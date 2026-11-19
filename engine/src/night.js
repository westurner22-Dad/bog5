// BoG V · Phase 3 · the nightly table loop (pure; runs in node for the GM tool and in the browser for players).
// One "night" = the GM publishes a scene + the dice-seed hash → players lock a move (or battle orders) before
// 9:00 PM Pacific (or everyone is in early) → the GM tool resolves it on the engine with the committed seed →
// narration is validated against the engine's results → the batch is published with the seed revealed.
import { Game, clone } from './game.js';
import { Dice, commit, verifyCommit } from './dice.js';
import { deriveSheet } from './character.js';
import * as A from './actions.js';
import { startEncounter, resolveBattle, endEncounter, tendFallen, STOP, STANCES } from './combat.js';
import { itemDef } from './rules/items.js';
import { SKILLS } from './rules/origins.js';
import * as L from './loot.js';
import * as SH from './shop.js';
import SRD from '../srd/data/srd.js';

export const CUTOFF = { hour: 21, minute: 0, tz: 'America/Los_Angeles' };
export const DEFAULT_STANCE = 'cautious';
export { STANCES, STOP };
// ---------- time: 9:00 PM Pacific on a given calendar date (DST-correct, no tz library)
const laParts = ms => Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: CUTOFF.tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(ms)).filter(p => p.type !== 'literal').map(p => [p.type, +p.value]));
export function cutoffMs(dateISO) { // 'YYYY-MM-DD' (a Pacific calendar date)
  const [y, m, d] = dateISO.split('-').map(Number);
  for (const off of [8, 7]) { const ms = Date.UTC(y, m - 1, d, CUTOFF.hour + off, CUTOFF.minute); const p = laParts(ms); if (p.hour === CUTOFF.hour && p.day === d) return ms; }
  throw new Error('cannot place 9 PM Pacific on ' + dateISO);
}
export const laDate = ms => { const p = laParts(ms); return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`; };
export const fmtLA = ms => new Intl.DateTimeFormat('en-US', { timeZone: CUTOFF.tz, weekday: 'short', hour: 'numeric', minute: '2-digit' }).format(new Date(ms)) + ' PT';

// ---------- lock-in status, early resolve, absentees
// players: [{pid, name, cid}] ; actions: {pid: {locked, ...}} ; scene: {cutoffMs, status}
export function tableStatus(scene, actions, players, now) {
  const rows = players.map(p => { const a = actions?.[p.pid]; return { ...p, state: a?.locked ? 'locked' : a ? 'thinking' : 'waiting' }; });
  const lockedN = rows.filter(r => r.state === 'locked').length; const allIn = lockedN === players.length && players.length > 0;
  const pastCutoff = now >= scene.cutoffMs; const resolved = scene.status === 'resolved';
  return { rows, lockedN, total: players.length, allIn, pastCutoff, msLeft: Math.max(0, scene.cutoffMs - now), canResolve: !resolved && (pastCutoff || allIn), early: allIn && !pastCutoff,
    open: !resolved && !pastCutoff && scene.status === 'open' };
}
// may this player still write/change their action?
export const canAct = (scene, now) => scene.status === 'open' && now < scene.cutoffMs;
// Reforge lock (Wes, Nov 10 9:21 PM PT): free rebuilds until the first adventure starts, then sheets lock.
export const heroesLocked = campaign => !!campaign?.adventureStarted;

// ---------- free text → a suggested check (the GM confirms or overrides in the plan)
const MAP = [[/sneak|hide|creep|quiet|shadow|slip (out|away|past)/, 'stealth'], [/lie|bluff|pretend|fake|con him|con her|disguise/, 'deception'], [/threat|intimidat|flex|scare|loom|glare|menac/, 'intimidation'],
  [/persuad|convince|charm|haggle|bargain|negotiat|beg|plead|flatter|sweet.?talk/, 'persuasion'], [/climb|jump|lift|shove|break|force|push|kick (the|a) door|arm.?wrestl|wrestl/, 'athletics'],
  [/tumble|flip|balance|cartwheel|acrobat|vault/, 'acrobatics'], [/pick (the )?lock|pickpocket|palm|steal|lift (his|her|a) purse|sleight/, 'sleight_of_hand'], [/read (him|her|them|the room)|motive|trust|lying\?|sincere|insight|sense/, 'insight'],
  [/search|examin|investigat|study|clue|inspect|ledger|records|read the|audit|math|accounts|paperwork|the bill/, 'investigation'], [/look|spot|watch|listen|scan|keep (an )?eye|perceiv|notice/, 'perception'], [/pray|relig|god|goddess|holy|waukeen|temple lore|sigil|altar/, 'religion'],
  [/arcan|magic|spell|rune|enchant|glow/, 'arcana'], [/histor|remember|recall|legend|old days/, 'history'], [/heal|bandage|medic|wound|first aid/, 'medicine'], [/sing|dance|perform|joke|toast|story|play (a|my|the) (song|lute)/, 'performance'],
  [/animal|horse|dog|goose|cat|rat|pony/, 'animal_handling'], [/track|forage|surviv|hunt|navigate/, 'survival'], [/drink|chug|hold (my|his|her) liquor|endure|stomach/, 'con']];
export function mapFreeText(text) {
  const t = String(text || '').toLowerCase(); for (const [re, skill] of MAP) if (re.test(t)) return { skill, why: `matched "${t.match(re)[0]}"` };
  return { skill: null, why: 'no keyword: the GM picks the check (or rules it needs no roll)' };
}
const ABN = { str: 'Strength', dex: 'Dexterity', con: 'Constitution', int: 'Intelligence', wis: 'Wisdom', cha: 'Charisma' };
export const checkLabel = skill => ABN[skill] || (SKILLS[skill] ? skill.split('_').map(w => w === 'of' ? w : w[0].toUpperCase() + w.slice(1)).join(' ') : skill);

// ---------- free-text DCs (Wes, Nov 11 8:13 AM PT, P3-1): fixed scale Easy 10 / Medium 15 / Hard 20, and the GM
// logs every pick with a one-line reason. Anything else is refused before the dice roll.
export const FREE_DC = { Easy: 10, Medium: 15, Hard: 20 };
const FREE_WORD = { 10: 'Easy', 15: 'Medium', 20: 'Hard' };
export function setDcCall(entry, word, why, skill) {
  if (!FREE_DC[word]) throw new Error(`free-text DC must be Easy, Medium or Hard (got "${word}")`);
  if (!why || String(why).trim().length < 4) throw new Error('give a one-line reason for the DC call');
  const sk = skill || entry.check?.skill; if (!sk) throw new Error('name the skill for this check');
  entry.check = { ...(entry.check || {}), skill: sk, dc: FREE_DC[word] }; entry.dcCall = { word, dc: FREE_DC[word], why: String(why).trim(), by: 'gm' }; return entry;
}
export function checkDcCalls(entries) {
  const errs = [];
  for (const e of entries.filter(x => x.kind === 'free' && x.check)) {
    const c = e.dcCall; const nm = e.name || e.pid;
    if (!c) { errs.push(`${nm}: free-text check has no logged DC call`); continue; }
    if (FREE_DC[c.word] !== c.dc || (e.check.dc != null && e.check.dc !== c.dc)) errs.push(`${nm}: DC ${e.check.dc} is off the fixed scale (Easy 10 / Medium 15 / Hard 20)`);
    if (!c.why || c.why.trim().length < 4) errs.push(`${nm}: the DC call needs a reason`);
  }
  return errs;
}

// ---------- plan: what the GM tool will run tonight (GM may edit DC/skill/outcomes before resolving)
// scene: content night; actions: {pid: {kind:'move'|'free', moveId, text, say, orders}} ; stances: {pid: stance}
export function planNight(scene, actions, players, stances = {}) {
  const entries = players.map(p => {
    const a = actions?.[p.pid]; const stance = stances[p.pid] || DEFAULT_STANCE;
    const extra = { ...(a?.cart?.length ? { cart: a.cart } : {}), ...(a?.loot ? { loot: a.loot } : {}), ...(a?.rest ? { rest: a.rest } : {}), ...(a?.levelUp ? { levelUp: a.levelUp } : {}), ...(a?.casts?.length ? { casts: a.casts } : {}), ...(a?.copy?.length ? { copy: a.copy } : {}), ...(a?.prepare ? { prepare: a.prepare } : {}) }; // saved before cutoff counts, locked or not
    const e = planOne(scene, a, p, stance); return { ...e, ...extra };
  });
  return { night: scene.n, sceneId: scene.id, entries };
}
function planOne(scene, a, p, stance) {
  {
    if (!a || !a.locked) return { pid: p.pid, cid: p.cid, kind: 'absent', stance, text: scene.absentText || 'Tags along with the party, keeps out of trouble, and is good company on the road. No roll.' };
    if (scene.battle || a.orders) return { pid: p.pid, cid: p.cid, kind: 'orders', orders: a.orders || {}, say: a.say || '', stance };
    if (a.kind === 'move') { const mv = scene.moves.find(m => m.id === a.moveId); if (!mv) throw new Error(`${p.pid}: unknown move ${a.moveId}`);
      return { pid: p.pid, cid: p.cid, kind: 'move', moveId: mv.id, label: mv.label, say: a.say || '', check: mv.check ? { ...mv.check } : null, assist: mv.assist || null, success: mv.success, failure: mv.failure, stance }; }
    const m = mapFreeText(a.text); const word = FREE_WORD[scene.freeDc] || 'Medium';
    return { pid: p.pid, cid: p.cid, kind: 'free', label: 'Something else', text: a.text, say: a.say || '', check: m.skill ? { skill: m.skill, dc: FREE_DC[word] } : null, mapped: m,
      dcCall: m.skill ? { word, dc: FREE_DC[word], why: `default ${word}: ${m.why}` } : null, success: { text: 'It works out, more or less the way it was meant to, and that is a nice feeling.', effects: [] }, failure: { text: 'It doesn\u2019t come off this time, though it was a fine idea and everyone says so.', effects: [] }, stance };
  }
}

// battle won: every foe's purse (engine treasure table by CR; beasts carry none) plus the encounter's own loot spec (hoard / set items)
export function victoryLoot(g) { const enc = g.state.encounter; const foes = Object.values(enc.combatants).filter(c => c.side === 'foe').map(c => ({ cr: c.cr ?? 0, type: c.type || '' }));
  const r = L.addLoot(g, { foes, ...(enc.loot || {}) }, { why: enc.name }); return { why: enc.name, ...r }; }
// ---------- effects (data-driven outcomes; every change is an engine event)
function applyEffect(g, cid, ef, out) {
  const c = () => g.state.chars[cid]; const party = g.state.party.order;
  if (ef.xp) { A.awardXp(g, ef.xp, ef.who === 'self' ? [cid] : party, ef.why || 'milestone'); out.push({ cid: ef.who === 'self' ? cid : 'party', what: `+${ef.xp} XP${ef.who === 'self' ? '' : ' each'}` }); }
  if (ef.coin) { const who = ef.who === 'party' ? party : [cid]; for (const w of who) { const nv = Math.max(0, g.state.chars[w].coin + ef.coin); g.event('coin', { cid: w, delta: ef.coin, why: ef.why || '' }, () => g.set(['chars', w, 'coin'], nv)); }
    out.push({ cid: ef.who === 'party' ? 'party' : cid, what: `${ef.coin > 0 ? '+' : '\u2212'}${fmtCoin(Math.abs(ef.coin))}${ef.who === 'party' ? ' each' : ''}${ef.why ? ' (' + ef.why + ')' : ''}` }); }
  if (ef.item) { A.giveItem(g, cid, ef.item, { why: ef.why || 'story' }); out.push({ cid, what: `gains ${ef.item.name || itemDef(ef.item).name}` }); }
  if (ef.flag) { g.event('story_flag', { flag: ef.flag }, () => g.set(['story', 'flags', ef.flag], true)); out.push({ cid: 'story', what: `hook: ${ef.flagText || ef.flag}` }); }
  if (ef.inspiration) { A.setInspiration(g, cid, true, ef.why || 'GM award'); out.push({ cid, what: 'Heroic Inspiration' }); }
  if (ef.damage) { const r = g.event('scene_damage', { cid, why: ef.why }, () => { const roll = g.roll(ef.damage, {}, ef.why || 'hazard'); const hp = Math.max(1, c().hp.cur - roll.total); g.set(['chars', cid, 'hp', 'cur'], hp); return roll; }); out.push({ cid, what: `\u2212${r.total} HP (${ef.why || ef.type || 'damage'})`, n: r.total }); }
  if (ef.condition) { A.addCondition(g, cid, ef.condition, ef.extra || {}); out.push({ cid, what: `${ef.condition}` }); }
  if (ef.loot) { const r = L.addLoot(g, ef.loot, { why: ef.why || 'treasure' }); out.push({ cid: 'party', what: `loot: ${r.coin ? fmtCoin(r.each) + ' each' : ''}${r.items.length ? `${r.coin ? ' + ' : ''}${r.items.length} item${r.items.length > 1 ? 's' : ''} to divide` : ''}${r.cash?.length ? ` + ${r.cash.length} valuable${r.cash.length > 1 ? 's' : ''}` : ''}`, loot: r, why: ef.why || 'treasure' }); }
  if (ef.quest) { g.event('quest', { quest: ef.quest.id, status: ef.quest.status }, () => g.set(['story', 'quests', ef.quest.id], { status: ef.quest.status, night: g.state.meta.night })); out.push({ cid: 'story', what: `${ef.quest.status === 'done' ? 'quest complete' : 'quest started'}: ${ef.quest.title || ef.quest.id}` }); }
}
export const fmtCoin = cp => { const gp = Math.floor(cp / 100), sp = Math.floor(cp % 100 / 10), c = cp % 10; return [gp && gp + ' gp', sp && sp + ' sp', c && c + ' cp'].filter(Boolean).join(' ') || '0 gp'; };

// ---------- resolve the night on the engine (GM tool). game must have had openNight(n, seed) at publish time.
export function resolveNight(g, scene, plan, { seed, now = Date.now(), early = false } = {}) {
  const N = String(scene.n); const pub = g.state.nights[N]; if (!pub) throw new Error(`night ${N} was never opened`);
  const dcErr = checkDcCalls(plan.entries); if (dcErr.length) throw new Error('DC calls refused: ' + dcErr.join('; '));
  if (!verifyCommit(seed, pub.commit)) throw new Error('seed does not match the published hash');
  const before = Object.fromEntries(Object.entries(g.state.chars).map(([k, c]) => [k, snap(c)])); const logStart = g.log.length;
  const entries = []; const changes = [];
  if (!g.state.story) g.event('story_init', {}, () => g.set(['story'], { flags: {}, adventure: scene.adventure || 'a1' }));
  // 0. between-scene business first: divide last night's loot, apply saved carts (shop / equip / identify), cash gems
  let lootDivide = [], carts = {}, cashed = 0;
  if (plan.lootMode && plan.lootMode !== (g.state.party.lootMode || 'needgreed')) L.setLootMode(g, plan.lootMode);
  if (g.state.loot?.pending?.length) { const ch = {}; for (const e of plan.entries) if (e.loot) ch[e.cid] = e.loot; lootDivide = L.divideLoot(g, ch); }
  for (const e of plan.entries) if (e.cart?.length) carts[e.cid] = SH.applyCart(g, e.cid, e.cart, scene.shop || null);
  // 0b. Phase 5 between-scene business, each an engine event (or a refusal with the engine's reason): level-ups chosen
  // on the level-up screen, spells cast outside battle (healing after last night's fight), Wizard spellbook copying.
  const between = {}; const tryDo = (cid, what, fn) => { const i0 = g.log.length; try { fn(); (between[cid] = between[cid] || []).push({ what, ok: true, lines: g.log.slice(i0).flatMap(ev => ev.notes || []) }); } catch (err) { if (!(err instanceof A.GameError)) throw err; (between[cid] = between[cid] || []).push({ what, ok: false, why: err.message }); } };
  for (const e of plan.entries) if (e.levelUp) tryDo(e.cid, `Level ${g.state.chars[e.cid].level + 1}`, () => A.levelUp(g, e.cid, e.levelUp));
  for (const e of plan.entries) for (const c of e.casts || []) tryDo(e.cid, `Cast ${SRD.spells[c.spell]?.name || c.spell}`, () => A.castOutOfCombat(g, e.cid, c.spell, c.level || SRD.spells[c.spell]?.level || 1, (c.targets || [e.cid]).map(t => t === 'self' ? e.cid : t), {}));
  for (const e of plan.entries) for (const c of e.copy || []) tryDo(e.cid, `Copy ${SRD.spells[c.spell]?.name || c.spell}`, () => A.copyToSpellbook(g, e.cid, c.spell, { fromScrollUid: c.scroll || null }));
  if (scene.shop && (g.state.party.stash || []).some(x => x.cash || g.state.party.lootMode === 'party')) cashed = L.sellStash(g, { valuablesOnly: g.state.party.lootMode !== 'party' }) || 0;
  // 1. assists first (Help gives advantage to the named ally's check)
  const advFor = new Set(plan.entries.filter(e => e.kind !== 'absent' && e.assist).map(e => e.assist));
  for (const e of plan.entries) {
    const c0 = g.state.chars[e.cid]; const row = { pid: e.pid, cid: e.cid, name: c0.name, kind: e.kind, label: e.label || null, text: e.text || null, say: e.say || '', mapped: e.mapped || null, ...(e.dcCall ? { dcCall: e.dcCall } : {}), ...(e.kind === 'orders' ? { orders: e.orders } : {}), ...(e.kind === 'absent' ? { stance: e.stance } : {}) };
    if (e.kind === 'move' || e.kind === 'free') {
      if (e.check) { const adv = !!e.check.adv || advFor.has(e.cid) || advFor.has(e.pid); const r = A.skillCheck(g, e.cid, e.check.skill, e.check.dc, { adv, why: e.label || e.text });
        row.check = { skill: e.check.skill, label: checkLabel(e.check.skill), word: r.word, dc: r.dc, nat: r.nat, faces: r.faces, mode: r.mode, parts: r.parts, total: r.total, ok: r.ok, adv };
        const oc = r.ok ? e.success : e.failure; row.outcome = oc?.text || (r.ok ? 'Success.' : 'Failure.'); row.effects = []; for (const ef of oc?.effects || []) applyEffect(g, e.cid, ef, row.effects); }
      else { row.check = null; row.outcome = e.success?.text || 'No roll needed.'; row.effects = []; for (const ef of e.success?.effects || []) applyEffect(g, e.cid, ef, row.effects); }
    } else if (e.kind === 'absent') row.outcome = e.text;
    if (carts[e.cid]) row.cart = carts[e.cid]; if (between[e.cid]) row.between = between[e.cid];
    entries.push(row);
  }
  // 2. battle: orders for one round (or the rest of the current round); absentees fight on their preset stance (Cautious default)
  let battle = null;
  if (g.state.encounter && ['active', 'awaiting_orders', 'paused'].includes(g.state.encounter.status)) {
    const orders = {}; for (const e of plan.entries) orders[e.cid] = e.kind === 'orders' ? { ...e.orders, stance: e.stance } : { absent: true, stance: e.stance };
    const i0 = g.log.length; const r = resolveBattle(g, orders, { maxRounds: 1 }); battle = battleSummary(g, i0, r);
  }
  // 3. scripted aftermath (start a battle, award milestone XP)
  const afterFx = []; for (const ef of scene.after?.effects || []) for (const cid of [g.state.party.order[0]]) applyEffect(g, cid, ef, afterFx);
  if (scene.after?.startBattle && !g.state.encounter) { const b = scene.after.startBattle; const party = g.state.party.order.map((cid, i) => ({ cid, pos: b.partyPos[i % b.partyPos.length] }));
    startEncounter(g, { name: b.name, map: b.map, party, foes: b.foes, script: b.script || [], location: scene.place }); if (b.loot) g.event('battle_loot_spec', {}, () => g.set(['encounter', 'loot'], b.loot)); if (b.kind) g.event('battle_kind', {}, () => g.set(['encounter', 'kind'], b.kind)); battle = { started: true, name: b.name, lines: g.log.at(-1).notes || [], status: 'active', round: 1, ...mapView(g) }; }
  const loot = [];
  if (g.state.encounter && ['victory', 'defeat'].includes(g.state.encounter.status)) { const enc = g.state.encounter; const out = enc.status;
    if (out === 'victory') { loot.push(victoryLoot(g)); const i0 = g.log.length; tendFallen(g); if (battle && g.log.length > i0) { battle.tended = g.log.slice(i0).flatMap(ev => ev.notes || []); battle.lines = [...(battle.lines || []), ...battle.tended]; } }
    endEncounter(g); if (battle) battle.cleared = out;
    if (out === 'victory') for (const ef of scene.after?.victory?.effects || []) applyEffect(g, g.state.party.order[0], ef, afterFx); }
  for (const e of entries) for (const x of e.effects || []) if (x.loot) { loot.push({ ...x.loot, why: x.why }); delete x.loot; }
  for (const x of afterFx) if (x.loot) loot.push({ ...x.loot, why: x.why });
  for (const a of plan.awards || []) { const r = L.addLoot(g, a.spec, { why: a.why || 'GM award' }); loot.push({ why: a.why || 'GM award', gm: true, ...r }); } // GM-awarded loot rides in the batch
  let rest = null; const R0 = scene.after?.rest || (battle?.cleared === 'victory' ? scene.after?.victory?.rest : null); const R = typeof R0 === 'string' ? { kind: R0 } : R0;
  if (R && !g.state.encounter) { const spend = {}, focus = {}, arcane = {}; for (const e of plan.entries) { if (e.rest?.hitDice) spend[e.cid] = e.rest.hitDice; if (e.rest?.identify) focus[e.cid] = { identify: e.rest.identify }; else if (e.rest?.attune) focus[e.cid] = { attune: e.rest.attune }; if (e.rest?.arcane?.length) arcane[e.cid] = e.rest.arcane; }
    // a scripted interruption happens unless someone succeeded on the move that prevents it (e.g. keeping watch)
    let interrupt = R.interrupt || null; if (interrupt?.unlessMove && entries.some(x => x.kind === 'move' && plan.entries.find(p => p.pid === x.pid)?.moveId === interrupt.unlessMove && x.check?.ok)) { interrupt = null; }
    const i0 = g.log.length;
    try { const r = A.restScene(g, { kind: R.kind, spend, focus, arcaneRecovery: arcane, water: R.water || 'carried', food: R.food || 'carried', interrupt, resume: !!R.resume });
      rest = { kind: R.kind, done: r.done, interrupted: r.interrupted || null, benefit: r.benefit || R.kind, resumed: !!r.resumed, prevented: !!(R.interrupt && !interrupt), lines: g.log.slice(i0).flatMap(ev => ev.notes || []) }; }
    catch (err) { if (!(err instanceof A.GameError)) throw err; rest = { kind: R.kind, lines: g.log.slice(i0).flatMap(ev => ev.notes || []), error: err.message }; } }

  // prepare spells (the list the player saved tonight), after any rest: needs a finished long rest, or the paladin/ranger swap
    for (const e of plan.entries) if (e.prepare?.list) { const row = entries.find(x => x.cid === e.cid); const i1 = g.log.length;
      try { A.prepareSpells(g, e.cid, e.prepare.list); (row.between = row.between || []).push({ what: 'Prepare spells', ok: true, lines: g.log.slice(i1).flatMap(ev => ev.notes || []) }); } catch (err) { if (!(err instanceof A.GameError)) throw err; (row.between = row.between || []).push({ what: 'Prepare spells', ok: false, why: err.message }); } }
  g.revealNight(Number(N), seed);
  for (const [cid, c] of Object.entries(g.state.chars)) changes.push(...diff(before[cid], snap(c), c.name, cid));
  const best = entries.filter(x => x.check).sort((a, b) => b.check.total - a.check.total)[0];
  const pendingLoot = (g.state.loot?.pending || []).map(x => ({ lid: x.lid, name: itemDef(x.inst).name, unid: !!x.inst.unid, need: Object.fromEntries(g.state.party.order.map(cid => [cid, L.canNeed(g.state.chars[cid], x.inst)])) }));
  return { n: scene.n, sceneId: scene.id, title: scene.title, place: scene.place, bg: scene.bg, commit: pub.commit, seed, resolvedAt: now, early, entries, battle, sheetChanges: changes, after: afterFx.map(({ loot: _l, ...x }) => x),
    loot: loot.map(l => ({ why: l.why, coin: l.coin, each: l.each, rem: l.rem, mode: l.mode, gm: !!l.gm, items: (l.items || []).map(x => ({ lid: x.lid, name: itemDef(x.inst).name })), cash: (l.cash || []).map(x => ({ lid: x.lid, name: itemDef(x.inst).name })) })), lootDivide, pendingLoot, cashed, rest, stash: (g.state.party.stash || []).map(x => ({ lid: x.lid, name: itemDef(x.inst).name, cash: !!x.cash })),
    best: best ? { name: best.name, label: best.label || best.text, ...best.check } : null, logRange: [logStart, g.log.length], nextTeaser: scene.next || null };
}
const snap = c => ({ hp: c.hp.cur, temp: c.hp.temp, xp: c.xp, coin: c.coin, insp: c.inspiration, conds: c.conditions.map(x => x.id).sort().join(','), items: c.inventory.reduce((o, i) => { const d = itemDef(i); const k = `${i.id}${i.plus ? '+' + i.plus : ''}${i.scroll ? ':' + i.scroll : ''}${i.unid ? '?' : ''}${i.name ? ':' + i.name : ''}`; o[k] = { n: (o[k]?.n || 0) + (i.qty || 1), name: d.name }; return o; }, {}), res: { ...c.resSpent }, slots: [...(c.slotsSpent || [])], dead: c.death.dead });
function diff(a, b, name, cid) {
  const out = []; const add = (what, delta) => out.push({ cid, name, what, delta });
  if (a.hp !== b.hp) add('HP', `${a.hp} \u2192 ${b.hp}`); if (a.xp !== b.xp) add('XP', `+${b.xp - a.xp}`); if (a.coin !== b.coin) add('Coin', `${b.coin > a.coin ? '+' : '\u2212'}${fmtCoin(Math.abs(b.coin - a.coin))}`);
  if (a.insp !== b.insp) add('Heroic Inspiration', b.insp ? 'gained' : 'spent'); if (a.conds !== b.conds) add('Conditions', b.conds || 'none');
  for (const k of new Set([...Object.keys(a.items), ...Object.keys(b.items)])) { const d = (b.items[k]?.n || 0) - (a.items[k]?.n || 0); if (d) add((b.items[k] || a.items[k]).name, d > 0 ? `+${d}` : `${d}`); }
  const nice = k => k.split('_').map(w => w[0].toUpperCase() + w.slice(1)).join(' ');
  for (let i = 0; i < Math.max(a.slots.length, b.slots.length); i++) { const d = (b.slots[i] || 0) - (a.slots[i] || 0); if (d) add(`Level ${i + 1} spell slot${Math.abs(d) > 1 ? 's' : ''}`, d > 0 ? `\u2212${d} used` : `+${-d} back`); }
  for (const k of new Set([...Object.keys(a.res), ...Object.keys(b.res)])) { const d = (b.res[k] || 0) - (a.res[k] || 0); if (d) add(nice(k), d > 0 ? `\u2212${d} used` : `+${-d} back`); }
  if (!a.dead && b.dead) add('Status', 'dead');
  return out;
}
export function mapView(g) { const e = g.state.encounter; if (!e) return {}; return { map: e.map, round: e.round, combatants: Object.values(e.combatants).map(c => ({ uid: c.uid, name: c.name, side: c.side, pos: c.pos, kind: c.kind, cid: c.cid || null, boss: !!c.boss, hp: c.kind === 'pc' ? g.state.chars[c.cid].hp.cur : c.hp.cur, max: c.kind === 'pc' ? deriveSheet(g.state.chars[c.cid]).hpMax : c.maxHp })), order: e.order, turn: e.turn }; }
function battleSummary(g, i0, r) {
  const e = g.state.encounter; const lines = g.log.slice(i0).flatMap(ev => ev.notes || []);
  return { name: e.name, kind: e.kind || null, lines, status: e.status, stop: e.stop, notices: (e.notices || []).filter(x => true), outcome: r.outcome || null, round: e.round, xpEach: e.xpAwarded || 0, unfinished: !['victory', 'defeat'].includes(e.status), ...mapView(g) };
}

// ---------- narration validator: narration may add color, never contradict the engine
const WIN = /\b(succeed(s|ed)?|success(fully)?|manage(s|d)? to|nail(s|ed)?|pull(s|ed)? it off|win(s)?|won|talks? (him|her|them) down|convince(s|d)|charm(s|ed)|spot(s|ted)|find(s)?|found|slip(s|ped)? (out|away|past) unseen)\b/i;
const LOSE = /\b(fail(s|ed)?|failure|botch(es|ed)?|flub(s|bed)?|blow(s)? it|blew it|fumble(s|d)?|miss(es|ed)?|can'?t|couldn'?t|no luck|falls? flat|fell flat)\b/i;
const DEATH = /\b(dies|died|is dead|killed|slain|perishes)\b/i; const DOWN = /\b(drops?|dropped|falls?|fell|collapses?|goes down|is down|unconscious|knocked out)\b/i;
const TITLES = new Set(['brother', 'sister', 'sir', 'dame', 'lady', 'lord', 'the', 'of', 'von', 'van', 'de', 'mother', 'father']);
export const shortName = n => String(n).split(/\s+/).find(w => !TITLES.has(w.toLowerCase())) || String(n).split(/\s+/)[0];
const nameRe = n => new RegExp(`\\b(${[n, ...String(n).split(/\s+/).filter(w => w.length >= 3 && !TITLES.has(w.toLowerCase()))].map(esc).join('|')})\\b`, 'i');
// character speech is color, not a claim: drop anything inside quotes before judging what the narration asserts
const unquote = t => String(t).replace(/\u201c[^\u201d]*\u201d|"[^"]*"/g, '\u2026');
export function validateNarration(text, result) {
  const errors = [], warnings = []; const sentences = unquote(text).split(/(?<=[.!?])\s+|\n+/).filter(s => s.trim());
  const named = row => sentences.filter(s => nameRe(row.name).test(s));
  for (const row of result.entries) {
    const ss = named(row);
    if (row.kind !== 'absent' && !ss.length) warnings.push(`${row.name} acted but isn't mentioned.`);
    if (!row.check) continue;
    for (const s of ss) { const others = result.entries.filter(o => o !== row && nameRe(o.name).test(s)); if (others.length) continue; // multi-hero sentences are too ambiguous to judge
      if (!row.check.ok && WIN.test(s) && !LOSE.test(s)) errors.push(`"${s.trim()}" reads as a success, but ${row.name}'s ${row.check.label} check FAILED (${row.check.total} vs DC ${row.check.dc}).`);
      if (row.check.ok && LOSE.test(s) && !WIN.test(s)) errors.push(`"${s.trim()}" reads as a failure, but ${row.name}'s ${row.check.label} check SUCCEEDED (${row.check.total} vs DC ${row.check.dc}).`); }
  }
  for (const s of sentences) for (const p of result.party || []) { if (!nameRe(p.name).test(s)) continue;
    if (DEATH.test(s) && !p.dead) errors.push(`"${s.trim()}" says ${p.name} dies, but the engine has ${p.name} alive (${p.hp} HP).`);
    if (DOWN.test(s) && /\b(hp|unconscious|knocked out|goes down|is down|collapses?)\b/i.test(s) && p.hp > 0) errors.push(`"${s.trim()}" puts ${p.name} down, but ${p.name} is at ${p.hp} HP.`); }
  // foes: "the X falls/dies/flees" when it is still up
  for (const f of (result.battle?.combatants || []).filter(c => c.kind !== 'pc')) { const nm = f.name.replace(/\s+\d+$/, ''); for (const s of sentences) if (new RegExp(`\\b${esc(f.name)}\\b`, 'i').test(s) && (DEATH.test(s) || /\b(falls|fell|defeated|beaten|flees|fled)\b/i.test(s)) && f.hp > 0) errors.push(`"${s.trim()}" defeats ${f.name}, but it is still standing (${f.hp} HP).`); void nm; }
  if (result.battle?.unfinished && /\b(battle|fight|brawl) (is over|ends|ended|is won)|\bvictory\b|\bthe last (of them|one) (falls|drops)/i.test(unquote(text))) errors.push('Narration ends the battle, but the engine has it still going.');
  // numbers: any "N damage / N HP / N gp / N XP" must be a number the engine produced tonight
  const nums = new Set(factNumbers(result)); for (const m of unquote(text).matchAll(/\b(\d+)\s*(damage|hp|hit points|gp|gold|xp)\b/gi)) if (!nums.has(+m[1])) errors.push(`"${m[0]}" is not a number from tonight's results.`);
  for (const row of result.entries) if (row.say && row.kind !== 'absent' && !String(text).includes(row.say.slice(0, 24)) ) warnings.push(`${row.name}'s "I say" line isn't quoted (optional).`);
  return { ok: !errors.length, errors, warnings };
}
const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
function factNumbers(r) { const n = []; for (const e of r.entries) { if (e.check) n.push(e.check.total, e.check.dc, e.check.nat, ...e.check.parts.map(p => Math.abs(p.v))); for (const ef of e.effects || []) { if (ef.n) n.push(ef.n); for (const m of String(ef.what).matchAll(/\d+/g)) n.push(+m[0]); } }
  for (const c of r.sheetChanges) for (const m of String(c.delta).matchAll(/\d+/g)) n.push(+m[0]); for (const l of r.battle?.lines || []) for (const m of String(l).matchAll(/\d+/g)) n.push(+m[0]); if (r.battle?.xpEach) n.push(r.battle.xpEach); return n; }
