// BoG V · Phase 4 · loot. Engine-owned treasure tables by Challenge Rating. SRD 5.2.1 has no CR treasure tables,
// so these tables are BoG's own, built only from SRD pieces: SRD magic items and rarities, SRD values (magic items
// by rarity, consumables at half, Spell Scroll prices), and the SRD rule that gems and art keep full value.
// Amounts are tuned by engine/sim/economy.mjs so a level 3-5 party faces real choices (see ECONOMY.md).
// Dividing: Need/Greed (default) or a party split (shared stash, claim by paying the others their shares).
// Coin is always split evenly; the remainder goes to the party fund. Magic items arrive unidentified.
import { itemDef, ITEMS, isMagic } from './rules/items.js';
import { deriveSheet } from './character.js';
import { CLASSES } from './rules/classes.js';
import * as A from './actions.js';
import SRD from '../srd/data/srd.js';
const crNum = cr => typeof cr === 'number' ? cr : String(cr).includes('/') ? 1 / +String(cr).split('/')[1] : +cr;
export const BAND = cr => { const n = crNum(cr); return n <= 4 ? '0-4' : n <= 10 ? '5-10' : n <= 16 ? '11-16' : '17+'; };
const NO_COIN = /^(Beast|Ooze|Plant|Elemental|Construct)/i; // monsters that don't carry purses

// ---------- the tables (coins as dice × unit in cp; valuables; magic rarity by d100) ----------
export const TABLES = {
  // per defeated foe that carries a purse
  individual: [
    { maxCr: 0.25, dice: '3d6', unit: 10, tag: 'sp' },         // ~10 sp
    { maxCr: 1, dice: '2d6', unit: 100, tag: 'gp' },           // ~7 gp
    { maxCr: 4, dice: '4d6', unit: 100, tag: 'gp' },           // ~14 gp
    { maxCr: 10, dice: '6d6', unit: 1000, tag: 'gp' },         // ~210 gp
    { maxCr: 16, dice: '4d6', unit: 10000, tag: 'gp' },        // ~1,400 gp
    { maxCr: 99, dice: '8d6', unit: 10000, tag: 'gp' },        // ~2,800 gp
  ],
  // an adventure's hoard (the boss's strongbox, a vault, a quest payout)
  hoard: {
    '0-4': { dice: '3d6', unit: 2500, valuables: { n: '1d4', from: ['gem_10', 'gem_10', 'art_25', 'gem_50'] }, magic: { n: '1d2', rarity: [[60, 'common'], [94, 'uncommon'], [100, 'rare']] } },
    '5-10': { dice: '4d6', unit: 10000, valuables: { n: '1d6', from: ['gem_50', 'gem_100', 'art_25', 'art_250'] }, magic: { n: '1d3', rarity: [[30, 'common'], [72, 'uncommon'], [97, 'rare'], [100, 'very_rare']] } },
    '11-16': { dice: '4d6', unit: 100000, valuables: { n: '2d4', from: ['gem_100', 'gem_500', 'art_250'] }, magic: { n: '1d4', rarity: [[10, 'uncommon'], [65, 'rare'], [97, 'very_rare'], [100, 'legendary']] } },
    '17+': { dice: '6d6', unit: 500000, valuables: { n: '2d6', from: ['gem_500', 'art_250'] }, magic: { n: '1d4+1', rarity: [[40, 'rare'], [88, 'very_rare'], [100, 'legendary']] } },
  },
  // magic items by rarity: SRD items the engine runs first; "gm" items are named and valued, the GM rules the effect
  magic: {
    common: ['potion_of_healing', 'potion_of_healing', 'potion_of_healing', 'potion_of_climbing', 'bead_of_nourishment', 'scroll:0', 'scroll:1', 'scroll:1'],
    uncommon: ['potion_of_healing_greater', 'potion_of_healing_greater', 'weapon+1', 'weapon+1', 'shield+1', 'cloak_of_protection', 'boots_of_elvenkind', 'gauntlets_of_ogre_power', 'headband_of_intellect', 'bag_of_holding', 'goggles_of_night', 'potion_of_resistance', 'sending_stones', 'wand_of_magic_missiles', 'pearl_of_power', 'scroll:2', 'scroll:3'],
    rare: ['ring_of_protection', 'bracers_of_defense', 'amulet_of_health', 'armor+1', 'weapon+2', 'potion_of_healing_superior', 'ring_of_resistance', 'flame_tongue', 'scroll:4', 'scroll:5'],
    very_rare: ['weapon+3', 'armor+2', 'potion_of_healing_supreme', 'shield+3', 'scroll:6'],
    legendary: ['armor+3', 'scroll:9'],
  },
};
const WEAPON_BASES = ['longsword', 'shortsword', 'rapier', 'mace', 'warhammer', 'battleaxe', 'greatsword', 'longbow', 'shortbow', 'light_crossbow', 'dagger', 'quarterstaff', 'spear', 'handaxe', 'scimitar'];
const ARMOR_BASES = ['leather_armor', 'studded_leather_armor', 'chain_shirt', 'scale_mail', 'breastplate', 'chain_mail', 'splint_armor', 'plate_armor'];
const pick = (g, list, why) => list[g.roll(`1d${list.length}`, {}, why).total - 1];
function magicItem(g, rarity) {
  const k = pick(g, TABLES.magic[rarity], `${rarity} magic item`);
  if (k.startsWith('scroll:')) { const L = +k.slice(7); const pool = Object.values(SRD.spells).filter(s => s.level === L).map(s => s.id).sort(); return { id: 'spell_scroll', scroll: pick(g, pool, `level ${L} scroll`) }; }
  const m = k.match(/^(weapon|armor|shield)\+(\d)$/); if (m) { const base = m[1] === 'weapon' ? pick(g, WEAPON_BASES, 'weapon') : m[1] === 'armor' ? pick(g, ARMOR_BASES, 'armor') : 'shield'; return { id: base, plus: +m[2], unid: true }; }
  if (k === 'potion_of_resistance') return { id: k, type: pick(g, ['acid', 'cold', 'fire', 'lightning', 'poison', 'necrotic', 'thunder'], 'resistance type'), unid: true };
  return { id: k, unid: isMagic(itemDef({ id: k })) };
}
const rarityOf = (g, table) => { const r = g.roll('1d100', {}, 'magic rarity').total; return table.find(([max]) => r <= max)[1]; };

