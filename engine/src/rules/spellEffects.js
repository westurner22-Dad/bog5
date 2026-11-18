// Mechanical models for spells. Most damage/save/heal spells are modeled automatically from the SRD text
// (srd/data/spells.json "auto"); this file adds or corrects the ones that need special handling.
// kinds: attack | save | heal | auto_hit | buff | debuff | utility(gm)
import SRD from '../../srd/data/srd.js';
const O = {
  magic_missile: { kind: 'auto_hit', darts: 3, dartsPerSlot: 1, dice: '1d4+1', type: 'force' },
  scorching_ray: { kind: 'attack', rays: 3, raysPerSlot: 1, dice: '2d6', type: 'fire' },
  eldritch_blast: { kind: 'attack', beamsAt: { 1: 1, 5: 2, 11: 3, 17: 4 }, dice: '1d10', type: 'force' },
  guiding_bolt: { kind: 'attack', dice: '4d6', type: 'radiant', upcast: '1d6', rider: 'guiding_bolt_adv' },
  sacred_flame: { kind: 'save', save: 'dex', dice: '1d8', type: 'radiant', half: false, cantrip: true },
  bless: { kind: 'buff', effect: 'bless', targets: 3, targetsPerSlot: 1, rounds: 10 },
  bane: { kind: 'debuff', save: 'cha', effect: 'bane', targets: 3, targetsPerSlot: 1, rounds: 10 },
  shield_of_faith: { kind: 'buff', effect: 'shield_of_faith', targets: 1, rounds: 100 },
  shield: { kind: 'buff', effect: 'shield_spell', self: true, reaction: true, rounds: 1 },
  mage_armor: { kind: 'buff', effect: 'mage_armor', targets: 1, rounds: 4800 },
  hunters_mark: { kind: 'buff', effect: 'hunters_mark', self: true, rounds: 600, bonusAction: true },
  hex: { kind: 'buff', effect: 'hex', self: true, rounds: 600, bonusAction: true },
  divine_smite: { kind: 'smite', dice: '2d8', type: 'radiant', upcast: '1d8', extraVs: ['Fiend', 'Undead'], extra: '1d8', bonusAction: true },
  searing_smite: { kind: 'smite', dice: '1d6', type: 'fire', upcast: '1d6', bonusAction: true },
  healing_word: { kind: 'heal', dice: '2d4', upcast: '2d4', addMod: true, bonusAction: true, range: 60 },
  cure_wounds: { kind: 'heal', dice: '2d8', upcast: '2d8', addMod: true, touch: true },
  mass_healing_word: { kind: 'heal', dice: '2d4', upcast: '1d4', addMod: true, targets: 6, bonusAction: true },
  mass_cure_wounds: { kind: 'heal', dice: '5d8', upcast: '1d8', addMod: true, targets: 6 },
  prayer_of_healing: { kind: 'heal', dice: '2d8', upcast: '1d8', addMod: true, targets: 5, outOfCombat: true },
  aid: { kind: 'buff', effect: 'aid', targets: 3, maxHp: 5, maxHpPerSlot: 5, rounds: 4800 },
  heroism: { kind: 'buff', effect: 'heroism', targets: 1, rounds: 10 },
  false_life: { kind: 'buff', effect: 'false_life', self: true, temp: '2d4+4', tempUp: 5 },
  spiritual_weapon: { kind: 'summon_attack', dice: '1d8', type: 'force', upcast: '1d8', bonusAction: true },
  spirit_guardians: { kind: 'aura', save: 'wis', dice: '3d8', type: 'radiant', upcast: '1d8', half: true },
  hold_person: { kind: 'debuff', save: 'wis', condition: 'paralyzed', repeatSave: true, targets: 1, targetsPerSlot: 1 },
  command: { kind: 'debuff', save: 'wis', condition: 'prone', targets: 1, targetsPerSlot: 1 },
  sleep: { kind: 'debuff', save: 'wis', condition: 'incapacitated', thenCondition: 'unconscious', repeatSave: true },
  faerie_fire: { kind: 'debuff', save: 'dex', effect: 'faerie_fire' },
  entangle: { kind: 'debuff', save: 'str', condition: 'restrained', repeatSave: true },
  web: { kind: 'debuff', save: 'dex', condition: 'restrained', repeatSave: true },
  dragons_breath: { kind: 'buff', effect: 'dragons_breath', targets: 1, dice: '3d6', upcast: '1d6', save: 'dex' },
  revivify: { kind: 'revive', within: 'minute', cost: 30000, hp: 1 },
  raise_dead: { kind: 'revive', within: '10days', cost: 50000, hp: 'full', penalty: -4 },
  lesser_restoration: { kind: 'cure', removes: ['blinded', 'deafened', 'paralyzed', 'poisoned'] },
  greater_restoration: { kind: 'cure', removes: ['charmed', 'petrified', 'exhaustion1'] },
  misty_step: { kind: 'utility', bonusAction: true, teleport: 30 },
  thunderwave: { kind: 'save', save: 'con', dice: '2d8', type: 'thunder', upcast: '1d8', half: true, push: 10 },
  burning_hands: { kind: 'save', save: 'dex', dice: '3d6', type: 'fire', upcast: '1d6', half: true },
  ice_knife: { kind: 'attack', dice: '1d10', type: 'piercing', then: { save: 'dex', dice: '2d6', type: 'cold', upcast: '1d6' } },
  chromatic_orb: { kind: 'attack', dice: '3d8', type: 'fire', upcast: '1d8', chooseType: ['acid', 'cold', 'fire', 'lightning', 'poison', 'thunder'] },
  guidance: { kind: 'buff', effect: 'guidance', targets: 1, rounds: 10 },
};
export function spellModel(id) {
  const s = SRD.spells[id]; if (!s) return null; const a = s.auto || {}; const o = O[id];
  if (o) return { ...o, id, level: s.level, concentration: s.concentration, ritual: s.ritual, source: 'override' };
  if (a.heal) return { id, kind: 'heal', dice: a.heal, upcast: a.upcast?.dice, addMod: a.healAddsMod, level: s.level, concentration: s.concentration, source: 'auto' };
  if (a.damage && a.attack) return { id, kind: 'attack', dice: a.damage.dice, type: a.damage.type, upcast: a.upcast?.dice, cantrip: !!a.cantrip, cantripDice: a.cantrip, level: s.level, concentration: s.concentration, source: 'auto' };
  if (a.damage && a.save) return { id, kind: 'save', save: a.save, dice: a.damage.dice, type: a.damage.type, half: a.half, upcast: a.upcast?.dice, cantrip: !!a.cantrip, cantripDice: a.cantrip, level: s.level, concentration: s.concentration, source: 'auto' };
  return { id, kind: 'gm', level: s.level, concentration: s.concentration, ritual: s.ritual, source: 'gm' };
}
export function spellCoverage() {
  const by = { override: 0, auto: 0, gm: 0 }; const byLevel = {};
  for (const id of Object.keys(SRD.spells)) { const m = spellModel(id); by[m.source]++; const L = m.level; byLevel[L] = byLevel[L] || { modeled: 0, gm: 0 }; byLevel[L][m.source === 'gm' ? 'gm' : 'modeled']++; }
  return { total: Object.keys(SRD.spells).length, ...by, byLevel };
}
// cantrip damage dice by character level (SRD Cantrip Upgrade at 5, 11, 17)
export function cantripDice(model, charLevel) {
  const tier = charLevel >= 17 ? 3 : charLevel >= 11 ? 2 : charLevel >= 5 ? 1 : 0;
  if (model.cantripDice && model.cantripDice[tier]) return model.cantripDice[tier];
  const m = String(model.dice).match(/^(\d+)d(\d+)(.*)$/); return m ? `${+m[1] * (tier + 1)}d${m[2]}${m[3]}` : model.dice;
}
