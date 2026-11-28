// BoG V · Phase 4 · shops that matter. SRD 5.2.1 prices (equipment table; magic items by rarity, consumables at
// half, Spell Scrolls at twice the scribing cost), location-based stock, sell at half (gems/art at full value),
// and every price shows what it does to YOUR sheet before you buy. All changes are engine events (sheet events).
import { deriveSheet, makeItem, SLOTS } from './character.js';
import { itemDef, ITEMS, sellValue, isMagic, COMPONENTS, componentFor } from './rules/items.js';
import { CLASSES } from './rules/classes.js';
import * as A from './actions.js';
import SRD from '../srd/data/srd.js';
const clone = v => JSON.parse(JSON.stringify(v));
const sgn = n => (n >= 0 ? '+' : '\u2212') + Math.abs(n);
export const fmtGp = cp => { const g = Math.floor(cp / 100), s = Math.floor((cp % 100) / 10), c = Math.round(cp % 10); return [g && g.toLocaleString() + ' gp', s && s + ' sp', c && c + ' cp'].filter(Boolean).join(' ') || '0 gp'; };

// ---------- stock keys: 'longsword' · 'longsword+1' · 'scroll:cure_wounds' · 'arrows x20' (bundle)
export function instOf(key) {
  const [k, bundle] = String(key).split(' x'); const m = k.match(/^(.+)\+(\d)$/);
  const inst = k.startsWith('scroll:') ? { id: 'spell_scroll', scroll: k.slice(7) } : m ? { id: m[1], plus: +m[2] } : { id: k };
  return { inst, qty: bundle ? +bundle : 1 };
}
const W = Object.keys(SRD.weapons), AR = Object.keys(SRD.armor);
const SUPPLIES = ['rations', 'waterskin', 'torch', 'arrows x20', 'bolts x20', 'sling_bullets x20', 'firearm_bullets x10', 'needles x50', 'quiver', 'healers_kit', 'rope', 'bedroll', 'tinderbox', 'oil', 'component_pouch', 'antitoxin'];
const COMPS = [...new Set(Object.values(COMPONENTS).map(c => c.id))];
const scrolls = (maxLevel, classes = ['cleric', 'wizard', 'bard', 'druid', 'sorcerer', 'warlock', 'paladin', 'ranger']) => Object.values(SRD.spells).filter(s => s.level <= maxLevel && s.classes.some(c => classes.includes(c))).map(s => 'scroll:' + s.id);
// Rare and better are quest-only (SPEC §10). Uncommon magic only in the capital (SRD: "usually found only in cities").
export const SHOPS = {
  capital: { id: 'capital', name: 'The Guildhall Bazaar', place: 'Teslandia \u00b7 the capital', blurb: 'Forty guild stalls under one copper roof. Everyone haggles; nobody wins.', buys: true,
    stock: [...W, ...AR, ...SUPPLIES, ...COMPS, 'holy_symbol', 'arcane_focus', 'druidic_focus', 'thieves_tools', 'herbalism_kit', 'spellbook', 'alchemists_fire', 'holy_water', 'caltrops', 'ball_bearings', 'potion_of_healing', 'potion_of_healing_greater', 'potion_of_climbing', 'potion_of_resistance',
      'scroll:guidance', 'scroll:fire_bolt', 'scroll:sacred_flame', 'scroll:healing_word', 'scroll:bless', 'scroll:magic_missile', 'scroll:sleep', 'scroll:detect_magic', 'scroll:identify', 'scroll:feather_fall', 'scroll:hunters_mark', 'scroll:cure_wounds', 'scroll:shield', 'scroll:misty_step', 'scroll:lesser_restoration', 'scroll:aid', 'scroll:revivify',
      'longsword+1', 'shortsword+1', 'rapier+1', 'mace+1', 'warhammer+1', 'longbow+1', 'shortbow+1', 'light_crossbow+1', 'quarterstaff+1', 'dagger+1', 'shield+1', 'cloak_of_protection', 'boots_of_elvenkind', 'bag_of_holding', 'gauntlets_of_ogre_power', 'headband_of_intellect', 'sending_stones', 'goggles_of_night', 'wand_of_magic_missiles',
      'immovable_rod', 'eversmoking_bottle', 'dust_of_disappearance', 'oil_of_slipperiness', 'potion_of_water_breathing', 'potion_of_animal_friendship', 'cask_of_tankard_export_ale'],
    limits: { 'potion_of_healing_greater': 4, 'longsword+1': 1, 'shortsword+1': 1, 'rapier+1': 1, 'mace+1': 1, 'warhammer+1': 1, 'longbow+1': 1, 'shortbow+1': 1, 'light_crossbow+1': 1, 'quarterstaff+1': 1, 'dagger+1': 1, 'shield+1': 1, cloak_of_protection: 1, boots_of_elvenkind: 1, bag_of_holding: 1, gauntlets_of_ogre_power: 1, headband_of_intellect: 1, sending_stones: 1, goggles_of_night: 1, wand_of_magic_missiles: 1, 'scroll:revivify': 1, 'scroll:lesser_restoration': 2, 'scroll:aid': 2, immovable_rod: 1, eversmoking_bottle: 1, dust_of_disappearance: 2, oil_of_slipperiness: 2, potion_of_water_breathing: 2, potion_of_animal_friendship: 2, cask_of_tankard_export_ale: 4 },
    discountFlag: 'guild_discount' },
  tankard: { id: 'tankard', name: 'Bucky\u2019s \u00b7 We Buy Odd Things', place: 'The Leaking Tankard II', blurb: 'A crate under table six. Bucky is also under table six.', buys: true,
    stock: [...SUPPLIES, 'potion_of_healing', 'alchemists_fire', 'holy_water', 'caltrops', 'ball_bearings', 'dagger', 'club', 'handaxe', 'javelin', 'light_hammer', 'sling', 'shortbow', 'quarterstaff', 'spear', 'light_crossbow', 'leather_armor', 'padded_armor', 'shield', 'pearl_100', 'diamond_50', 'incense_10', 'scroll:cure_wounds', 'scroll:healing_word', 'scroll:bless'],
    limits: { potion_of_healing: 3, pearl_100: 1, diamond_50: 1, 'scroll:cure_wounds': 1, 'scroll:healing_word': 1, 'scroll:bless': 1 } },
  frontier: { id: 'frontier', name: 'Mother of Grudges\u2019 Bridge Stall', place: 'The Border March', blurb: 'She takes coin. She prefers grudges.', buys: true,
    stock: ['rations', 'waterskin', 'torch', 'arrows x20', 'bolts x20', 'sling_bullets x20', 'rope', 'tinderbox', 'bedroll', 'healers_kit', 'potion_of_healing', 'holy_water', 'antitoxin', 'dagger', 'spear', 'javelin', 'handaxe', 'shortbow', 'light_crossbow', 'leather_armor', 'hide_armor', 'scale_mail', 'shield'],
    limits: { potion_of_healing: 2, holy_water: 2, scale_mail: 1, hide_armor: 1, antitoxin: 2 } },
  thimbleby: { id: 'thimbleby', name: 'The Pump Stall', place: 'Thimbleby \u00b7 the square', blurb: 'A front room on the square that sells what a village sells. Rations first, talk later.', buys: true,
    stock: ['rations', 'waterskin', 'torch', 'arrows x20', 'bolts x20', 'sling_bullets x20', 'rope', 'tinderbox', 'bedroll', 'healers_kit', 'potion_of_healing', 'holy_water', 'dagger', 'spear', 'javelin', 'handaxe', 'shortbow', 'leather_armor', 'shield'],
    limits: { potion_of_healing: 2, holy_water: 1 } },
  // Next towns after Thimbleby (ids exist in the catalog; do not open a night with these until Pages is cache-busted).
  fenwick: { id: 'fenwick', name: 'The Green Sign', place: 'Fenwick \u00b7 the green', blurb: 'A shuttered shop on the green. She sells what the road still needs, and she counts the coin twice.', buys: true,
    stock: ['rations', 'waterskin', 'torch', 'arrows x20', 'bolts x20', 'sling_bullets x20', 'rope', 'tinderbox', 'bedroll', 'healers_kit', 'potion_of_healing', 'holy_water', 'antitoxin', 'dagger', 'spear', 'javelin', 'handaxe', 'shortbow', 'light_crossbow', 'leather_armor', 'hide_armor', 'scale_mail', 'shield'],
    limits: { potion_of_healing: 2, holy_water: 1, antitoxin: 1, scale_mail: 1, hide_armor: 1 } },
  tollford: { id: 'tollford', name: 'The Post Shop', place: 'Tollford \u00b7 the post', blurb: 'A counter beside the official post. Rations, a scroll, and no patience for long stories.', buys: true,
    stock: ['rations', 'waterskin', 'torch', 'arrows x20', 'bolts x20', 'sling_bullets x20', 'rope', 'tinderbox', 'bedroll', 'healers_kit', 'potion_of_healing', 'holy_water', 'dagger', 'spear', 'javelin', 'handaxe', 'shortbow', 'light_crossbow', 'leather_armor', 'shield', 'scroll:cure_wounds', 'scroll:healing_word'],
    limits: { potion_of_healing: 2, holy_water: 1, 'scroll:cure_wounds': 1, 'scroll:healing_word': 1 } },
};
export const DISCOUNT = 0.9; // the Agent at Court reward: 10% off at the capital's guild stalls (decision D4-2)
const tabOf = d => d.kind === 'armor' || d.kind === 'shield' ? (d.plus ? 'magic' : 'armor') : d.kind === 'weapon' ? (d.plus ? 'magic' : 'weapons') : d.kind === 'scroll' || /^potion/.test(d.id) || d.kind === 'consumable' ? 'potions' : isMagic(d) ? 'magic' : 'supplies';
export const TABS = [['foryou', 'For you'], ['armor', 'Armor'], ['weapons', 'Weapons'], ['potions', 'Potions & scrolls'], ['magic', 'Magic'], ['supplies', 'Supplies']];

