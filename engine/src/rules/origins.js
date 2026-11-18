// Species, backgrounds and feats from SRD 5.2.1 "Character Origins" and "Feats" (CC-BY-4.0).
// Only mechanical fields the engine uses; flavor text lives in the SRD source.
export const ABILITIES = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
export const SKILLS = {
  acrobatics: 'dex', animal_handling: 'wis', arcana: 'int', athletics: 'str', deception: 'cha', history: 'int', insight: 'wis',
  intimidation: 'cha', investigation: 'int', medicine: 'wis', nature: 'int', perception: 'wis', performance: 'cha', persuasion: 'cha',
  religion: 'int', sleight_of_hand: 'dex', stealth: 'dex', survival: 'wis',
};
export const DAMAGE_TYPES = ['acid', 'bludgeoning', 'cold', 'fire', 'force', 'lightning', 'necrotic', 'piercing', 'poison', 'psychic', 'radiant', 'slashing', 'thunder'];

export const SPECIES = {
  dragonborn: { name: 'Dragonborn', size: ['medium'], speed: 30, darkvision: 60,
    choices: { ancestry: ['black:acid', 'blue:lightning', 'brass:fire', 'bronze:lightning', 'copper:acid', 'gold:fire', 'green:poison', 'red:fire', 'silver:cold', 'white:cold'] },
    resist: c => [c.ancestry.split(':')[1]],
    resources: (lvl, pb) => ({ breath_weapon: { max: pb, reset: 'long' } }),
    traits: ['Draconic Ancestry', 'Breath Weapon', 'Damage Resistance', 'Darkvision', 'Draconic Flight (level 5)'] },
  // HOUSE RULE (Wes, Nov 10 2026): Aasimar is NOT in SRD 5.2.1. Our own wording and numbers, balanced against the SRD species
  // (see engine/HOUSE_RULES.md). Fields mirror the SRD species so the sheet, combat and rests treat it the same way.
  aasimar: { name: 'Aasimar', houseRule: true, size: ['medium', 'small'], speed: 30, darkvision: 60,
    resist: () => ['necrotic', 'radiant'], cantrip: 'light', spellAbility: 'cha',
    resources: (lvl, pb) => ({ healing_hands: { max: 1, reset: 'long' }, ...(lvl >= 3 ? { celestial_revelation: { max: 1, reset: 'long' } } : {}) }),
    traits: ['Darkvision 60 ft', 'Celestial Resistance (radiant, necrotic)', 'Healing Hands', 'Light Bearer', 'Celestial Revelation (level 3)'] },
  dwarf: { name: 'Dwarf', size: ['medium'], speed: 30, darkvision: 120, resist: () => ['poison'], hpPerLevel: 1,
    saveAdvVs: ['poisoned'], resources: (lvl, pb) => ({ stonecunning: { max: pb, reset: 'long' } }),
    traits: ['Darkvision 120 ft', 'Dwarven Resilience', 'Dwarven Toughness', 'Stonecunning'] },
  elf: { name: 'Elf', size: ['medium'], speed: 30, darkvision: 60,
    choices: { lineage: ['drow', 'high', 'wood'], keen_senses: ['insight', 'perception', 'survival'], spell_ability: ['int', 'wis', 'cha'] },
    lineage: { drow: { darkvision: 120, cantrip: 'dancing_lights', spells: { 3: 'faerie_fire', 5: 'darkness' } },
               high: { cantrip: 'prestidigitation', spells: { 3: 'detect_magic', 5: 'misty_step' } },
               wood: { speed: 35, cantrip: 'druidcraft', spells: { 3: 'longstrider', 5: 'pass_without_trace' } } },
    skillFrom: c => [c.keen_senses], saveAdvVs: ['charmed'],
    traits: ['Darkvision', 'Elven Lineage', 'Fey Ancestry', 'Keen Senses', 'Trance'] },
  gnome: { name: 'Gnome', size: ['small'], speed: 30, darkvision: 60, choices: { lineage: ['forest', 'rock'], spell_ability: ['int', 'wis', 'cha'] },
    saveAdvAbilities: ['int', 'wis', 'cha'], traits: ['Darkvision', 'Gnomish Cunning', 'Gnomish Lineage'] },
  goliath: { name: 'Goliath', size: ['medium'], speed: 35, choices: { giant: ['cloud', 'fire', 'frost', 'hill', 'stone', 'storm'] },
    resources: (lvl, pb) => ({ giant_ancestry: { max: pb, reset: 'long' } }), carryAsSize: 'large',
    onHit: c => ({ fire: { dice: '1d10', type: 'fire', res: 'giant_ancestry' }, frost: { dice: '1d6', type: 'cold', res: 'giant_ancestry' } }[c.giant] || null),
    traits: ['Giant Ancestry', 'Large Form (level 5)', 'Powerful Build'] },
  halfling: { name: 'Halfling', size: ['small'], speed: 30, luck: true, saveAdvVs: ['frightened'],
    traits: ['Brave', 'Halfling Nimbleness', 'Luck', 'Naturally Stealthy'] },
  human: { name: 'Human', size: ['medium', 'small'], speed: 30, choices: { skillful: Object.keys(SKILLS), versatile_feat: ['alert', 'magic_initiate', 'savage_attacker', 'skilled'] },
    skillFrom: c => [c.skillful], featFrom: c => [c.versatile_feat], inspirationOnLongRest: true,
    traits: ['Resourceful', 'Skillful', 'Versatile'] },
  orc: { name: 'Orc', size: ['medium'], speed: 30, darkvision: 120, relentless: true,
    resources: (lvl, pb) => ({ adrenaline_rush: { max: pb, reset: 'short' }, relentless_endurance: { max: 1, reset: 'long' } }),
    traits: ['Adrenaline Rush', 'Darkvision 120 ft', 'Relentless Endurance'] },
  tiefling: { name: 'Tiefling', size: ['medium', 'small'], speed: 30, darkvision: 60, choices: { legacy: ['abyssal', 'chthonic', 'infernal'], spell_ability: ['int', 'wis', 'cha'] },
    legacy: { abyssal: { resist: 'poison', cantrip: 'poison_spray', spells: { 3: 'ray_of_sickness', 5: 'hold_person' } },
              chthonic: { resist: 'necrotic', cantrip: 'chill_touch', spells: { 3: 'false_life', 5: 'ray_of_enfeeblement' } },
              infernal: { resist: 'fire', cantrip: 'fire_bolt', spells: { 3: 'hellish_rebuke', 5: 'darkness' } } },
    resist: c => [SPECIES.tiefling.legacy[c.legacy].resist], traits: ['Darkvision', 'Fiendish Legacy', 'Otherworldly Presence'] },
};

