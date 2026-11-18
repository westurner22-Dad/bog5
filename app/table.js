// BoG V · Phase 3–4 · the nightly table (player app). Scene → lock in → resolution → recap; battle orders; party;
// Phase 4: Gear (shop, pack, paperdoll, cart), loot (Need / Greed), side quests, and the issue log (gear.js).
// Everything shown comes from what the GM tool published (scene, result, public engine state). The app never
// rolls a die for the table; it verifies the revealed seed against the hash posted when the scene opened.
import * as N from '../engine/src/night.js';
import { deriveSheet } from '../engine/src/character.js';
import { SKILLS } from '../engine/src/rules/origins.js';
import SRD from '../engine/srd/data/srd.js';
import * as P from './portrait.js';
import * as G from './gear.js';
import * as F5 from './phase5.js';
import * as PA from './portrait-art.js';
import { partySupplies, suppliesOf } from '../engine/src/shop.js';

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const md = s => esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/\*(.+?)\*/g, '<i>$1</i>');
const sgn = n => (n >= 0 ? '+' : '\u2212') + Math.abs(n);
const first = n => N.shortName(String(n || ''));
const ICON = {
  table: '<path d="M12 2.5l8.5 4.9v9.2L12 21.5 3.5 16.6V7.4z"/><path d="M12 2.5L7.5 15h9z M3.5 7.4L7.5 15 M20.5 7.4L16.5 15 M7.5 15L12 21.5 16.5 15"/>',
  hero: '<path d="M5 14a7 7 0 0 1 14 0v6h-4.5v-4h-5v4H5z"/><path d="M12 7v6 M8.5 12.5h7"/>',
  party: '<path d="M12 3l7 3v5c0 5-3.5 8.5-7 10-3.5-1.5-7-5-7-10V6z"/><path d="M12 3v18 M5.3 11h13.4"/>',
  chron: '<path d="M7 4h11a2 2 0 0 1 0 4h-1 M7 4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V8"/><path d="M8.5 11h5.5 M8.5 14h5.5 M8.5 17h3"/>',
  talk: '<path d="M7 11V6.5a1.5 1.5 0 0 1 3 0V11 M10 10V5a1.5 1.5 0 0 1 3 0v5 M13 10V6a1.5 1.5 0 0 1 3 0v6c0 4-2.5 8-6.5 8S5 17 4 14l-1-3a1.4 1.4 0 0 1 2.5-1.2L7 12"/>',
  lore: '<path d="M4 5.5c3-1 6-1 8 1 2-2 5-2 8-1v13c-3-1-6-1-8 1-2-2-5-2-8-1z"/><path d="M12 6.5v13"/>',
  notice: '<circle cx="10.5" cy="10.5" r="6"/><path d="M15 15l5 5"/>',
  risky: '<path d="M12 3v5 M12 16v5 M3 12h5 M16 12h5 M6 6l3 3 M15 15l3 3 M18 6l-3 3 M9 15l-3 3"/>',
  gear: '<path d="M6 8h12l1 12H5z M9 8V6a3 3 0 0 1 6 0v2"/><path d="M9.5 13h5"/>',
  issues: '<path d="M5 21V4 M5 4h11l-2 4 2 4H5"/>',
  spells: '<path d="M12 3l1.8 4.6L18.5 9l-4.7 1.4L12 15l-1.8-4.6L5.5 9l4.7-1.4z"/><path d="M6 17l.9 2.1L9 20l-2.1.9L6 23l-.9-2.1L3 20l2.1-.9z M18 15l.7 1.6 1.6.7-1.6.7-.7 1.6-.7-1.6-1.6-.7 1.6-.7z"/>',
  sword: '<path d="M14.5 4H20v5.5L9 20.5 3.5 15z M5 13l6 6 M3 21l3-3"/>',
};
const svgI = k => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ICON[k] || ICON.risky}</svg>`;
const D20 = (n, col = '#2c6a8a', cls = '') => `<div class="d20 ${cls}"><svg viewBox="0 0 54 58"><polygon points="27,2 51,15.5 51,42.5 27,56 3,42.5 3,15.5" fill="${col}" stroke="#1c120b" stroke-width="2"/><polygon points="27,11 45,41 9,41" fill="rgba(255,255,255,.13)" stroke="rgba(255,255,255,.35)" stroke-width="1.2"/><path d="M27 2v9 M3 15.5L27 11 51 15.5 M3 15.5L9 41 M51 15.5L45 41 M3 42.5L9 41 M51 42.5L45 41 M27 56L9 41 M27 56L45 41" stroke="rgba(255,255,255,.28)" stroke-width="1.1" fill="none"/></svg><b>${esc(n)}</b></div>`;
const STANCE_TXT = { cautious: 'Cautious', support: 'Support', aggressive: 'Aggressive' };
const XP_NEXT = { 3: 2700, 4: 6500, 5: 14000 };

let ctx, store, renderSheet, OWNER; const T = { view: 'table', n: null, results: {}, scenes: {}, draft: null, orders: null, pickCell: false, open: {} };
const now = () => ctx.now();
const q = new URLSearchParams(location.search);

// ---------- data ----------
async function load() {
  T.camp = await store.campaign(); T.n = T.camp.currentNight || 0; T.game = await store.game();
  T.heroes = await store.listHeroes(); await PA.ready(); PA.verify(T.heroes.map(h => { try { return PA.paintingFor(PA.lookOf(h.draft, h.ch)); } catch { return null; } }), () => render()); T.players = Object.entries(T.camp.players || {}).map(([pid, p]) => ({ pid, name: p.hero || p.name, player: p.name, cid: p.cid }));
  T.me = T.players.find(p => p.pid === OWNER) || null; T.stances = (await store.p.get('stances')) || {};
  if (T.n) { T.scene = await store.scene(T.n); T.locks = await store.locks(T.n); T.mine = T.me ? await store.myAction(T.n) : null; T.scenes[T.n] = T.scene; T.results[T.n] = await store.result(T.n); }
  T.party = T.n && T.me && T.scene?.status === 'open' ? await store.partyActions(T.n, T.players.map(p => p.pid)).catch(() => ({})) : {};
  if (T.draft == null) T.draft = T.mine ? { ...T.mine } : { kind: null, moveId: null, text: '', say: '', sayMode: 'say' };
  if (T.cart == null) { T.cart = T.mine?.cart || []; T.lootPick = T.mine?.loot || {}; T.restPick = T.mine?.rest || {}; F5.loadExtras(T.mine); }
  T.asks = await store.listAsks().catch(() => []);
  T.issues = await store.listIssues().catch(() => []);
  if (T.orders == null) T.orders = T.mine?.orders ? structuredClone(T.mine.orders) : { thisRound: { move: null, action: { do: 'attack', target: 'nearest' } }, standing: [], preset: 'none' };
}
async function resultOf(k) { if (!(k in T.results) || !T.results[k]) T.results[k] = await store.result(k); if (!T.scenes[k]) T.scenes[k] = await store.scene(k); return T.results[k]; }
const ch = cid => T.game?.state?.chars?.[cid]; const sheetOf = cid => { const c = ch(cid); return c ? deriveSheet(c) : null; };
const heroRec = pid => T.heroes.filter(h => h.owner === pid).at(-1);
// painted portrait + live gear overlay (portrait-art.js); procedural SVG underneath as the offline fallback
const AVC = new Map();
const avStyle = pid => { const h = heroRec(pid); if (!h) return ''; const p = T.players.find(x => x.pid === pid); const c = (p && ch(p.cid)) || h.ch;
  const k = pid + '|' + JSON.stringify((c?.inventory || []).filter(i => i.slot).map(i => [i.id, i.slot, i.magic, i.bonus])) + PA.badCount();
  if (!AVC.has(k)) { let st; try { st = h.draft ? PA.layers(h.draft, c).style : ''; } catch (e) { console.warn('portrait', e); } AVC.set(k, st || `background-image:url("${P.svgDataUrl(h.portraitSvg || P.fallbackCrest(p?.name))}")`); }
  return AVC.get(k); };
const pidOfCid = cid => T.players.find(p => p.cid === cid)?.pid;
const AV = (pid, extra = '') => `<span class="av" style="${esc(avStyle(pid))}${extra}"></span>`;
const stanceOf = pid => T.stances[pid] || 'cautious';
const fmtLeft = ms => { const m = Math.max(0, Math.round(ms / 60000)); return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`; };
const timeLA = ms => new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', hour: 'numeric', minute: '2-digit' }).format(new Date(ms)) + ' PT';
const dayLA = ms => new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', weekday: 'short', month: 'short', day: 'numeric' }).format(new Date(ms));
const status = () => N.tableStatus(T.scene, Object.fromEntries(Object.entries(T.locks || {}).map(([k, v]) => [k, { locked: v.state === 'locked', text: v.state === 'thinking' ? '…' : undefined }])), T.players, now());