export function priceOf(state, shopId, key) {
  const shop = SHOPS[shopId]; const { inst, qty } = instOf(key); const d = itemDef(inst); let unit = d.cost;
  const disc = shop.discountFlag && state?.story?.flags?.[shop.discountFlag]; const total = Math.round(unit * qty * (disc ? DISCOUNT : 1));
  return { unit: Math.round(unit * (disc ? DISCOUNT : 1)), total, qty, discount: !!disc, list: unit * qty };
}
export const stockLeft = (state, shopId, key) => { const lim = SHOPS[shopId].limits?.[key]; if (lim == null) return Infinity; return Math.max(0, lim - (state?.shops?.[shopId]?.sold?.[key] || 0)); };

// ---------- supplies (party bar + pack): days of food, water, light, ammo
export function suppliesOf(c) {
  const sum = id => c.inventory.filter(i => i.id === id).reduce((a, i) => a + (i.qty || 1), 0);
  const pints = c.inventory.filter(i => i.id === 'waterskin').reduce((a, i) => a + (i.pints ?? 4), 0);
  const ammo = {}; for (const i of c.inventory) { const d = itemDef(i); if (d.kind === 'ammo') ammo[d.id] = (ammo[d.id] || 0) + i.qty; }
  return { rations: sum('rations'), pints, waterDays: Math.round(pints / 8 * 10) / 10, torches: sum('torch'), ammo, potions: c.inventory.filter(i => /^potion_of_healing/.test(i.id) && !i.unid).reduce((a, i) => a + i.qty, 0) };
}
export function partySupplies(state) {
  const cs = state.party.order.map(cid => state.chars[cid]).filter(Boolean); const per = cs.map(suppliesOf);
  return { rationDays: per.length ? Math.min(...per.map(p => p.rations)) : 0, waterFull: per.length > 0 && per.every(p => p.pints >= 4), waterDays: per.length ? Math.min(...per.map(p => p.waterDays)) : 0,
    torches: per.reduce((a, p) => a + p.torches, 0), coin: cs.reduce((a, c) => a + c.coin, 0), fund: state.party.fund || 0 };
}

