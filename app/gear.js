// BoG V · Phase 4 · Gear (paperdoll, pack, shop with sheet deltas, cart), Loot (Need / Greed / Pass, party stash),
// side quests and the issue log (Report an issue + Wes's queue). Players never change their sheet directly: every
// shop, equip, identify or loot choice is saved with tonight's action and applied by the GM's nightly batch, which
// writes it as engine events. The cart preview runs the same engine code on a copy of the public state.
import * as SH from '../engine/src/shop.js';
import * as L from '../engine/src/loot.js';
import { Game } from '../engine/src/game.js';
import { deriveSheet } from '../engine/src/character.js';
import { itemDef, sellValue } from '../engine/src/rules/items.js';
import { questBoard } from './content/sidequests.js';
import * as I from './issues.js';

let X; // context from table.js: { T, esc, AV, first, now, canAct, sgn, store, OWNER }
export const init = ctx => { X = ctx; };
const esc = s => X.esc(s); const sgn = n => (n >= 0 ? '+' : '\u2212') + Math.abs(n);
const TH = {
  armor: '<path d="M6 4l6-2 6 2v6c0 5-3 9-6 11-3-2-6-6-6-11z"/>', shield: '<path d="M12 3l7 3v5c0 5-3.5 8.5-7 10-3.5-1.5-7-5-7-10V6z"/>',
  weapon: '<path d="M14.5 4H20v5.5L9 20.5 3.5 15z M5 13l6 6 M3 21l3-3"/>', potion: '<path d="M10 3h4 M10.5 3v5L6 16a4 4 0 0 0 3.5 6h5A4 4 0 0 0 18 16l-4.5-8V3"/><path d="M7.5 14h9"/>',
  scroll: '<path d="M7 4h11a2 2 0 0 1 0 4h-1 M7 4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V8"/>', gem: '<path d="M6 4h12l3 5-9 11L3 9z M3 9h18 M9 4l3 5 3-5"/>',
  food: '<path d="M4 13h16a8 8 0 0 1-16 0z M8 9c0-2 2-2 2-4 M13 9c0-2 2-2 2-4"/>', light: '<path d="M12 2c2 3 3 4.5 3 7a3 3 0 0 1-6 0c0-2.5 1-4 3-7z M10 13h4l-1 9h-2z"/>',
  ring: '<circle cx="12" cy="14" r="6"/><path d="M9 5l3 3 3-3"/>', bag: '<path d="M6 8h12l1 12H5z M9 8V6a3 3 0 0 1 6 0v2"/>', heart: '<path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.5-7 10-7 10z"/>',
};
const thumb = d => { const k = d.id === 'keepsake' ? 'heart' : d.kind === 'armor' ? 'armor' : d.kind === 'shield' ? 'shield' : d.kind === 'weapon' || d.kind === 'ammo' ? 'weapon' : /potion/.test(d.id) || d.kind === 'consumable' ? 'potion' : d.kind === 'scroll' ? 'scroll' : d.kind === 'valuable' || d.kind === 'component' ? 'gem' : d.id === 'rations' ? 'food' : d.id === 'torch' || d.id === 'lamp' ? 'light' : d.slot === 'ring' ? 'ring' : 'bag';
  return `<div class="thumb"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${TH[k]}</svg></div>`; };
const gp = cp => SH.fmtGp(cp);
const me = () => X.T.me; const st = () => X.T.game?.state; const open = () => X.T.scene && X.canAct(X.T.scene, X.now()) && !!me();
const shopId = () => (X.T.scene?.shop && open() ? X.T.scene.shop : null);