// ---------- chrome ----------
function header() {
  const sc = T.scene; const coin = T.players.reduce((s, p) => s + (ch(p.cid)?.coin || 0), 0);
  const pcs = T.players.map(p => { const c = ch(p.cid); const s = sheetOf(p.cid); const hp = c?.hp.cur ?? 0, mx = s?.hpMax || 1;
    return `<button class="pc ${p.pid === OWNER ? 'me' : ''}" data-t="sheet" data-v="${p.pid}">${AV(p.pid)}<div style="min-width:0;flex:1"><div class="nm">${esc(first(p.name))}</div><div class="row2"><div class="hp"><i style="width:${Math.round(100 * hp / mx)}%"></i></div><div class="st">${hp}/${mx}</div></div></div></button>`; }).join('');
  return `<header class="tbl"><div class="brand"><div class="logo">Balls or Gapes V<small>Reforged \u00b7 ${esc(T.camp.adventureTitle || 'Adventure 1')}</small></div><div class="night">${sc ? `<b>Night ${sc.n}</b>${esc(sc.place.split(' \u00b7 ')[0])} \u00b7 ${esc(sc.time || '')}` : '<b>Session 0</b>The Forge'}</div></div>
  <div class="party">${pcs}</div>${suppliesRow(coin)}</header>`;
}
function suppliesRow(coin) { const mine = T.me && T.game?.state?.chars?.[T.me.cid]; const S = !T.game?.state ? null : mine ? (x => ({ rationDays: x.rations, waterFull: mine.inventory.some(i => i.id === 'waterskin') && mine.inventory.filter(i => i.id === 'waterskin').every(i => (i.pints ?? 4) >= 4), waterDays: x.pints ? `${x.pints}/${4 * mine.inventory.filter(i => i.id === 'waterskin').length} pt` : 'none', torches: x.torches }))(suppliesOf(mine)) : partySupplies(T.game.state); const it = (l, v, w) => `<span${w ? ' class="lowsup"' : ''}>${l} <b>${v}</b></span>`;
  if (!S) return `<div class="supplies">${it('Party gold', Math.floor(coin / 100))}</div>`;
  return `<div class="supplies">${[it('Rations', `${S.rationDays} day${S.rationDays === 1 ? '' : 's'}`, S.rationDays < 2), it('Water', S.waterFull ? 'full' : typeof S.waterDays === 'string' ? S.waterDays : `${S.waterDays} d`, !S.waterFull), it('Torches', S.torches, S.torches < 2), it('Party gold', Math.floor(coin / 100))].join('<span>\u00b7</span>')}</div>`; }
function nav() { const v = T.view; const on = k => (k === 'table' && ['table', 'night', 'asks'].includes(v)) || (k === 'hero' && ['hero', 'party', 'sheet', 'levelup'].includes(v)) || (k === 'chron' && ['chron', 'recap'].includes(v)) || k === v;
  const badge = k => k === 'issues' && T.camp?.host === OWNER && (T.issues || []).some(i => i.status === 'options' && !i.decision) ? '<i class="dot"></i>' : k === 'gear' && (T.game?.state?.loot?.pending?.length || (T.scene?.shop && T.scene.status === 'open')) ? '<i class="dot g"></i>' : k === 'hero' && F5.canLevel() ? '<i class="dot g"></i>' : '';
  return `<nav class="tnav six">${[['table', 'Table'], ['hero', 'Hero'], ['gear', 'Gear'], ['spells', 'Spells'], ['chron', 'Chronicle'], ['issues', 'Issues']].map(([k, l]) => `<button class="${on(k) ? 'on' : ''}" data-t="go" data-v="${k}">${svgI(k)}${badge(k)}${l}</button>`).join('')}</nav>`; }
const REPORT = () => T.view === 'issues' ? '' : `<button class="reportlink" data-t="report">\u2691 Report an issue with this screen</button>`;
const FOOT = '<div class="foot tfoot">This work includes material from the System Reference Document 5.2.1 (\u201cSRD 5.2.1\u201d) by Wizards of the Coast LLC, available at https://www.dndbeyond.com/srd, licensed under the Creative Commons Attribution 4.0 International License.</div>';

// ---------- scene (tonight) ----------
function band(sc) { return `<div class="band" style="background-image:url('assets/bg/${esc(sc.bg)}.png')"><div class="lbl">Night ${sc.n} \u00b7 ${esc(sc.place)} \u00b7 ${esc((sc.time || '').toLowerCase())}<b>${esc(sc.title)}</b></div></div>`; }
function sceneCard(sc) { return `<div class="card">${band(sc)}${(sc.prose || []).map(p => `<p class="prose">${md(p)}</p>`).join('')}${sc.quote ? `<div class="quote">${esc(sc.quote.text)}<span class="qwho"> \u2014 ${esc(sc.quote.who)}</span></div>` : ''}</div>`; }
function lockCard(st) {
  const chip = r => { const me = r.pid === OWNER; const lbl = r.state === 'locked' ? '\u2713 locked' : r.state === 'thinking' ? '\u00b7 thinking' : st.open ? '\u00b7 waiting' : `\u00b7 absent (${STANCE_TXT[stanceOf(r.pid)]})`;
    return `<span class="lk ${r.state === 'locked' ? 'ok' : 'wait'}">${AV(r.pid)}${me ? 'You' : esc(first(r.name))} <b>${lbl}</b></span>`; };
  const missing = st.rows.filter(r => r.state !== 'locked');
  return `<div class="card dark" id="lockcard"><div class="row"><div><div class="sc" style="font-size:11px;color:#cdb27a">${st.open ? 'Table locks in' : 'Table locked'}</div><div class="timer">${st.open ? fmtLeft(st.msLeft) : st.allIn && !st.pastCutoff ? 'All in' : '9:00 PM'}</div>
   <div class="meta" style="color:#b89b62">${st.open ? `${N.fmtLA(T.scene.cutoffMs)} \u00b7 or as soon as all ${st.total} lock` : 'Tonight\u2019s moves are with the GM. Results post after resolution.'}</div></div><div class="sp"></div><div class="lockn">${st.lockedN}/${st.total}</div></div>
   <div class="lockline">${st.rows.map(chip).join('')}</div>
   <div class="note" style="color:#a88f62">${missing.length ? `If someone misses the cutoff, their preset stance is used (${missing.map(r => `${esc(first(r.name))}: ${STANCE_TXT[stanceOf(r.pid)]}`).join(', ')}).` : 'Everyone is in. The GM can resolve early.'}</div>
   <div class="hash">Dice for tonight: sha256 <b>${esc(T.scene.commit.slice(0, 4))}\u2026${esc(T.scene.commit.slice(-4))}</b> posted \u2713 \u00b7 seed revealed with the results</div></div>`;
}
function movesCard(sc, st) {
  const me = T.me; if (!me) return '<div class="card"><div class="note">You are watching. Add <b>?player=p1</b> (etc.) to play.</div></div>';
  const s = sheetOf(me.cid); const d = T.draft; const locked = T.mine?.locked; const canEdit = st.open;
  const mod = m => { if (!m.skill) return ''; const k = m.skillKey; const v = k && s.skills[k] ? s.skills[k].v : k && s.mods[k] != null ? s.mods[k] : null; return v == null ? esc(m.skill) : `${esc(m.skill)} ${sgn(v)}`; };
  const wordCls = w => ({ 'Very Easy': 'g', Easy: 'g', Medium: '', Hard: 'w', 'Very Hard': 'w', 'Nearly Impossible': 'w' }[w] ?? '');
  const mv = m => `<button class="move ${d.kind === 'move' && d.moveId === m.id ? 'sel' : ''}" data-t="move" data-v="${m.id}" ${canEdit ? '' : 'disabled'}><div class="ic">${svgI(m.tags?.[0])}</div><div style="flex:1"><div class="t">${esc(m.label)}${m.hint ? `<small>${esc(m.hint)}</small>` : ''}</div><div class="d"><span class="tag">${mod(m)}</span><span class="tag ${wordCls(m.word)}">${esc(m.word)}</span>${(m.tags || []).includes('risky') ? '<span class="tag m">risky</span>' : ''}</div></div><div class="check"></div></button>`;
  if (locked && !T.editing) { const what = T.mine.kind === 'move' ? sc.moves.find(m => m.id === T.mine.moveId)?.label : `\u201c${T.mine.text}\u201d`;
    return `<div class="card"><h2>Your move, ${esc(first(me.name))}</h2><div class="move sel" style="cursor:default"><div class="ic">${svgI('risky')}</div><div style="flex:1"><div class="t">${esc(what)}</div>${T.mine.say ? `<div class="meta" style="margin-top:4px"><b style="color:var(--wine)">${T.mine.sayMode === 'whisper' ? 'Whisper' : 'I say'}:</b> \u201c${esc(T.mine.say)}\u201d</div>` : ''}</div><div class="check"></div></div>
     <div class="note">\u2713 Locked at ${timeLA(T.mine.at)}. ${canEdit ? 'You can change it until the table locks.' : 'The table has locked.'}</div>${canEdit ? '<div class="row" style="margin-top:9px"><button class="btn ghost" data-t="unlock" style="flex:1;color:var(--wine);border-color:var(--wine)">Change my move</button></div>' : ''}</div>`; }
  const ok = d.kind === 'move' ? !!d.moveId : d.kind === 'free' ? d.text.trim().length >= 3 : false;
  return `<div class="card"><h2>Your move, ${esc(first(me.name))}</h2><div class="meta" style="margin-top:6px">Pick one, or do something else. You can change it until the table locks.</div>${sc.moves.map(mv).join('')}
   <div style="margin-top:12px" class="sc meta"><b style="color:var(--wine)">Or: I do something else</b></div><textarea rows="2" data-f="text" placeholder="Describe what you try. The GM calls the check\u2026" ${canEdit ? '' : 'disabled'}>${esc(d.text)}</textarea>
   <div class="row" style="margin-top:9px"><div class="seg" style="flex:1"><span class="${d.sayMode !== 'whisper' ? 'on' : ''}" data-t="saymode" data-v="say">I say\u2026</span><span class="${d.sayMode === 'whisper' ? 'on' : ''}" data-t="saymode" data-v="whisper">Whisper to party</span></div></div>
   <textarea rows="2" style="margin-top:7px" data-f="say" placeholder="Optional in-character line" ${canEdit ? '' : 'disabled'}>${esc(d.say)}</textarea><div class="note">Optional. The GM may award Heroic Inspiration for a great one.</div>
   <div class="row" style="margin-top:11px"><button class="btn" data-t="lock" style="flex:1" ${ok && canEdit ? '' : 'disabled'}>Lock my move</button></div></div>`;
}
// Phase 5 note 3: what each teammate has picked so far (move, free text or battle orders) and their party line, live
// while the night is open. Teammates only; foes' plans stay hidden. Refreshed in place every 8 s (no reload mid-typing).
function partyCard(st) {
  if (!T.me || !st.open || !T.scene) return ''; const mates = T.players.filter(p => p.pid !== OWNER); if (!mates.length) return '';
  const lk = pid => T.locks?.[pid]?.state; const sc = T.scene;
  const row = p => { const a = T.party?.[p.pid]; const c = ch(p.cid); const s = sheetOf(p.cid); const state = lk(p.pid);
    const tag = state === 'locked' ? '<span class="tag g">\u2713 locked</span>' : state === 'thinking' ? '<span class="tag">thinking</span>' : '<span class="tag">waiting</span>';
    let what;
    if (!a || (!a.kind && !a.orders)) what = `<span class="meta">${state ? 'Still deciding\u2026' : 'Hasn\u2019t picked yet.'}</span>`;
    else if (sc.battle && a.orders && c && s) { const L = orderLines(a.orders, s, c); what = L.filter(([k, v]) => !(k === 'Standing order' && /^(none|no standing order)$/i.test(v))).map(([k, v]) => `<b>${esc(k)}:</b> ${v}`).join(' \u00b7 '); }
    else if (a.kind === 'move') what = `<b>${esc(sc.moves.find(m => m.id === a.moveId)?.label || a.moveId)}</b>`;
    else if (a.kind === 'free') { const t = String(a.text || ''); what = `<b>Something else:</b> \u201c${esc(t.length > 160 ? t.slice(0, 157) + '\u2026' : t)}\u201d`; }
    else what = '<span class="meta">Still deciding\u2026</span>';
    const say = a?.say ? `<div class="meta" style="margin-top:3px"><b style="color:var(--wine)">${a.sayMode === 'whisper' ? 'Whispers to the party' : 'Says'}:</b> \u201c${esc(a.say)}\u201d</div>` : '';
    return `<div class="who" style="margin-top:9px">${AV(p.pid)}<div style="flex:1;min-width:0"><div class="n">${esc(first(p.name))} ${tag}</div><div class="meta" style="margin-top:2px;color:var(--ink)">${what}</div>${say}</div></div>`; };
  return `<div class="card" id="partycard"><h2>Your party tonight</h2><div class="meta" style="margin-top:4px">What your teammates have picked so far. It updates as they change their minds, until the table locks.</div>${mates.map(row).join('')}</div>`;
}
function tableView() {
  if (!T.n || !T.scene) return `<div class="card"><h2>No scene yet</h2><div class="note">The GM hasn\u2019t opened Night 1. Your hero can still be reforged until then.</div></div>`;
  const sc = T.scene; const st = status(); const prev = T.n > 1 ? `<button class="card ribbon" data-t="night" data-v="${T.n - 1}"><span>Last night: <b>${esc(T.scenes[T.n - 1]?.title || 'Night ' + (T.n - 1))}</b></span><span>Results \u2192</span></button>` : '';
  if (sc.status === 'resolved' && T.results[T.n]) return resolutionView(T.n) + F5.askCard();
  if (sc.battle) return prev + F5.levelBanner() + battleView(st) + F5.restCard() + F5.askCard();
  const shopTeaser = sc.shop && st.open && T.me ? `<button class="card ribbon" data-t="go" data-v="gear"><span>\u{1F6D2} <b>${esc(sc.shop === 'tankard' ? 'Bucky\u2019s stall' : sc.shop === 'capital' ? 'The Guildhall Bazaar' : 'The bridge stall')}</b> is open tonight${T.cart?.length ? ` \u00b7 ${T.cart.length} in your cart` : ''}</span><span>Gear \u2192</span></button>` : '';
  return prev + F5.levelBanner() + sceneCard(sc) + G.lootCard() + movesCard(sc, st) + partyCard(st) + F5.restCard() + shopTeaser + lockCard(st) + F5.askCard() + G.questCard();
}

