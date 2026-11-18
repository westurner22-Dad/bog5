// Class rules. Level tables, trait text and feature names are parsed from SRD 5.2.1 (srd/data/classes.json);
// this file adds the mechanics the engine needs and states, per feature, how far the engine models it.
import SRD from '../../srd/data/srd.js';
import { SKILLS } from './origins.js';
const AB = { strength: 'str', dexterity: 'dex', constitution: 'con', intelligence: 'int', wisdom: 'wis', charisma: 'cha' };
const slugSkill = s => s.toLowerCase().replace(/[’']/g, '').replace(/[^a-z]+/g, '_').replace(/^_|_$/g, '');

const CASTER = {
  bard: { ability: 'cha', type: 'full', prepares: 'levelup' }, cleric: { ability: 'wis', type: 'full', prepares: 'long_rest' },
  druid: { ability: 'wis', type: 'full', prepares: 'long_rest' }, paladin: { ability: 'cha', type: 'half', prepares: 'long_rest' },
  ranger: { ability: 'wis', type: 'half', prepares: 'long_rest' }, sorcerer: { ability: 'cha', type: 'full', prepares: 'levelup' },
  warlock: { ability: 'cha', type: 'pact', prepares: 'levelup' }, wizard: { ability: 'int', type: 'full', prepares: 'long_rest', spellbook: true },
};
const SUBCLASS_ID = { barbarian: 'berserker', bard: 'lore', cleric: 'life', druid: 'land', fighter: 'champion', monk: 'open_hand', paladin: 'devotion', ranger: 'hunter', rogue: 'thief', sorcerer: 'draconic', warlock: 'fiend', wizard: 'evoker' };

// How each feature (levels 1-8, plus a few later ones) is handled. engine = rolls/numbers automated;
// tracked = uses/limits tracked, effect applied by a GM ruling; gm = narrative only.
export const FEATURE_SUPPORT = {
  // engine = rolled/applied automatically; tracked = uses/limits on the sheet, effect applied by a GM ruling; gm = narrative only
  rage: 'engine', unarmored_defense: 'engine', weapon_mastery: 'engine', danger_sense: 'engine', reckless_attack: 'engine', primal_knowledge: 'tracked',
  frenzy: 'engine', mindless_rage: 'gm', extra_attack: 'engine', fast_movement: 'engine', feral_instinct: 'engine', instinctive_pounce: 'gm',
  bardic_inspiration: 'engine', spellcasting: 'engine', expertise: 'engine', jack_of_all_trades: 'engine', bonus_proficiencies: 'engine', cutting_words: 'tracked',
  font_of_inspiration: 'engine', magical_discoveries: 'tracked', countercharm: 'gm',
  divine_order: 'engine', channel_divinity: 'engine', disciple_of_life: 'engine', life_domain_spells: 'engine', preserve_life: 'engine', sear_undead: 'tracked',
  blessed_healer: 'tracked', blessed_strikes: 'engine',
  druidic: 'gm', primal_order: 'engine', wild_shape: 'tracked', wild_companion: 'tracked', circle_of_the_land_spells: 'engine', lands_aid: 'tracked',
  wild_resurgence: 'tracked', natural_recovery: 'tracked', elemental_fury: 'tracked',
  fighting_style: 'engine', second_wind: 'engine', action_surge: 'engine', tactical_mind: 'tracked', improved_critical: 'engine',
  remarkable_athlete: 'gm', tactical_shift: 'gm', additional_fighting_style: 'tracked',
  martial_arts: 'engine', monks_focus: 'engine', unarmored_movement: 'engine', uncanny_metabolism: 'tracked', deflect_attacks: 'engine', open_hand_technique: 'tracked',
  slow_fall: 'gm', stunning_strike: 'engine', empowered_strikes: 'gm', wholeness_of_body: 'tracked', evasion: 'engine',
  lay_on_hands: 'engine', paladins_smite: 'engine', oath_of_devotion_spells: 'engine', sacred_weapon: 'engine', faithful_steed: 'tracked',
  aura_of_protection: 'engine', aura_of_devotion: 'gm',
  favored_enemy: 'engine', deft_explorer: 'engine', hunters_lore: 'gm', hunters_prey: 'engine', roving: 'engine', defensive_tactics: 'tracked',
  sneak_attack: 'engine', thieves_cant: 'gm', cunning_action: 'engine', steady_aim: 'engine', fast_hands: 'tracked', second_story_work: 'gm', cunning_strike: 'tracked',
  uncanny_dodge: 'engine', reliable_talent: 'engine',
  innate_sorcery: 'engine', font_of_magic: 'tracked', metamagic: 'tracked', draconic_resilience: 'engine', draconic_spells: 'engine', sorcerous_restoration: 'tracked',
  elemental_affinity: 'engine', sorcery_incarnate: 'tracked',
  eldritch_invocations: 'tracked', pact_magic: 'engine', magical_cunning: 'tracked', dark_ones_blessing: 'engine', fiend_spells: 'engine', dark_ones_own_luck: 'tracked',
  ritual_adept: 'tracked', arcane_recovery: 'engine', scholar: 'tracked', evocation_savant: 'engine', potent_cantrip: 'engine', memorize_spell: 'tracked', sculpt_spells: 'gm',
  ability_score_improvement: 'engine', epic_boon: 'tracked',
};

function parseClass(id) {
  const raw = SRD.classes[id]; const t = raw.traits;
  const sk = t.skill_proficiencies.match(/Choose (any )?(\d)/); const n = +sk[2];
  const from = sk[1] ? Object.keys(SKILLS) : t.skill_proficiencies.split(':')[1].replace(/\bor\b/g, '').split(',').map(slugSkill).filter(Boolean);
  const wp = t.weapon_proficiencies;
  const levelOf = name => raw.levels.filter(l => String(l.class_features).includes(name)).map(l => l.level);
  const subFeat = raw.subclass.features.map(f => ({ ...f, sub: true }));
  return {
    id, name: raw.name, hd: +t.hit_point_die.match(/D(\d+)/)[1],
    saves: t.saving_throw_proficiencies.toLowerCase().split(' and ').map(s => AB[s.trim()]),
    skillChoice: { n, from },
    weapons: { simple: true, martial: /Martial weapons/.test(wp) && !/that have/.test(wp), martialIf: /Light property/.test(wp) && !/Finesse/.test(wp) ? ['light'] : /Finesse or Light/.test(wp) ? ['finesse', 'light'] : null },
    armor: t.armor_training === 'None' ? [] : [...(/Light/.test(t.armor_training) ? ['light'] : []), ...(/Medium/.test(t.armor_training) ? ['medium'] : []), ...(/Heavy/.test(t.armor_training) ? ['heavy'] : []), ...(/Shields/.test(t.armor_training) ? ['shield'] : [])],
    caster: CASTER[id] || null, subclass: { id: SUBCLASS_ID[id], name: raw.subclass.name, spells: raw.subclass.spells },
    asiLevels: levelOf('Ability Score Improvement'), extraAttack: id === 'fighter' ? { 5: 2, 11: 3, 20: 4 } : levelOf('Extra Attack').length ? { 5: 2 } : {},
    levels: raw.levels, features: [...raw.features, ...subFeat].sort((a, b) => a.level - b.level),
  };
}
export const CLASSES = Object.fromEntries(Object.keys(SRD.classes).map(id => [id, parseClass(id)]));

export const row = (cls, level) => CLASSES[cls].levels[level - 1];
export const PB = level => Math.ceil(level / 4) + 1;
export const XP_TABLE = [0, 300, 900, 2700, 6500, 14000, 23000, 34000, 48000, 64000, 85000, 100000, 120000, 140000, 165000, 195000, 225000, 265000, 305000, 355000];
export const levelForXp = xp => { let l = 1; while (l < 20 && xp >= XP_TABLE[l]) l++; return l; };
export const XP_BY_CR = { '0': 10, '1/8': 25, '1/4': 50, '1/2': 100, '1': 200, '2': 450, '3': 700, '4': 1100, '5': 1800, '6': 2300, '7': 2900, '8': 3900, '9': 5000, '10': 5900, '11': 7200, '12': 8400, '13': 10000, '14': 11500, '15': 13000, '16': 15000, '17': 18000, '18': 20000, '19': 22000, '20': 25000 };

export function slotsFor(cls, level) {
  const r = row(cls, level); const c = CLASSES[cls].caster; if (!c) return { slots: [], pact: null };
  if (c.type === 'pact') return { slots: [], pact: { count: r.spell_slots, level: r.slot_level } };
  const slots = []; for (let i = 1; i <= 9; i++) slots.push(+r['slot' + i] || 0);
  while (slots.length && !slots[slots.length - 1]) slots.pop(); return { slots, pact: null };
}
export const cantripsKnown = (cls, level, ch) => (+row(cls, level).cantrips || 0) + (cls === 'cleric' && ch?.choices?.divine_order === 'thaumaturge' ? 1 : 0) + (cls === 'druid' && ch?.choices?.primal_order === 'magician' ? 1 : 0);
export const preparedMax = (cls, level) => +row(cls, level).prepared_spells || 0;
export function weaponMasteryCount(cls, level) { const r = row(cls, level); return +r.weapon_mastery || (cls === 'paladin' || cls === 'ranger' || cls === 'rogue' ? 2 : 0); }

// Class resources: {id: {max, reset: 'short'|'long'|'special'}}
export function classResources(ch, mods, level) {
  const c = ch.cls, r = row(c, level), out = {}, pb = PB(level);
  const add = (id, max, reset, extra = {}) => { if (max > 0) out[id] = { max, reset, ...extra }; };
  if (c === 'barbarian') add('rage', r.rages, 'long', { shortRegain: 1, damage: r.rage_damage });
  if (c === 'bard') add('bardic_inspiration', Math.max(1, mods.cha), level >= 5 ? 'short' : 'long', { die: String(r.bardic_die).toLowerCase() });
  if (c === 'cleric' && level >= 2) add('channel_divinity', r.channel_divinity, 'long', { shortRegain: 1 });
  if (c === 'paladin' && level >= 3) add('channel_divinity', r.channel_divinity, 'long', { shortRegain: 1 });
  if (c === 'paladin') { add('lay_on_hands', 5 * level, 'long', { pool: true }); if (level >= 2) add('free_smite', 1, 'long'); }
  if (c === 'druid' && level >= 2) add('wild_shape', r.wild_shape, 'long', { shortRegain: 1 });
  if (c === 'fighter') { add('second_wind', r.second_wind, 'long', { shortRegain: 1 }); if (level >= 2) add('action_surge', level >= 17 ? 2 : 1, 'short'); }
  if (c === 'monk' && level >= 2) add('focus', r.focus_points, 'short');
  if (c === 'ranger') add('favored_enemy', r.favored_enemy, 'long');
  if (c === 'sorcerer') { add('innate_sorcery', 2, 'long'); if (level >= 2) add('sorcery_points', r.sorcery_points, 'long'); }
  if (c === 'wizard') add('arcane_recovery', 1, 'long');
  if (c === 'warlock' && level >= 2) add('magical_cunning', 1, 'long');
  return out;
}
export const martialArtsDie = level => String(row('monk', level).martial_arts);
export const sneakDice = level => String(row('rogue', level).sneak_attack);