// roll loot (inside an event; every die is from the night's committed seed and shows in the log)
export function rollIndividual(g, cr, type = '') {
  if (NO_COIN.test(type)) return { coin: 0, items: [] };
  const row = TABLES.individual.find(r => crNum(cr) <= r.maxCr); const r = g.roll(row.dice, {}, `purse (CR ${cr})`);
  const items = crNum(cr) >= 1 && g.roll('1d10', {}, 'valuable?').total === 10 ? [{ id: 'gem_10' }] : [];
  return { coin: r.total * row.unit, items };
}
export function rollHoard(g, band) {
  const t = TABLES.hoard[band]; const coin = g.roll(t.dice, {}, `hoard coins (${band})`).total * t.unit; const items = [];
  const nv = g.roll(t.valuables.n, {}, 'valuables').total; for (let i = 0; i < nv; i++) items.push({ id: pick(g, t.valuables.from, 'valuable') });
  const nm = g.roll(t.magic.n, {}, 'magic items').total; for (let i = 0; i < nm; i++) items.push(magicItem(g, rarityOf(g, t.magic.rarity)));
  return { coin, items };
}
// loot spec → {coin, items}. spec: {foes:[{cr,type}]} | {hoard:'0-4'} | {coin, items}
export function rollLoot(g, spec) {
  const out = { coin: spec.coin || 0, items: [...(spec.items || []).map(i => typeof i === 'string' ? { id: i } : { ...i })] };
  for (const f of spec.foes || []) { const r = rollIndividual(g, f.cr, f.type); out.coin += r.coin; out.items.push(...r.items); }
  if (spec.hoard) { const r = rollHoard(g, spec.hoard); out.coin += r.coin; out.items.push(...r.items); }
  for (const it of out.items) if (it.id === 'keepsake') throw new A.GameError('keepsakes are never loot'); // C5: statless and personal
  return out;
}
// add loot to the party: coin split now, items wait for Need/Greed (or go to the stash in party-split mode)
export function addLoot(g, spec, { why = 'loot' } = {}) {
  return g.event('loot', { why }, () => {
    const L = spec.rolled || rollLoot(g, spec); const party = g.state.party.order; const alive = party.filter(cid => !g.state.chars[cid].death.dead);
    const each = alive.length ? Math.floor(L.coin / alive.length) : 0; const rem = L.coin - each * alive.length;
    for (const cid of alive) g.set(['chars', cid, 'coin'], g.state.chars[cid].coin + each); if (rem) g.set(['party', 'fund'], (g.state.party.fund || 0) + rem);
    const mode = g.state.party.lootMode || 'needgreed'; const n0 = g.state.lootSeq || 0; const all = L.items.map((inst, i) => ({ lid: `L${n0 + i + 1}`, inst, from: why }));
    g.set(['lootSeq'], n0 + all.length);
    // gems and art keep full value (SRD): they ride in the party stash and are cashed and split at the next shop
    const cash = all.filter(x => itemDef(x.inst).kind === 'valuable').map(x => ({ ...x, cash: true })); const items = all.filter(x => itemDef(x.inst).kind !== 'valuable');
    if (cash.length || (items.length && mode === 'party')) g.set(['party', 'stash'], [...(g.state.party.stash || []), ...cash, ...(mode === 'party' ? items : [])]);
    if (items.length && mode !== 'party') g.set(['loot'], { pending: [...(g.state.loot?.pending || []), ...items] });
    g.note(`Loot (${why}): ${L.coin ? `${L.coin / 100} gp split ${alive.length} ways (${each / 100} gp each${rem ? `, ${rem} cp to the party fund` : ''})` : 'no coin'}${items.length ? `; ${items.map(x => itemDef(x.inst).name).join(', ')} ${mode === 'party' ? 'into the party stash' : 'to divide (Need / Greed)'}` : ''}${cash.length ? `; ${cash.map(x => itemDef(x.inst).name).join(', ')} to cash in at the next shop` : ''}.`);
    return { coin: L.coin, each, rem, items, cash, mode };
  });
}
// may this hero roll Need? (they could actually use it)
export function canNeed(c, inst) {
  // unidentified: what it IS stays hidden, but a longsword is visibly a longsword (proficiency still counts); rings, potions, etc. anyone may Need
  const d = itemDef(inst); if (inst.unid && !['weapon', 'armor', 'shield'].includes(d.kind)) return { ok: true }; const s = deriveSheet(c); const cls = CLASSES[c.cls];
  if (d.kind === 'weapon') { const prof = d.simple || cls.weapons.martial || (cls.weapons.martialIf || []).some(p => d.properties.includes(p)); return prof ? { ok: true } : { ok: false, why: 'not proficient' }; }
  if (d.kind === 'armor') { const t = [...cls.armor, ...(c.cls === 'cleric' && c.choices.divine_order === 'protector' ? ['heavy'] : [])]; return t.includes(d.armorType) ? { ok: true } : { ok: false, why: 'no armor training' }; }
  if (d.kind === 'shield') return cls.armor.includes('shield') ? { ok: true } : { ok: false, why: 'no shield training' };
  if (d.kind === 'scroll') return SRD.spells[d.spell].classes.includes(c.cls) ? { ok: true } : { ok: false, why: 'not on your spell list' };
  void s; return { ok: true };
}
const RANK = { need: 2, greed: 1, pass: 0 };
// divide pending loot. choices: {cid: {lid: 'need'|'greed'|'pass'}}; anyone without a choice rolls Greed (absent default)
export function divideLoot(g, choices = {}, { absentDefault = 'greed' } = {}) {
  const pend = g.state.loot?.pending || []; if (!pend.length) return [];
  const lines = [];
  g.event('loot_divide', {}, () => {
    for (const it of pend) {
      const party = g.state.party.order.filter(cid => !g.state.chars[cid].death.dead);
      const bids = party.map(cid => { let ch = choices[cid]?.[it.lid] || absentDefault; let note = choices[cid]?.[it.lid] ? null : 'no choice: Greed';
        if (ch === 'need') { const ok = canNeed(g.state.chars[cid], it.inst); if (!ok.ok) { ch = 'greed'; note = `Need not allowed (${ok.why}): Greed`; } } return { cid, choice: ch, note }; });
      const top = Math.max(...bids.map(b => RANK[b.choice])); const line = { lid: it.lid, name: itemDef(it.inst).name, bids, rolls: [], winner: null, tier: Object.keys(RANK).find(k => RANK[k] === top) };
      if (top === 0) { g.set(['party', 'stash'], [...(g.state.party.stash || []), it]); line.toStash = true; lines.push(line); g.note(`Everyone passed on ${line.name}: it goes to the party stash.`); continue; }
      let pool = bids.filter(b => RANK[b.choice] === top).map(b => b.cid); let round = 0;
      while (pool.length > 1 && round < 10) { const rs = pool.map(cid => ({ cid, nat: g.d20({}, `${line.tier} roll for ${line.name}`).nat })); line.rolls.push(rs); const hi = Math.max(...rs.map(r => r.nat)); pool = rs.filter(r => r.nat === hi).map(r => r.cid); round++; }
      line.winner = pool[0]; lines.push(line);
      g.note(`${line.name}: ${g.state.chars[line.winner].name} wins on ${line.tier === 'need' ? 'Need' : 'Greed'}${line.rolls.length ? ` (${line.rolls.at(-1).map(r => `${g.state.chars[r.cid].name.split(' ')[0]} ${r.nat}`).join(', ')})` : ''}.`);
    }
    g.set(['loot'], { pending: [] });
  });
  for (const l of lines) if (l.winner) A.giveItem(g, l.winner, pend.find(p => p.lid === l.lid).inst, { banked: false, why: 'loot (' + l.tier + ')' });
  return lines;
}
// party-split: unclaimed stash items are sold at the next shop and the coin is split evenly (stays SRD half price)
export function sellStash(g, { onlyIdentified = true, valuablesOnly = false } = {}) {
  const st = g.state.party.stash || []; const sell = st.filter(x => (x.cash || !valuablesOnly) && (!onlyIdentified || !x.inst.unid)); if (!sell.length) return 0;
  return g.event('stash_sell', {}, () => { const total = sell.reduce((a, x) => { const d = itemDef(x.inst); return a + (d.fullValue ? d.cost : Math.floor(d.cost / 2)); }, 0); const party = g.state.party.order; const each = Math.floor(total / party.length);
    for (const cid of party) g.set(['chars', cid, 'coin'], g.state.chars[cid].coin + each); g.set(['party', 'fund'], (g.state.party.fund || 0) + total - each * party.length); g.set(['party', 'stash'], st.filter(x => !sell.includes(x))); g.note(`Stash sold for ${total / 100} gp: ${each / 100} gp each.`); return total; });
}
export const setLootMode = (g, mode) => { if (!['needgreed', 'party'].includes(mode)) throw new A.GameError('loot mode is needgreed or party'); return g.event('loot_mode', { mode }, () => g.set(['party', 'lootMode'], mode)); };
export { crNum };