// ---------- battle ----------
const foeLabel = c => { const nm = c.name; const n = nm.match(/(\d+)$/); const ini = nm.replace(/\s*\d+$/, '').split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase(); return c.boss ? ini.slice(-1) : ini + (n ? n[1] : ''); };
function mapHtml(view, { dest = null, clickable = false, paused = null } = {}) {
  if (!view?.map) return ''; const { w, h, terrain = {} } = view.map; const S = 44; let cells = '';
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const t = terrain[`${x},${y}`]; const cls = t === 'wall' ? (view.map.water ? 'water' : 'bar') : t === 'difficult' ? 'tbl' : (x + y) % 2 ? 'floor' : 'floor2';
    cells += `<div class="cell ${cls}" ${clickable && t !== 'wall' ? `data-t="cell" data-x="${x}" data-y="${y}"` : ''}>${x === 0 ? `<i>${y + 1}</i>` : y === 0 ? `<i>${'ABCDEFGHIJ'[x]}</i>` : ''}</div>`; }
  const toks = view.combatants.map(c => { const big = c.boss; const sz = big ? 38 : 38; const L = c.pos[0] * S + 3, Tp = c.pos[1] * S + 3; const down = c.hp <= 0;
    if (c.side === 'pc' || c.kind === 'pc') { const pid = pidOfCid(c.cid); return `<div class="tok pc ${pid === OWNER ? 'me' : ''} ${down ? 'down' : ''}" style="left:${L}px;top:${Tp}px;width:${sz}px;height:${sz}px">${AV(pid)}</div>`; }
    if (down) return `<div class="tok foe gone" style="left:${L + 9}px;top:${Tp + 9}px;width:20px;height:20px"><b>\u2715</b></div>`;
    return `<div class="tok foe ${big ? 'big' : ''} ${c.hp <= c.max / 2 ? 'bl' : ''}" style="left:${L}px;top:${Tp}px;width:${sz}px;height:${sz}px"><b>${esc(foeLabel(c))}</b></div>`; }).join('');
  return `<div class="map" style="grid-template-columns:repeat(${w},44px);grid-template-rows:repeat(${h},44px);width:${w * 44}px;height:${h * 44}px">${cells}${toks}${dest ? `<div class="dest" style="left:${dest[0] * 44 + 3}px;top:${dest[1] * 44 + 3}px"></div>` : ''}${paused ? `<div class="paused"><span>${esc(paused)}</span></div>` : ''}</div>`;
}
function initStrip(view) { const order = view.order || []; const cur = order[view.turn];
  return `<div class="init">${order.map(u => { const c = view.combatants.find(x => x.uid === u); if (!c || c.hp <= 0 && c.side !== 'pc') return ''; const pid = c.cid ? pidOfCid(c.cid) : null;
    return `<span class="ini ${u === cur ? 'now' : ''}">${pid ? AV(pid) : `<span class="fd">${esc(foeLabel(c))}</span>`}${pid === OWNER ? 'you' : esc(first(c.name))}</span>`; }).join('')}</div>`; }
function legend(view) { const foes = view.combatants.filter(c => c.side !== 'pc' && c.kind !== 'pc');
  const lg = { floor: 'floor', difficult: 'tables (difficult)', wall: 'bar (wall)', ...(view.map?.legend || {}) };
  return `<div class="legend"><span style="--c:#8a6438">${esc(lg.floor)}</span><span style="--c:repeating-linear-gradient(45deg,#5b3d1f 0 3px,#3a2612 3px 6px)">${esc(lg.difficult)}</span><span style="--c:${view.map?.water ? '#2f6f9e' : '#2b1c12'}">${esc(lg.wall)}</span><span style="--c:#e35d4f">bloodied</span></div>
   <div class="meta" style="color:#b89b62;margin-top:6px">${foes.map(f => `<b style="color:#f0d58a">${esc(foeLabel(f))}</b> ${esc(f.name)} ${f.hp > 0 ? `(${f.hp <= f.max / 2 ? 'bloodied' : 'unhurt'})` : '(down)'}`).join(' \u00b7 ')}</div>`; }