// ---------- the cart: saved with tonight's action; previewed with the engine on a copy of the public state
export function sim() {
  const T = X.T; if (!me() || !st()) return null; const g = new Game({ state: st() });
  let lines = []; try { lines = SH.applyCart(g, me().cid, T.cart || [], shopId()); } catch (e) { lines = [{ ok: false, why: e.message }]; }
  return { g, lines, c: g.state.chars[me().cid], s: deriveSheet(g.state.chars[me().cid]) };
}
function cartCard(P) {
  const T = X.T; if (!T.cart?.length) return ''; const c0 = st().chars[me().cid];
  const row = (l, i) => { const nm = l.op === 'buy' ? itemDef(SH.instOf(l.key).inst).name + (SH.instOf(l.key).qty > 1 ? ` \u00d7${SH.instOf(l.key).qty}` : '') : l.what || l.op;
    const pr = l.op === 'buy' && shopId() ? SH.priceOf(st(), shopId(), l.key).total : null; const sv = l.op === 'sell' ? sellValue(st().chars[me().cid].inventory.find(i => i.uid === l.uid) || {}) : null;
    return `<li><span style="flex:1;min-width:0">${esc({ buy: 'Buy', sell: 'Sell', equip: 'Equip', unequip: 'Unequip', use: 'Drink', identify: 'Cast Identify on', claim: 'Claim' }[l.op] || l.op)} ${esc(l.op === 'buy' ? nm : l.label || '')}${pr != null ? ` <b class="meta">\u00b7 ${gp(pr)}</b>` : sv ? ` <b class="meta" style="color:#2f6a2c">\u00b7 +${gp(sv)}</b>` : ''}${P.lines[i] && !P.lines[i].ok ? `<div class="meta warn">\u2717 ${esc(P.lines[i].why)}</div>` : ''}</span><button class="btn ghost sm" data-t="cartrm" data-v="${i}" style="width:auto;padding:5px 8px">\u2715</button></li>`; };
  const bad = P.lines.filter(l => !l.ok).length; const d = P.c.coin - c0.coin;
  return `<div class="card" id="cart"><h2>Your cart \u00b7 ${T.cart.length}</h2><ul class="list">${T.cart.map(row).join('')}</ul>
   <div class="row" style="margin-top:8px"><span class="meta">Coin ${gp(c0.coin)} \u2192 <b>${gp(P.c.coin)}</b> (${d >= 0 ? '+' : '\u2212'}${gp(Math.abs(d))})${P.s.ac.v !== deriveSheet(c0).ac.v ? ` \u00b7 AC ${deriveSheet(c0).ac.v} \u2192 <b>${P.s.ac.v}</b>` : ''}</span></div>
   <div class="note">${bad ? `<span class="warn">${bad} line${bad > 1 ? 's' : ''} won\u2019t go through as things stand.</span> ` : ''}Saved with tonight\u2019s action. The GM\u2019s batch applies it when the night resolves (before any fight).</div></div>`;
}
// ---------- paperdoll
const SLOT_L = { head: 'Head', neck: 'Neck', cloak: 'Cloak', armor: 'Armor', main: 'Main hand', off: 'Off hand', ranged: 'Ranged', hands: 'Hands', ring1: 'Ring', ring2: 'Ring', belt: 'Belt', feet: 'Feet' };
function slotHtml(c, s, slot) {
  const it = c.inventory.find(i => i.slot === slot); if (!it) return `<div class="slot empty"><div class="sl">${SLOT_L[slot]}</div><div class="si">empty</div></div>`;
  const d = itemDef(it); const a = s.attacks.find(x => x.uid === it.uid);
  const sub = d.kind === 'armor' ? `AC ${d.ac?.base ?? ''}${d.strReq ? ` \u00b7 STR ${d.strReq} ${s.scores.str >= d.strReq ? '\u2713' : '\u2717'}` : ''}` : d.kind === 'shield' ? `+${2 + (d.plus || 0)} AC` : a ? `${sgn(a.toHit)} \u00b7 ${a.dice}${a.dmgBonus ? sgn(a.dmgBonus) : ''}` : d.attune ? (it.attuned ? 'attuned' : 'not attuned') : d.focus ? 'focus' : '';
  return `<button class="slot" ${open() ? `data-t="cart" data-v="unequip" data-k="${it.uid}"` : 'disabled'}><div class="sl">${SLOT_L[slot]}</div><div class="si">${esc(d.name)}</div>${sub ? `<div class="ss">${esc(sub)}</div>` : ''}</button>`;
}
function dollCard(c, s) {
  const acParts = s.ac.parts.filter(p => p.v).map(p => `${p.src.replace(/ armor$/i, '')} ${p.v}`).join(' + ');
  const over = s.carry.carried > s.carry.cap;
  return `<div class="card"><h2>Equipped \u00b7 ${esc(X.first(c.name))}</h2><div class="doll"><div class="col">${['head', 'neck', 'cloak', 'armor'].map(k => slotHtml(c, s, k)).join('')}</div>
   <div class="fig">${X.AV(me().pid)}<div class="acn">${s.ac.v}</div><div class="ack">Armor class</div></div><div class="col">${['main', 'off', 'ranged', 'hands'].map(k => slotHtml(c, s, k)).join('')}</div></div>
   <div class="bot">${['ring1', 'ring2', 'belt', 'feet'].map(k => slotHtml(c, s, k)).join('')}</div>
   <div class="row" style="margin-top:9px;flex-wrap:wrap;gap:5px"><span class="tag k">AC ${s.ac.v} = ${esc(acParts)}</span>${s.armor?.stealthDis ? '<span class="tag w">Stealth: disadvantage</span>' : ''}<span class="tag m">Attuned ${s.attuned} / 3</span>${over ? `<span class="tag w">Over capacity: speed 5 ft (${s.carry.carried} / ${s.carry.cap} lb)</span>` : ''}</div>
   ${open() ? '<div class="note">Tap a slot to take it off (goes in your cart).</div>' : ''}</div>`;
}
// ---------- pack
function packCard(c, s) {
  const T = X.T; const sh = shopId(); const rest = (X.T.scene?.rest === 'short' || X.T.scene?.rest?.kind === 'short') && open(); const rp = T.restPick || {};
  const canIdentify = (c.prepared || []).includes('identify') || (c.cls === 'wizard' && (c.spellbook || []).includes('identify'));
  const hasPearl = c.inventory.some(i => i.id === 'pearl_100');
  const groups = []; for (const it of c.inventory.filter(i => !i.slot)) { const k = `${it.id}|${it.plus || 0}|${it.scroll || ''}|${!!it.unid}|${it.name || ''}|${it.pints ?? ''}`; const g = groups.find(x => x.k === k); if (g) { g.n += it.qty || 1; g.items.push(it); } else groups.push({ k, n: it.qty || 1, items: [it], it }); }
  const KEY = new Set(['weapon', 'armor', 'shield', 'consumable', 'scroll', 'ammo', 'component', 'valuable', 'magic', 'wondrous']); const isKey = it => { const d = itemDef(it); return it.id === 'keepsake' || it.unid || KEY.has(d.kind) || d.attune || ['rations', 'waterskin', 'torch', 'healers_kit'].includes(d.id) || !!d.focus; };
  const keyG = groups.filter(g => isKey(g.it)), miscG = groups.filter(g => !isKey(g.it)); const showMisc = T.open?.packmisc;
  const rows = [...keyG, ...(showMisc ? miscG : [])].map(({ it, n }) => { const d = itemDef(it); const tags = []; const btn = [];
    if (it.id === 'keepsake') tags.push(['keepsake \u00b7 no stats \u00b7 never sold', 'm']);
    if (it.unid) tags.push(['unidentified: a short rest or Identify', 'w']);
    if (d.use?.heal) tags.push([`heals ${d.use.heal}`, 'g']); if (d.id === 'rations') tags.push([`${n} day${n === 1 ? '' : 's'} of food`, n < 3 ? 'w' : 'g']);
    if (d.id === 'waterskin') tags.push([`${it.pints ?? 4} / 4 pints`, (it.pints ?? 4) < 4 ? 'w' : '']); if (d.kind === 'ammo') tags.push([`${n} left`, n < 10 ? 'w' : '']);
    if (d.kind === 'component') tags.push([`for ${d.forSpell?.replace(/_/g, ' ')}${d.consumed ? ' (used up)' : ''}`, '']);
    if (d.attune && !it.unid) tags.push([it.attuned ? 'attuned' : 'needs attunement (short rest)', 'm']);
    const sv = sellValue(it); if (sh && sv) tags.push([`sells for ${gp(sv)}${n > 1 ? ' each' : ''}${d.fullValue ? ' (full value)' : ''}`, '']);
    if (open()) { const slot = ['armor', 'shield', 'weapon'].includes(d.kind) || (d.slot && d.kind !== 'consumable') ? 1 : 0;
      if (slot && !it.unid) btn.push(`<button class="btn sm" data-t="cart" data-v="equip" data-k="${it.uid}">Equip</button>`);
      if (d.use?.heal && !/greater|superior|supreme/.test(d.id) && c.hp.cur < s.hpMax) btn.push(`<button class="btn sm" data-t="cart" data-v="use" data-k="${it.uid}">Drink</button>`);
      if (sh && sv) btn.push(`<button class="btn ghost sm" data-t="cart" data-v="sell" data-k="${it.uid}">Sell</button>`);
      if (it.unid && rest) btn.push(`<button class="btn ${rp.identify === it.uid ? 'gold' : 'ghost'} sm" data-t="restpick" data-v="identify" data-k="${it.uid}">${rp.identify === it.uid ? '\u2713 Study on rest' : 'Study on rest'}</button>`);
      if (it.unid && canIdentify && hasPearl) btn.push(`<button class="btn ghost sm" data-t="cart" data-v="identify" data-k="${it.uid}">Identify</button>`);
      if (d.attune && !it.attuned && !it.unid && rest) btn.push(`<button class="btn ${rp.attune === it.uid ? 'gold' : 'ghost'} sm" data-t="restpick" data-v="attune" data-k="${it.uid}">${rp.attune === it.uid ? '\u2713 Attune on rest' : 'Attune on rest'}</button>`); }
    return `<div class="item">${thumb(d)}<div style="flex:1"><div class="nm">${esc(it.id === 'keepsake' ? it.name || d.name : d.name)}${n > 1 ? ` \u00d7${n}` : ''}</div><div class="tags">${tags.map(([t, k]) => `<span class="tag ${k}">${esc(t)}</span>`).join('')}</div></div>${btn.length ? `<div class="ibtns">${btn.join('')}</div>` : ''}</div>`; });
  if (miscG.length) rows.push(`<button class="btn ghost sm" data-t="toggle" data-v="packmisc" style="margin-top:8px">${showMisc ? 'Hide other gear' : `Other gear \u00b7 ${miscG.reduce((a, g) => a + g.n, 0)} items (packs, tools, clothes)`}</button>`);
  return `<div class="card"><h2>Pack</h2>${rows.join('') || '<div class="note">Empty.</div>'}<div class="note">Carrying ${s.carry.carried} / ${s.carry.cap} lb \u00b7 Coin ${gp(c.coin)}${rest ? ' \u00b7 tonight ends with a short rest: study one item to identify it, or attune to one' : ''}</div></div>`;
}
// ---------- the shop
function shopCard(P) {
  const T = X.T; const id = shopId(); const where = X.T.scene;
  if (!id) return `<div class="card"><h2>No shop here tonight</h2><div class="note">${where?.status === 'open' && where.shop ? 'The table has locked for tonight.' : 'Shops open on nights in town: Bucky\u2019s stall at the Leaking Tankard II, the Guildhall Bazaar in the capital, and the bridge stall on the frontier.'} Sell back at half price. Rare items are quest-only.</div></div>`;
  const tab = T.shopTab || 'foryou'; const v = SH.shopView(P.g.state, me().cid, id, tab);
  const row = r => { const inCart = (T.cart || []).filter(l => l.op === 'buy' && l.key === r.key).length;
    return `<div class="item">${thumb(itemDef(SH.instOf(r.key).inst))}<div style="flex:1"><div class="nm">${esc(r.name)}${r.left !== Infinity && r.left < 9 ? ` <span class="meta">\u00b7 ${r.left} left</span>` : ''}</div><div class="tags">${r.tags.slice(0, 4).map(t => `<span class="tag ${t.k || ''}">${esc(t.t)}</span>`).join('')}</div></div>
     <div style="text-align:right"><div class="price">${gp(r.price)}${r.discount ? ' <span class="tag g" style="font-size:9px">\u221210%</span>' : ''}</div>${r.left <= 0 ? '<div class="meta warn">sold out</div>' : r.afford ? `<button class="btn sm" data-t="buy" data-v="${esc(r.key)}" style="margin-top:4px;width:auto">${inCart ? `In cart \u00d7${inCart} \u00b7 +1` : 'Buy'}</button>` : `<div class="meta warn">short ${gp(r.short)}</div>`}</div></div>`; };
  return `<div class="card" id="shop"><h2>${esc(v.shop.name)}</h2><div class="meta" style="margin-top:3px">${esc(v.shop.blurb || '')}</div>
   <div class="seg shopseg" style="margin-top:9px">${SH.TABS.map(([k, l]) => `<span class="${k === tab ? 'on' : ''}" data-t="shoptab" data-v="${k}">${esc(l.replace(' & scrolls', ''))}</span>`).join('')}</div>
   <div class="note" style="margin-bottom:2px">Every price shows what it does to <b>your</b> sheet before you buy.${v.discount ? ' Guild discount: 10% off (the Steward\u2019s thanks).' : ''}</div>
   ${v.rows.slice(0, tab === 'foryou' ? 8 : 40).map(row).join('') || '<div class="note">Nothing here for you.</div>'}
   <div class="note">Sell back at half price (gems and art at full value). Rare items are quest-only. Coin after your cart: <b>${gp(P.c.coin)}</b>.</div></div>`;
}
// ---------- loot: Need / Greed / Pass on what the party found; party stash
export function lootCard({ compact = false } = {}) {
  const T = X.T; const s0 = st(); if (!s0 || !me()) return ''; const pend = s0.loot?.pending || []; const stash = (s0.party.stash || []).filter(x => !x.cash); const mode = s0.party.lootMode || 'needgreed';
  if (!pend.length && !(mode === 'party' && stash.length)) return ''; const c = s0.chars[me().cid]; const pick = T.lootPick || {}; const can = open();
  const rowP = x => { const d = itemDef(x.inst); const nd = L.canNeed(c, x.inst); const v = pick[x.lid] || null;
    const seg = ['need', 'greed', 'pass'].map(k => `<span class="${v === k ? 'on' : ''} ${k === 'need' && !nd.ok ? 'off' : ''}" ${can && (k !== 'need' || nd.ok) ? `data-t="lootpick" data-v="${k}" data-k="${x.lid}"` : ''}>${k === 'need' ? 'Need' : k === 'greed' ? 'Greed' : 'Pass'}</span>`).join('');
    return `<div class="item">${thumb(d)}<div style="flex:1"><div class="nm">${esc(d.name)}</div><div class="tags">${x.inst.unid ? '<span class="tag w">unidentified</span>' : ''}${!nd.ok ? `<span class="tag">can\u2019t Need: ${esc(nd.why)}</span>` : ''}<span class="tag">${esc(x.from || '')}</span></div><div class="seg lootseg" style="margin-top:6px">${seg}</div></div></div>`; };
  const rowS = x => { const d = itemDef(x.inst); const owe = x.inst.unid ? 0 : Math.floor((d.cost || 0) / 2 / s0.party.order.length) * (s0.party.order.length - 1); const inCart = (T.cart || []).some(l => l.op === 'claim' && l.lid === x.lid);
    return `<div class="item">${thumb(d)}<div style="flex:1"><div class="nm">${esc(d.name)}</div><div class="tags"><span class="tag">claim: pay the others ${gp(owe)}</span></div></div>${can ? `<button class="btn sm" data-t="claim" data-v="${x.lid}" style="width:auto" ${inCart ? 'disabled' : ''}>${inCart ? 'In cart' : 'Claim'}</button>` : ''}</div>`; };
  return `<div class="card" id="loot"><h2>${pend.length ? 'Loot to divide' : 'Party stash'}</h2><div class="meta" style="margin-top:4px">${pend.length ? 'Coin is already split evenly. For each item pick <b>Need</b> (you\u2019ll use it), <b>Greed</b> (you\u2019d sell it) or <b>Pass</b>. Need beats Greed; ties roll a d20 in tonight\u2019s batch. No pick = Greed.' : 'Party-split mode: claim an item by paying the others their shares of its half-price value. Unclaimed items are sold at the next shop and the coin split.'}</div>
   ${pend.map(rowP).join('')}${mode === 'party' ? stash.map(rowS).join('') : ''}${compact ? '' : ''}</div>`;
}
// ---------- quest board
export function questCard() {
  const s0 = st(); if (!s0) return ''; const qs = questBoard(s0.story || {}).filter(q => q.status !== 'locked'); if (!qs.length) return '';
  const tag = q => q.status === 'done' ? '<span class="tag g">Done</span>' : q.status === 'started' ? '<span class="tag m">In progress</span>' : '<span class="tag">Optional</span>';
  return `<div class="card" id="quests"><h2>Side quests</h2>${qs.map(q => `<div class="item"><div class="thumb"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M6 3h9l3 3v15H6z M9 9h6 M9 13h6 M9 17h3"/></svg></div><div style="flex:1"><div class="nm">${esc(q.title)} ${tag(q)}</div><div class="meta">${esc(q.pitch)}</div><div class="tags" style="margin-top:4px"><span class="tag g">${esc(q.reward)}</span></div></div></div>`).join('')}
   <div class="note">Optional. Want one? Say so in your move (\u201cwe take the relic job\u201d) and the GM slots it in as a night between main scenes.</div></div>`;
}
export function gearView() {
  if (!me()) return '<div class="card"><div class="note">You are watching. Gear is per hero.</div></div>';
  const c = st().chars[me().cid]; const s = deriveSheet(c); const P = sim();
  return `<div class="stephead"><div class="eyebrow">${esc(X.T.scene?.shop ? (SH.SHOPS[X.T.scene.shop]?.place || 'In town') : (X.T.scene?.place ? X.T.scene.place.split(' \u00b7 ')[0] + ' \u00b7 no shop open' : 'On the road'))}</div><div class="title">Gear</div></div>` + lootCard() + dollCard(c, s) + cartCard(P) + packCard(c, s) + shopCard(P);
}
// ---------- issues
export function issuesView() {
  const T = X.T; const all = (T.issues || []).map(I.readIssue); const host = T.camp?.host; const isHost = X.OWNER === host;   const B = { needs: all.filter(i => i.status === 'options'), open: all.filter(i => ['filed', 'decided', 'built'].includes(i.status)), done: all.filter(i => ['released', 'rejected', 'ruled'].includes(i.status)) };
  const tab = T.issueTab || (B.needs.length ? 'needs' : 'open');
  const who = pid => T.players.find(p => p.pid === pid); const catTag = c => `<span class="tag ${{ bug: 'w', rules: 'g', ui: 'b', story: 'm' }[c]}">${esc(I.CATS[c])}</span>`;
  const stTag = i => `<span class="tag ${i.status === 'options' ? 'w' : ['released', 'ruled', 'built'].includes(i.status) ? 'g' : ''}">${esc(i.status === 'options' ? (isHost ? 'Needs you' : 'Awaiting Wes') : I.STATUS_TXT[i.status])}</span>`;
  const flow = i => { const idx = { filed: 0, options: 2, decided: 3, built: 4, released: 5 }[i.status] ?? 0; return `<div class="flow">${['Filed', 'Options', 'Wes picks', 'Built', 'Released'].map((l, j) => `<span class="${j < idx ? 'done' : j === idx ? 'on' : ''}">${l}</span>`).join('')}</div>`; };
  const card = i => { const p = who(i.by); const head = `<div class="row" style="gap:8px">${X.AV(i.by)}<div style="flex:1;min-width:0"><div class="meta"><b>#${esc(i.id.slice(-4))}</b> \u00b7 ${esc(X.first(p?.name || i.by))} \u00b7 ${catTag(i.cat)}</div><div style="font:700 15px/1.25 Alegreya,serif;margin-top:3px">${esc(i.text)}</div></div>${stTag(i)}</div>`;
    if (i.status === 'ruled') return `<div class="card">${head}<div class="called" style="margin-top:9px">${esc(i.ruling?.text || '')} <span style="color:#cdb27a">(${esc(i.ruling?.srd || 'SRD 5.2.1')})</span></div></div>`;
    const opts = (i.options || []).map(o => `<div class="opt ${o.rec ? 'rec' : ''} ${i.decision?.pick === o.key ? 'picked' : ''}"><b>${esc(o.key)} \u00b7 ${esc(o.text)}${o.rec ? ' \u2605' : ''}</b><div class="meta">${o.rec ? '<b>Recommended:</b> ' : ''}${esc(o.why)}</div></div>`).join('');
    const rec = (i.options || []).find(o => o.rec);
    const btns = i.status === 'options' && isHost ? `<div class="row" style="margin-top:9px;gap:6px">${rec ? `<button class="btn sm" data-t="decide" data-v="${rec.key}" data-k="${i.id}" style="flex:1">Pick ${rec.key}</button>` : ''}${(i.options || []).filter(o => !o.rec).map(o => `<button class="btn ghost sm" data-t="decide" data-v="${o.key}" data-k="${i.id}" style="width:auto">${o.key}</button>`).join('')}<button class="btn ghost sm" data-t="decide" data-v="other" data-k="${i.id}" style="width:auto">Other\u2026</button><button class="btn ghost sm" data-t="decide" data-v="reject" data-k="${i.id}" style="width:auto">Reject</button></div>` : '';
    const dec = i.decision ? `<div class="note">Wes picked <b>${esc(i.decision.pick === 'other' ? 'something else' : i.decision.pick)}</b>${i.decision.note ? `: \u201c${esc(i.decision.note)}\u201d` : ''}.${i.status === 'decided' ? ' Queued to build.' : ''}</div>` : i.status === 'filed' ? '<div class="note">With the GM: options coming.</div>' : '';
    return `<div class="card">${head}${flow(i)}${opts}${btns}${dec}</div>`; };
  const n = B.needs.length; const cat = T.reportCat || 'bug';
  const queue = `<div class="card dark"><div class="row"><div><h2 style="display:block">${isHost ? 'Your queue' : 'Wes\u2019s queue'}</h2><div class="meta" style="color:#cdb27a;margin-top:4px">${isHost ? 'Host seat only. Nothing gets built until you pick.' : 'Wes picks every fix. Nothing gets built until he does.'}</div></div><div class="sp"></div><div class="timer" style="font-size:30px">${n}</div></div>
   <div class="seg dseg" style="margin-top:9px">${[['needs', isHost ? 'Needs you' : 'Needs Wes'], ['open', 'Open'], ['done', 'Done']].map(([k, l]) => `<span class="${k === tab ? 'on' : ''}" data-t="issuetab" data-v="${k}">${l} \u00b7 ${B[k].length}</span>`).join('')}</div></div>`;
  const form = `<div class="card" id="report"><h2>Report an issue</h2><div class="seg" style="margin-top:9px">${Object.entries(I.CATS).map(([k, l]) => `<span class="${k === cat ? 'on' : ''}" data-t="reportcat" data-v="${k}">${l}</span>`).join('')}</div>
   <textarea rows="3" data-f="report" style="margin-top:8px" placeholder="What happened, or what would you change?">${esc(T.reportText || '')}</textarea>
   <div class="row" style="margin-top:8px"><label class="tag" style="cursor:pointer"><input type="checkbox" data-f="attach" ${T.reportAttach !== false ? 'checked' : ''} style="width:auto;margin:0 4px 0 0"> attach ${T.reportFrom ? `the ${esc(T.reportFrom)} screen` : 'this screen'} + game state</label><div class="sp"></div><button class="btn sm" data-t="fileissue" style="width:auto">File it</button></div>
   ${T.reportDone ? `<div class="note" style="color:#2f6a2c">\u2713 Filed as #${esc(T.reportDone.slice(-4))}. The GM writes options; Wes picks.</div>` : ''}<div class="note">For in-story asks (\u201ccan I buy the goose\u2019s hat?\u201d) use your move on the Table tab instead.</div></div>`;
  return queue + (B[tab].map(card).join('') || `<div class="card"><div class="note">Nothing here.</div></div>`) + form;
}
// ---------- events from table.js
export async function onGearClick(t, v, k, b) {
  const T = X.T;
  if (t === 'shoptab') { T.shopTab = v; return 'render'; }
  if (t === 'buy') { T.cart = [...(T.cart || []), { op: 'buy', key: v }]; return 'save'; }
  if (t === 'cartrm') { T.cart = T.cart.filter((_, i) => i !== +v); return 'save'; }
  if (t === 'claim') { T.cart = [...(T.cart || []), { op: 'claim', lid: v }]; return 'save'; }
  if (t === 'cart') { const c = st().chars[me().cid]; const it = c.inventory.find(i => i.uid === k); const label = it ? itemDef(it).name : '';
    T.cart = [...(T.cart || []).filter(l => !(l.uid === k && ['equip', 'unequip'].includes(l.op) && ['equip', 'unequip'].includes(v))), { op: v, uid: k, label, ...(v === 'identify' ? { owner: me().cid } : {}) }]; return 'save'; }
  if (t === 'restpick') { const cur = { ...(T.restPick || {}) }; const was = cur[v] === k; delete cur.identify; delete cur.attune; T.restPick = was ? cur : { ...cur, [v]: k }; return 'save'; }
  if (t === 'lootpick') { T.lootPick = { ...(T.lootPick || {}), [k]: v }; return 'save'; }
  if (t === 'issuetab') { T.issueTab = v; return 'render'; }
  if (t === 'reportcat') { T.reportCat = v; return 'render'; }
  if (t === 'fileissue') { const ctx = T.reportAttach === false ? null : { screen: T.reportFrom || 'issues', night: T.n, view: T.reportFromView || null, k: T.reportFromK ?? null, hero: me()?.cid || null, logLen: T.game?.logLen ?? null, ua: navigator.userAgent.slice(0, 120), w: innerWidth };
    const i = I.newIssue({ by: X.OWNER, cat: T.reportCat || 'bug', text: T.reportText, ctx, now: X.now() }); await X.store.fileIssue(i); T.reportText = ''; T.reportDone = i.id; T.issues = await X.store.listIssues(); return 'render'; }
  if (t === 'decide') { let note = ''; if (v === 'other') { note = prompt('What should happen instead?') || ''; if (!note.trim()) return 'render'; } await X.store.decideIssue(k, v, note.trim()); T.issues = await X.store.listIssues(); T.issueTab = 'open'; return 'render'; }
  return null;
}