// what the validator knows about the party after the night (attach before validating)
export const partyFacts = g => Object.values(g.state.chars).map(c => ({ cid: c.id, name: c.name, hp: c.hp.cur, dead: c.death.dead }));

// ---------- GM-side helpers: open a night (commit), restore/serialize the private game
export function openNight(g, scene, { seed, dateISO }) {
  g.openNight(scene.n, seed); const cut = cutoffMs(dateISO);
  return { n: scene.n, id: scene.id, adventure: scene.adventure, title: scene.title, place: scene.place, bg: scene.bg, time: scene.time, prose: scene.prose, quote: scene.quote || null, gmNote: scene.playerNote || null,
    moves: (scene.moves || []).map(m => ({ id: m.id, label: m.label, tags: m.tags || [], word: m.check ? A.difficultyWord(m.check.dc) : null, skill: m.check ? checkLabel(m.check.skill) : null, skillKey: m.check?.skill || null, hint: m.hint || null })),
    battle: !!scene.battle, shop: scene.shop || null, quest: scene.quest || null, rest: restInfo(scene), commit: commit(seed), cutoffMs: cut, date: dateISO, status: 'open' };
}
// what the players see about tonight's rest before it happens (kind, water, the risk of an interruption)
export function restInfo(scene) { const v = scene.after?.rest || scene.after?.victory?.rest; if (!v) return null; const r = typeof v === 'string' ? { kind: v } : v;
  return { kind: r.kind, ifVictory: !scene.after?.rest, water: r.water || null, risk: r.interrupt ? (r.interrupt.risk || 'Something may interrupt the rest.') : null }; }
export const saveGame = g => ({ state: g.initial, log: g.log, dice: g.dice.toJSON() });   // GM-private (contains the live seed)
export const loadGame = j => { const g = new Game({ state: j.state, log: j.log }); g.dice = Dice.fromJSON(j.dice); return g; };
export const publicGame = g => ({ state: clone(g.state), logLen: g.log.length });           // safe for players: no dice seed
export { verifyCommit, commit };
