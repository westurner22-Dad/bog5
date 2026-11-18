// Item catalogue: SRD 5.2.1 weapons/armor/gear (parsed) + magic-item mechanics the engine applies.
// Values: SRD equipment table costs; magic items at SRD "Magic Item Rarities and Values" (consumables other than
// Spell Scrolls at half; Spell Scroll = 2x scribing cost). Costs are in copper pieces.
import SRD from '../../srd/data/srd.js';
export const RARITY_VALUE = { common: 10000, uncommon: 40000, rare: 400000, very_rare: 4000000, legendary: 20000000 };
export const SCROLL_VALUE = [3000, 5000, 20000, 30000, 200000, 300000, 2000000, 2500000, 3000000, 10000000]; // 2x scribe cost by level 0..9
const R = r => r.toLowerCase().replace(' ', '_');

const base = {};
for (const w of Object.values(SRD.weapons)) base[w.id] = { kind: 'weapon', ...w };
for (const a of Object.values(SRD.armor)) base[a.id] = { kind: a.category === 'shield' ? 'shield' : 'armor', ...a, armorType: a.category };
for (const g of Object.values(SRD.gear)) if (!base[g.id]) base[g.id] = { kind: 'gear', ...g };
// gear the engine treats specially
Object.assign(base, {
  rations: { ...base.rations, kind: 'supply', supply: 'food', perUnitDays: 1 },
  waterskin: { ...base.waterskin, kind: 'supply', supply: 'water', capacityPints: 4 },
  torch: { ...base.torch, kind: 'supply', supply: 'light', burnHours: 1 },
  arrows: { id: 'arrows', name: 'Arrow', kind: 'ammo', ammo: 'arrow', weight: 0.05, cost: 5 },
  bolts: { id: 'bolts', name: 'Bolt', kind: 'ammo', ammo: 'bolt', weight: 0.075, cost: 5 },
  sling_bullets: { id: 'sling_bullets', name: 'Sling Bullet', kind: 'ammo', ammo: 'bullet', weight: 0.075, cost: 0.2 },
  firearm_bullets: { id: 'firearm_bullets', name: 'Firearm Bullet', kind: 'ammo', ammo: 'firearm', weight: 0.2, cost: 30 },
  needles: { id: 'needles', name: 'Blowgun Needle', kind: 'ammo', ammo: 'needle', weight: 0.02, cost: 2 },
  potion_of_healing: { id: 'potion_of_healing', name: 'Potion of Healing', kind: 'consumable', weight: 0.5, cost: 5000, use: { heal: '2d4+2', action: 'bonus' }, rarity: 'common' },
  potion_of_healing_greater: { id: 'potion_of_healing_greater', name: 'Potion of Healing (greater)', kind: 'consumable', weight: 0.5, cost: RARITY_VALUE.uncommon / 2, use: { heal: '4d4+4', action: 'bonus' }, rarity: 'uncommon' },
  potion_of_healing_superior: { id: 'potion_of_healing_superior', name: 'Potion of Healing (superior)', kind: 'consumable', weight: 0.5, cost: RARITY_VALUE.rare / 2, use: { heal: '8d4+8', action: 'bonus' }, rarity: 'rare' },
  potion_of_healing_supreme: { id: 'potion_of_healing_supreme', name: 'Potion of Healing (supreme)', kind: 'consumable', weight: 0.5, cost: RARITY_VALUE.very_rare / 2, use: { heal: '10d4+20', action: 'bonus' }, rarity: 'very_rare' },
  healers_kit: { ...(base.healers_kit || { id: 'healers_kit', name: "Healer's Kit", weight: 3, cost: 500 }), kind: 'consumable', charges: 10, use: { stabilize: true, action: 'action' } },
  antitoxin: { ...(base.antitoxin || { id: 'antitoxin', name: 'Antitoxin', weight: 0, cost: 5000 }), kind: 'consumable', use: { effect: 'antitoxin', action: 'bonus' } },
  alchemists_fire: { ...(base.alchemists_fire || { id: 'alchemists_fire', name: "Alchemist's Fire", weight: 1, cost: 5000 }), kind: 'consumable', use: { throw: { save: 'dex', dcFrom: 'dex', dice: '1d4', type: 'fire', burning: true }, action: 'action' } },
  holy_water: { ...(base.holy_water || { id: 'holy_water', name: 'Holy Water', weight: 1, cost: 2500 }), kind: 'consumable', use: { throw: { save: 'dex', dcFrom: 'dex', dice: '2d8', type: 'radiant', only: ['Fiend', 'Undead'] }, action: 'action' } },
  holy_symbol: { id: 'holy_symbol', name: 'Holy Symbol', kind: 'focus', slot: 'neck', weight: 0, cost: 500 },
  arcane_focus: { id: 'arcane_focus', name: 'Arcane Focus (wand)', kind: 'focus', slot: 'main', weight: 1, cost: 1000 },
  // tools and kits named by SRD 5.2.1 starting equipment (Tools table costs/weights); no engine mechanics beyond carry weight
  thieves_tools: { id: 'thieves_tools', name: "Thieves' Tools", kind: 'tool', weight: 1, cost: 2500 },
  calligraphers_supplies: { id: 'calligraphers_supplies', name: "Calligrapher's Supplies", kind: 'tool', weight: 5, cost: 1000 },
  gaming_set: { id: 'gaming_set', name: 'Gaming Set (dice)', kind: 'tool', weight: 0, cost: 10 },
  herbalism_kit: { id: 'herbalism_kit', name: 'Herbalism Kit', kind: 'tool', weight: 3, cost: 500 },
  musical_instrument: { id: 'musical_instrument', name: 'Musical Instrument (lute)', kind: 'tool', weight: 2, cost: 3500 },
  artisans_tools: { id: 'artisans_tools', name: "Artisan's Tools (smith's)", kind: 'tool', weight: 8, cost: 2000 },
  spellbook: { id: 'spellbook', name: 'Spellbook', kind: 'gear', weight: 3, cost: 5000 },
  travelers_clothes: { ...(base.clothes_travelers || {}), id: 'travelers_clothes', name: "Traveler's Clothes", kind: 'gear' },
  // BoG V (Lock C5): a keepsake from the old life. Name is free text; no weight, no value, no mechanics.
  keepsake: { id: 'keepsake', name: 'Keepsake', kind: 'keepsake', weight: 0, cost: 0, noStats: true },
  diamond_300: { id: 'diamond_300', name: 'Diamond (300 GP)', kind: 'gear', weight: 0, cost: 30000 },
  diamond_500: { id: 'diamond_500', name: 'Diamond (500 GP)', kind: 'gear', weight: 0, cost: 50000 },
});
// magic items with mechanics. bonus: AC/save/attack/damage; setScore; resist; attune.
const MAGIC = {
  weapon_plus: { name: '+N Weapon', kind: 'weapon_plus' },
  armor_plus: { name: '+N Armor', kind: 'armor_plus' },
  shield_plus: { name: '+N Shield', kind: 'shield_plus' },
  ring_of_protection: { name: 'Ring of Protection', kind: 'wondrous', slot: 'ring', attune: true, rarity: 'rare', bonus: { ac: 1, saves: 1 } },
  cloak_of_protection: { name: 'Cloak of Protection', kind: 'wondrous', slot: 'cloak', attune: true, rarity: 'uncommon', bonus: { ac: 1, saves: 1 } },
  bracers_of_defense: { name: 'Bracers of Defense', kind: 'wondrous', slot: 'hands', attune: true, rarity: 'rare', bonus: { acUnarmored: 2 } },
  gauntlets_of_ogre_power: { name: 'Gauntlets of Ogre Power', kind: 'wondrous', slot: 'hands', attune: true, rarity: 'uncommon', setScore: { str: 19 } },
  amulet_of_health: { name: 'Amulet of Health', kind: 'wondrous', slot: 'neck', attune: true, rarity: 'rare', setScore: { con: 19 } },
  headband_of_intellect: { name: 'Headband of Intellect', kind: 'wondrous', slot: 'head', attune: true, rarity: 'uncommon', setScore: { int: 19 } },
  ring_of_resistance: { name: 'Ring of Resistance', kind: 'wondrous', slot: 'ring', attune: true, rarity: 'rare', resistChoice: true },
  boots_of_elvenkind: { name: 'Boots of Elvenkind', kind: 'wondrous', slot: 'feet', attune: false, rarity: 'uncommon', advSkill: ['stealth'] },
  sending_stones: { name: 'Sending Stones', kind: 'wondrous', slot: null, attune: false, rarity: 'uncommon' },
  potion_of_resistance: { name: 'Potion of Resistance', kind: 'consumable', rarity: 'uncommon', use: { effect: 'resistance_potion', hours: 1, action: 'bonus' } },
};
for (const [id, m] of Object.entries(MAGIC)) {
  if (m.kind === 'weapon_plus' || m.kind === 'armor_plus' || m.kind === 'shield_plus') continue;
  const srd = SRD.magic_items[id];
  base[id] = { id, ...m, srd: !!srd, attune: srd ? srd.attunement : !!m.attune, weight: 1, cost: m.kind === 'consumable' ? RARITY_VALUE[m.rarity] / 2 : RARITY_VALUE[m.rarity] };
}
// ---- Phase 4: costly spell components (SRD 5.2.1 spell text "worth N+ GP"; price = the stated worth)
export const COMPONENTS = {
  identify: { id: 'pearl_100', name: 'Pearl (100 GP)', gp: 100 }, chromatic_orb: { id: 'diamond_50', name: 'Diamond (50 GP)', gp: 50 },
  revivify: { id: 'diamond_300', name: 'Diamond (300 GP)', gp: 300, consumed: true }, find_familiar: { id: 'incense_10', name: 'Burning Incense (10 GP)', gp: 10, consumed: true },
  arcane_lock: { id: 'gold_dust_25', name: 'Gold Dust (25 GP)', gp: 25, consumed: true }, augury: { id: 'divination_tokens_25', name: 'Divination Tokens (25 GP)', gp: 25 },
  continual_flame: { id: 'ruby_dust_50', name: 'Ruby Dust (50 GP)', gp: 50, consumed: true }, glyph_of_warding: { id: 'powdered_diamond_200', name: 'Powdered Diamond (200 GP)', gp: 200, consumed: true },
  nondetection: { id: 'diamond_dust_25', name: 'Diamond Dust (25 GP)', gp: 25, consumed: true }, magic_circle: { id: 'silver_salt_100', name: 'Salt and Powdered Silver (100 GP)', gp: 100, consumed: true },
  magic_mouth: { id: 'jade_dust_10', name: 'Jade Dust (10 GP)', gp: 10, consumed: true }, illusory_script: { id: 'ink_10', name: 'Fine Ink (10 GP)', gp: 10, consumed: true },
  clairvoyance: { id: 'glass_eye_100', name: 'Jeweled Focus (100 GP)', gp: 100 }, warding_bond: { id: 'platinum_rings_50', name: 'Platinum Rings, pair (50 GP each)', gp: 100 },
  protection_from_evil_and_good: { id: 'holy_water', name: 'Holy Water (25 GP)', gp: 25, consumed: true },
};
for (const [spell, c] of Object.entries(COMPONENTS)) if (!base[c.id]) base[c.id] = { id: c.id, name: c.name, kind: 'component', forSpell: spell, consumed: !!c.consumed, weight: 0, cost: c.gp * 100 };
export const componentFor = spell => COMPONENTS[spell] || null;
// ---- valuables: SRD "trade goods and valuables like gems and art objects retain their full value" (no SRD table,
// so these generic denominations are engine-owned; the loot tables name them for flavor)
for (const [id, name, gp] of [['gem_10', 'Gemstone (10 GP)', 10], ['gem_50', 'Gemstone (50 GP)', 50], ['gem_100', 'Gemstone (100 GP)', 100], ['gem_500', 'Gemstone (500 GP)', 500], ['art_25', 'Art Object (25 GP)', 25], ['art_250', 'Art Object (250 GP)', 250]])
  base[id] = { id, name, kind: 'valuable', weight: 0, cost: gp * 100, fullValue: true };
