#!/usr/bin/env node
// BoG V · GM tool (Studio Lead). Runs on the GM's machine; the only writer of scenes, results and game state.
//   node app/gm/gm.mjs <command> [n] [--target dev|emulator|live] [--now <ms|ISO>] [--date YYYY-MM-DD] [--file f]
// Commands (one night = open → [players act] → status → plan → resolve → narrate → publish → verify):
//   init --players p1:Wes,p2:Player 2,...   members + campaign (heroes stay editable)
//   open <n> --date YYYY-MM-DD              build tonight's scene from content, publish it with the dice-seed hash
//                                           (and a hash of the move DCs). Night 1 imports the heroes into the
//                                           engine and sets adventureStarted: sheets lock (Reforge rule).
//   status <n>                              who's locked; whether the table can resolve (cutoff or all in)
//   plan <n>                                load the submitted actions, map free text to checks → work/plan-n.json
//                                           (free text gets a default Medium DC; change it with gm call)
//   resolve <n>                             refuses before 9:00 PM PT unless all players are locked (early resolve)
//   draft <n>                               print a narration skeleton built from the engine results
//                                           (write all narration in the house voice: phase0/VOICE.md)
//   narrate <n> --file narration.txt        validate narration against the engine; stores it only if it passes
//   publish <n>                             post result + narration + revealed seed + public game state
//   verify <n>                              check the published seed and DC hashes, the free-text DC calls, and replay the log
//   rulings <n> --file rulings.json        apply skill + Easy|Medium|Hard (+ optional xp/flags/awards) to the plan
//                                           so the GM only writes prose. Then: resolve, draft, narrate, publish, verify.
//   call <n> <pid> <Easy|Medium|Hard> "why" [--skill s] [--do action] [--slot action|move|bonus]
//                                           P3-1: set a free-text (or battle write-in) DC on that night's scale
//                                           (v3: 6/11/16 from Night 38; nights 8–37 stay 9/14/19; nights 1–7 stay 10/15/20),
//                                           logged with a reason. --do/--slot override the auto-mapped 5e action on a battle write-in.
//   award <n> [--hoard 0-4] [--coin cp] [--items a,b] --why "..."   GM loot, applied in tonight's batch (Need/Greed or stash)
//   lootmode <n> needgreed|party            how tonight's batch splits items (coin always splits evenly)
//   link <uid> <pid> | unlink <uid>         P3-4: map a Google account (Firebase uid) to a seat
//   quests                                  side-quest board (hooks found, status, next scene id)
//   issues [--all]                          the issue log: Needs Wes / Open / Done
//   issue <id> · triage <id> [--file opts.json] · rule <id> --text "..." --srd "..."
//   build <id> · release <id>               refused unless Wes picked an option (nothing gets built without him)
//   asks [--all] · answer <id> --text "..." [--srd "section"]   Phase 5 Ask the GM (words only; never changes a sheet)
//   levelups [n]                            who can level up, and whether tonight's saved picks pass the engine
//   portraits                               painted-portrait library: which heroes have one, the exact prompt for any that don't
//   --dry-run (any command)                 print every database path/value and work file it would write; write nothing
//   init --adventure test                   the Phase 5 test adventure (content/testadv.js) on this save
// open <n> --scene <id> plays a side-quest scene (content/sidequests.js) as night n.
// The seed for night n lives only in work/<target>/secrets/n.json (git-ignored) until publish.
import fs from 'node:fs'; import path from 'node:path'; import crypto from 'node:crypto'; import { fileURLToPath } from 'node:url';
import * as F from '../../engine/src/forge.js';
import { Game, actions as A, rebuild } from '../../engine/src/index.js';
import * as N from '../../engine/src/night.js';
import * as SH from '../../engine/src/shop.js';
import { RtdbRest, Bog5Store, pack, unpack, LIVE_OK } from '../storage.js';
import { loadServiceAccount, serviceAccountAuth } from './sa-auth.mjs';
import { NIGHTS as ARC1, ADVENTURE as ADV1 } from '../content/arc1.js';
import { NIGHTS as TEST_NIGHTS, ADVENTURE as TEST_ADV } from '../content/testadv.js';
import { levelUpPlan, validateLevelUp } from '../../engine/src/levelup.js';
import * as PA from '../portrait-art.js';
import { SCENES as SIDE, QUESTS, questBoard } from '../content/sidequests.js';
import { BOARD_SCENES, listedBoardQuests, recapScope } from '../content/missions.js';
import { GULPWELL_SCENE } from '../content/gulpwell.js';
import { applyRulings } from '../../engine/src/rulings.js';
import * as I from '../issues.js';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2); const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const cmd = argv[0]; const n = Number(argv[1]); const TARGET = opt('target', 'dev'); const DRY = argv.includes('--dry-run');
const NOW = (() => { const v = opt('now'); if (!v) return Date.now(); return /^\d+$/.test(v) ? +v : Date.parse(v); })();
const WORK = path.join(HERE, 'work', TARGET); if (!argv.includes('--dry-run')) fs.mkdirSync(path.join(WORK, 'secrets'), { recursive: true });
const say = (...a) => console.log(...a);
// --dry-run: work files go to an in-memory overlay (later steps of the same command still read them) and are printed
const FILES = new Map(); const wpath = f => path.join(WORK, f);
const fexists = f => FILES.has(f) || fs.existsSync(wpath(f)); const fread = f => FILES.has(f) ? FILES.get(f) : fs.readFileSync(wpath(f), 'utf8');
const fwrite = (f, text, mode) => { if (DRY) { FILES.set(f, text); say(`[dry-run] would write file ${path.relative(process.cwd(), wpath(f))} (${text.length} bytes${mode ? ', mode ' + mode.toString(8) : ''}, sha256 ${crypto.createHash('sha256').update(text).digest('hex').slice(0, 12)}…)`); return; } fs.writeFileSync(wpath(f), text, mode ? { mode } : undefined); };
const readJ = f => JSON.parse(fread(f)); const writeJ = (f, v, mode) => fwrite(f, JSON.stringify(v, null, 1), mode);
// which adventure this save plays (gm init --adventure test → the Phase 5 test adventure)
const ADV_FILE = 'adventure.txt'; const advId = () => (fexists(ADV_FILE) ? fread(ADV_FILE).trim() : 'a1');
const NIGHTS = advId() === 't1' ? TEST_NIGHTS : ARC1; const ADVENTURE = advId() === 't1' ? TEST_ADV : ADV1;

