// BoG V rules engine (headless). SRD 5.2.1 content, CC-BY-4.0 — see srd/ATTRIBUTION.md.
export { Game, rebuild, emptyState, applyEvent } from './game.js';
export { Dice, commit, verifyCommit, parseDice, avgDice } from './dice.js';
export { createCharacter, deriveSheet, makeItem, RuleError } from './character.js';
export * as actions from './actions.js';
export { startEncounter, resolveBattle, pauseAtCutoff, endEncounter, STOP, STANCES } from './combat.js';
export { monsterTemplate, MONSTERS } from './monsters.js';
export { ITEMS, RESKINS, itemDef } from './rules/items.js';
export { CLASSES, XP_TABLE, levelForXp, XP_BY_CR, FEATURE_SUPPORT } from './rules/classes.js';
export { SPECIES, BACKGROUNDS, FEATS } from './rules/origins.js';
export { spellModel, spellCoverage } from './rules/spellEffects.js';
export { CONDITIONS } from './rules/conditions.js';
// Phase 2: the Forge (guided level-3 builder) and starting equipment
export * as forge from './forge.js';
export { classGearOptions, backgroundGearOptions, startingInventory, starterShop, PACKS } from './startingGear.js';
export { POINT_BUY, STANDARD_ARRAY, ABILITIES, SKILLS } from './rules/origins.js';
export { classSpellList } from './character.js';
