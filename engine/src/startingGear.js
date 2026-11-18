// Starting equipment from SRD 5.2.1: each class's "Choose A or B" text (parsed from the SRD data) and each
// background's package, turned into engine items. Packs are unpacked into their SRD 5.2.1 contents so supplies
// (rations, water, torches) are tracked from day one. Coin is returned in copper pieces.
import SRD from '../srd/data/srd.js';
import { BACKGROUNDS } from './rules/origins.js';
import { itemDef } from './rules/items.js';

export const PACKS = {
  explorers_pack: [['backpack', 1], ['bedroll', 1], ['oil', 2], ['rations', 10], ['rope', 1], ['tinderbox', 1], ['torch', 10], ['waterskin', 1]],
  dungeoneers_pack: [['backpack', 1], ['caltrops', 1], ['crowbar', 1], ['oil', 2], ['rations', 10], ['rope', 1], ['tinderbox', 1], ['torch', 10], ['waterskin', 1]],
  priests_pack: [['backpack', 1], ['blanket', 1], ['holy_water', 1], ['lamp', 1], ['rations', 7], ['robe', 1], ['tinderbox', 1]],
  scholars_pack: [['backpack', 1], ['book', 1], ['ink', 1], ['ink_pen', 1], ['lamp', 1], ['oil', 10], ['parchment', 10], ['tinderbox', 1]],
  burglars_pack: [['backpack', 1], ['ball_bearings', 1], ['bell', 1], ['candle', 10], ['crowbar', 1], ['lantern_hooded', 1], ['oil', 7], ['rations', 5], ['rope', 1], ['tinderbox', 1], ['waterskin', 1]],
  entertainers_pack: [['backpack', 1], ['bedroll', 1], ['bell', 1], ['lantern_bullseye', 1], ['costume', 3], ['mirror', 1], ['oil', 8], ['rations', 9], ['tinderbox', 1], ['waterskin', 1]],
};
const ALIAS = {
  'druidic focus (quarterstaff)': 'quarterstaff', 'arcane focus (quarterstaff)': 'quarterstaff', 'druidic focus (sprig of mistletoe)': 'druidic_focus',
  'arcane focus (crystal)': 'arcane_focus', 'arcane focus (orb)': 'arcane_focus', 'book (occult lore)': 'book', 'musical instrument of your choice': 'musical_instrument',
  "artisan's tools or musical instrument chosen for the tool proficiency above": 'artisans_tools', 'arrows': 'arrows', 'javelins': 'javelin', 'daggers': 'dagger', 'handaxes': 'handaxe',
};
const slug = s => s.toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
function toId(name) {
  const n = name.trim().toLowerCase(); if (ALIAS[n]) return ALIAS[n];
  for (const c of [slug(name), slug(name).replace(/s$/, ''), slug(name).replace(/es$/, '')]) { try { itemDef({ id: c }); return c; } catch { /* next */ } }
  throw new Error('starting equipment: no item for "' + name + '"');
}
function parseList(txt) {
  const items = []; let gp = 0;
  for (let part of txt.replace(/\band\b/g, ',').split(',')) { part = part.trim(); if (!part) continue;
    const m = part.match(/^(\d+)\s+GP$/i); if (m) { gp = +m[1]; continue; }
    const q = part.match(/^(\d+)\s+(.*)$/); const qty = q ? +q[1] : 1; const name = q ? q[2] : part; items.push([toId(name), qty]); }
  return { items, gp };
}
// class options: [{key:'A', label, items:[[id,qty]], gp}]
export function classGearOptions(cls) {
  const txt = SRD.classes[cls].traits.starting_equipment; const out = [];
  for (const m of txt.matchAll(/\(([A-C])\)\s*([^;]+?)(?=;|$|\s*or\s*\([A-C]\))/g)) { const body = m[2].replace(/^or\s+/, '').replace(/[.;]\s*$/, ''); const p = parseList(body); out.push({ key: m[1], label: body.trim(), ...p }); }
  return out;
}
export function backgroundGearOptions(bg) {
  const e = BACKGROUNDS[bg].equipment; const names = e.A.map(([id, q]) => { const n = itemDef({ id }).name; return q > 1 ? `${q} ${/s$/.test(n) ? n : n.replace(/^(\w+)/, w => w + (/(ch|sh|x)$/.test(w) ? 'es' : 's'))}` : n; });
  return [{ key: 'A', label: names.join(', ') + `, and ${e.gpA} GP`, items: e.A, gp: e.gpA }, { key: 'B', label: `${e.gpB} GP`, items: [], gp: e.gpB }];
}
// expand packs, merge stacks, auto-equip (armor, shield, a one-handed main weapon if a shield is carried, a ranged weapon, a holy symbol)
export function startingInventory(cls, clsKey, bg, bgKey, bought = []) {
  const co = classGearOptions(cls).find(o => o.key === clsKey); const bo = backgroundGearOptions(bg).find(o => o.key === bgKey);
  if (!co || !bo) throw new Error('pick an equipment option');
  const raw = [...co.items, ...bo.items, ...bought]; const flat = [];
  for (const [id, q] of raw) { if (PACKS[id]) for (const [pid, pq] of PACKS[id]) flat.push([pid, pq * q]); else flat.push([id, q]); }
  const stack = new Map(); for (const [id, q] of flat) stack.set(id, (stack.get(id) || 0) + q);
  const inv = []; for (const [id, q] of stack) { const d = itemDef({ id });
    if (id === 'waterskin') { for (let i = 0; i < q; i++) inv.push({ id, pints: 4 }); continue; }
    if (['weapon', 'armor', 'shield', 'focus'].includes(d.kind) && !d.ammo) { for (let i = 0; i < q; i++) inv.push({ id }); continue; }
    inv.push({ id, qty: q }); }
  const defs = inv.map(i => ({ i, d: itemDef(i) }));
  const armor = defs.find(x => x.d.kind === 'armor'); if (armor) armor.i.slot = 'armor';
  const shield = defs.find(x => x.d.kind === 'shield'); if (shield) shield.i.slot = 'off';
  const melee = defs.filter(x => x.d.kind === 'weapon' && x.d.melee).sort((a, b) => avg(b.d) - avg(a.d));
  const main = melee.find(x => !shield || !x.d.properties.includes('two_handed')); if (main) main.i.slot = 'main';
  const ranged = defs.find(x => x.d.kind === 'weapon' && !x.d.melee); if (ranged) ranged.i.slot = 'ranged';
  const sym = defs.find(x => x.d.id === 'holy_symbol'); if (sym) sym.i.slot = 'neck';
  return { inventory: inv, coin: (co.gp + bo.gp) * 100 };
}
const avg = d => { const m = String(d.dice || '').match(/(\d+)d(\d+)/); return m ? m[1] * (+m[2] + 1) / 2 : 0; };
// a small SRD shop for heroes who take the gold: weapons, armor, shields, packs, basics (cost in cp)
export function starterShop() {
  const ids = [...Object.values(SRD.weapons).map(w => w.id), ...Object.values(SRD.armor).map(a => a.id), ...Object.keys(PACKS),
    'holy_symbol', 'arcane_focus', 'druidic_focus', 'thieves_tools', 'herbalism_kit', 'musical_instrument', 'spellbook', 'arrows', 'bolts', 'quiver', 'rations', 'waterskin', 'torch', 'rope', 'healers_kit', 'potion_of_healing'];
  return [...new Set(ids)].map(id => { try { const d = itemDef({ id }); return { id, name: d.name, cost: d.cost, kind: d.kind, weight: d.weight }; } catch { return null; } }).filter(Boolean);
}