const SPELL_OK = id => { const sp = SRD.spells[id]; return sp && /^action/i.test(sp.castingTime || ''); };
function castable(c, s, ok = SPELL_OK) { const sc = s.spellcasting; if (!sc) return []; const slots = sc.slotsLeft || [];
  const ids = [...new Set([...(c.cantrips || []), ...(c.prepared || []), ...(sc.always || [])])].filter(ok);
  return ids.map(id => ({ id, name: SRD.spells[id].name, level: SRD.spells[id].level })).filter(x => x.level === 0 || slots.slice(x.level - 1).some(n => n > 0)).sort((a, b) => a.level - b.level || a.name.localeCompare(b.name)); }
const HEALS = ['healing_word', 'cure_wounds', 'aid', 'prayer_of_healing'];
function presets(c, s) { const heal = castable(c, s, id => !!SRD.spells[id]).find(x => HEALS.includes(x.id)); const bonus = heal && /bonus/i.test(SRD.spells[heal.id].castingTime);
  return [{ id: 'none', t: 'No standing order', d: 'Repeat this round\u2019s orders (cantrips and free attacks only), then the engine uses your stance.' },
    heal && { id: 'healer', t: 'Healer first', d: `${heal.name} on anyone below \u00bc HP \u00b7 otherwise this round\u2019s orders`, rule: [{ if: { ally_below: 0.25 }, then: bonus ? { bonus: { do: 'cast', spell: heal.id, target: 'ally_lowest' }, action: { do: 'attack', target: 'nearest' } } : { action: { do: 'cast', spell: heal.id, target: 'ally_lowest' } } }] },
    { id: 'guard', t: 'Dodge when hurt', d: 'Hold and take the Dodge action if I drop below \u2153 HP', rule: [{ if: { self_below: 0.34 }, then: { move: 'hold', action: { do: 'dodge' } } }] },
    { id: 'medic', t: 'No one bleeds out', d: 'Stabilize an ally at 0 HP before anything else', rule: [{ if: { ally_down: true }, then: { action: { do: 'stabilize', target: 'ally_down' } } }] }].filter(Boolean); }
const fightWord = () => (T.game?.state?.encounter?.kind === 'brawl' ? 'brawl' : 'battle');
function battleView(st) {
  const g = T.game; const view = g.view; const enc = g.state.encounter; const me = T.me; const sc = T.scene;
  const stopped = enc && ['awaiting_orders', 'paused'].includes(enc.status) && enc.stop; const lastN = T.n - 1;
  const pausedCard = stopped ? `<div class="card dark"><div class="row" style="gap:10px"><div style="font:700 34px/1 Cinzel,serif;color:#f0d58a">\u275a\u275a</div><div style="flex:1"><h2 style="display:block">${enc.status === 'paused' ? 'Battle paused at the cutoff' : `Battle stopped: ${esc(enc.stop.text)}`}</h2><div class="meta" style="color:#cdb27a;margin-top:4px">${esc(enc.stop.triggers?.map(t => t.detail).join(' \u00b7 ') || '')}</div></div></div>
     <ul class="list" style="margin-top:9px;color:#efe0bb"><li>Stopped at<span class="r">Round ${enc.round}</span></li><li>Resumes<span class="r">Night ${T.n} \u00b7 orders due ${N.fmtLA(sc.cutoffMs)}</span></li><li>Tonight\u2019s dice<span class="r" style="font-family:monospace;color:#f0d58a">sha256 ${esc(sc.commit.slice(0, 4))}\u2026${esc(sc.commit.slice(-4))} \u2713 posted</span></li></ul>
     <div class="note" style="color:#a88f62">Saved exactly as it stood: positions, HP, initiative, whose turn, concentration and conditions. Nobody rests overnight: real-world time is not an in-game rest.</div></div>` : '';
  const mapCard = `<div class="card dark" style="padding:10px 7px 10px"><h2 style="padding:0 6px">${esc(enc?.name || sc.title)} \u00b7 Round ${enc?.round || 1}</h2><div style="padding:0 6px">${initStrip(view)}</div>${mapHtml(view, { dest: Array.isArray(T.orders?.thisRound?.move) ? T.orders.thisRound.move : null, clickable: T.pickCell })}<div style="padding:0 6px">${legend(view)}</div></div>`;
  return sceneCard({ ...sc, prose: sc.prose.slice(0, 1) }) + pausedCard + mapCard + (me ? ordersCard(st) : '') + partyCard(st) + lockCard(st);
}
function ordersCard(st) {
  const me = T.me; const c = ch(me.cid); const s = sheetOf(me.cid); const o = T.orders; const r = o.thisRound; const view = T.game.view; const canEdit = st.open;
  if (T.mine?.locked && !T.editing) return `<div class="card" id="orders"><h2>Your ${fightWord()} orders</h2><ul class="list">${orderLines(T.mine.orders, s, c).map(([k, v]) => `<li>${k}<span class="r">${v}</span></li>`).join('')}</ul><div class="note">\u2713 Locked at ${timeLA(T.mine.at)}. ${canEdit ? 'You can change them until the table locks.' : ''}</div>${canEdit ? '<div class="row" style="margin-top:9px"><button class="btn ghost" data-t="unlock" style="flex:1;color:var(--wine);border-color:var(--wine)">Change my orders</button></div>' : ''}</div>`;
  const foes = view.combatants.filter(x => x.side !== 'pc' && x.kind !== 'pc' && x.hp > 0);
  const chip = (grp, v, label, on) => `<button class="chip ${on ? 'on' : ''}" data-t="ord" data-k="${grp}" data-v="${esc(v)}" ${canEdit ? '' : 'disabled'}>${label}</button>`;
  const act = r.action || {}; const spells = castable(c, s);
  const acts = [['attack', 'Attack'], ...spells.slice(0, 8).map(x => ['cast:' + x.id, `<i>${esc(x.name)}</i>${x.level ? ` <small>L${x.level}</small>` : ''}`]), ['dodge', 'Dodge'], ['help', 'Help an ally'], ['dash', 'Dash']];
  if (s.resources.healing_hands?.left > 0) acts.push(['healing_hands', 'Healing Hands']);
  const allyTarget = act.do === 'cast' && ['heal', 'buff'].includes(spellKind(act.spell)) || ['help', 'healing_hands'].includes(act.do);
  const tg = allyTarget ? [['ally_lowest', 'Most hurt ally'], ['self', 'Myself'], ...T.players.filter(p => p.pid !== OWNER).map(p => [p.cid, esc(first(p.name))])] : [['nearest', 'Nearest'], ['weakest', 'Weakest'], ['boss', 'The boss'], ...foes.map(f => [f.uid, esc(foeLabel(f))])];
  const mv = r.move === 'hold' ? 'hold' : Array.isArray(r.move) ? 'cell' : 'auto';
  const pre = presets(c, s);
  return `<div class="card" id="orders"><h2>Your ${fightWord()} orders</h2>
   <div class="sc meta" style="margin-top:8px;color:var(--wine);font-weight:700">This round \u00b7 move</div><div class="chips">${chip('move', 'auto', 'Close in as needed', mv === 'auto')}${chip('move', 'hold', 'Hold position', mv === 'hold')}${chip('move', 'cell', Array.isArray(r.move) ? `Move to ${'ABCDEFGHIJ'[r.move[0]]}${r.move[1] + 1}` : T.pickCell ? 'Tap a square on the map\u2026' : 'Pick a square', mv === 'cell' || T.pickCell)}</div>
   <div class="sc meta" style="margin-top:8px;color:var(--wine);font-weight:700">Action</div><div class="chips">${acts.map(([v, l]) => chip('act', v, l, (act.do === 'cast' ? 'cast:' + act.spell : act.do) === v)).join('')}</div>
   ${['dodge', 'dash'].includes(act.do) ? '' : `<div class="sc meta" style="margin-top:8px;color:var(--wine);font-weight:700">Target</div><div class="chips">${tg.map(([v, l]) => chip('tgt', v, l, act.target === v)).join('')}</div>`}
   ${s.resources.action_surge?.left > 0 ? `<div class="chips" style="margin-top:8px">${chip('surge', o.actionSurge ? '0' : '1', `Action Surge ${o.actionSurge ? 'ON' : 'off'} <small>(${s.resources.action_surge.left} left)</small>`, !!o.actionSurge)}</div>` : ''}
   <div class="sc meta" style="margin-top:10px;color:var(--wine);font-weight:700">Standing order (rounds 2\u20133)</div>${pre.map(p => `<button class="move ${o.preset === p.id ? 'sel' : ''}" data-t="preset" data-v="${p.id}" style="margin:5px 0" ${canEdit ? '' : 'disabled'}><div class="ic">${svgI(p.id === 'none' ? 'sword' : 'party')}</div><div style="flex:1"><div class="t">${esc(p.t)}</div><div class="meta">${esc(p.d)}</div></div><div class="check"></div></button>`).join('')}
   <textarea rows="2" style="margin-top:7px" data-f="say" placeholder="Optional war cry (I say\u2026)" ${canEdit ? '' : 'disabled'}>${esc(T.draft.say)}</textarea>
   <div class="note">The engine plays up to 3 rounds, then stops early if an ally drops to 0 or a new enemy appears. A boss phase change or broken concentration is only a notice. If you miss the cutoff, you fight on your stance (<b>${STANCE_TXT[stanceOf(OWNER)]}</b>; change it on the Hero tab).</div>
   <div class="row" style="margin-top:10px"><button class="btn" data-t="lockorders" style="flex:1" ${canEdit ? '' : 'disabled'}>Lock orders</button></div></div>`;
}
const spellKind = id => ({ healing_word: 'heal', cure_wounds: 'heal', bless: 'buff', aid: 'heal', shield_of_faith: 'buff', guidance: 'buff', prayer_of_healing: 'heal' }[id] || 'attack');
function orderLines(o, s, c) { const r = o?.thisRound || {}; const a = r.action || {}; const tname = t => ({ nearest: 'nearest foe', weakest: 'weakest foe', boss: 'the boss', ally_lowest: 'most hurt ally', self: 'myself' }[t] || T.game.view.combatants.find(x => x.uid === t)?.name || T.players.find(p => p.cid === t)?.name || t);
  const pre = presets(c, s).find(p => p.id === o?.preset);
  return [['Move', r.move === 'hold' ? 'hold position' : Array.isArray(r.move) ? `to ${'ABCDEFGHIJ'[r.move[0]]}${r.move[1] + 1}` : 'close in as needed'], ['Action', `${a.do === 'cast' ? `<i>${esc(SRD.spells[a.spell]?.name)}</i>` : esc(a.do)}${a.target && !['dodge', 'dash'].includes(a.do) ? ' \u2192 ' + esc(tname(a.target)) : ''}`], ...(o?.actionSurge ? [['Action Surge', 'on']] : []), ['Standing order', esc(pre?.t || 'none')]]; }

