// BoG V storage. One path-based interface, three backends, all rooted at bog5/ and nothing else:
//   MemoryPaths      in-memory tree (tests, ?store=memory)
//   LocalPaths       the same tree persisted in localStorage (single-device play, Phase 2 default)
//   RtdbRest         Firebase Realtime Database REST shape (/{prefix}/{path}.json). Used against the local dev
//                    server (app/dev-server.mjs), the Firebase emulator, and (only after Wes signs off) live c-thug.
// Bog5Store layers the game's data model on top (heroes, drafts, campaign, nights, actions, locks, results).
//
// Layout under bog5/ (who may write in brackets; see firebase/bog5.rules.json):
//   members/{uid}            {pid, role}                          [GM tool only]
//   campaign                 {title, adventureStarted, currentNight, players{pid:{name,player}}}   [GM tool only]
//   game                     public engine state: chars, party, encounter (never the dice seed)    [GM tool only]
//   heroes/{heroId}          {id, owner, draft, spec, ch, ...}    [owner, only while !adventureStarted]
//   drafts/{pid}             Forge draft in progress              [owner]
//   stances/{pid}            'cautious' | 'support' | 'aggressive' [owner]
//   nights/{n}/scene         scene + dice-seed hash + cutoffMs     [GM tool only]
//   nights/{n}/actions/{pid} the player's move / battle orders    [owner, scene open and before cutoff; read: owner, and
//                                                                  party seats while the scene is open (Phase 5 note 3)]
//   nights/{n}/locks/{pid}   {state:'thinking'|'locked', at}      [owner, same window; read: all members]
//   nights/{n}/result        resolution + narration + revealed seed [GM tool only]
//   issues/{id}              player issue log (Phase 4)            [filer creates; host decides; GM triages]
//   asks/{id}                Ask the GM (Phase 5) {id, by, night, text, at, status:'asked'}  [asker creates]
//                            + answer {text, srd?, at} and status 'answered'                 [GM tool only]
//                            An answer is words only: it never changes a sheet (the engine does, in the batch).
export const PREFIX = 'bog5';
const SEG = /^[A-Za-z0-9_-]+$/;
export function cleanPath(path) {
  const segs = (Array.isArray(path) ? path : String(path).split('/')).filter(s => s !== '');
  for (const s of segs) if (!SEG.test(String(s))) throw new Error(`bad path segment "${s}"`);
  return segs.map(String);
}
const clone = v => v == null ? null : JSON.parse(JSON.stringify(v));
// RTDB semantics: empty objects / nulls vanish, writes of null delete
const prune = v => { if (v == null) return null; if (typeof v !== 'object') return v; if (Array.isArray(v)) { const a = v.map(prune); return a.some(x => x !== null) ? a : null; }
  const out = {}; let any = false; for (const [k, x] of Object.entries(v)) { const p = prune(x); if (p !== null) { out[k] = p; any = true; } } return any ? out : null; };
// RTDB drops empty arrays/objects, so engine documents travel as a JSON string beside the few fields rules check
export const pack = (doc, keep = []) => doc == null ? null : { ...Object.fromEntries(keep.filter(k => doc[k] !== undefined).map(k => [k, doc[k]])), json: JSON.stringify(doc) };
// top-level fields win: they are the ones rules check and the GM tool patches (e.g. scene status)
export const unpack = v => { if (v == null) return null; if (typeof v.json !== 'string') return v; const { json, ...top } = v; return { ...JSON.parse(json), ...top }; };

export class PathStore {
  async get(path) { throw new Error('not implemented'); }
  async set(path, value) { throw new Error('not implemented'); }
  async update(path, patch) { for (const [k, v] of Object.entries(patch)) await this.set([...cleanPath(path), ...k.split('/')], v); }
  async remove(path) { return this.set(path, null); }
}
export class MemoryPaths extends PathStore {
  constructor(tree = null) { super(); this.tree = clone(tree) || {}; }
  _get(segs) { let o = this.tree; for (const s of segs) { if (o == null || typeof o !== 'object') return null; o = o[s]; } return o === undefined ? null : o; }
  async get(path) { return clone(this._get(cleanPath(path))); }
  async set(path, value) { const segs = cleanPath(path); if (!segs.length) { this.tree = prune(clone(value)) || {}; return this._save(); }
    let o = this.tree; for (const s of segs.slice(0, -1)) { if (o[s] == null || typeof o[s] !== 'object') o[s] = {}; o = o[s]; }
    const v = prune(clone(value)); if (v === null) delete o[segs.at(-1)]; else o[segs.at(-1)] = v; this.tree = prune(this.tree) || {}; this._save(); }
  _save() {}
}
export class LocalPaths extends MemoryPaths {
  constructor(ls = globalThis.localStorage, key = PREFIX + '/') { let t = {}; try { t = JSON.parse(ls.getItem(key) || '{}'); } catch {} super(t); this.ls = ls; this.key = key; }
  _save() { this.ls.setItem(this.key, JSON.stringify(this.tree)); }
}