// ---- every other SRD 5.2.1 magic item with a single rarity: named, valued and slotted; effect is "GM rules it"
const CONSUMABLE = /^(potion|oil|philter|elixir|dust|bead|ammunition|feather token|universal solvent|sovereign glue)/i;
const SLOT_OF = t => /\bring\b/i.test(t) ? 'ring' : /cloak|cape|mantle|robe/i.test(t) ? 'cloak' : /boots|slippers|horseshoes/i.test(t) ? 'feet' : /gloves|gauntlets|bracers/i.test(t) ? 'hands' : /helm|hat|headband|circlet|goggles|eyes of|lenses/i.test(t) ? 'head' : /amulet|necklace|periapt|medallion|brooch|scarab|talisman/i.test(t) ? 'neck' : /belt/i.test(t) ? 'belt' : null;
for (const m of Object.values(SRD.magic_items)) {
  if (base[m.id]) continue; const r = R(m.rarity); if (!RARITY_VALUE[r]) continue;
  const cons = CONSUMABLE.test(m.name);
  base[m.id] = { id: m.id, name: m.name, kind: cons ? 'consumable' : 'magic', magicType: m.type, rarity: r, attune: !!m.attunement, srd: true, gm: true, slot: SLOT_OF(m.name), weight: 1, cost: cons ? RARITY_VALUE[r] / 2 : RARITY_VALUE[r] };
}
for (const id of Object.keys(MAGIC)) if (base[id]) base[id].magicItem = true;
for (const id of ['potion_of_healing', 'potion_of_healing_greater', 'potion_of_healing_superior', 'potion_of_healing_supreme']) base[id].magicItem = true;
export const ITEMS = base;
export const isMagic = d => !!(d && (d.plus || d.magicItem || d.kind === 'magic' || d.srd || (d.rarity && d.kind !== 'scroll')));
// what an item is called (and does) before it is identified (SRD: Identify, or a Short Rest focused on it)
const UNID_WORD = d => d.kind === 'consumable' ? (/oil/i.test(d.name) ? 'oil' : /dust/i.test(d.name) ? 'pouch of dust' : 'potion') : d.slot === 'ring' || d.slot === 'ring1' ? 'ring' : d.slot === 'cloak' ? 'cloak' : d.slot === 'feet' ? 'pair of boots' : d.slot === 'hands' ? 'pair of gloves' : d.slot === 'head' ? 'headpiece' : d.slot === 'neck' ? 'amulet' : d.slot === 'belt' ? 'belt' : /wand/i.test(d.name) ? 'wand' : /staff/i.test(d.name) ? 'staff' : /rod/i.test(d.name) ? 'rod' : 'trinket';
// selling: half the cost (SRD "Selling Equipment"); gems and art keep full value; keepsakes are not for sale
export function sellValue(inst) {
  const d = itemDef(inst); if (d.kind === 'keepsake') return null; if (inst.unid) return null;
  return d.fullValue ? d.cost : Math.floor(d.cost / 2);
}
// BoG flavor = name/description over an SRD item. Keep mechanics SRD.
export const RESKINS = {
  longsword_of_massive_girth: { name: 'Longsword of Massive Girth', base: 'longsword', plus: 1, note: 'Reskinned +1 Longsword (SRD "Weapon, +1", Uncommon).' },
  coin_of_waukeen: { name: 'Coin-stamped Holy Symbol of Waukeen', base: 'holy_symbol', note: 'Flavor holy symbol; mechanically an SRD Holy Symbol.' },
};