// ---------- resolution ----------
function entryCard(e, r) {
  const pid = e.pid; const s = sheetOf(e.cid);
  if (e.kind === 'absent') return `<div class="card"><div class="who">${AV(pid)}<div><div class="n">${esc(e.name)}</div><div class="meta">Absent at cutoff \u00b7 preset stance: <b>${STANCE_TXT[e.stance || stanceOf(pid)]}</b></div></div></div><div class="dice">${D20('\u2013', '#2c6a8a', 'faded')}<div class="mods"><span class="mod">${r.battle && !r.battle.started ? 'Fought on stance (see the fight below)' : 'Stays with the party'}</span><span class="mod">No resources spent</span></div><div class="total"><div class="n">\u2014</div><div class="vs">no roll</div></div></div><div class="res na">\u00b7 ${esc(e.outcome)}</div></div>`;
  if (e.kind === 'orders') return '';  // shown together in ordersInCard
  const c = e.check; const how = e.kind === 'move' ? `Suggested move \u00b7 \u201c${esc(e.label)}\u201d` : `I do something else: \u201c${esc(e.text)}\u201d`;
  const dcw = e.dcCall; const called = e.kind === 'free' && c ? `<div class="called">GM called: <b>${esc(c.label)}</b> \u00b7 <b>${esc(dcw?.word || c.word)}${dcw ? ` (DC ${dcw.dc})` : ''}</b>${dcw?.why ? ` <span style="opacity:.8">\u00b7 ${esc(dcw.why.replace(/^default (Easy|Medium|Hard): /, ''))}</span>` : e.mapped?.why ? ` <span style="opacity:.75">(${esc(e.mapped.why)})</span>` : ''}</div>` : '';
  if (!c) return `<div class="card"><div class="who">${AV(pid)}<div><div class="n">${esc(e.name)}</div><div class="meta">${how}</div></div></div><div class="res na">\u00b7 No roll needed \u00b7 ${esc(e.outcome)}</div></div>`;
  const faces = c.faces?.length > 1 ? c.faces : [c.nat]; const dimIdx = c.faces?.length > 1 ? c.faces.indexOf(c.nat) === 0 ? 1 : 0 : -1;
  const dice = faces.map((f, i) => D20(f, c.nat === 20 ? '#b8862a' : c.nat === 1 ? '#7a1a1f' : '#2c6a8a', i === dimIdx ? 'dim' : '')).join('');
  const parts = c.parts.map(p => `<span class="mod">${esc(p.src)} <b>${sgn(p.v)}</b></span>`).join('') + (c.mode !== 'normal' ? `<span class="mod">${c.mode === 'adv' ? 'Advantage' : 'Disadvantage'}: ${faces.join(' / ')}</span>` : '');
  const fx = (e.effects || []).map(x => `<span class="tag ${/^\u2212|^-/.test(x.what) ? 'w' : 'g'}">${esc(x.cid === 'party' ? 'Party: ' : x.cid === 'story' ? '' : '')}${esc(x.what)}</span>`).join('');
  return `<div class="card"><div class="who">${AV(pid)}<div><div class="n">${esc(e.name)}</div><div class="meta">${how}</div></div></div>${called}
   <div class="dice">${dice}<div class="mods">${parts}</div><div class="total"><div class="n">${c.total}</div><div class="vs">vs DC ${c.dc} \u00b7 ${esc(c.word)}</div></div></div>
   <div class="res ${c.ok ? 'ok' : 'no'}">${c.ok ? '\u2713 Success' : '\u2717 Failure'}${c.nat === 20 ? ' \u00b7 natural 20' : c.nat === 1 ? ' \u00b7 natural 1' : ''}</div><p class="outcome">${esc(e.outcome)}</p>${fx ? `<div class="d" style="display:flex;flex-wrap:wrap;gap:4px">${fx}</div>` : ''}
   ${e.say ? `<div class="note"><b style="color:#7d1d2e">I say:</b> \u201c${esc(e.say)}\u201d</div>` : ''}</div>`;
}
function battleCard(r) {
  const b = r.battle; if (!b) return ''; const k = r.n;
  if (b.started) return `<div class="card dark"><h2>Roll for initiative</h2><p style="color:#efe0bb;margin:8px 0 4px">${esc(r.nextTeaser || '')}</p><div class="meta" style="color:#cdb27a">${esc(b.lines.join(' '))}</div>${mapHtml(b, {})}</div>`;
  const open = T.open['b' + k]; const lines = b.lines; const shown = open ? lines : lines.slice(0, 10);
  const stop = b.stop ? `<div class="res ${b.status === 'victory' ? 'ok' : 'na'}" style="border-color:#5b4229;color:#f0d58a">\u275a\u275a ${esc(b.stop.text)}${b.stop.triggers?.length ? ' \u00b7 ' + esc(b.stop.triggers.map(t => t.detail).join(' \u00b7 ')) : ''}</div>` : '';
  return `<div class="card dark" style="padding:10px 7px"><h2 style="padding:0 6px">${esc(b.name)} \u00b7 through round ${b.round}</h2>${mapHtml(b, { paused: b.unfinished ? `\u275a\u275a Saved \u00b7 resumes Night ${k + 1}` : null })}
   <div style="padding:0 6px">${(b.notices || []).map(nt => `<div class="notice">Notice: ${esc(nt.text)} \u2014 ${esc(nt.detail)}. Orders kept running.</div>`).join('')}${stop}
   <ol class="pbp">${shown.map(l => `<li class="${/falls|drops to 0|CRITICAL/.test(l) ? 'hi' : /\((this round|standing order|Cautious stance|Support stance|Aggressive stance|repeating orders)\)/.test(l) ? 'ord' : ''}">${esc(l)}</li>`).join('')}</ol>
   ${lines.length > 10 ? `<button class="btn sm ghost" data-t="toggle" data-v="b${k}" style="width:auto;color:#f0d58a;border-color:#8e6a1e">${open ? 'Show less' : `Every roll (${lines.length} lines)`}</button>` : ''}</div></div>`;
}
function resolutionView(k) {
  const r = T.results[k]; const sc = T.scenes[k]; if (!r) return `<div class="card"><h2>Night ${k}</h2><div class="note">Not resolved yet.</div></div>`;
  const absent = r.entries.filter(e => e.kind === 'absent').map(e => first(e.name)); const ok = T.verify?.[k];
  const head = `<div class="card dark"><h2>Night ${k} \u00b7 how it went</h2><div class="meta" style="color:#cdb27a;margin-top:6px">${r.early ? `Resolved early: all ${r.entries.length} locked in before 9:00 PM PT` : `Locked at the 9:00 PM PT cutoff${absent.length ? ` (${esc(absent.join(', '))} absent)` : ''}`}. Every die and modifier is shown.</div>
   <div class="hash" style="margin-top:6px">Seed <b>${esc(r.seed.slice(0, 4))}\u2026${esc(r.seed.slice(-4))}</b> ${ok == null ? 'checking\u2026' : ok.seed ? `matches the hash posted when the scene opened \u2713` : '<span class="warn">DOES NOT match the posted hash \u2717</span>'}${ok?.dc != null ? ` \u00b7 move DCs ${ok.dc ? 'match their hash \u2713' : '<span class="warn">do not match \u2717</span>'}` : ''}</div></div>`;
  const narr = r.narration ? `<div class="card"><h2>The GM narrates</h2>${r.narration.split(/\n\s*\n/).map(p => `<p class="prose" style="font-size:15.5px">${md(p)}</p>`).join('')}` : '<div class="card">';
  const changes = r.sheetChanges.length ? `<h2 style="margin-top:12px">Sheet changes</h2><ul class="list">${r.sheetChanges.map(c => `<li>${AV(pidOfCid(c.cid))}<span style="flex:1;min-width:0">${esc(first(c.name))} \u00b7 ${esc(c.what)}</span><span class="r ${/^\u2212|^-|\u2192 \d/.test(c.delta) && !/^\+/.test(c.delta) ? 'warn' : ''}" style="${/^\+|gained/.test(c.delta) ? 'color:#2f6a2c' : ''}">${esc(c.delta)}</span></li>`).join('')}</ul>` : '<div class="note">No sheet changes tonight.</div>';
  const flags = r.entries.flatMap(e => (e.effects || []).filter(x => x.cid === 'story')).map(x => x.what.replace(/^hook: /, ''));
  const ord = r.entries.filter(e => e.kind === 'orders' || (e.kind === 'absent' && r.battle && !r.battle.started));
  const ordersIn = ord.length ? `<div class="card"><h2>Orders in</h2><ul class="list">${ord.map(e => `<li>${AV(e.pid)}<div style="flex:1;min-width:0"><b>${esc(first(e.name))}</b><div class="meta">${e.kind === 'absent' ? `absent \u00b7 fought on <b>${STANCE_TXT[e.stance || stanceOf(e.pid)]}</b> stance` : orderText(e)}</div>${e.say ? `<div class="meta"><b style="color:#7d1d2e">I say:</b> \u201c${esc(e.say)}\u201d</div>` : ''}</div></li>`).join('')}</ul></div>` : '';
  return head + r.entries.map(e => entryCard(e, r)).join('') + ordersIn + battleCard(r) + lootResult(r) + narr + changes + (flags.length ? `<h2 style="margin-top:12px">New in the story</h2><ul class="list">${flags.map(f => `<li>\u2726 ${esc(f)}</li>`).join('')}</ul>` : '') +
    `<div class="row" style="margin-top:10px"><button class="btn ghost sm" data-t="recap" data-v="${k}" style="width:auto">Recap</button><div class="sp"></div>${k < T.n ? `<button class="btn sm" data-t="go" data-v="table" style="width:auto">Tonight\u2019s scene \u2192</button>` : ''}</div></div>`;
}
function lootResult(r) {
  const nm = cid => esc(first(T.players.find(p => p.cid === cid)?.name || cid)); const out = [];
  for (const e of r.entries) if (e.cart?.length) out.push(`<li>${AV(e.pid)}<div style="flex:1;min-width:0"><b>${esc(first(e.name))}</b> \u00b7 cart<div class="meta">${e.cart.map(l => l.ok ? esc(l.what) : `<span class="warn">\u2717 ${esc(l.op)} ${esc(l.key || l.label || '')}: ${esc(l.why)}</span>`).join(' \u00b7 ')}</div></div></li>`);
  for (const d of r.lootDivide || []) out.push(`<li><span style="flex:1;min-width:0">\u2726 <b>${esc(d.name)}</b>: ${d.toStash ? 'everyone passed, to the party stash' : `${nm(d.winner)} on ${d.tier === 'need' ? 'Need' : 'Greed'}`}${d.rolls?.length ? `<div class="meta">${d.rolls.at(-1).map(x => `${nm(x.cid)} d20 ${x.nat}`).join(' \u00b7 ')}</div>` : ''}${d.bids.some(b => b.note && /not allowed/.test(b.note)) ? `<div class="meta">${d.bids.filter(b => b.note && /not allowed/.test(b.note)).map(b => `${nm(b.cid)}: ${esc(b.note)}`).join(' \u00b7 ')}</div>` : ''}</span></li>`);
  for (const l of r.loot || []) out.push(`<li><span style="flex:1;min-width:0">\u{1F4B0} <b>${esc(l.why)}</b>${l.gm ? ' <span class="tag">GM award</span>' : ''}<div class="meta">${l.coin ? `${N.fmtCoin(l.coin)} found \u00b7 ${N.fmtCoin(l.each)} each${l.rem ? ` (+${l.rem} cp to the party fund)` : ''}` : 'no coin'}${l.items.length ? ` \u00b7 to divide next night: ${l.items.map(x => esc(x.name)).join(', ')}` : ''}${l.cash.length ? ` \u00b7 to cash at the next shop: ${l.cash.map(x => esc(x.name)).join(', ')}` : ''}</div></span></li>`);
  if (r.cashed) out.push(`<li><span style="flex:1">\u{1F48E} Gems and art cashed at full value: <b>${N.fmtCoin(r.cashed)}</b>, split evenly</span></li>`);
  for (const e of r.entries) for (const b of e.between || []) out.push(`<li>${AV(e.pid)}<div style="flex:1;min-width:0"><b>${esc(first(e.name))}</b> \u00b7 ${esc(b.what)}<div class="meta">${b.ok ? esc((b.lines || []).join(' ') || 'done') : `<span class="warn">\u2717 refused: ${esc(b.why)}</span>`}</div></div></li>`);
  if (r.rest) { const R = r.rest; const head = R.error ? `${R.kind === 'long' ? 'Long' : 'Short'} rest: not taken` : R.interrupted ? `${R.kind === 'long' ? 'Long' : 'Short'} rest, interrupted${R.resumed ? ' and resumed' : ''}` : R.prevented ? `${R.kind === 'long' ? 'Long' : 'Short'} rest (the watch kept it quiet)` : `${R.kind === 'long' ? 'Long' : 'Short'} rest`;
    const lines = R.error ? [R.error] : R.lines.filter(x => /interrupt|benefit|resum|identif|attune|Hit Point Dice|regains|it is|eats|drank|no food|rested/i.test(x)).slice(0, 8);
    out.push(`<li><span style="flex:1;min-width:0">\u263E <b>${esc(head)}</b>${R.benefit && !R.error ? ` <span class="tag ${R.benefit === 'long' ? 'g' : R.benefit === 'short' ? 'b' : 'w'}">${R.benefit === 'long' ? 'long-rest benefits' : R.benefit === 'short' ? 'short-rest benefits' : 'no benefit'}</span>` : ''}<div class="meta">${esc(lines.join(' ') || (R.kind === 'long' ? 'Eight hours. Everyone wakes with full HP, Hit Point Dice and spell slots.' : 'An hour\u2019s rest.'))}</div></span></li>`); }
  return out.length ? `<div class="card" id="lootres"><h2>Between scenes: gear, loot, levels, rest</h2><ul class="list">${out.join('')}</ul></div>` : '';
}
function orderText(e) { const o = e.orders || {}; const r = o.thisRound || {}; const a = r.action || {}; const tn = t => ({ nearest: 'nearest foe', weakest: 'weakest foe', boss: 'the boss', ally_lowest: 'most hurt ally', self: 'self' }[t] || t);
  return esc([r.move === 'hold' ? 'hold' : Array.isArray(r.move) ? `move to ${'ABCDEFGHIJ'[r.move[0]]}${r.move[1] + 1}` : 'close in', a.do === 'cast' ? `${SRD.spells[a.spell]?.name || a.spell} \u2192 ${tn(a.target)}` : `${a.do || 'attack'}${a.target && !['dodge', 'dash'].includes(a.do) ? ' \u2192 ' + tn(a.target) : ''}`, o.actionSurge ? 'Action Surge' : null, o.preset && o.preset !== 'none' ? `standing order: ${({ guard: 'Dodge when hurt', healer: 'Healer first', medic: 'No one bleeds out' })[o.preset] || o.preset}` : null].filter(Boolean).join(' \u00b7 ')); }
