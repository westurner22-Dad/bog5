// quickBuild: a legal SRD 5.2.1 character spec for any class at any level (used by tests, sims and the
// "party-gap hint" pre-fill). Players normally build their own; this just picks sensible defaults.
import { CLASSES, slotsFor, cantripsKnown, preparedMax, weaponMasteryCount } from './rules/classes.js';
import { spellModel } from './rules/spellEffects.js';
import { STANDARD_ARRAY } from './rules/origins.js';
import SRD from '../srd/data/srd.js';
const PRI = { barbarian: ['str', 'con', 'dex'], bard: ['cha', 'dex', 'con'], cleric: ['wis', 'con', 'str'], druid: ['wis', 'con', 'dex'], fighter: ['str', 'con', 'dex'], monk: ['dex', 'wis', 'con'],
  paladin: ['str', 'cha', 'con'], ranger: ['dex', 'wis', 'con'], rogue: ['dex', 'con', 'wis'], sorcerer: ['cha', 'con', 'dex'], warlock: ['cha', 'con', 'dex'], wizard: ['int', 'con', 'dex'] };
const BG = { str: ['soldier', { str: 2, con: 1 }], dex: ['criminal', { dex: 2, con: 1 }], int: ['sage', { int: 2, con: 1 }], wis: ['sage', { wis: 2, con: 1 }], cha: ['acolyte', { cha: 2, wis: 1 }] };
const KIT = {
  barbarian: [['greataxe', 'main'], ['handaxe', null, 4]], bard: [['leather_armor', 'armor'], ['dagger', 'main']], cleric: [['chain_mail', 'armor'], ['shield', 'off'], ['mace', 'main'], ['holy_symbol', 'neck']],
  druid: [['leather_armor', 'armor'], ['shield', 'off'], ['quarterstaff', 'main']], fighter: [['chain_mail', 'armor'], ['greatsword', 'main'], ['longbow', 'ranged'], ['arrows', null, 20]], monk: [['shortsword', 'main']],
  paladin: [['chain_mail', 'armor'], ['shield', 'off'], ['longsword', 'main'], ['javelin', null, 5]], ranger: [['studded_leather_armor', 'armor'], ['longbow', 'ranged'], ['shortsword', 'main'], ['arrows', null, 40]],
  rogue: [['leather_armor', 'armor'], ['rapier', 'main'], ['shortbow', 'ranged'], ['arrows', null, 20]], sorcerer: [['dagger', 'main'], ['arcane_focus', null]], warlock: [['leather_armor', 'armor'], ['dagger', 'main']], wizard: [['quarterstaff', 'main']],
};
const MAST = { barbarian: ['greataxe', 'handaxe'], fighter: ['greatsword', 'longbow', 'javelin'], paladin: ['longsword', 'javelin'], ranger: ['longbow', 'shortsword'], rogue: ['rapier', 'shortbow'] };
const FAV = ['fire_bolt', 'eldritch_blast', 'sacred_flame', 'vicious_mockery', 'shillelagh', 'produce_flame', 'ray_of_frost', 'toll_the_dead', 'starry_wisp', 'sorcerous_burst', 'guidance', 'light', 'prestidigitation', 'thaumaturgy', 'druidcraft', 'mage_hand', 'minor_illusion', 'spare_the_dying', 'resistance', 'chill_touch', 'shocking_grasp', 'poison_spray', 'thorn_whip'];
const FAVS = ['bless', 'cure_wounds', 'healing_word', 'shield', 'magic_missile', 'guiding_bolt', 'hunters_mark', 'hex', 'shield_of_faith', 'burning_hands', 'thunderwave', 'sleep', 'faerie_fire', 'heroism', 'command', 'mage_armor', 'spiritual_weapon', 'scorching_ray', 'hold_person', 'aid', 'misty_step', 'lesser_restoration', 'fireball', 'lightning_bolt', 'spirit_guardians', 'revivify', 'mass_healing_word', 'dispel_magic', 'counterspell', 'haste', 'fly', 'ice_storm', 'polymorph', 'banishment', 'greater_invisibility', 'death_ward'];
const list = cls => Object.values(SRD.spells).filter(s => s.classes.includes(cls));
const rank = (ids, fav) => [...ids].sort((a, b) => (fav.indexOf(a) + 1 || 999) - (fav.indexOf(b) + 1 || 999) || (spellModel(a).source === 'gm') - (spellModel(b).source === 'gm') || (a < b ? -1 : 1));
export function quickBuild(cls, level = 3, { id, name, species = 'human', items = [] } = {}) {
  const C = CLASSES[cls]; const pri = PRI[cls]; const order = [...pri, ...['str', 'dex', 'con', 'int', 'wis', 'cha'].filter(a => !pri.includes(a))];
  const scores = Object.fromEntries(order.map((a, i) => [a, STANDARD_ARRAY[i]])); const [bg, bonus] = BG[pri[0]];
  const cur = { ...scores }; for (const [k, v] of Object.entries(bonus)) cur[k] += v;
  const asi = {}; for (const L of C.asiLevels.filter(l => l <= level)) { const a = pri.find(x => cur[x] <= 18) || pri[0]; if (cur[a] <= 18) { asi[L] = { [a]: 2 }; cur[a] += 2; } else { const b = order.filter(x => cur[x] < 20).slice(0, 2); asi[L] = { [b[0]]: 1, [b[1]]: 1 }; cur[b[0]]++; cur[b[1]]++; } }
  const spec = { id: id || `${cls}${level}`, name: name || `${C.name} ${level}`, level, cls, species, background: bg, method: 'array', scores, bgBonus: bonus, asi,
    skills: C.skillChoice.from.slice(0, C.skillChoice.n), speciesChoices: species === 'human' ? { skillful: 'perception', versatile_feat: 'alert' } : {}, coin: 5000,
    inventory: [...KIT[cls].map(([i, slot, qty]) => ({ id: i, slot, qty: qty || 1 })), { id: 'rations', qty: 3 }, { id: 'waterskin', pints: 4 }, { id: 'torch', qty: 2 }, { id: 'potion_of_healing', qty: 1 }, ...items] };
  if (spec.skills.includes('perception') && species === 'human') spec.speciesChoices.skillful = 'stealth';
  if (cls === 'fighter') spec.fightingStyle = 'great_weapon_fighting'; if (cls === 'paladin' && level >= 2) spec.fightingStyle = 'defense'; if (cls === 'ranger' && level >= 2) spec.fightingStyle = 'archery';
  if (MAST[cls]) spec.masteries = MAST[cls].slice(0, weaponMasteryCount(cls, level));
  if (cls === 'cleric') spec.divineOrder = 'protector'; if (cls === 'druid') spec.primalOrder = 'warden'; if (cls === 'sorcerer') spec.dragon = 'red:fire';
  if (level >= 3) spec.subclass = C.subclass.id;
  if (cls === 'rogue') spec.expertise = ['stealth', spec.skills[0]];
  if (bg === 'sage' || bg === 'acolyte') { const L = bg === 'sage' ? 'wizard' : 'cleric'; const ids = list(L); spec.magicInitiate = { cantrips: rank(ids.filter(s => s.level === 0).map(s => s.id), FAV).slice(0, 2), spell: rank(ids.filter(s => s.level === 1).map(s => s.id), FAVS)[0], ability: pri[0] === 'int' ? 'int' : pri[0] === 'cha' ? 'cha' : 'wis' }; }
  if (C.caster) {
    const { slots, pact } = slotsFor(cls, level); const max = pact ? pact.level : slots.length; const ids = list(cls);
    spec.cantrips = rank(ids.filter(s => s.level === 0).map(s => s.id), FAV).filter(x => !spec.magicInitiate?.cantrips.includes(x)).slice(0, cantripsKnown(cls, level, { choices: {} }));
    const pool = rank(ids.filter(s => s.level >= 1 && s.level <= max).map(s => s.id), FAVS);
    if (cls === 'wizard') { spec.spellbook = pool.slice(0, 6 + 2 * (level - 1)); spec.prepared = spec.spellbook.slice(0, preparedMax(cls, level)); }
    else spec.prepared = pool.filter(x => !(cls === 'ranger' && x === 'hunters_mark') && !Object.entries(C.subclass.spells).some(([l, s]) => level >= +l && s.includes(x))).slice(0, preparedMax(cls, level));
  }
  return spec;
}