export function itemDef(inst) {
  if (!inst) return null;
  if (inst.reskin) { const r = RESKINS[inst.reskin]; const b = itemDef({ ...inst, reskin: null, id: r.base, plus: inst.plus ?? r.plus }); return { ...b, name: inst.name || r.name, reskin: inst.reskin, note: r.note }; }
  if (inst.scroll && !ITEMS[inst.id]) inst = { ...inst, id: 'spell_scroll' };
  const b = inst.id === 'spell_scroll' ? { id: 'spell_scroll', kind: 'scroll', weight: 0 } : ITEMS[inst.id]; if (!b) throw new Error('unknown item ' + inst.id);
  const d = { ...b, plus: inst.plus || 0 }; if ((b.kind === 'keepsake' || b.kind === 'valuable') && inst.name) d.name = inst.name;
  if (d.plus) {
    d.magical = true;
    if (d.kind === 'weapon') { d.rarity = ['', 'uncommon', 'rare', 'very_rare'][d.plus]; d.cost = b.cost + RARITY_VALUE[d.rarity]; d.name = `${b.name}, +${d.plus}`; }
    if (d.kind === 'armor') { d.rarity = ['', 'rare', 'very_rare', 'legendary'][d.plus]; d.cost = b.cost + RARITY_VALUE[d.rarity]; d.name = `${b.name}, +${d.plus}`; }
    if (d.kind === 'shield') { d.rarity = ['', 'uncommon', 'rare', 'very_rare'][d.plus]; d.cost = b.cost + RARITY_VALUE[d.rarity]; d.name = `${b.name}, +${d.plus}`; }
  }
  if (inst.scroll) { const s = SRD.spells[inst.scroll]; d.kind = 'scroll'; d.name = `Spell Scroll (${s.name})`; d.spell = inst.scroll; d.level = s.level; d.cost = SCROLL_VALUE[s.level]; d.rarity = ['common', 'common', 'uncommon', 'uncommon', 'rare', 'rare', 'very_rare', 'very_rare', 'very_rare', 'legendary'][s.level]; d.weight = 0; }
  if (d.slot === undefined) d.slot = { weapon: d.melee ? 'main' : 'ranged', armor: 'armor', shield: 'off' }[d.kind] ?? null;
  if (inst.unid && isMagic(d)) { // unidentified: mundane base stats only, no magical properties, no attunement, no price
    if (['weapon', 'armor', 'shield'].includes(d.kind)) return { ...b, plus: 0, name: `${b.name} (unidentified magic)`, unid: true, trueId: d.id, slot: d.slot, magical: false };
    return { id: d.id, kind: d.kind === 'consumable' ? 'consumable' : 'magic', name: `Unidentified ${UNID_WORD(d)}`, slot: d.slot, weight: d.weight, cost: 0, unid: true, attune: false, rarity: null, use: null };
  }
  return d;
}
// scroll fixed DC/attack by level (SRD Spell Scroll table)
export const SCROLL_DC = [[13, 5], [13, 5], [13, 5], [15, 7], [15, 7], [17, 9], [17, 9], [18, 10], [18, 10], [19, 11]];