async function verify(k) { const r = T.results[k], sc = T.scenes[k]; if (!r || !sc) return; (T.verify = T.verify || {})[k] = { seed: N.verifyCommit(r.seed, sc.commit), dc: sc.dcCommit ? N.commit(r.salt + '|' + JSON.stringify(r.dcs)) === sc.dcCommit : null }; }

// ---------- recap / chronicle ----------
function recapView(k) {
  const r = T.results[k]; if (!r) return '<div class="card"><div class="note">Not resolved yet.</div></div>';
  const best = r.entries.filter(e => e.check).sort((a, b) => b.check.nat - a.check.nat).slice(0, 2);
  const xpBy = cid => r.sheetChanges.filter(c => c.cid === cid && c.what === 'XP').map(c => c.delta).join(' ');
  const xpAvg = Math.round(T.players.reduce((s, p) => s + (ch(p.cid)?.xp || 0), 0) / Math.max(1, T.players.length)); const lvAvg = Math.min(...T.players.map(p => ch(p.cid)?.level || 3)); const nx = XP_NEXT[lvAvg] || 14000;
  const nextSc = T.scenes[k + 1];
  return `<div class="card"><div class="eyebrow">Chronicle \u00b7 Night ${k}</div><div class="title">${esc(r.title)}</div>${(r.narration || '').split(/\n\s*\n/).slice(0, 2).map(p => `<p class="prose">${md(p)}</p>`).join('')}</div>
   ${best.length ? `<div class="card dark"><h2>Dice of the night</h2>${best.map(e => `<div class="row" style="margin-top:9px;gap:12px">${D20(e.check.nat, e.check.nat === 20 ? '#b8862a' : e.check.nat === 1 ? '#7a1a1f' : '#2c6a8a')}<div><b style="font:700 14px Cinzel,serif;color:#f0d58a">${esc(first(e.name))} \u00b7 ${esc(e.label || 'something else')}</b><div class="meta" style="color:#cdb27a">${e.check.nat} ${e.check.parts.map(p => `${sgn(p.v).replace('+', '+ ').replace('\u2212', '\u2212 ')} ${esc(p.src)}`).join(' ')} = ${e.check.total} vs DC ${e.check.dc}. ${e.check.ok ? 'Success.' : 'Failure.'}</div></div></div>`).join('')}</div>` : ''}
   ${r.battle && !r.battle.started ? `<div class="card dark"><h2>The fight</h2><div class="meta" style="color:#cdb27a;margin-top:6px">${esc(r.battle.name)} \u00b7 through round ${r.battle.round} \u00b7 ${r.battle.unfinished ? `saved, resumes Night ${k + 1}` : esc(r.battle.status)}${r.battle.stop ? ` \u00b7 stopped: ${esc(r.battle.stop.text)}` : ''}</div></div>` : ''}
   <div class="card"><h2>The heroes</h2><ul class="list">${T.players.map(p => { const c = ch(p.cid); const s = sheetOf(p.cid); const e = r.entries.find(x => x.pid === p.pid);
     return `<li>${AV(p.pid)}<div style="flex:1;min-width:0"><b>${esc(p.name)}</b><div class="meta">HP ${c.hp.cur}/${s.hpMax}${c.inspiration ? ' \u00b7 Heroic Inspiration \u2726' : ''}${e?.kind === 'absent' ? ` \u00b7 absent (${STANCE_TXT[e.stance || stanceOf(p.pid)]})` : ''}${r.sheetChanges.filter(x => x.cid === p.cid && x.what !== 'XP').map(x => ` \u00b7 ${esc(x.what)} ${esc(x.delta)}`).join('')}</div></div><span class="r" style="color:#2f6a2c">${esc(xpBy(p.cid))}</span></li>`; }).join('')}</ul>
   <div class="meta" style="margin-top:8px"><b>Party XP</b> \u00b7 ${xpAvg.toLocaleString()} / ${nx.toLocaleString()} to level ${lvAvg + 1} (average)</div><div class="xpbar"><i style="width:${Math.min(100, Math.round(100 * xpAvg / nx))}%"></i></div></div>
   <div class="card dark"><h2>Next</h2><p style="margin:7px 0 4px;font-size:15px;color:#efe0bb">${nextSc ? `Night ${k + 1} is up: <b style="color:#f0d58a">${esc(nextSc.title)}.</b> Choose by <b style="color:#f0d58a">${N.fmtLA(nextSc.cutoffMs)}</b>.` : esc(r.nextTeaser || 'The GM will open the next scene soon.')}</p>
   <div class="row" style="margin-top:8px">${nextSc ? '<button class="btn gold sm" data-t="go" data-v="table" style="width:auto">Open tonight\u2019s scene</button>' : ''}<div class="sp"></div><button class="btn ghost sm" data-t="go" data-v="chron" style="width:auto;color:#f0d58a;border-color:#f0d58a">All recaps</button></div></div>`;
}
function chronView() {
  const ks = Array.from({ length: T.n }, (_, i) => i + 1).reverse();
  return `<div class="stephead"><div class="eyebrow">Chronicle</div><div class="title">${esc(T.camp.adventureTitle || 'Adventure 1')}</div></div>${ks.map(k => { const r = T.results[k], sc = T.scenes[k];
    return `<button class="card ribbon" data-t="${r ? 'recap' : 'go'}" data-v="${r ? k : 'table'}"><span><b>Night ${k}</b> \u00b7 ${esc(sc?.title || '')}</span><span>${r ? 'Recap \u2192' : sc?.status === 'open' ? 'Tonight \u2192' : 'Resolving\u2026'}</span></button>`; }).join('')}`;
}