// ---------- Firebase RTDB REST ----------
// auth: async () => ({ query: {auth: idToken} } | { query: {access_token} } | { headers: {Authorization} } | null)
// Live guard: any host that is not localhost/127.0.0.1 needs BOTH allowLive: 'wes-signed-off' and (in node)
// BOG5_ALLOW_LIVE=1. Nothing in this repo sets either. The prefix is fixed to bog5; bog4 is unreachable by construction.
export const LIVE_OK = 'wes-signed-off';
// A plain-http private-LAN IPv4 (10.x, 192.168.x, 172.16-31.x) also counts as local: it is the playtest dev server
// opened from a phone on the same Wi-Fi (`playtest.mjs --lan`). Firebase is never plain http on a private address.
const LAN = /^(10\.\d+|192\.168|172\.(1[6-9]|2\d|3[01]))\.\d+\.\d+$/;
export function isLocalUrl(u) { const x = new URL(u), h = x.hostname; return h === 'localhost' || h === '127.0.0.1' || h === '[::1]' || (x.protocol === 'http:' && LAN.test(h)); }
export class LiveWriteBlocked extends Error {}
export class RtdbRest extends PathStore {
  constructor({ base, ns = null, auth = async () => null, fetch: f = globalThis.fetch?.bind(globalThis), allowLive = null, prefix = PREFIX } = {}) {
    super(); if (prefix !== PREFIX) throw new Error('RtdbRest is fixed to the bog5/ prefix'); this.base = base.replace(/\/$/, ''); this.ns = ns; this.auth = auth; this.fetch = f;
    this.live = !isLocalUrl(this.base);
    if (this.live) { const envOk = typeof process !== 'undefined' && process.env?.BOG5_ALLOW_LIVE === '1'; if (allowLive !== LIVE_OK || (typeof process !== 'undefined' && process.versions?.node && !envOk)) this.blocked = true; }
  }
  async _req(method, path, body) {
    if (this.blocked) throw new LiveWriteBlocked(`refusing ${method} to live Firebase (${new URL(this.base).hostname}): live access needs Wes's sign-off`);
    const segs = [PREFIX, ...cleanPath(path)]; const url = new URL(`${this.base}/${segs.map(encodeURIComponent).join('/')}.json`);
    if (this.ns) url.searchParams.set('ns', this.ns); const a = (await this.auth()) || {}; for (const [k, v] of Object.entries(a.query || {})) url.searchParams.set(k, v);
    const res = await this.fetch(url.toString(), { method, headers: { 'content-type': 'application/json', ...(a.headers || {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
    const text = await res.text(); let j = null; try { j = text ? JSON.parse(text) : null; } catch { j = text; }
    if (!res.ok) { const e = new Error(`${method} /${segs.join('/')}: ${res.status} ${j?.error || text}`); e.status = res.status; throw e; } return j;
  }
  get(path) { return this._req('GET', path); }
  set(path, v) { return v == null ? this._req('DELETE', path) : this._req('PUT', path, v); }
  update(path, patch) { return this._req('PATCH', path, patch); }
}

// ---------- the game's data model ----------
export class LockedError extends Error {}
export class Bog5Store {
  constructor(paths, { owner = 'local', gm = false, now = () => Date.now() } = {}) { this.p = paths; this.owner = owner; this.gm = gm; this.now = now; }
  // heroes & drafts (Forge)
  async listHeroes() { const h = await this.p.get('heroes'); return Object.values(h || {}).map(unpack).sort((a, b) => a.savedAt - b.savedAt); }
  async getHero(id) { return unpack(await this.p.get(['heroes', id])); }
  async heroOf(pid) { return (await this.listHeroes()).find(h => h.owner === pid) || null; }
  async campaign() { return (await this.p.get('campaign')) || {}; }
  async heroesLocked() { return !!(await this.campaign()).adventureStarted; }
  async putHero(h) { if (!this.gm && await this.heroesLocked()) throw new LockedError('Sheets are locked: the first adventure has started.'); await this.p.set(['heroes', h.id], pack({ ...h, owner: h.owner || this.owner, savedAt: h.savedAt || Date.now() }, ['id', 'owner', 'savedAt'])); return h.id; }
  async removeHero(id) { if (!this.gm && await this.heroesLocked()) throw new LockedError('Sheets are locked.'); await this.p.remove(['heroes', id]); }
  async getDraft(owner = this.owner) { return unpack(await this.p.get(['drafts', owner])); }
  async putDraft(owner = this.owner, d) { await this.p.set(['drafts', owner], pack(d)); }
  // table
  async game() { return unpack(await this.p.get('game')); }
  async scene(n) { return unpack(await this.p.get(['nights', n, 'scene'])); }
  async locks(n) { return (await this.p.get(['nights', n, 'locks'])) || {}; }
  async result(n) { return unpack(await this.p.get(['nights', n, 'result'])); }
  async myAction(n, pid = this.owner) { return unpack(await this.p.get(['nights', n, 'actions', pid])); }
  // Phase 5 note 3: teammates' current moves/orders and party lines while the night is open (rules allow only then)
  async partyActions(n, pids) { const out = {}; await Promise.all(pids.filter(p => p !== this.owner).map(async p => { try { out[p] = unpack(await this.p.get(['nights', n, 'actions', p])); } catch { out[p] = null; } })); return out; }
  async putAction(n, a, pid = this.owner) {
    const sc = await this.scene(n); if (!sc || sc.status !== 'open' || this.now() >= sc.cutoffMs) throw new LockedError('The table has locked for tonight.');
    await this.p.set(['nights', n, 'actions', pid], pack({ ...a, at: this.now() }, ['at'])); await this.p.set(['nights', n, 'locks', pid], { state: a.locked ? 'locked' : 'thinking', at: this.now() });
  }
  // Phase 4 issue log (bog5/issues). Players file; the host seat decides; the GM tool triages/builds/releases.
  async listIssues() { const v = (await this.p.get('issues')) || {}; return Object.values(v).sort((a, b) => b.at - a.at); }
  async fileIssue(issue) { if (issue.by !== this.owner && !this.gm) throw new Error('file issues as yourself'); await this.p.set(['issues', issue.id], issue); return issue; }
  async decideIssue(id, pick, note = '') { const d = { pick, by: this.owner, at: this.now(), ...(note ? { note } : {}) }; await this.p.set(['issues', id, 'decision'], d); return d; }
  // Phase 5 Ask the GM (bog5/asks): in-fiction or rules questions. Players ask as themselves; only the GM tool answers.
  async listAsks() { const v = (await this.p.get('asks')) || {}; return Object.values(v).sort((a, b) => b.at - a.at); }
  async ask(q) { if (q.by !== this.owner && !this.gm) throw new Error('ask as yourself'); const t = String(q.text || '').trim(); if (t.length < 3 || t.length > 600) throw new Error('a question is 3 to 600 characters');
    const a = { id: q.id, by: q.by, night: q.night ?? 0, text: t, at: this.now(), status: 'asked', ...(q.about ? { about: String(q.about).slice(0, 40) } : {}) }; await this.p.set(['asks', a.id], a); return a; }
  async answerAsk(id, text, { srd = null } = {}) { if (!this.gm) throw new Error('only the GM answers'); const t = String(text || '').trim(); if (t.length < 2 || t.length > 1500) throw new Error('an answer is 2 to 1500 characters');
    const ans = { text: t, at: this.now(), ...(srd ? { srd: String(srd).slice(0, 120) } : {}) }; await this.p.update(['asks', id], { answer: ans, status: 'answered' }); return ans; }
  async stance(pid = this.owner) { return (await this.p.get(['stances', pid])) || 'cautious'; }
  async putStance(s, pid = this.owner) { await this.p.set(['stances', pid], s); }
}

// back-compat names for the Phase 2 Forge and its tests
export class MemoryAdapter extends Bog5Store { constructor() { super(new MemoryPaths()); } }
export class LocalStorageAdapter extends Bog5Store { constructor(ls) { super(new LocalPaths(ls)); } }
// ?store=memory → memory; ?store=dev → the local dev server (RTDB REST at the page's origin); else localStorage
export function createStore(search = globalThis.location?.search || '', { owner = 'local', now, restAuth = null, emulatorBase = 'http://127.0.0.1:9000' } = {}) {
  const q = new URLSearchParams(search);
  if (q.get('store') === 'memory') return new Bog5Store(new MemoryPaths(), { owner, now });
  // ?store=emulator → the Firebase RTDB emulator (demo-c-thug), signed in through the Auth emulator (Google provider)
  if (q.get('store') === 'emulator') { if (!restAuth) throw new Error('sign in first'); return new Bog5Store(new RtdbRest({ base: emulatorBase, ns: 'c-thug-default-rtdb', auth: restAuth }), { owner, now }); }
  if (q.get('store') === 'dev') return new Bog5Store(new RtdbRest({ base: globalThis.location.origin + '/rtdb', auth: async () => ({ query: { auth: 'dev:' + owner } }) }), { owner, now });
  try { const t = PREFIX + '/__probe'; localStorage.setItem(t, '1'); localStorage.removeItem(t); return new Bog5Store(new LocalPaths(), { owner, now }); } catch { return new Bog5Store(new MemoryPaths(), { owner, now }); }
}