function adminPaths() {
  if (TARGET === 'dev') { const tok = fs.readFileSync(path.join(HERE, 'work/dev-admin-token'), 'utf8').trim(); return new RtdbRest({ base: opt('base', 'http://127.0.0.1:8770/rtdb'), auth: async () => ({ headers: { Authorization: 'Bearer ' + tok } }) }); }
  if (TARGET === 'emulator') return new RtdbRest({ base: opt('base', 'http://127.0.0.1:9000'), ns: 'c-thug-default-rtdb', auth: async () => ({ headers: { Authorization: 'Bearer owner' } }) });
  if (TARGET === 'live') {
    // Wes signed off Nov 17 2026 6:20 PM PT. allowLive is set here; BOG5_ALLOW_LIVE=1 must be in the GM CLI environment only.
    // Auth is BoG V's own service account (BOG5_SA_JSON); BOG4_SA_JSON is refused by loadServiceAccount.
    return new RtdbRest({ base: 'https://c-thug-default-rtdb.firebaseio.com', auth: serviceAccountAuth(loadServiceAccount()), allowLive: LIVE_OK }); }
  throw new Error('unknown --target ' + TARGET);
}
// --dry-run: database writes are printed (full path + value) and kept in an overlay; nothing reaches the database
class DryRunPaths { constructor(inner) { this.inner = inner; this.over = new Map(); this.writes = 0; }
  key(p) { return (Array.isArray(p) ? p : String(p).split('/')).join('/'); }
  async get(p) { const k = this.key(p); if (this.over.has(k)) return JSON.parse(JSON.stringify(this.over.get(k))); return this.inner.get(p); }
  async set(p, v) { const k = this.key(p); this.writes++; say(`[dry-run] would ${v == null ? 'DELETE' : 'SET'} bog5/${k}${v == null ? '' : ' = ' + JSON.stringify(v)}`); this.over.set(k, v); }
  async update(p, patch) { for (const [k, v] of Object.entries(patch)) await this.set([...(Array.isArray(p) ? p : [p]), ...k.split('/')], v); }
  async remove(p) { return this.set(p, null); } }