// ---------- hero / party ----------
function heroHead(p, mine) { const c = ch(p.cid); const s = sheetOf(p.cid);
  return `<div class="card"><div class="sc meta" style="color:var(--wine);font-weight:700">Right now \u00b7 ${esc(p.name)}</div><div style="display:flex;gap:8px;align-items:center;margin-top:6px"><div class="hp" style="flex:1;min-width:90px;height:9px;margin:0"><i style="width:${Math.round(100 * c.hp.cur / s.hpMax)}%"></i></div><b style="font:700 15px Cinzel,serif;white-space:nowrap">${c.hp.cur}/${s.hpMax} HP</b></div>
   <div class="d" style="display:flex;flex-wrap:wrap;gap:4px;margin-top:7px">${c.inspiration ? '<span class="tag g">Heroic Inspiration</span>' : ''}${c.conditions.map(x => `<span class="tag w">${esc(x.id)}</span>`).join('')}<span class="tag">Stance: ${STANCE_TXT[stanceOf(p.pid)]}</span><span class="tag">${Math.floor(c.coin / 100)} gp</span><span class="tag">XP ${c.xp.toLocaleString()}</span>${s.spellcasting?.slotsLeft ? s.spellcasting.slotsLeft.map((n, i) => `<span class="tag m">L${i + 1} slots ${n}/${s.spellcasting.slots[i]}</span>`).join('') : ''}</div></div>
   ${mine ? `<div class="card"><h2>Preset stance</h2><div class="meta" style="margin-top:6px">Used when you miss the 9:00 PM PT cutoff in a fight. Out of combat, you simply follow the party with no roll.</div>${Object.entries(N.STANCES).map(([k, d]) => `<button class="move ${stanceOf(p.pid) === k ? 'sel' : ''}" data-t="stance" data-v="${k}"><div class="ic">${svgI(k === 'aggressive' ? 'sword' : k === 'support' ? 'party' : 'hero')}</div><div style="flex:1"><div class="t">${STANCE_TXT[k]}${k === 'cautious' ? ' <small>the default</small>' : ''}</div><div class="meta">${esc(d)}</div></div><div class="check"></div></button>`).join('')}</div>
   <div class="card locked"><h2>Sheet locked</h2><div class="note">Reforge was free until the first adventure started (${T.camp.startedAt ? dayLA(T.camp.startedAt) : 'Night 1'}). From here on, your sheet changes only through the engine: XP, loot, level-ups and damage arrive with the GM\u2019s nightly results.</div></div>` : ''}`; }
function sheetView(pid, mine) { const p = T.players.find(x => x.pid === pid); if (!p) return ''; const c = ch(p.cid); const s = sheetOf(p.cid); const h = heroRec(pid);
  const big = `<div class="card heroart"><span class="portrait" role="img" aria-label="${esc(p.name)}" style="${esc(avStyle(pid))}"></span><div class="cap"><div class="nm">${esc(p.name)}</div><div class="meta">${esc(`${s.species} \u00b7 ${s.className} ${c.level}${s.subclass ? ' (' + s.subclass + ')' : ''}`)}</div></div></div>`;
  return (mine ? F5.levelBanner() : '') + big + heroHead(p, mine) + renderSheet(s, c, null, { style: avStyle(pid) }) + (mine ? '<button class="card ribbon" data-t="go" data-v="party"><span>The party · everyone’s sheets</span><span>Party →</span></button>' : ''); }
function partyView() {
  return `<div class="stephead"><div class="eyebrow">Teslandia \u00b7 the party</div><div class="title">Party sheets</div></div>${T.players.map(p => { const c = ch(p.cid); const s = sheetOf(p.cid);
    return `<button class="card rosterhero" data-t="sheet" data-v="${p.pid}">${AV(p.pid, ';width:52px;height:52px')}<div style="flex:1;min-width:0"><div class="nm" style="font:700 16px Cinzel,serif">${esc(p.name)}${p.pid === OWNER ? ' <span class="tag k">you</span>' : ''}</div><div class="meta">${esc(s.species)} \u00b7 ${esc(s.className)} ${s.level} (${esc(s.subclass)}) \u00b7 ${esc(p.player)}</div>
     <div style="display:flex;gap:6px;align-items:center;margin-top:5px"><div class="hp" style="height:6px"><i style="width:${Math.round(100 * c.hp.cur / s.hpMax)}%"></i></div><span class="meta">${c.hp.cur}/${s.hpMax} HP \u00b7 AC ${s.ac.v} \u00b7 ${STANCE_TXT[stanceOf(p.pid)]}</span></div></div></button>`; }).join('')}
   <div class="note" style="color:#b89b62;margin:2px 6px">Everyone at the table sees every sheet. Numbers come from the engine, not from anyone\u2019s typing.</div>`;
}