export const BACKGROUNDS = {
  acolyte: { name: 'Acolyte', abilities: ['int', 'wis', 'cha'], feat: { id: 'magic_initiate', list: 'cleric' }, skills: ['insight', 'religion'], tool: "Calligrapher's Supplies",
    equipment: { A: [['calligraphers_supplies', 1], ['book', 1], ['holy_symbol', 1], ['parchment', 10], ['robe', 1]], gpA: 8, gpB: 50 } },
  criminal: { name: 'Criminal', abilities: ['dex', 'con', 'int'], feat: { id: 'alert' }, skills: ['sleight_of_hand', 'stealth'], tool: "Thieves' Tools",
    equipment: { A: [['dagger', 2], ['thieves_tools', 1], ['crowbar', 1], ['pouch', 2], ['travelers_clothes', 1]], gpA: 16, gpB: 50 } },
  sage: { name: 'Sage', abilities: ['con', 'int', 'wis'], feat: { id: 'magic_initiate', list: 'wizard' }, skills: ['arcana', 'history'], tool: "Calligrapher's Supplies",
    equipment: { A: [['quarterstaff', 1], ['calligraphers_supplies', 1], ['book', 1], ['parchment', 8], ['robe', 1]], gpA: 8, gpB: 50 } },
  soldier: { name: 'Soldier', abilities: ['str', 'dex', 'con'], feat: { id: 'savage_attacker' }, skills: ['athletics', 'intimidation'], tool: 'Gaming Set',
    equipment: { A: [['spear', 1], ['shortbow', 1], ['arrows', 20], ['gaming_set', 1], ['healers_kit', 1], ['quiver', 1], ['travelers_clothes', 1]], gpA: 14, gpB: 50 } },
};

export const FEATS = {
  alert: { name: 'Alert', cat: 'origin', initiativePB: true },
  magic_initiate: { name: 'Magic Initiate', cat: 'origin', repeatable: true, grants: { cantrips: 2, level1: 1 } },
  savage_attacker: { name: 'Savage Attacker', cat: 'origin', savage: true },
  skilled: { name: 'Skilled', cat: 'origin', repeatable: true, grants: { skills: 3 } },
  ability_score_improvement: { name: 'Ability Score Improvement', cat: 'general' },
  grappler: { name: 'Grappler', cat: 'general', prereq: { level: 4, str_or_dex: 13 }, asi: ['str', 'dex'] },
  archery: { name: 'Archery', cat: 'fighting_style', rangedAttack: 2 },
  defense: { name: 'Defense', cat: 'fighting_style', armoredAC: 1 },
  great_weapon_fighting: { name: 'Great Weapon Fighting', cat: 'fighting_style', gwf: true },
  two_weapon_fighting: { name: 'Two-Weapon Fighting', cat: 'fighting_style', twf: true },
};

export const POINT_BUY = { 8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 7, 15: 9 };
export const STANDARD_ARRAY = [15, 14, 13, 12, 10, 8];