// ---------- the delta: what this item does to this hero's sheet
function naturalSlot(c, d) {
  if (d.kind === 'armor') return 'armor'; if (d.kind === 'shield') return 'off';
  if (d.kind === 'weapon') return d.melee ? 'main' : 'ranged';
  if (['ring'].includes(d.slot)) return c.inventory.some(i => i.slot === 'ring1') ? 'ring2' : 'ring1';
  return SLOTS.includes(d.slot) ? d.slot : null;
}
export function preview(c, inst, qty = 1) {
  const d = itemDef(inst); const before = deriveSheet(c); const tags = []; let good = 0; let usable = true; const why = [];
  const c2 = clone(c); const ni = makeItem({ ...inst, qty, uid: 'preview' }); ni.slot = null; const slot = naturalSlot(c2, d);
  if (slot && !['ammo', 'consumable', 'supply', 'scroll', 'component', 'valuable', 'tool', 'gear'].includes(d.kind)) { for (const x of c2.inventory) if (x.slot === slot) x.slot = null;
    if (d.kind === 'weapon' && d.properties?.includes('two_handed')) for (const x of c2.inventory) if (x.slot === 'off') x.slot = null; ni.slot = slot; if (d.attune) ni.attuned = true; }
  c2.inventory.push(ni); const after = deriveSheet(c2);
  if (after.ac.v !== before.ac.v) { tags.push({ t: `AC ${before.ac.v} \u2192 ${after.ac.v}`, k: after.ac.v > before.ac.v ? 'g' : 'w' }); good += after.ac.v - before.ac.v; }
  if (d.kind === 'weapon') { const na = after.attacks.find(a => a.uid === 'preview'); const old = before.attacks.filter(a => a.slot === slot)[0];
    if (na) { const f = a => `${sgn(a.toHit)} \u00b7 ${a.dice === '0d1' ? '' : a.dice}${a.dmgBonus ? sgn(a.dmgBonus) : ''}`; const better = !old || expDmg(na) > expDmg(old) + 0.05;
      tags.push({ t: old ? `${f(old)} \u2192 ${f(na)}` : f(na), k: better ? 'g' : '' }); if (better) good += old ? Math.min(2, (expDmg(na) - expDmg(old)) / 1.5 + 0.5) : 0.4;
      if (!na.proficient) { tags.push({ t: 'not proficient', k: 'w' }); usable = false; why.push('not proficient'); }
      if (d.ammo && !Object.keys(suppliesOf(c).ammo).some(id => itemDef({ id }).ammo === ammoKindOf(d))) { tags.push({ t: `needs ${ammoName(d)}`, k: 'w' }); good -= 0.75; } } }
  if (d.kind === 'armor') { if (d.strReq) { const ok = after.scores.str >= d.strReq; tags.push({ t: `needs STR ${d.strReq} \u00b7 you ${after.scores.str} ${ok ? '\u2713' : '\u2717 (\u221210 ft)'}`, k: ok ? '' : 'w' }); if (!ok) good -= 2.5; }
    if (!after.armorProf) { tags.push({ t: 'no armor training: no spells', k: 'w' }); usable = false; why.push('no armor training'); } if (d.stealthDis) tags.push({ t: 'Stealth: disadvantage', k: 'w' }); }
  if (d.kind === 'shield') { const two = c.inventory.find(i => i.slot === 'main' && itemDef(i).properties?.includes('two_handed')); if (two) { tags.push({ t: `${itemDef(two).name} (two-handed) goes to your pack`, k: 'w' }); good -= 2; } }
  if (d.kind === 'shield' && !after.shieldProf) { tags.push({ t: 'no shield training: no AC', k: 'w' }); usable = false; why.push('no shield training'); }
  for (const a of ['str', 'con', 'int', 'dex', 'wis', 'cha']) if (after.scores[a] !== before.scores[a]) { tags.push({ t: `${a.toUpperCase()} ${before.scores[a]} \u2192 ${after.scores[a]}`, k: 'g' }); good += 1; }
  if (d.attune) tags.push({ t: `attune ${before.attuned} \u2192 ${before.attuned + 1} / 3`, k: before.attuned >= 3 ? 'w' : 'm' });
  if (d.bonus?.saves) { tags.push({ t: `saves +${d.bonus.saves}`, k: 'g' }); good += 1; }
  const sup = suppliesOf(c);
  if (d.id === 'rations') tags.push({ t: `food ${sup.rations} \u2192 ${sup.rations + qty} days`, k: sup.rations < 3 ? 'g' : '' }), good += sup.rations < 3 ? 1 : 0;
  if (d.id === 'waterskin') tags.push({ t: `water ${sup.waterDays} \u2192 ${Math.round((sup.pints + 4 * qty) / 8 * 10) / 10} days`, k: 'g' });
  if (d.id === 'torch') tags.push({ t: `torches ${sup.torches} \u2192 ${sup.torches + qty}`, k: '' });
  if (d.kind === 'ammo') { const mine = sup.ammo[d.id] || 0; const fits = before.attacks.some(a => a.ammo && ammoKindOf(itemDef({ id: a.weapon })) === d.ammo); tags.push({ t: `${d.name.toLowerCase()}s ${mine} \u2192 ${mine + qty}`, k: fits ? 'g' : '' }); if (!fits) { usable = false; why.push('no weapon for it'); } else if (mine < 20) good += 1; }
  if (d.use?.heal) { tags.push({ t: `heals ${d.use.heal}`, k: 'g' }); const own = c.inventory.filter(i => i.id === d.id).reduce((a, i) => a + i.qty, 0); if (own) tags.push({ t: `you own ${own}`, k: '' }); if (own < 2) good += 1; }
  if (d.kind === 'scroll') { const on = SRD.spells[d.spell].classes.includes(c.cls); tags.push({ t: on ? `${c.cls} list \u2713` : `not on the ${c.cls} list`, k: on ? 'g' : 'w' }); if (!on) { usable = false; why.push('not on your spell list'); } else if (d.level > (before.spellcasting?.maxSpellLevel ?? 0)) tags.push({ t: `above your level: DC ${10 + d.level} check`, k: 'w' }); else good += 0.5; }
  if (d.kind === 'component') { const known = (c.prepared || []).includes(d.forSpell) || (c.spellbook || []).includes(d.forSpell) || (c.cantrips || []).includes(d.forSpell); tags.push({ t: `for ${SRD.spells[d.forSpell]?.name}${d.consumed ? ' (used up)' : ''}${known ? ' \u2713 you know it' : ''}`, k: known ? 'g' : '' }); if (known && !c.inventory.some(i => i.id === d.id)) good += 1; else if (!known) usable = false; }
  if (d.gm) tags.push({ t: 'GM rules the effect', k: '' });
  if (d.rarity && isMagic(d)) tags.push({ t: d.rarity.replace('_', ' '), k: 'm' });
  if (after.carry.carried > after.carry.cap && before.carry.carried <= before.carry.cap) { tags.push({ t: `over capacity: speed 5 ft (${after.carry.carried}/${after.carry.cap} lb)`, k: 'w' }); good -= 2; }
  return { d, tags, good, usable, why, slot, acBefore: before.ac.v, acAfter: after.ac.v };
}
const expDmg = a => (avg(a.dice) + a.dmgBonus) * Math.min(0.95, Math.max(0.05, (21 - (13 - a.toHit)) / 20)); // vs a typical AC 13
const avg = e => { const m = String(e).match(/(\d+)d(\d+)/); return m ? m[1] * (+m[2] + 1) / 2 : 0; };
const ammoKindOf = w => ['musket', 'pistol'].includes(w.id) ? 'firearm' : /arrow/i.test(w.ammo) ? 'arrow' : /bolt/i.test(w.ammo) ? 'bolt' : /bullet/i.test(w.ammo) ? 'bullet' : /needle/i.test(w.ammo) ? 'needle' : w.ammo;
const ammoName = w => ({ arrow: 'arrows', bolt: 'bolts', bullet: 'sling bullets', firearm: 'firearm bullets', needle: 'needles' }[ammoKindOf(w)] || 'ammunition');