// ---------- render + events ----------
function render() {
  const v = T.view; const keep = window.scrollY;
  const body = v === 'table' ? tableView() : v === 'night' ? resolutionView(T.k) : v === 'recap' ? recapView(T.k) : v === 'chron' ? chronView() : v === 'hero' ? (T.me ? sheetView(OWNER, true) : partyView()) : v === 'party' ? partyView() : v === 'sheet' ? sheetView(T.k, T.k === OWNER) : v === 'gear' ? G.gearView() : v === 'issues' ? G.issuesView() : v === 'spells' ? F5.spellsView() : v === 'levelup' ? F5.levelUpView() : v === 'asks' ? F5.asksView() : '';
  document.querySelector('#app').innerHTML = header() + `<main class="tmain">${body}${REPORT()}</main>` + FOOT + nav();
  document.body.dataset.step = 'table-' + v; window.scrollTo(0, T._top ? 0 : keep); T._top = false;
}
const extras = () => ({ ...(T.cart?.length ? { cart: T.cart } : {}), ...(Object.keys(T.lootPick || {}).length ? { loot: T.lootPick } : {}), ...(Object.keys(T.restPick || {}).length ? { rest: T.restPick } : {}), ...F5.extras() });
async function saveExtras() { const base = T.mine ? { ...T.mine } : { kind: null, locked: false }; delete base.at; delete base.cart; delete base.loot; delete base.rest; for (const x of ['levelUp', 'casts', 'copy', 'prepare']) delete base[x]; await store.putAction(T.n, { ...base, ...extras() }); T.mine = await store.myAction(T.n); T.locks = await store.locks(T.n); }
async function saveDraft(locked) { const d = T.draft; const a = { kind: d.kind, moveId: d.kind === 'move' ? d.moveId : null, text: d.kind === 'free' ? d.text.trim() : '', say: d.say.trim(), sayMode: d.sayMode, locked, ...extras() };
  await store.putAction(T.n, a); T.mine = await store.myAction(T.n); T.locks = await store.locks(T.n); }
async function saveOrders(locked) { const o = T.orders; const pre = presets(ch(T.me.cid), sheetOf(T.me.cid)).find(p => p.id === o.preset);
  const orders = { thisRound: { ...o.thisRound, move: o.thisRound.move ?? undefined }, standing: pre?.rule || [], preset: o.preset, actionSurge: !!o.actionSurge };
  await store.putAction(T.n, { kind: 'orders', orders, say: T.draft.say.trim(), locked, ...extras() }); T.mine = await store.myAction(T.n); T.locks = await store.locks(T.n); }
async function onClick(e) {
  const b = e.target.closest('[data-t]'); if (!b || b.disabled) return; const t = b.dataset.t, v = b.dataset.v, k = b.dataset.k;
  try {
    const f5 = await F5.onClick(t, v, k, b); if (f5) { if (f5 === 'save') { if (!T.scene || !N.canAct(T.scene, now())) { alert('The table has locked for tonight: this saves with the next scene.'); await load(); render(); return; } await saveExtras(); } render(); return; }
    const gr = await G.onGearClick(t, v, k, b); if (gr) { if (gr === 'save') await saveExtras(); render(); return; }
    switch (t) {
      case 'report': T.reportFrom = { table: 'scene', night: 'results', recap: 'recap', chron: 'chronicle', hero: 'hero sheet', party: 'party', sheet: 'party sheet', gear: 'gear' }[T.view] || T.view; T.reportFromView = T.view; T.reportFromK = T.k ?? null; T.view = 'issues'; T.reportDone = null; render(); document.getElementById('report')?.scrollIntoView(); return;
      case 'go': T.view = v; T._top = true; if (v === 'chron') for (let i = 1; i <= T.n; i++) await resultOf(i); break;
      case 'night': T.view = 'night'; T.k = +v; await resultOf(T.k); await resultOf(T.k + 1).catch(() => {}); await verify(T.k); T._top = true; break;
      case 'recap': T.view = 'recap'; T.k = +v; await resultOf(T.k); if (T.k + 1 <= T.n) T.scenes[T.k + 1] = T.scenes[T.k + 1] || await store.scene(T.k + 1); T._top = true; break;
      case 'sheet': T.view = 'sheet'; T.k = v; T._top = true; break;
      case 'move': T.draft = { ...T.draft, kind: 'move', moveId: v }; await saveDraft(false); break;
      case 'saymode': T.draft = { ...T.draft, sayMode: v }; break;
      case 'lock': await saveDraft(true); T.editing = false; break;
      case 'unlock': T.editing = true; if (T.scene.battle) { T.orders = structuredClone(T.mine.orders); } else T.draft = { ...T.draft, ...T.mine }; await (T.scene.battle ? saveOrders(false) : saveDraft(false)); break;
      case 'ord': { const r = T.orders.thisRound; T.pickCell = false;
        if (k === 'move') { if (v === 'cell') { T.pickCell = true; } else r.move = v === 'hold' ? 'hold' : null; }
        if (k === 'act') { const [d, spell] = v.split(':'); const ally = d === 'cast' && ['heal', 'buff'].includes(spellKind(spell)) || ['help', 'healing_hands'].includes(d); r.action = { do: d, ...(spell ? { spell } : {}), target: ally ? 'ally_lowest' : 'nearest' }; }
        if (k === 'tgt') r.action = { ...r.action, target: v }; if (k === 'surge') T.orders.actionSurge = v === '1'; break; }
      case 'cell': T.orders.thisRound.move = [+b.dataset.x, +b.dataset.y]; T.pickCell = false; break;
      case 'preset': T.orders.preset = v; break;
      case 'lockorders': await saveOrders(true); T.editing = false; break;
      case 'stance': await store.putStance(v); T.stances[OWNER] = v; break;
      case 'toggle': T.open[v] = !T.open[v]; break;
      default: return;
    }
  } catch (err) { alert(err.message); await load(); }
  render();
}
let inputTimer = null;
function onInput(e) { const f = e.target.dataset?.f; if (!f) return; if (f === 'report') { T.reportText = e.target.value; return; } if (f === 'ask') { T.askText = e.target.value; T.askDone = null; return; } if (f === 'attach') { T.reportAttach = e.target.checked; return; } if (f === 'text') { T.draft.text = e.target.value; T.draft.kind = e.target.value.trim() ? 'free' : (T.draft.moveId ? 'move' : null); if (T.draft.kind === 'free') T.draft.moveId = null; } else T.draft[f] = e.target.value;
  const btn = document.querySelector('[data-t="lock"]'); if (btn) btn.disabled = !(T.draft.kind === 'move' ? T.draft.moveId : T.draft.kind === 'free' && T.draft.text.trim().length >= 3);
  document.querySelectorAll('[data-t="move"]').forEach(m => m.classList.toggle('sel', T.draft.kind === 'move' && m.dataset.v === T.draft.moveId)); }
export async function boot(o) {
  ({ store, renderSheet, OWNER } = o); ctx = { now: o.now };
  G.init({ T, esc, AV, first, now, canAct: N.canAct, store, OWNER }); F5.init({ T, esc, AV, first, now, canAct: N.canAct, store, OWNER });
  await load(); const v = q.get('view'); if (v) { T.view = v; T.k = q.get('k') ? (/^\d+$/.test(q.get('k')) ? +q.get('k') : q.get('k')) : T.n; }
  if (T.view === 'night' || T.view === 'recap') { await resultOf(T.k); if (T.k + 1 <= T.n) T.scenes[T.k + 1] = await store.scene(T.k + 1); await verify(T.k); }
  if (T.view === 'chron') for (let i = 1; i <= T.n; i++) await resultOf(i);
  if (T.view === 'table' && T.n > 1) T.scenes[T.n - 1] = await store.scene(T.n - 1);
  if (T.view === 'table' && T.scene?.status === 'resolved') await verify(T.n);
  document.addEventListener('click', onClick); document.addEventListener('input', onInput);
  window.__bog5t = { T, render, load, store }; render();
  setInterval(() => { if (T.view === 'table' && T.scene?.status === 'open') { const el = document.querySelector('.timer'); if (el) el.textContent = fmtLeft(T.scene.cutoffMs - now()); } }, 30000);
  // the GM resolved tonight or opened the next night while this page was open: offer a refresh (never reload mid-typing)
  setInterval(async () => { if (document.hidden || T._moved) return; try { const c = await store.campaign(); const s = T.n ? await store.scene(T.n) : null;
    if (T.view === 'table' && s?.status === 'open' && T.scene?.status === 'open' && T.me && (c?.currentNight || 0) === T.n) { const locks = await store.locks(T.n); const party = await store.partyActions(T.n, T.players.map(p => p.pid)).catch(() => T.party);
      if (JSON.stringify([locks, party]) !== JSON.stringify([T.locks, T.party])) { T.locks = locks; T.party = party; const st = status();
        for (const [id, html] of [['partycard', partyCard(st)], ['lockcard', lockCard(st)]]) { const el = document.getElementById(id); if (el && html) el.outerHTML = html; } } }
    if ((c?.currentNight || 0) !== T.n || (s && T.scene && s.status !== T.scene.status)) { T._moved = true; const b = document.createElement('button'); b.className = 'btn gold moved'; b.dataset.moved = '1';
      b.textContent = 'New results \u00b7 tap to refresh'; b.onclick = () => location.reload(); document.body.appendChild(b); } } catch {} }, 8000);
}
