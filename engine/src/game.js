// Event-sourced game state. Every change goes through tx ops recorded in an append-only log;
// rebuild(log) replays the log from nothing and must equal the live state (tested + simmed).
import { Dice, commit, verifyCommit } from './dice.js';
const clone = v => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));

export function emptyState(meta = {}) {
  return { v: 1, meta: { title: 'Balls or Gapes V', night: 0, cutoff: '21:00 America/Los_Angeles', ...meta }, chars: {}, party: { order: [], stance: {} }, encounter: null, clock: { day: 1, hour: 8, lastLongRestHour: -999 }, nights: {} };
}
function setPath(obj, p, v) { let o = obj; for (let i = 0; i < p.length - 1; i++) { if (o[p[i]] === undefined || o[p[i]] === null) o[p[i]] = typeof p[i + 1] === 'number' ? [] : {}; o = o[p[i]]; } const k = p[p.length - 1]; if (v === undefined) { if (Array.isArray(o)) o.splice(k, 1); else delete o[k]; } else o[k] = v; }
export function applyEvent(state, ev) { for (const op of ev.ops || []) setPath(state, op.p, clone(op.v)); return state; }
export function rebuild(log, initial) { const s = clone(initial) || emptyState(); for (const ev of log) applyEvent(s, ev); return s; }

export class Game {
  constructor({ state, log, seed, dice } = {}) {
    this.initial = clone(state) || emptyState(); this.state = clone(this.initial); this.log = [];
    if (log) for (const ev of log) { applyEvent(this.state, ev); this.log.push(ev); }
    this.dice = dice || new Dice(seed || 'dev-seed'); this._tx = null; this.triggers = [];
  }
  get(p) { return p.reduce((o, k) => (o == null ? o : o[k]), this.state); }
  // open an event; ops are applied immediately (so later logic sees them) and recorded
  begin(t, data = {}) { if (this._tx) throw new Error('nested tx ' + t + ' inside ' + this._tx.t); this._tx = { t, ...clone(data), ops: [], rolls: [] }; return this._tx; }
  set(p, v) { if (!this._tx) throw new Error('set outside tx'); const op = { p: [...p], v: clone(v) }; this._tx.ops.push(op); setPath(this.state, op.p, clone(v)); }
  roll(expr, opt, why) { const r = this.dice.roll(expr, opt); this._rec({ why, ...r }); return r; }
  d20(opt, why) { const r = this.dice.d20(opt); this._rec({ why, d20: true, ...r }); return r; }
  _rec(r) { if (this._tx) this._tx.rolls.push(r); }
  note(text) { if (this._tx) (this._tx.notes = this._tx.notes || []).push(text); }
  end(extra = {}) { const ev = { seq: this.log.length, ...this._tx, ...clone(extra) }; this._tx = null; this.log.push(ev); return ev; }
  // convenience: one-shot event
  event(t, data, fn) { this.begin(t, data); try { const r = fn ? fn() : undefined; const ev = this.end(); return r === undefined ? ev : r; } catch (e) { this.abort(); throw e; } }
  abort() { if (!this._tx) return; for (const op of [...this._tx.ops].reverse()) { /* rebuild instead of undo */ } const ops = this._tx.ops; this._tx = null; if (ops.length) this.state = rebuild(this.log, this.initial); }
  // nightly fair dice: publish the hash, play with the seed, reveal it after
  openNight(night, seed) { this.dice = new Dice(seed); return this.event('night_open', { night, commit: commit(seed) }, () => { this.set(['meta', 'night'], night); this.set(['nights', String(night)], { commit: commit(seed), revealed: null }); }); }
  revealNight(night, seed) { if (!verifyCommit(seed, this.state.nights[String(night)].commit)) throw new Error('seed does not match the published hash'); return this.event('seed_reveal', { night, seed }, () => this.set(['nights', String(night), 'revealed'], seed)); }
  snapshot() { return { state: clone(this.state), dice: this.dice.toJSON() }; }
}
export { clone };