// the shop screen: one row per stock line, sorted with "for you" items first
export function shopView(state, cid, shopId, tab = 'foryou') {
  const shop = SHOPS[shopId]; if (!shop) throw new Error('no shop ' + shopId); const c = state.chars[cid];
  const rows = shop.stock.map(key => { const { inst, qty } = instOf(key); let d; try { d = itemDef(inst); } catch { return null; }
    const pr = priceOf(state, shopId, key); const left = stockLeft(state, shopId, key); const pv = preview(c, inst, qty);
    return { key, name: d.name + (qty > 1 ? ` \u00d7${qty}` : ''), tab: tabOf(d), kind: d.kind, price: pr.total, list: pr.list, discount: pr.discount, left, tags: pv.tags, good: pv.good, usable: pv.usable, why: pv.why, afford: c.coin >= pr.total, short: Math.max(0, pr.total - c.coin), rarity: d.rarity || null, weight: d.weight }; }).filter(Boolean);
  const list = tab === 'foryou' ? rows.filter(r => r.usable && r.good > 0 && r.left > 0).sort((a, b) => b.good - a.good || a.price - b.price).slice(0, 12) : rows.filter(r => r.tab === tab).sort((a, b) => a.price - b.price);
  return { shop: { id: shop.id, name: shop.name, place: shop.place, blurb: shop.blurb }, coin: c.coin, rows: list, counts: Object.fromEntries(TABS.map(([k]) => [k, k === 'foryou' ? list.length : rows.filter(r => r.tab === k).length])), discount: rows.some(r => r.discount) };
}
// what the hero could sell here (half price; gems/art full; keepsakes and unidentified items refused, with why)
export function sellList(state, cid) {
  const c = state.chars[cid];
  return c.inventory.map(it => { const d = itemDef(it); const v = sellValue(it); const why = d.kind === 'keepsake' ? 'keepsake: not for sale' : it.unid ? 'identify it first' : it.slot ? 'equipped: take it off first' : it.attuned ? 'attuned' : null;
    return { uid: it.uid, name: d.name, qty: it.qty, each: v, price: v == null ? null : v * it.qty, ok: !why && v != null && v > 0, why, full: !!d.fullValue }; });
}