const P0 = adminPaths(); const P = DRY ? new DryRunPaths(P0) : P0; if (DRY) say(`[dry-run] ${cmd || ''} on --target ${TARGET}: reads are real, nothing is written`); const store = new Bog5Store(P, { gm: true, owner: 'gm', now: () => NOW });
// night n's content: the main arc by number, or a side-quest scene chosen at open (--scene id, remembered per night)
const content = k => { const f = `scene-${k}.txt`; const id = opt('scene') || (fexists(f) ? fread(f).trim() : null);
  if (id) { const q = SIDE.find(x => x.id === id) || BOARD_SCENES.find(x => x.id === id) || (id === GULPWELL_SCENE.id ? GULPWELL_SCENE : null) || NIGHTS.find(x => x.id === id); if (!q) throw new Error(`no scene ${id}`); return { ...q, n: k }; }
  const sc = NIGHTS.find(x => x.n === k); if (!sc) throw new Error(`no content for night ${k}`); return sc; };
const players = async () => { const c = await store.campaign(); return Object.entries(c.players || {}).map(([pid, p]) => ({ pid, name: p.hero || p.name, cid: p.cid, player: p.name })); };
const loadG = () => N.loadGame(readJ('game.json')); const saveG = g => writeJ('game.json', N.saveGame(g), 0o600);
const publishGame = async g => P.set('game', pack({ ...N.publicGame(g), view: N.mapView(g), updatedAt: NOW }, ['updatedAt']));
const dcList = sc => sc.moves.map(m => [m.id, m.check?.skill || null, m.check?.dc || null]);
// Already-open nights without dcScale were hashed on v1 (Easy 10 / Medium 15 / Hard 20). Nights 8–37 stay on v2 (9/14/19). New opens use v3 (Easy 6 / Medium 11 / Hard 16).
const nightScale = async k => N.scaleOf(await store.scene(k));
const sceneFor = async k => N.applyDcScale(content(k), await nightScale(k));

