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
import { partySupplies, suppliesOf, SHOPS } from '../engine/src/shop.js';
import { normalizeDraft, draftAction, FREE_TEXT_MAX, capFreeText } from './draft.js';
import { spellModel } from '../engine/src/rules/spellEffects.js';
import { RULES_V2_NIGHT, castRounds, castTimeLabel } from '../engine/src/combat.js';
import { actionSpells, bonusSpells, smiteSpells, bonusFeatures, actionFeatures, canSacredWeapon } from '../engine/src/orders.js';
import { reelFor, reelHtml } from './content/battle-reels.js';
import { currentMissions, suggestedIdeas, pickWriteIn, ruledCheckLine, MAIN_QUEST } from './content/missions.js';
import { mapHtml as spriteMap, initStripHtml, foeLabel } from './content/battle-sprites.js';

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
  if (T.draft == null) T.draft = normalizeDraft(T.mine);
  if (T.cart == null) { T.cart = T.mine?.cart || []; T.lootPick = T.mine?.loot || {}; T.restPick = T.mine?.rest || {}; F5.loadExtras(T.mine); }
  T.asks = await store.listAsks().catch(() => []);
  T.issues = await store.listIssues().catch(() => []);
  if (T.orders == null) T.orders = T.mine?.orders ? structuredClone(T.mine.orders) : { thisRound: { move: null, action: (T.me && castingOf(T.game?.state?.chars?.[T.me.cid])) ? { do: 'continue_cast' } : { do: 'attack', target: 'nearest' } }, standing: [], preset: 'none' };
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
function missionsCard() {
  const story = T.game?.state?.story || {};
  const board = currentMissions(story, T.scene || {});
  const main = board.main || MAIN_QUEST;
  const mainBlock = `<div class="item" style="align-items:flex-start"><div style="flex:1;min-width:0"><div class="nm">${esc(main.title)} <span class="tag m">Main</span>${main.status === 'done' ? ' <span class="tag g">Done</span>' : ''}</div><div class="meta">${esc(main.pitch)}</div></div></div>`;
  const sides = (board.active || []).map(q => `<div class="item" style="align-items:flex-start"><div style="flex:1;min-width:0"><div class="nm">${esc(q.title)} <span class="tag">Side</span> <span class="tag m">In progress</span></div><div class="meta">${esc(q.pitch || '')}${q.reward ? ` \u00b7 ${esc(q.reward)}` : ''}</div></div></div>`).join('');
  return `<div class="card" id="missions"><h2>Current Missions</h2>${mainBlock}${sides || '<div class="note">No side jobs on the books right now.</div>'}</div>`;
}
function guildBoardCard(st) {
  const story = T.game?.state?.story || {};
  const board = currentMissions(story, T.scene || {});
  if (!board.showBoard) return '';
  const canEdit = !!(st && st.open);
  const atCap = board.atCap;
  const jobs = (board.available || []).map(q => {
    const text = q.writeIn || `We take the job: ${q.title}.`;
    const selected = T.draft?.kind === 'free' && (T.draft.text || '').trim() === text.trim();
    return `<button class="move ${selected ? 'sel' : ''}" data-t="suggest" data-v="${esc(q.id)}" ${canEdit && !atCap ? '' : 'disabled'}><div class="ic">${svgI('talk')}</div><div style="flex:1"><div class="t">${esc(q.title)}<small>${esc(q.hook || q.pitch)}</small></div><div class="d"><span class="tag">${esc(q.nights === 1 ? '1 night' : q.nights + ' nights')}</span><span class="tag g">${esc(q.reward || '')}</span></div></div><div class="check"></div></button>`;
  }).join('');
  const capNote = atCap ? `The party already has ${board.cap} side jobs going. Finish one before taking another. The cap is counted from jobs already started (existing quest flags); tapping a notice will not save a new field.` : `Up to ${board.cap} side jobs at a time. Tap a job to put it in the write-in box below \u2014 then lock it or edit it. The GM slots it in as a short night.`;
  return `<div class="card" id="guildboard"><h2>Teslandia mission board</h2><div class="meta" style="margin-top:4px">Short jobs posted at the Teslandia guild hall in the capital. Wrap in one or two nights. This board is only here, not in other towns.</div>${jobs || '<div class="note">No notices posted here tonight.</div>'}<div class="note">${esc(capNote)}</div></div>`;
}
function moveLabelOf(action, sc) {
  if (!action) return '';
  if (action.kind === 'move') return (sc?.moves || []).find(m => m.id === action.moveId)?.label || action.label || action.moveId || 'a saved move';
  const t = String(action.text || ''); return t ? `\u201c${t}\u201d` : 'something else';
}
function movesCard(sc, st) {
  const me = T.me; if (!me) return '<div class="card"><div class="note">You are watching. Add <b>?player=p1</b> (etc.) to play.</div></div>';
  const d = T.draft; const locked = T.mine?.locked; const canEdit = st.open;
  const story = T.game?.state?.story || {};
  const ideas = suggestedIdeas(story, sc);
  if (locked && !T.editing) {
    const what = moveLabelOf(T.mine, sc);
    return `<div class="card" id="moves"><h2>Your move, ${esc(first(me.name))}</h2><div class="move sel" style="cursor:default"><div class="ic">${svgI('risky')}</div><div style="flex:1"><div class="t">${esc(what)}</div>${T.mine.say ? `<div class="meta" style="margin-top:4px"><b style="color:var(--wine)">${T.mine.sayMode === 'whisper' ? 'Whisper' : 'I say'}:</b> \u201c${esc(T.mine.say)}\u201d</div>` : ''}</div><div class="check"></div></div>
     <div class="note">\u2713 Locked at ${timeLA(T.mine.at)}. ${canEdit ? 'You can change it until the table locks.' : 'The table has locked.'}</div>${canEdit ? '<div class="row" style="margin-top:9px"><button class="btn ghost" data-t="unlock" style="flex:1;color:var(--wine);border-color:var(--wine)">Change my move</button></div>' : ''}</div>`; }
  const ok = d.kind === 'move' ? !!d.moveId : d.kind === 'free' ? (d.text || '').trim().length >= 3 : false;
  const legacy = d.kind === 'move' && d.moveId ? `<div class="note">A saved suggested move is still on your sheet: <b>${esc(moveLabelOf(d, sc))}</b>. It will lock and resolve as before. Typing in the box, or tapping an idea, replaces it.</div>` : '';
  const ideaBtns = ideas.map(m => {
    const selected = d.kind === 'free' && (d.text || '').trim() === String(m.text || '').trim();
    return `<button class="move ${selected ? 'sel' : ''}" data-t="suggest" data-v="${esc(m.id)}" ${canEdit ? '' : 'disabled'}><div class="ic">${svgI('talk')}</div><div style="flex:1"><div class="t">${esc(m.label)}${m.hint ? `<small>${esc(m.hint)}</small>` : ''}</div><div class="d"><span class="tag">${esc(m.mission)}</span></div></div><div class="check"></div></button>`;
  }).join('');
  return `<div class="card" id="moves"><h2>What do you do tonight, ${esc(first(me.name))}?</h2>
   <div class="meta" style="margin-top:6px">Write what you try. Tap an idea to fill the box, then lock it or edit it. The GM calls the skill and the DC (Easy 6, Medium 11, or Hard 16) at resolve.</div>
   ${legacy}
   <textarea rows="3" data-f="text" maxlength="${FREE_TEXT_MAX}" placeholder="Describe what you try tonight\u2026" ${canEdit ? '' : 'disabled'}>${esc(d.text)}</textarea>
   <div class="note">${(d.text || '').length ? `${d.text.length}/${FREE_TEXT_MAX}` : `Short, up to ${FREE_TEXT_MAX} characters.`} This is how you act.</div>
   ${ideas.length ? `<div style="margin-top:12px" class="sc meta"><b style="color:var(--wine)">Ideas</b> <span class="meta">tied to the missions above. Tap one to fill the box.</span></div>${ideaBtns}` : ''}
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
    else if (sc.battle && a.orders && c && s) { const L = orderLines(a.orders, s, c, { text: a.text }); what = L.filter(([k, v]) => !(k === 'Standing order' && /^(none|no standing order)$/i.test(v))).map(([k, v]) => `<b>${esc(k)}:</b> ${v}`).join(' \u00b7 '); }
    else if (a.kind === 'move') what = `<b>${esc(moveLabelOf(a, sc))}</b>`;
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
  const shopTeaser = sc.shop && st.open && T.me ? `<button class="card ribbon" data-t="go" data-v="gear"><span>\u{1F6D2} <b>${esc(SHOPS[sc.shop]?.name || 'The shop')}</b> is open tonight${T.cart?.length ? ` \u00b7 ${T.cart.length} in your cart` : ''}</span><span>Gear \u2192</span></button>` : '';
  // Order: table narrative > Current Missions > guild board > map (battles only) > action box.
  return prev + F5.levelBanner() + sceneCard(sc) + G.lootCard() + missionsCard() + guildBoardCard(st) + movesCard(sc, st) + partyCard(st) + F5.restCard() + shopTeaser + lockCard(st) + F5.askCard();
}

// ---------- battle ----------
function mapHtml(view, opts = {}) {
  return spriteMap(view, { ...opts, isMe: pid => pidOfCid(pid) === OWNER || pid === OWNER, pcFallback: pid => AV(pidOfCid(pid) || pid) });
}
function initStrip(view) {
  return initStripHtml(view, { isMe: pid => pidOfCid(pid) === OWNER || pid === OWNER, pcFallback: pid => AV(pidOfCid(pid) || pid), firstName: first });
}
function legend(view) { const foes = view.combatants.filter(c => c.side !== 'pc' && c.kind !== 'pc');
  const lg = { floor: 'floor', difficult: 'tables (difficult)', wall: 'bar (wall)', ...(view.map?.legend || {}) };
  return `<div class="legend"><span style="--c:#8a6438">${esc(lg.floor)}</span><span style="--c:repeating-linear-gradient(45deg,#5b3d1f 0 3px,#3a2612 3px 6px)">${esc(lg.difficult)}</span><span style="--c:${view.map?.water ? '#2f6f9e' : '#2b1c12'}">${esc(lg.wall)}</span><span style="--c:#e35d4f">bloodied</span>${(T.game?.state?.encounter?.startedNight || 0) >= RULES_V2_NIGHT ? '<span class="sq">1 square = 10 ft</span>' : ''}</div>
   <div class="meta" style="color:#b89b62;margin-top:6px">${foes.map(f => `<b style="color:#f0d58a">${esc(foeLabel(f))}</b> ${esc(f.name)} ${f.hp > 0 ? `(${f.hp <= f.max / 2 ? 'bloodied' : 'unhurt'})` : '(down)'}`).join(' \u00b7 ')}</div>`; }
const SPELL_OK = id => { const sp = SRD.spells[id]; return sp && /^action/i.test(sp.castingTime || ''); };
// post-fight rules (Night 20+): 10-ft squares, casting times shown between rounds, 1-minute spells take 10 rounds
const isV2 = () => ((T.game?.state?.encounter?.startedNight ?? T.n) || 0) >= RULES_V2_NIGHT;
const SPELL_OK_V2 = id => { const sp = SRD.spells[id]; return sp && (/^action/i.test(sp.castingTime || '') || (castRounds(sp) > 1 && castRounds(sp) <= 10)); };
const castingOf = c => (c?.effects || []).find(e => e.id === 'casting') || null;
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
  // Order: table narrative > Current Missions > map > action box (orders).
  return sceneCard({ ...sc, prose: sc.prose.slice(0, 1) }) + missionsCard() + pausedCard + mapCard + (me ? ordersCard(st) : '') + partyCard(st) + lockCard(st);
}
function ordersCard(st) {
  const me = T.me; const c = ch(me.cid); const s = sheetOf(me.cid); const o = T.orders; const r = o.thisRound; const view = T.game.view; const canEdit = st.open;
  if (T.mine?.locked && !T.editing) return `<div class="card" id="orders"><h2>Your ${fightWord()} orders</h2><ul class="list">${orderLines(T.mine.orders, s, c, { text: T.mine.text }).map(([k, v]) => `<li>${k}<span class="r">${v}</span></li>`).join('')}</ul><div class="note">\u2713 Locked at ${timeLA(T.mine.at)}. ${canEdit ? 'You can change them until the table locks.' : ''}</div>${canEdit ? '<div class="row" style="margin-top:9px"><button class="btn ghost" data-t="unlock" style="flex:1;color:var(--wine);border-color:var(--wine)">Change my orders</button></div>' : ''}</div>`;
  const foes = view.combatants.filter(x => x.side !== 'pc' && x.kind !== 'pc' && x.hp > 0);
  const chip = (grp, v, label, on) => `<button class="chip ${on ? 'on' : ''}" data-t="ord" data-k="${grp}" data-v="${esc(v)}" ${canEdit ? '' : 'disabled'}>${label}</button>`;
  const act = r.action || {}; const v2 = isV2(); const spells = actionSpells(c, s, { v2, castRounds }); const casting = v2 ? castingOf(c) : null; const conc = v2 && c.conc && !c.conc.casting ? c.conc : null;
  const spellChip = (x, endConc) => v2 ? `<i>${esc(x.name)}</i> <small>${x.level ? `L${x.level} \u00b7 ` : ''}${esc(castTimeLabel(SRD.spells[x.id]))}${endConc && SRD.spells[x.id].concentration ? ` \u00b7 ends ${esc(SRD.spells[endConc.spell]?.name)}` : ''}</small>` : `<i>${esc(x.name)}</i>${x.level ? ` <small>L${x.level}</small>` : ''}`;
  const acts = [...(casting ? [['continue_cast', `Keep casting <i>${esc(SRD.spells[casting.spell]?.name)}</i> <small>${casting.left} round${casting.left === 1 ? '' : 's'} left</small>`]] : []), ['attack', 'Attack'], ...spells.slice(0, 8).map(x => ['cast:' + x.id, spellChip(x, conc || casting)]), ['dodge', 'Dodge'], ['help', 'Help an ally'], ['dash', 'Dash']];
  for (const f of actionFeatures(c, s)) acts.push([f.do, f.do === 'lay_on_hands' ? `Lay on Hands <small>(${f.left} HP)</small>` : f.name]);
  const allyTarget = act.do === 'cast' && ['heal', 'buff', 'cure'].includes(spellKind(act.spell)) || ['help', 'healing_hands', 'lay_on_hands'].includes(act.do);
  const tg = allyTarget ? [['ally_lowest', 'Most hurt ally'], ['self', 'Myself'], ...T.players.filter(p => p.pid !== OWNER).map(p => [p.cid, esc(first(p.name))])] : [['nearest', 'Nearest'], ['weakest', 'Weakest'], ['boss', 'The boss'], ...foes.map(f => [f.uid, esc(foeLabel(f))])];
  const mv = r.move === 'hold' ? 'hold' : Array.isArray(r.move) ? 'cell' : 'auto'; const multi = act.do === 'cast' ? multiTargets(act.spell) : 0;
  const pre = presets(c, s);
  return `<div class="card" id="orders"><h2>Your ${fightWord()} orders</h2>
   <div class="sc meta" style="margin-top:8px;color:var(--wine);font-weight:700">This round \u00b7 move</div><div class="chips">${chip('move', 'auto', 'Close in as needed', mv === 'auto')}${chip('move', 'hold', 'Hold position', mv === 'hold')}${chip('move', 'cell', Array.isArray(r.move) ? `Move to ${'ABCDEFGHIJ'[r.move[0]]}${r.move[1] + 1}` : T.pickCell ? 'Tap a square on the map\u2026' : 'Pick a square', mv === 'cell' || T.pickCell)}</div>
   <div class="sc meta" style="margin-top:8px;color:var(--wine);font-weight:700">Action</div><div class="chips">${acts.map(([v, l]) => chip('act', v, l, (act.do === 'cast' ? 'cast:' + act.spell : act.do) === v)).join('')}</div>
   ${casting && act.do !== 'continue_cast' ? `<div class="note">Picking anything else stops ${esc(SRD.spells[casting.spell]?.name)}; the spell is lost (no slot spent).</div>` : ''}
   ${conc ? `<div class="sc meta" style="margin-top:8px;color:var(--wine);font-weight:700">Concentrating on ${esc(SRD.spells[conc.spell]?.name)}</div><div class="chips">${chip('keep', '1', `Keep it going${conc.spell === 'heat_metal' ? ' <small>burns again (bonus action)</small>' : ''}`, r.keep !== false)}${chip('keep', '0', 'Let it end', r.keep === false)}</div>` : ''}
   ${['dodge', 'dash', 'continue_cast'].includes(act.do) ? '' : `<div class="sc meta" style="margin-top:8px;color:var(--wine);font-weight:700">Target${multi ? ` \u00b7 up to ${multi}` : ''}</div><div class="chips">${tg.map(([v, l]) => chip('tgt', v, l, multi && Array.isArray(act.targets) && act.targets.length ? v !== 'ally_lowest' && act.targets.includes(v === 'self' ? me.cid : v) : act.target === v)).join('')}</div>`}
   ${s.resources.action_surge?.left > 0 ? `<div class="chips" style="margin-top:8px">${chip('surge', o.actionSurge ? '0' : '1', `Action Surge ${o.actionSurge ? 'ON' : 'off'} <small>(${s.resources.action_surge.left} left)</small>`, !!o.actionSurge)}</div>` : ''}
   ${canSacredWeapon(c, s) || o.sacredWeapon ? `<div class="chips" style="margin-top:8px">${chip('sacred', o.sacredWeapon ? '0' : '1', `Sacred Weapon ${o.sacredWeapon ? 'ON' : 'off'} <small>(Channel Divinity${s.resources.channel_divinity ? `, ${s.resources.channel_divinity.left} left` : ''})</small>`, !!o.sacredWeapon)}</div>` : ''}
   ${bonusOrdersHtml(c, s, o, r, chip, conc, v2, spellChip, me)}
   <div class="sc meta" style="margin-top:10px;color:var(--wine);font-weight:700">Standing order</div>${pre.map(p => `<button class="move ${o.preset === p.id ? 'sel' : ''}" data-t="preset" data-v="${p.id}" style="margin:5px 0" ${canEdit ? '' : 'disabled'}><div class="ic">${svgI(p.id === 'none' ? 'sword' : 'party')}</div><div style="flex:1"><div class="t">${esc(p.t)}</div><div class="meta">${esc(p.d)}</div></div><div class="check"></div></button>`).join('')}
   ${writeInBox(T.draft, canEdit)}
   <textarea rows="2" style="margin-top:7px" data-f="say" placeholder="Optional war cry (I say\u2026)" ${canEdit ? '' : 'disabled'}>${esc(T.draft.say)}</textarea>
   <div class="note">The engine plays one round, then stops for new orders, or earlier if an ally drops to 0 or a new enemy appears. A boss phase change or broken concentration is only a notice. If you miss the cutoff, you fight on your stance (<b>${STANCE_TXT[stanceOf(OWNER)]}</b>; change it on the Hero tab).</div>
   <div class="row" style="margin-top:10px"><button class="btn" data-t="lockorders" style="flex:1" ${canEdit ? '' : 'disabled'}>Lock orders</button></div></div>`;
}
// ally spells that take several creatures at their base level (Bless 3, Aid 3): the Target chips become a multi-pick
const multiTargets = id => { const m = spellModel(id); return m && (m.kind === 'buff' || m.kind === 'heal') && !m.outOfCombat && m.targets > 1 && ['heal', 'buff'].includes(spellKind(id)) ? m.targets : 0; };
const tgtList = a => Array.isArray(a?.targets) && a.targets.length > 1 ? a.targets : null;
const spellKind = id => ({ healing_word: 'heal', cure_wounds: 'heal', bless: 'buff', heroism: 'buff', aid: 'heal', shield_of_faith: 'buff', guidance: 'buff', prayer_of_healing: 'heal', lesser_restoration: 'cure', dragons_breath: 'buff' }[id] || (['heal', 'buff', 'cure'].includes(spellModel(id)?.kind) ? spellModel(id).kind : 'attack'));
function smiteWhenLabel(when) { return ({ never: 'Off', always: 'On a hit', crit: 'On a crit', boss: 'On the boss' })[when] || when; }
function smiteLine(sm) { if (!sm || sm.when === 'never') return null; return `${SRD.spells[sm.spell || 'divine_smite']?.name || 'Smite'} ${({ always: 'on a hit', crit: 'on a crit', boss: 'on the boss' })[sm.when] || sm.when}`; }
function bonusLine(b, tname) {
  if (!b?.do) return null;
  const name = b.do === 'cast' ? (SRD.spells[b.spell]?.name || b.spell) : b.do === 'celestial_revelation' ? 'Celestial Revelation' : b.do === 'bardic_inspiration' ? 'Bardic Inspiration' : b.do === 'second_wind' ? 'Second Wind' : b.do === 'innate_sorcery' ? 'Innate Sorcery' : b.do.replace(/_/g, ' ');
  const tgt = b.target && !['second_wind', 'innate_sorcery', 'celestial_revelation'].includes(b.do) ? ' \u2192 ' + (typeof tname === 'function' ? tname(b.target) : b.target) : '';
  return name + tgt;
}
function bonusOrdersHtml(c, s, o, r, chip, conc, v2, spellChip, me) {
  const bSpells = bonusSpells(c, s); const bFeats = bonusFeatures(c, s); const smites = smiteSpells(c, s);
  if (!bSpells.length && !bFeats.length && !smites.length) return '';
  const b = r.bonus || null;
  const onBonus = v => !b ? v === '0' : (b.do === 'cast' ? 'cast:' + b.spell : b.do) === v;
  const bonusAlly = b && (b.do === 'cast' && ['heal', 'buff', 'cure'].includes(spellKind(b.spell)) || b.do === 'bardic_inspiration');
  const bTg = bonusAlly ? [['ally_lowest', 'Most hurt ally'], ...(b.do === 'bardic_inspiration' ? [] : [['self', 'Myself']]), ...T.players.filter(p => p.pid !== OWNER && (b.do !== 'bardic_inspiration' || p.cid !== me.cid)).map(p => [p.cid, esc(first(p.name))])] : [];
  const smWhen = o.smite?.when || (smites.length ? 'crit' : null);
  const smSpell = o.smite?.spell || smites.find(x => x.id === 'divine_smite')?.id || smites[0]?.id;
  const bonusBlocks = [];
  if (bSpells.length || bFeats.length) {
    const chips = [chip('bonus', '0', 'None', !b), ...bFeats.map(f => chip('bonus', f.do, `${esc(f.name)}${f.left != null ? ` <small>(${f.left} left${f.die ? ` \u00b7 ${esc(f.die)}` : ''})</small>` : ''}`, onBonus(f.do))), ...bSpells.map(x => chip('bonus', 'cast:' + x.id, spellChip(x, conc), onBonus('cast:' + x.id)))].join('');
    bonusBlocks.push(`<div class="sc meta" style="margin-top:8px;color:var(--wine);font-weight:700">Bonus action</div><div class="chips">${chips}</div>`);
    if (b && ['cast'].includes(b.do) && SRD.spells[b.spell]?.concentration && conc && conc.spell !== b.spell) bonusBlocks.push(`<div class="note">Casting ${esc(SRD.spells[b.spell]?.name)} ends ${esc(SRD.spells[conc.spell]?.name)}.</div>`);
    if (bonusAlly) bonusBlocks.push(`<div class="sc meta" style="margin-top:8px;color:var(--wine);font-weight:700">Bonus target</div><div class="chips">${bTg.map(([v, l]) => chip('btgt', v, l, (b.target || (b.do === 'bardic_inspiration' ? 'ally_lowest' : 'self')) === v)).join('')}</div>`);
  }
  if (smites.length) {
    const whenChips = [['never', 'Off'], ['always', 'On a hit'], ['crit', 'On a crit'], ['boss', 'On the boss']].map(([v, l]) => chip('smwhen', v, l, smWhen === v)).join('');
    const spellChips = smites.map(x => chip('smspell', x.id, `<i>${esc(x.name)}</i> <small>${x.free ? 'free' : `L${x.level}`}</small>`, smSpell === x.id)).join('');
    bonusBlocks.push(`<div class="sc meta" style="margin-top:8px;color:var(--wine);font-weight:700">Smite on a hit <small style="font-weight:500">\u00b7 bonus action after a melee hit</small></div><div class="chips">${whenChips}</div><div class="chips" style="margin-top:6px">${spellChips}</div>`);
    if (smWhen && smWhen !== 'never' && !o.smite) bonusBlocks.push(`<div class="note">If you do not change this, Divine Smite still goes off on a critical hit (the engine default).</div>`);
    if (b && smWhen && smWhen !== 'never') bonusBlocks.push(`<div class="note">A bonus action this round uses the same bonus as a smite, so the smite will not go off.</div>`);
  }
  return bonusBlocks.join('');
}
function writeInBox(d, canEdit) {
  const text = d?.text || '';
  const mapped = text.trim() ? N.mapCombatWriteIn(text) : null;
  const slotNote = !mapped ? 'If you fill this in, it replaces your Action this turn, unless you clearly describe a move or a bonus action instead.'
    : mapped.slot === 'bonus' ? 'This replaces your bonus action this turn. Your Action still stands.'
    : mapped.slot === 'move' ? 'This replaces your move this turn. Your Action still stands.'
    : 'This replaces your Action this turn.';
  return `<div style="margin-top:10px" class="sc meta"><b style="color:var(--wine)">Or: I do something else</b></div>
   <textarea rows="2" data-f="text" maxlength="${FREE_TEXT_MAX}" placeholder="Grapple, shove, use the terrain or an item\u2026 The GM rules it at resolve." ${canEdit ? '' : 'disabled'}>${esc(text)}</textarea>
   <div class="note" id="writein-note">${esc(slotNote)} ${text.length ? `${text.length}/${FREE_TEXT_MAX}` : `Short, up to ${FREE_TEXT_MAX} characters.`} The GM maps it to the closest legal action and, if a check is needed, calls Easy, Medium or Hard.</div>`;
}
function writeInLine(text) { const t = String(text || '').trim(); return t ? `\u201c${esc(t.length > 160 ? t.slice(0, 157) + '\u2026' : t)}\u201d` : null; }
function orderLines(o, s, c, extra = {}) { const r = o?.thisRound || {}; const a = r.action || {}; const tname = t => ({ nearest: 'nearest foe', weakest: 'weakest foe', boss: 'the boss', ally_lowest: 'most hurt ally', self: 'myself' }[t] || T.game.view.combatants.find(x => x.uid === t)?.name || T.players.find(p => p.cid === t)?.name || t);
  const pre = presets(c, s).find(p => p.id === o?.preset);
  const btxt = bonusLine(r.bonus, t => esc(tname(t === T.me?.cid ? 'self' : t)));
  const stxt = smiteLine(o?.smite);
  const wmap = extra.text?.trim() ? N.mapCombatWriteIn(extra.text) : null;
  const wtxt = writeInLine(extra.text);
  const wnote = wmap?.slot === 'bonus' ? ' <small>(replaces bonus action)</small>' : wmap?.slot === 'move' ? ' <small>(replaces move)</small>' : wmap ? ' <small>(replaces Action)</small>' : '';
  return [['Move', r.move === 'hold' ? 'hold position' : Array.isArray(r.move) ? `to ${'ABCDEFGHIJ'[r.move[0]]}${r.move[1] + 1}` : 'close in as needed'], ['Action', `${a.do === 'cast' ? `<i>${esc(SRD.spells[a.spell]?.name)}</i>` : a.do === 'continue_cast' ? 'keep casting' : esc(a.do)}${tgtList(a) ? ' \u2192 ' + tgtList(a).map(t => esc(tname(t === T.me?.cid ? 'self' : t))).join(', ') : a.target && !['dodge', 'dash'].includes(a.do) ? ' \u2192 ' + esc(tname(a.target)) : ''}`], ...(btxt ? [['Bonus action', btxt]] : []), ...(stxt ? [['Smite', esc(stxt)]] : []), ...(o?.actionSurge ? [['Action Surge', 'on']] : []), ...(o?.sacredWeapon ? [['Sacred Weapon', 'on']] : []), ...(r.keep === false ? [['Concentration', 'let it end']] : []), ...(wtxt ? [['Something else', wtxt + wnote]] : []), ['Standing order', esc(pre?.t || 'none')]]; }

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
  const ordersIn = ord.length ? `<div class="card"><h2>Orders in</h2><ul class="list">${ord.map(e => `<li>${AV(e.pid)}<div style="flex:1;min-width:0"><b>${esc(first(e.name))}</b><div class="meta">${e.kind === 'absent' ? `absent \u00b7 fought on <b>${STANCE_TXT[e.stance || stanceOf(e.pid)]}</b> stance` : orderText(e)}</div>${e.check ? `<div class="meta">${esc(e.check.label || e.check.skill)} ${e.check.nat} = ${e.check.total} vs DC ${e.check.dc}. ${e.check.ok ? 'Success.' : 'Failure.'}</div>` : ''}${e.say ? `<div class="meta"><b style="color:#7d1d2e">I say:</b> \u201c${esc(e.say)}\u201d</div>` : ''}</div></li>`).join('')}</ul></div>` : '';
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
  return esc([r.move === 'hold' ? 'hold' : Array.isArray(r.move) ? `move to ${'ABCDEFGHIJ'[r.move[0]]}${r.move[1] + 1}` : 'close in', a.do === 'cast' ? `${SRD.spells[a.spell]?.name || a.spell} \u2192 ${tgtList(a) ? tgtList(a).map(t => N.shortName(T.players.find(p => p.cid === t)?.name || tn(t))).join(', ') : tn(a.target)}` : a.do === 'continue_cast' ? 'keep casting' : `${a.do || 'attack'}${a.target && !['dodge', 'dash'].includes(a.do) ? ' \u2192 ' + tn(a.target) : ''}`, bonusLine(r.bonus, t => tn(t)), smiteLine(o.smite), r.keep === false ? 'let concentration end' : null, o.actionSurge ? 'Action Surge' : null, o.sacredWeapon ? 'Sacred Weapon' : null, e.text ? 'something else: \u201c' + e.text + '\u201d' : null, o.preset && o.preset !== 'none' ? `standing order: ${({ guard: 'Dodge when hurt', healer: 'Healer first', medic: 'No one bleeds out' })[o.preset] || o.preset}` : null].filter(Boolean).join(' \u00b7 ')); }
async function verify(k) { const r = T.results[k], sc = T.scenes[k]; if (!r || !sc) return; (T.verify = T.verify || {})[k] = { seed: N.verifyCommit(r.seed, sc.commit), dc: sc.dcCommit ? N.commit(r.salt + '|' + JSON.stringify(r.dcs)) === sc.dcCommit : null }; }

// ---------- recap / chronicle ----------
function recapView(k) {
  const r = T.results[k]; if (!r) return '<div class="card"><div class="note">Not resolved yet.</div></div>';
  const best = r.entries.filter(e => e.check).sort((a, b) => b.check.nat - a.check.nat).slice(0, 2);
  const xpBy = cid => r.sheetChanges.filter(c => c.cid === cid && c.what === 'XP').map(c => c.delta).join(' ');
  const xpAvg = Math.round(T.players.reduce((s, p) => s + (ch(p.cid)?.xp || 0), 0) / Math.max(1, T.players.length)); const lvAvg = Math.min(...T.players.map(p => ch(p.cid)?.level || 3)); const nx = XP_NEXT[lvAvg] || 14000;
  const nextSc = T.scenes[k + 1];
  const reel = reelHtml(reelFor(k, T.scenes[k]?.id || r.sceneId || r.scene));
  const checks = r.entries.filter(e => e.check);
  const checkList = checks.length ? `<div class="card"><h2>Ruled checks</h2><ul class="list">${checks.map(e => { const line = ruledCheckLine(e); const how = e.kind === 'free' || e.kind === 'orders' && e.text ? 'write-in' : (e.kind === 'move' ? 'suggested move' : e.kind); return `<li>${AV(e.pid)}<div style="flex:1;min-width:0"><b>${esc(first(e.name))}</b> \u00b7 ${esc(how)}<div class="meta">${line ? esc(line) : esc((e.check.label || e.check.skill || '') + ' DC ' + e.check.dc)}</div></div><span class="r">${e.check.ok ? 'Success' : 'Failure'}</span></li>`; }).join('')}</ul><div class="note">Write-ins are called on the night\u2019s scale: Easy 6, Medium 11, or Hard 16 from Night 38 on.</div></div>` : '';
  return `${reel}<div class="card"><div class="eyebrow">Chronicle \u00b7 Night ${k}</div><div class="title">${esc(r.title)}</div>${(r.narration || '').split(/\n\s*\n/).slice(0, 2).map(p => `<p class="prose">${md(p)}</p>`).join('')}</div>
   ${checkList}
   ${best.length ? `<div class="card dark"><h2>Dice of the night</h2>${best.map(e => `<div class="row" style="margin-top:9px;gap:12px">${D20(e.check.nat, e.check.nat === 20 ? '#b8862a' : e.check.nat === 1 ? '#7a1a1f' : '#2c6a8a')}<div><b style="font:700 14px Cinzel,serif;color:#f0d58a">${esc(first(e.name))} \u00b7 ${esc(e.label || 'something else')}</b><div class="meta" style="color:#cdb27a">${ruledCheckLine(e) ? esc(ruledCheckLine(e)) + ' \u00b7 ' : ''}${e.check.nat} ${e.check.parts.map(p => `${sgn(p.v).replace('+', '+ ').replace('\u2212', '\u2212 ')} ${esc(p.src)}`).join(' ')} = ${e.check.total} vs DC ${e.check.dc}. ${e.check.ok ? 'Success.' : 'Failure.'}</div></div></div>`).join('')}</div>` : ''}
   ${r.battle && !r.battle.started ? `<div class="card dark"><h2>The fight</h2><div class="meta" style="color:#cdb27a;margin-top:6px">${esc(r.battle.name)} \u00b7 through round ${r.battle.round} \u00b7 ${r.battle.unfinished ? `saved, resumes Night ${k + 1}` : esc(r.battle.status)}${r.battle.stop ? ` \u00b7 stopped: ${esc(r.battle.stop.text)}` : ''}</div></div>` : ''}
   <div class="card"><h2>The heroes</h2><ul class="list">${T.players.map(p => { const c = ch(p.cid); const s = sheetOf(p.cid); const e = r.entries.find(x => x.pid === p.pid);
     return `<li>${AV(p.pid)}<div style="flex:1;min-width:0"><b>${esc(p.name)}</b><div class="meta">HP ${c.hp.cur}/${s.hpMax}${c.inspiration ? ' \u00b7 Heroic Inspiration \u2726' : ''}${e?.kind === 'absent' ? ` \u00b7 absent (${STANCE_TXT[e.stance || stanceOf(p.pid)]})` : ''}${r.sheetChanges.filter(x => x.cid === p.cid && x.what !== 'XP').map(x => ` \u00b7 ${esc(x.what)} ${esc(x.delta)}`).join('')}</div></div><span class="r" style="color:#2f6a2c">${esc(xpBy(p.cid))}</span></li>`; }).join('')}</ul>
   <div class="meta" style="margin-top:8px"><b>Party XP</b> \u00b7 ${xpAvg.toLocaleString()} / ${nx.toLocaleString()} to level ${lvAvg + 1} (average)</div><div class="xpbar"><i style="width:${Math.min(100, Math.round(100 * xpAvg / nx))}%"></i></div></div>
   <div class="card dark"><h2>Next</h2><p style="margin:7px 0 4px;font-size:15px;color:#efe0bb">${nextSc ? `Night ${k + 1} is up: <b style="color:#f0d58a">${esc(nextSc.title)}.</b> Choose by <b style="color:#f0d58a">${N.fmtLA(nextSc.cutoffMs)}</b>.` : esc(r.nextTeaser || 'The GM will open the next scene soon.')}</p>
   <div class="row" style="margin-top:8px">${nextSc ? '<button class="btn gold sm" data-t="go" data-v="table" style="width:auto">Open tonight\u2019s scene</button>' : ''}<div class="sp"></div><button class="btn ghost sm" data-t="go" data-v="chron" style="width:auto;color:#f0d58a;border-color:#f0d58a">All recaps</button></div></div>`;
}
// ---------- recap popup (post-fight list item 1) ----------
// The latest night's recap opens full screen once per night per player on this device (localStorage only; nothing is
// written to the database). An optional static battle reel (content/battle-reels.js, keyed by night or scene id; not
// stored in the save) plays at the top when one is configured, then that night's Ask the GM questions and their
// answers (omitted entirely if there are none); the colored narration follows; "Back to the table" closes it. Write-in /
// "Something else" summaries (skill, DC, reason, result) are not listed here.
const SEEN_KEY = () => `bog5.recapSeen.${q.get('store') || 'local'}.${OWNER || 'guest'}`;
const seenNights = () => { try { const v = JSON.parse(localStorage.getItem(SEEN_KEY()) || '[]'); return Array.isArray(v) ? v : []; } catch { return []; } };
function markSeen(k) { try { localStorage.setItem(SEEN_KEY(), JSON.stringify([...seenNights().filter(x => x !== k), k].slice(-60))); } catch {} }
export function gmRequests(k, r, asks = T.asks || [], players = T.players || []) {
  const nameOf = pid => players.find(p => p.pid === pid)?.name || pid;
  return asks.filter(a => a.night === k).sort((x, y) => x.at - y.at)
    .map(a => ({ pid: a.by, name: nameOf(a.by), kind: 'Ask the GM', text: a.text, ruling: a.answer ? `${a.answer.text}${a.answer.srd ? ` (${a.answer.srd})` : ''}` : 'Not answered yet.', result: '' }));
}
function recapPopupHtml(k, r) {
  const reqs = gmRequests(k, r);
  const reel = reelHtml(reelFor(k, T.scenes?.[k]?.id || r.sceneId || r.scene));
  const front = reqs.length ? `<div class="card"><h2>Ask the GM \u00b7 Night ${k}</h2><ul class="list">${reqs.map(x => `<li>${AV(x.pid)}<div style="flex:1;min-width:0"><b>${esc(first(x.name))}</b> <span class="tag">${esc(x.kind)}</span><div class="meta">\u201c${esc(x.text)}\u201d</div><div class="meta"><b style="color:#7d1d2e">Ruled:</b> ${esc(x.ruling)}</div>${x.result ? `<div class="meta">${esc(x.result)}</div>` : ''}</div></li>`).join('')}</ul></div>` : '';
  const narr = `<div class="card"><h2>The GM narrates</h2>${(r.narration || '').split(/\n\s*\n/).map(p => `<p class="prose" style="font-size:15.5px">${md(p)}</p>`).join('')}</div>`;
  const checks = (r.entries || []).filter(e => e.check && (e.kind === 'free' || (e.kind === 'orders' && e.text) || e.dcCall));
  const ruled = checks.length ? `<div class="card"><h2>Write-in checks</h2><ul class="list">${checks.map(e => `<li>${AV(e.pid)}<div style="flex:1;min-width:0"><b>${esc(first(e.name))}</b><div class="meta">${esc(ruledCheckLine(e) || ((e.check.skill || '') + ' DC ' + e.check.dc))}</div></div></li>`).join('')}</ul></div>` : '';
  return `<div class="recappop-in"><div class="card dark"><div class="eyebrow" style="color:#cdb27a">Night ${k} \u00b7 the recap</div><div class="title" style="color:#f0d58a">${esc(r.title || '')}</div></div>${reel}${front}${narr}${ruled}<button class="btn gold back" data-recapclose="1">Back to the table</button></div>`;
}
async function maybeRecapPopup() {
  if (T.view !== 'table' || !T.n || q.get('norecap')) return; const k = T.scene?.status === 'resolved' ? T.n : T.n - 1; if (k < 1 || seenNights().includes(k)) return;
  const r = await resultOf(k).catch(() => null); if (!r?.narration) return;
  const el = document.createElement('div'); el.className = 'recappop'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', `Night ${k} recap`); el.innerHTML = recapPopupHtml(k, r);
  const close = () => { markSeen(k); el.remove(); document.body.classList.remove('popopen'); document.removeEventListener('keydown', onKey); };
  const onKey = e => { if (e.key === 'Escape') close(); };
  el.addEventListener('click', e => { if (e.target.closest('[data-recapclose]')) close(); }); document.addEventListener('keydown', onKey);
  document.body.appendChild(el); document.body.classList.add('popopen'); el.scrollTop = 0;
  el.querySelector('video')?.play?.().catch(() => {});
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
async function saveDraft(locked) { const d = T.draft = normalizeDraft(T.draft); const a = { ...draftAction(d, locked), ...extras() };
  await store.putAction(T.n, a); T.mine = await store.myAction(T.n); T.locks = await store.locks(T.n); }
async function saveOrders(locked) { const o = T.orders; const pre = presets(ch(T.me.cid), sheetOf(T.me.cid)).find(p => p.id === o.preset);
  const orders = { thisRound: { ...o.thisRound, move: o.thisRound.move ?? undefined }, standing: pre?.rule || [], preset: o.preset, actionSurge: !!o.actionSurge, ...(o.smite ? { smite: o.smite } : {}), ...(o.sacredWeapon ? { sacredWeapon: true } : {}) };
  const d = T.draft = normalizeDraft(T.draft); await store.putAction(T.n, { kind: 'orders', orders, say: (d.say || '').trim(), ...( (d.text || '').trim() ? { text: (d.text || '').trim() } : {} ), locked, ...extras() }); T.mine = await store.myAction(T.n); T.locks = await store.locks(T.n); }
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
      case 'move': T.draft = normalizeDraft({ ...T.draft, kind: 'move', moveId: v }); await saveDraft(false); break;
      case 'suggest': { const text = pickWriteIn(v, T.game?.state?.story || {}, T.scene || {}); if (!text) break;
        T.draft = normalizeDraft({ ...T.draft, kind: 'free', moveId: null, text }); await saveDraft(false); break; }
      case 'saymode': T.draft = normalizeDraft({ ...T.draft, sayMode: v }); break;
      case 'lock': await saveDraft(true); T.editing = false; break;
      case 'unlock': T.editing = true; if (T.scene.battle) { T.orders = structuredClone(T.mine.orders); } else T.draft = normalizeDraft({ ...T.draft, ...T.mine }); await (T.scene.battle ? saveOrders(false) : saveDraft(false)); break;
      case 'ord': { const r = T.orders.thisRound; T.pickCell = false;
        if (k === 'move') { if (v === 'cell') { T.pickCell = true; } else r.move = v === 'hold' ? 'hold' : null; }
        if (k === 'act') { const [d, spell] = v.split(':'); const ally = d === 'cast' && ['heal', 'buff'].includes(spellKind(spell)) || ['help', 'healing_hands'].includes(d); r.action = { do: d, ...(spell ? { spell } : {}), target: ally ? 'ally_lowest' : 'nearest' }; }
        if (k === 'tgt') { const max = r.action?.do === 'cast' ? multiTargets(r.action.spell) : 0;
          if (!max || v === 'ally_lowest') { const { targets, ...a } = r.action || {}; r.action = { ...a, target: v }; }
          else { const id = v === 'self' ? T.me.cid : v; let list = Array.isArray(r.action.targets) ? [...r.action.targets] : (r.action.target && r.action.target !== 'ally_lowest' ? [r.action.target === 'self' ? T.me.cid : r.action.target] : []);
            list = list.includes(id) ? list.filter(x => x !== id) : list.length < max ? [...list, id] : list;
            const { targets, ...a } = r.action; r.action = list.length ? { ...a, target: list[0] === T.me.cid ? 'self' : list[0], targets: list } : { ...a, target: 'ally_lowest' }; } } if (k === 'surge') T.orders.actionSurge = v === '1';
        if (k === 'sacred') T.orders.sacredWeapon = v === '1';
        if (k === 'bonus') { if (v === '0') delete r.bonus; else { const [d, spell] = v.split(':'); const ally = d === 'cast' && ['heal', 'buff', 'cure'].includes(spellKind(spell)) || d === 'bardic_inspiration'; r.bonus = { do: d, ...(spell ? { spell } : {}), ...(d === 'celestial_revelation' ? { form: 'radiance' } : {}), ...(ally ? { target: d === 'bardic_inspiration' ? 'ally_lowest' : 'self' } : {}) }; } }
        if (k === 'btgt' && r.bonus) r.bonus = { ...r.bonus, target: v };
        if (k === 'smwhen') T.orders.smite = { when: v, spell: T.orders.smite?.spell || 'divine_smite', ...(T.orders.smite?.level ? { level: T.orders.smite.level } : {}) };
        if (k === 'smspell') T.orders.smite = { when: T.orders.smite?.when && T.orders.smite.when !== 'never' ? T.orders.smite.when : 'always', spell: v, ...(T.orders.smite?.level ? { level: T.orders.smite.level } : {}) };
        if (k === 'keep') { if (v === '0') r.keep = false; else delete r.keep; } break; }
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
function onInput(e) { const f = e.target.dataset?.f; if (!f) return; if (f === 'report') { T.reportText = e.target.value; return; } if (f === 'ask') { T.askText = e.target.value; T.askDone = null; return; } if (f === 'attach') { T.reportAttach = e.target.checked; return; } T.draft = normalizeDraft(T.draft); if (f === 'text') { T.draft.text = capFreeText(e.target.value); if (e.target.value !== T.draft.text) e.target.value = T.draft.text;
    if (T.scene?.battle) { const note = e.target.parentNode?.querySelector?.('#writein-note') || e.target.nextElementSibling; if (note && note.classList.contains('note')) { const mapped = T.draft.text.trim() ? N.mapCombatWriteIn(T.draft.text) : null; note.textContent = (!mapped ? 'If you fill this in, it replaces your Action this turn, unless you clearly describe a move or a bonus action instead.' : mapped.slot === 'bonus' ? 'This replaces your bonus action this turn. Your Action still stands.' : mapped.slot === 'move' ? 'This replaces your move this turn. Your Action still stands.' : 'This replaces your Action this turn.') + ' ' + (T.draft.text.length ? `${T.draft.text.length}/${FREE_TEXT_MAX}` : `Short, up to ${FREE_TEXT_MAX} characters.`) + ' The GM maps it to the closest legal action and, if a check is needed, calls Easy, Medium or Hard.'; } }
    else { T.draft.kind = T.draft.text.trim() ? 'free' : (T.draft.moveId ? 'move' : null); if (T.draft.kind === 'free') T.draft.moveId = null; } } else T.draft[f] = e.target.value;
  const btn = document.querySelector('[data-t="lock"]'); if (btn) btn.disabled = !(T.draft.kind === 'move' ? T.draft.moveId : T.draft.kind === 'free' && (T.draft.text || '').trim().length >= 3);
  document.querySelectorAll('[data-t="move"]').forEach(m => m.classList.toggle('sel', T.draft.kind === 'move' && m.dataset.v === T.draft.moveId));
  document.querySelectorAll('[data-t="suggest"]').forEach(m => { const txt = pickWriteIn(m.dataset.v, T.game?.state?.story || {}, T.scene || {}); m.classList.toggle('sel', T.draft.kind === 'free' && txt && (T.draft.text || '').trim() === txt.trim()); }); }
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
  maybeRecapPopup().catch(e => console.warn('recap popup', e));
  setInterval(() => { if (T.view === 'table' && T.scene?.status === 'open') { const el = document.querySelector('.timer'); if (el) el.textContent = fmtLeft(T.scene.cutoffMs - now()); } }, 30000);
  // the GM resolved tonight or opened the next night while this page was open: offer a refresh (never reload mid-typing)
  setInterval(async () => { if (document.hidden || T._moved) return; try { const c = await store.campaign(); const s = T.n ? await store.scene(T.n) : null;
    if (T.view === 'table' && s?.status === 'open' && T.scene?.status === 'open' && T.me && (c?.currentNight || 0) === T.n) { const locks = await store.locks(T.n); const party = await store.partyActions(T.n, T.players.map(p => p.pid)).catch(() => T.party);
      if (JSON.stringify([locks, party]) !== JSON.stringify([T.locks, T.party])) { T.locks = locks; T.party = party; const st = status();
        for (const [id, html] of [['partycard', partyCard(st)], ['lockcard', lockCard(st)]]) { const el = document.getElementById(id); if (el && html) el.outerHTML = html; } } }
    if ((c?.currentNight || 0) !== T.n || (s && T.scene && s.status !== T.scene.status)) { T._moved = true; const b = document.createElement('button'); b.className = 'btn gold moved'; b.dataset.moved = '1';
      b.textContent = 'New results \u00b7 tap to refresh'; b.onclick = () => location.reload(); document.body.appendChild(b); } } catch {} }, 8000);
}