// ---------- engine actions (each one an event the GM pass replays; the client previews the same calls)
export function buyFrom(g, cid, shopId, key, n = 1, { equip = false } = {}) {
  const shop = SHOPS[shopId]; if (!shop) throw new A.GameError('no shop ' + shopId); if (!shop.stock.includes(key)) throw new A.GameError(`${shop.name} doesn't sell that`);
  const left = stockLeft(g.state, shopId, key); if (left < n) throw new A.GameError(left ? `only ${left} left` : `${shop.name} is sold out of that`);
  const { inst, qty } = instOf(key); const pr = priceOf(g.state, shopId, key);
  A.buy(g, cid, inst, qty * n, { unitCost: pr.unit, shop: shopId });
  if (shop.limits?.[key] != null) g.event('shop_stock', { shop: shopId, key, n }, () => g.set(['shops', shopId, 'sold', key], (g.state.shops?.[shopId]?.sold?.[key] || 0) + n));
  const c = g.state.chars[cid]; const it = c.inventory.findLast(i => i.id === inst.id && (i.plus || 0) === (inst.plus || 0) && (i.scroll || null) === (inst.scroll || null));
  if (equip && it) { const d = itemDef(it); const slot = naturalSlot(c, d); if (slot) A.equip(g, cid, it.uid, slot); }
  return it;
}
export function sellAt(g, cid, shopId, uid, qty = 1) { const shop = SHOPS[shopId]; if (!shop?.buys) throw new A.GameError('nobody here buys'); return A.sell(g, cid, uid, qty, { shop: shopId }); }
// a player's saved cart, applied by the GM pass at resolution (or by the client for a preview). Never throws:
// each line reports ok/why so a bad line can't block the night.
export function applyCart(g, cid, cart = [], shopId = null) {
  const out = [];
  for (const line of cart || []) {
    try {
      if (line.op === 'buy') { if (!shopId) throw new A.GameError('no shop in this scene'); const it = buyFrom(g, cid, shopId, line.key, line.n || 1, { equip: !!line.equip }); out.push({ ...line, ok: true, what: `bought ${itemDef(it).name}${(line.n || 1) > 1 ? ' \u00d7' + line.n : ''}${line.equip ? ' (equipped)' : ''}` }); }
      else if (line.op === 'sell') { if (!shopId) throw new A.GameError('no shop in this scene'); const it = g.state.chars[cid].inventory.find(i => i.uid === line.uid); const nm = it ? itemDef(it).name : line.uid; sellAt(g, cid, shopId, line.uid, line.n || 1); out.push({ ...line, ok: true, what: `sold ${nm}` }); }
      else if (line.op === 'equip') { A.equip(g, cid, line.uid, line.slot); out.push({ ...line, ok: true, what: `equipped ${itemDef(g.state.chars[cid].inventory.find(i => i.uid === line.uid)).name}` }); }
      else if (line.op === 'unequip') { A.unequip(g, cid, line.uid); out.push({ ...line, ok: true, what: 'unequipped' }); }
      else if (line.op === 'use') { A.usePotion(g, cid, line.uid, line.target || cid); out.push({ ...line, ok: true, what: 'drank a potion' }); }
      else if (line.op === 'identify') { const owner = line.owner || cid; const it = A.castIdentify(g, cid, owner, line.uid, { ritual: line.ritual !== false }); out.push({ ...line, ok: true, what: `cast Identify: ${it?.name || 'item identified'}` }); }
      else if (line.op === 'claim') { claimFromStash(g, cid, line.lid); out.push({ ...line, ok: true, what: 'claimed from the party stash' }); }
      else throw new A.GameError('unknown cart line ' + line.op);
    } catch (e) { if (!(e instanceof A.GameError)) throw e; out.push({ ...line, ok: false, why: e.message }); }
  }
  return out;
}
// party-split mode: claim an item from the stash by paying the others their shares of its sale value
export function claimFromStash(g, cid, lid) {
  const st = g.state.party.stash || []; const i = st.findIndex(x => x.lid === lid); if (i < 0) throw new A.GameError('that item is no longer in the stash');
  const it = st[i]; const order = g.state.party.order; const value = it.inst.unid ? 0 : Math.floor((itemDef(it.inst).cost || 0) / 2); const share = Math.floor(value / order.length); const owe = share * (order.length - 1);
  const c = g.state.chars[cid]; if (c.coin < owe) throw new A.GameError(`claiming it costs ${fmtGp(owe)} (the others' shares)`);
  g.event('stash_claim', { cid, lid, owe }, () => { g.set(['chars', cid, 'coin'], c.coin - owe); for (const o of order) if (o !== cid) g.set(['chars', o, 'coin'], g.state.chars[o].coin + share); g.set(['party', 'stash'], st.filter(x => x.lid !== lid)); });
  return A.giveItem(g, cid, it.inst, { why: 'claimed from the party stash' });
}
export { CLASSES };