const C = {
  async init() {
    const list = (opt('players', 'p1:Wes,p2:Player 2,p3:Player 3,p4:Player 4')).split(',').map(s => s.split(':'));
    for (const [pid] of list) await P.set(['members', pid], { pid, role: 'player' }); // test seats (uid = pid); real players: gm link <google uid> <pid>
    const old = await store.campaign(); if (old.adventureStarted) throw new Error('campaign already started; refusing to re-init');
    const A0 = opt('adventure') === 'test' ? TEST_ADV : ADV1; fwrite(ADV_FILE, A0.id);
    await P.set('campaign', { title: 'Balls or Gapes V: Reforged', host: opt('host', 'p1'), adventure: A0.id, adventureTitle: A0.title, ...(A0.test ? { testSave: true } : {}), adventureStarted: false, currentNight: 0, players: Object.fromEntries(list.map(([pid, name]) => [pid, { name }])) });
    say(`campaign initialised for ${list.length} players (${A0.title}${A0.test ? ', a test save' : ''}); heroes are editable until "open 1"`);
  },
  async open() {
    const sc = N.applyDcScale(content(n), N.DC_SCALE_CURRENT); const date = opt('date'); if (!date) throw new Error('--date YYYY-MM-DD (the Pacific date of the 9 PM cutoff) is required');
    let g; const camp = await store.campaign();
    if (n === 1 && !camp.adventureStarted) {
      g = new Game({}); const heroes = await store.listHeroes(); const ps = Object.keys(camp.players || {});
      for (const pid of ps) { const h = heroes.filter(x => x.owner === pid).at(-1); if (!h) throw new Error(`${pid} has no hero yet`);
        const ev = F.evaluate(h.draft); if (!ev.ok) throw new Error(`${pid}'s hero is not legal: ${[...ev.errors, ...ev.ruleErrors].join('; ')}`);
        const spec = F.toSpec(h.draft); spec.id = 'hero-' + pid; A.addCharacter(g, spec);
        await P.update(['campaign', 'players', pid], { cid: spec.id, hero: ev.ch.name, heroId: h.id }); }
      await P.set(['campaign', 'adventureStarted'], true); await P.set(['campaign', 'startedAt'], NOW);  // Reforge lock
      say('heroes imported into the engine; sheets are now locked (adventureStarted)');
    } else g = loadG();
    const seed = opt('seed') || crypto.randomBytes(32).toString('hex'); const salt = crypto.randomBytes(16).toString('hex');
    const scene = N.openNight(g, sc, { seed, dateISO: date }); scene.dcCommit = N.commit(salt + '|' + JSON.stringify(dcList(sc)));
    if (g.state.encounter) scene.battleView = N.mapView(g);
    writeJ(`secrets/${n}.json`, { seed, salt }, 0o600); saveG(g); if (opt('scene')) fwrite(`scene-${n}.txt`, opt('scene'));
    await P.set(['nights', n, 'scene'], pack(scene, ['n', 'status', 'cutoffMs', 'commit'])); await P.set(['campaign', 'currentNight'], n); await publishGame(g);
    say(`night ${n} "${sc.title}" is open until ${N.fmtLA(scene.cutoffMs)} (${date}); seed hash ${scene.commit.slice(0, 16)}…`);
  },
  async status() {
    const sc = await store.scene(n); const st = N.tableStatus(sc, Object.fromEntries(Object.entries(await store.locks(n)).map(([k, v]) => [k, { locked: v.state === 'locked' }])), await players(), NOW);
    for (const r of st.rows) say(`  ${r.state.padEnd(8)} ${r.pid} ${r.name}`);
    say(`${st.lockedN}/${st.total} locked · ${st.pastCutoff ? 'past cutoff' : Math.round(st.msLeft / 60000) + ' min to cutoff'} · ${st.canResolve ? (st.early ? 'EARLY RESOLVE available (all in)' : 'ready to resolve') : sc.status === 'resolved' ? 'resolved' : 'not yet'}`);
    return st;
  },
  async plan() {
    const sc = await sceneFor(n); const ps = await players(); const actions = {}; const stances = {};
    for (const p of ps) { const a = await store.myAction(n, p.pid); if (a) actions[p.pid] = a; stances[p.pid] = await store.stance(p.pid); }
    const plan = N.planNight(sc, actions, ps, stances); const prev = fexists(`plan-${n}.json`) ? readJ(`plan-${n}.json`) : null;
    if (prev) { for (const e of plan.entries) { const o = prev.entries.find(x => x.pid === e.pid); if (o?.dcCall?.by === 'gm' && e.kind === 'free' && o.text === e.text) { e.dcCall = o.dcCall; e.check = o.check; } } // keep GM calls on re-plan
      for (const k of ['awards', 'lootMode']) if (prev[k]) plan[k] = prev[k]; }
    writeJ(`plan-${n}.json`, plan);
    for (const e of plan.entries) say(`  ${e.pid} ${e.kind.padEnd(6)} ${e.kind === 'move' ? `${e.label} → ${e.check.skill} DC ${e.check.dc}` : e.kind === 'free' ? `"${e.text}" → ${e.check ? e.check.skill + ' DC ' + e.check.dc : 'NO CHECK (GM decides)'} (${e.mapped.why})` : e.kind === 'orders' ? (e.text ? `battle orders + something else: "${e.text}" → ${e.writeIn?.do || e.mapped?.do || 'check'}${e.check ? ' ' + e.check.skill + ' DC ' + e.check.dc : e.mapped?.needsCheck ? ' (needs GM call)' : ''} (${e.mapped?.why || ''})` : 'battle orders') : `absent (${e.stance})`}`);
    for (const e of plan.entries) { if (e.dcCall) say(`  ${e.pid} DC call ${e.dcCall.word} (${e.dcCall.dc}): ${e.dcCall.why}${e.dcCall.by === 'gm' ? '' : '  ← default; gm call to change'}`);
      if (e.cart?.length) say(`  ${e.pid} cart: ${e.cart.map(l => l.op + ' ' + (l.key || l.uid || l.lid)).join(', ')}`); if (e.loot) say(`  ${e.pid} loot: ${Object.entries(e.loot).map(([k, v]) => k + ' ' + v).join(', ')}`);
      if (e.levelUp) say(`  ${e.pid} level-up picks: ${JSON.stringify(e.levelUp)}`); if (e.rest) say(`  ${e.pid} rest: ${JSON.stringify(e.rest)}`); if (e.prepare) say(`  ${e.pid} prepare after the rest: ${e.prepare.list.join(', ')}`); if (e.casts?.length) say(`  ${e.pid} casts: ${e.casts.map(c => c.spell).join(', ')}`); }
    say(`plan written to ${path.relative(process.cwd(), wpath(`plan-${n}.json`))}`);
  },
  async resolve() {
    const st = await C.status(); if (!st.canResolve) throw new Error('the table is still open: wait for 9:00 PM PT or for every player to lock in');
    const sc = await sceneFor(n); if (!fexists(`plan-${n}.json`)) await C.plan(); const plan = readJ(`plan-${n}.json`);
    const { seed, salt } = readJ(`secrets/${n}.json`); const g = loadG();
    await P.update(['nights', n, 'scene'], { status: 'closed' });  // no more player writes tonight
    const r = N.resolveNight(g, sc, plan, { seed, now: NOW, early: st.early }); r.salt = salt; r.dcs = dcList(sc);
    saveG(g); writeJ(`result-${n}.json`, r); say(`resolved night ${n}: ${r.entries.filter(e => e.check).length} checks${r.battle ? `, battle ${r.battle.status} (round ${r.battle.round})` : ''}. Next: draft / narrate / publish.`);
  },
  async draft() {
    const r = readJ(`result-${n}.json`); const scope = recapScope(r);
    say(`Recap length: ${scope === 'short' ? 'SHORT (quiet night — travel, shop, or rest). A few flowing paragraphs.' : 'FULL (a big moment, a fight, or a natural 20 / 1). Tell the whole beat.'}`);
    const out = [];
    // Phase 5 note 1: the skeleton reads in the cozy house voice (phase0/VOICE.md). Hero sentences carry no success/failure
    // words of their own (the outcome text does), so the narration validator judges exactly what the engine decided.
    const sn = N.shortName; const LEAD = [n => `${n} takes a breath and has a go.`, n => `Then it is ${n}\u2019s turn.`, n => `${n} rolls up a sleeve.`, n => `${n} gives it a try, in their own good time.`];
    r.entries.forEach((e, i) => out.push(e.kind === 'absent' ? `${sn(e.name)}, meanwhile, ${e.outcome.charAt(0).toLowerCase()}${e.outcome.slice(1)}` : e.kind === 'orders' ? null : `${e.say ? `\u201c${e.say}\u201d says ${sn(e.name)}, and gets on with it.` : LEAD[i % LEAD.length](sn(e.name))} ${e.outcome}`));
    if (r.battle) { const b = r.battle, what = /brawl/i.test(b.kind || '') ? 'The brawl' : `${b.name ? `\u201c${b.name}\u201d` : 'The fight'}`; out.push(b.started ? r.nextTeaser : b.unfinished ? `${what} isn\u2019t finished yet. Everyone catches their breath right where they stand, and it picks up again tomorrow night at round ${b.round + 1}.` : b.cleared === 'victory' ? `${what} is won in round ${b.round}, and the quiet that settles afterward feels well earned.` : b.cleared === 'defeat' ? `${what} is lost, and for a while nobody says very much at all.` : `${what} ends, and the evening goes back to being an evening.`); } say(out.filter(Boolean).join('\n\n'));
  },
  async narrate() {
    const file = opt('file'); if (!file) throw new Error('--file narration.txt'); const text = fs.readFileSync(file, 'utf8').trim(); const r = readJ(`result-${n}.json`);
    r.party = N.partyFacts(loadG()); const v = N.validateNarration(text, r);
    for (const w of v.warnings) say('  warn:', w); for (const e of v.errors) say('  ERROR:', e);
    if (!v.ok) { process.exitCode = 2; return say('narration REJECTED: it contradicts the engine. Fix and re-run.'); }
    r.narration = text; r.narrationCheck = { ok: true, warnings: v.warnings }; writeJ(`result-${n}.json`, r); say('narration accepted');
  },
  async publish() {
    const r = readJ(`result-${n}.json`); if (!r.narration) throw new Error('narrate first (the validator must pass)');
    const g = loadG(); r.publishedAt = NOW; r.party = N.partyFacts(g);
    await P.set(['nights', n, 'result'], pack(r, ['n', 'publishedAt'])); await P.update(['nights', n, 'scene'], { status: 'resolved' }); await publishGame(g);
    say(`published night ${n}; seed revealed (${r.seed.slice(0, 12)}…)`);
  },
  async verify() {
    const sc = await store.scene(n), r = await store.result(n); const okSeed = N.verifyCommit(r.seed, sc.commit); const okDc = N.commit(r.salt + '|' + JSON.stringify(r.dcs)) === sc.dcCommit;
    const g = loadG(); const replay = JSON.stringify(rebuild(g.log, g.initial)) === JSON.stringify(g.state);
    const ver = r.dcScale || N.scaleOf(sc);
    const dcErr = N.checkDcCalls(r.entries.filter(e => e.check && (e.kind === 'free' || (e.kind === 'orders' && e.text))).map(e => ({ kind: e.kind, text: e.text, check: e.check ? { dc: e.check.dc, skill: e.check.skill } : null, dcCall: e.dcCall })), ver);
    const okFree = !dcErr.length; const nFree = r.entries.filter(e => e.dcCall).length;
    say(`seed matches published hash: ${okSeed}\nmove DCs match published hash: ${okDc}\nfree-text DC calls on scale v${ver} (${N.scaleLabel(ver)}) with reasons (${nFree}): ${okFree}${okFree ? '' : ' (' + dcErr.join('; ') + ')'}\nevent log replays to the same state: ${replay}`);
    if (!(okSeed && okDc && okFree && replay)) process.exitCode = 3;
  },
  async call() { // gm call <n> <pid> <Easy|Medium|Hard> "reason" [--skill s]
    const [pid, word, why] = argv.slice(2); const plan = readJ(`plan-${n}.json`); const e = plan.entries.find(x => x.pid === pid);
    if (!e || (e.kind !== 'free' && !(e.kind === 'orders' && e.text))) throw new Error(`${pid} has no free-text action in plan ${n}`);
    const doId = opt('do'); const slot = opt('slot');
    if (doId || slot) e.writeIn = { ...(e.writeIn || e.mapped || {}), ...(doId ? { do: doId } : {}), ...(slot ? { slot } : {}) };
    if (doId && ['dodge', 'help', 'dash', 'disengage', 'attack', 'potion'].includes(doId)) { delete e.check; delete e.dcCall; writeJ(`plan-${n}.json`, plan); return say(`${pid}: "${e.text}" → ${doId}${slot ? ' (' + slot + ')' : ''} · no check`); }
    N.setDcCall(e, word, why, opt('skill') || undefined, await nightScale(n)); e.dcCall.by = 'gm'; e.dcCall.at = NOW; writeJ(`plan-${n}.json`, plan);
    say(`${pid}: "${e.text}" → ${e.writeIn?.do || e.mapped?.do || 'check'} ${e.check.skill} ${e.dcCall.word} (DC ${e.dcCall.dc}) · ${e.dcCall.why}`);
  },
  async award() {
    const plan = readJ(`plan-${n}.json`); const spec = {}; if (opt('hoard')) spec.hoard = opt('hoard'); if (opt('coin')) spec.coin = +opt('coin'); if (opt('items')) spec.items = opt('items').split(',').map(k => k.trim()).filter(Boolean).map(k => k.endsWith('?') ? { ...SH.instOf(k.slice(0, -1)).inst, unid: true } : SH.instOf(k).inst);
    if (!Object.keys(spec).length) throw new Error('--hoard, --coin or --items'); const why = opt('why'); if (!why || why.length < 4) throw new Error('--why "where it came from"');
    if ((spec.items || []).some(i => i.id === 'keepsake')) throw new Error('keepsakes are never loot');
    (plan.awards = plan.awards || []).push({ spec, why, at: NOW }); writeJ(`plan-${n}.json`, plan); say(`award queued for night ${n}: ${JSON.stringify(spec)} (${why})`);
  },
  async lootmode() { const m = argv[2]; if (!['needgreed', 'party'].includes(m)) throw new Error('needgreed | party'); const plan = readJ(`plan-${n}.json`); plan.lootMode = m; writeJ(`plan-${n}.json`, plan); say(`night ${n}: items split by ${m === 'party' ? 'party stash (claim or sell and split)' : 'Need / Greed'}`); },
  async link() { const [uid, pid] = argv.slice(1); const camp = await store.campaign(); if (!uid || !camp.players?.[pid]) throw new Error('gm link <firebase uid> <pid of a seat>');
    await P.set(['members', uid], { pid, role: 'player', linkedAt: NOW }); say(`linked ${uid} → seat ${pid} (${camp.players[pid].name})`); },
  async unlink() { const uid = argv[1]; await P.remove(['members', uid]); say(`unlinked ${uid}`); },
  async quests() { const g = loadG(); const camp = await store.campaign().catch(() => ({})); const sc = camp?.currentNight ? await store.scene(camp.currentNight).catch(() => ({})) : {};
    say('Main quest: recover Harold\'s urn from Gulpwell\'s office at the counting hall in Thimbleby.');
    for (const q of questBoard(g.state.story || {})) say(`  ${q.status.padEnd(9)} ${q.title} · ${q.giver}${q.nextScene ? ` · next: gm open <n> --scene ${q.nextScene}` : ''}\n            reward: ${q.reward}`);
    say('Teslandia board (1–2 nights, cap 2 active):');
    for (const q of listedBoardQuests(g.state.story || {}, sc || {})) say(`  ${q.status.padEnd(9)} ${q.title} · ${q.nights} night${q.nights > 1 ? 's' : ''} · ${q.skill} ${q.word}${q.status !== 'locked' && q.scenes?.[0] ? ` · gm open <n> --scene ${q.scenes[0]}` : ''}\n            ${q.hook}`); },
  async rulings() {
    const file = opt('file'); if (!file) throw new Error('gm rulings <n> --file rulings.json');
    if (!fexists(`plan-${n}.json`)) await C.plan();
    const plan = readJ(`plan-${n}.json`);
    const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
    const next = applyRulings(plan, raw);
    writeJ(`plan-${n}.json`, next);
    for (const e of next.entries) {
      if (e.dcCall) say(`  ${e.pid} ${e.dcCall.word} DC ${e.dcCall.dc} ${e.check?.skill || ''} — ${e.dcCall.why}`);
      const xp = (e.success?.effects || []).find(x => x.xp)?.xp;
      if (xp) say(`  ${e.pid} success XP ${xp}`);
    }
    if (next.awards?.length) say(`  awards: ${next.awards.length}`);
    if (next.clockHours) say(`  clockHours ${next.clockHours} (apply after verify with a logged travel ruling, as before)`);
    say(`rulings applied to ${path.relative(process.cwd(), wpath(`plan-${n}.json`))}. Next: gm resolve ${n} (when Wes says the table is locked), then draft / narrate / publish / verify.`);
  },
  async issues() {
    const all = (await store.listIssues()).map(I.readIssue); const groups = { needs: 'Needs Wes', open: 'Open', done: 'Done' };
    for (const [k, label] of Object.entries(groups)) { const xs = all.filter(i => I.bucket(i) === k || (k === 'open' && ['decided', 'built'].includes(i.status))).filter((i, _, a) => k !== 'needs' || i.status === 'options'); if (!xs.length || (k === 'done' && !argv.includes('--all'))) continue;
      say(`${label} (${xs.length})`); for (const i of xs) say(`  #${i.id} ${I.CATS[i.cat].padEnd(5)} ${I.STATUS_TXT[i.status].padEnd(10)} ${i.by}: ${i.text.slice(0, 70)}${i.decision ? `  → Wes: ${i.decision.pick}` : ''}`); }
    if (!all.length) say('no issues filed');
  },
  async issue() { const i = I.readIssue(await P.get(['issues', argv[1]])); if (!i) throw new Error('no issue ' + argv[1]); say(JSON.stringify({ ...i, ctx: i.ctx ? '[attached screen + game state]' : null }, null, 1)); },
  async triage() { const id = argv[1]; const i = I.readIssue(await P.get(['issues', id])); if (!i) throw new Error('no issue ' + id); if (i.status !== 'filed') throw new Error(`#${id} is already ${i.status}`);
    const opts = opt('file') ? JSON.parse(fs.readFileSync(opt('file'), 'utf8')) : I.templateOptions(i); const errs = I.checkOptions(opts); if (errs.length) throw new Error('options: ' + errs.join('; '));
    await P.update(['issues', id], { status: 'options', options: JSON.stringify(opts), triagedAt: NOW }); say(`#${id} → Wes's queue with ${opts.length} options (recommended ${opts.find(o => o.rec).key})`); },
  async rule() { const id = argv[1]; const i = I.readIssue(await P.get(['issues', id])); if (!i || i.cat !== 'rules') throw new Error('rule answers rules questions only'); const text = opt('text'), srd = opt('srd'); if (!text || !srd) throw new Error('--text and --srd (the SRD 5.2.1 section)');
    await P.update(['issues', id], { status: 'ruled', ruling: JSON.stringify({ text, srd, at: NOW }) }); say(`#${id} ruled (${srd}). Nothing changes in code; if it should, triage a follow-up for Wes.`); },
  async build() { const id = argv[1]; const i = I.readIssue(await P.get(['issues', id])); if (!i) throw new Error('no issue ' + id);
    if (!I.canBuild(i)) throw new Error(`#${id} can't be built: ${i.decision ? (i.decision.pick === 'reject' ? 'Wes rejected it' : 'status ' + i.status) : 'Wes hasn\u2019t picked an option yet'}`);
    await P.update(['issues', id], { status: 'built', builtAt: NOW, ...(opt('commit') ? { commit: opt('commit') } : {}) }); say(`#${id} built (Wes picked ${i.decision.pick})`); },
  async asks() { const all = await store.listAsks(); const show = argv.includes('--all') ? all : all.filter(a => a.status !== 'answered'); if (!show.length) return say(all.length ? 'no open questions (--all for answered)' : 'no questions asked');
    for (const a of show) say(`  ?${a.id} ${a.status.padEnd(8)} ${a.by} night ${a.night}${a.about ? ' · ' + a.about : ''}: ${a.text}${a.answer ? `\n      → ${a.answer.text}${a.answer.srd ? ' (' + a.answer.srd + ')' : ''}` : ''}`); },
  async answer() { const id = argv[1]; const text = opt('text'); if (!id || !text) throw new Error('gm answer <id> --text "..." [--srd "section"]'); const q = await P.get(['asks', id]); if (!q) throw new Error('no question ' + id);
    await store.answerAsk(id, text, { srd: opt('srd') || null }); say(`?${id} answered. Answers are words only: if it should change a sheet, do that through the engine (gm award, a scene effect) in the next batch.`); },
  async levelups() { const g = loadG(); const k = Number.isFinite(n) && n > 0 ? n : (await store.campaign()).currentNight; const ps = await players();
    for (const p of ps) { const c = g.state.chars[p.cid]; if (!c) continue; const plan = levelUpPlan(c); const a = k ? await store.myAction(k, p.pid) : null;
      if (!plan.canLevel) { say(`  ${p.pid} ${c.name}: level ${c.level} (${plan.why})`); continue; }
      const errs = a?.levelUp ? validateLevelUp(c, a.levelUp) : null; say(`  ${p.pid} ${c.name}: level ${c.level} → ${plan.to} READY · ${a?.levelUp ? (errs.length ? 'picks REFUSED: ' + errs.join('; ') : 'picks saved and legal (applied first in the batch)') : 'no picks saved yet'}`); } },
  async portraits() { const mf = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'portraits', 'manifest.json'); PA.setManifest(fs.existsSync(mf) ? JSON.parse(fs.readFileSync(mf, 'utf8')) : { portraits: {} }, 'assets/');
    const hs = await store.listHeroes(); if (!hs.length) return say('no heroes saved yet'); let miss = 0;
    for (const h of hs) { const L = PA.lookOf(h.draft, h.ch); const key = PA.lookKey(L); const have = !!PA.paintingFor(L); if (!have) miss++;
      say(`  ${h.owner} ${h.ch?.name || h.draft?.name}: ${key} ${have ? 'PAINTED' : 'missing (SVG fallback until painted)'}`); if (!have) say(`      prompt: ${PA.promptFor(L)}`); }
    say(miss ? `${miss} missing. Paint each prompt at 1:1, review it at phone size, then: node app/tools/portraits.mjs add <key> <image>` : 'every hero has a painted portrait'); },
  async release() { const id = argv[1]; const i = I.readIssue(await P.get(['issues', id])); if (i?.status !== 'built') throw new Error(`#${id} isn't built yet`); await P.update(['issues', id], { status: 'released', releasedAt: NOW }); say(`#${id} released`); },
};
if (!C[cmd]) { say(fs.readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').slice(1).filter((l, i, a) => i < a.findIndex(x => x.startsWith('import '))).map(l => l.replace(/^\/\/ ?/, '')).join('\n')); process.exit(cmd ? 1 : 0); }
C[cmd]().catch(e => { console.error('gm:', e.message); process.exit(1); });
