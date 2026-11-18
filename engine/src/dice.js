// Deterministic, verifiable dice. The GM publishes commit(seed) before actions open, reveals the seed after.
// Anyone can rebuild the exact same rolls with new Dice(seed). State (seed + PRNG words + count) is JSON-serializable,
// so a battle paused at the cutoff resumes with the dice stream exactly where it stopped.
import { sha256 } from './sha256.js';

export const commit = seed => sha256('bog5-seed:' + seed);
export const verifyCommit = (seed, hash) => commit(seed) === hash;

export class Dice {
  constructor(seed, saved) {
    this.seed = String(seed);
    if (saved) { this.s = Uint32Array.from(saved.s); this.n = saved.n; return; }
    const h = sha256('bog5-prng:' + this.seed);
    this.s = new Uint32Array(4); for (let i = 0; i < 4; i++) this.s[i] = parseInt(h.slice(i * 8, i * 8 + 8), 16) || 0x9e3779b9;
    this.n = 0;
  }
  static fromJSON(j) { return new Dice(j.seed, j); }
  toJSON() { return { seed: this.seed, s: [...this.s], n: this.n }; }
  // xoshiro128**
  next() {
    const s = this.s; const res = Math.imul(rotl(Math.imul(s[1], 5), 7), 9) >>> 0; const t = s[1] << 9;
    s[2] ^= s[0]; s[3] ^= s[1]; s[1] ^= s[2]; s[0] ^= s[3]; s[2] ^= t; s[3] = rotl(s[3], 11); this.n++; return res;
  }
  die(sides) { // unbiased 1..sides
    const lim = Math.floor(0x100000000 / sides) * sides; let x;
    do { x = this.next(); } while (x >= lim);
    return (x % sides) + 1;
  }
  // roll('2d6+3', {crit, minFace, rerollBelow}) -> {expr, faces, bonus, total}
  roll(expr, opt = {}) {
    const p = parseDice(expr); const faces = [];
    for (const term of p.terms) {
      const count = term.n * (opt.crit ? 2 : 1);
      for (let i = 0; i < count; i++) { let f = this.die(term.d); if (opt.minFace && f < opt.minFace) f = opt.minFace; faces.push({ d: term.d, f }); }
    }
    const total = faces.reduce((a, x) => a + x.f, 0) + p.bonus;
    return { expr, crit: !!opt.crit, faces: faces.map(x => x.f), sides: faces.map(x => x.d), bonus: p.bonus, total: Math.max(0, total) };
  }
  // d20 test with advantage/disadvantage (they cancel). Halfling Luck rerolls a natural 1 once.
  d20({ adv = false, dis = false, luck = false } = {}) {
    const mode = adv && !dis ? 'adv' : dis && !adv ? 'dis' : 'normal';
    const roll1 = () => { let r = this.die(20); if (luck && r === 1) r = this.die(20); return r; };
    const a = roll1(); if (mode === 'normal') return { mode, faces: [a], nat: a };
    const b = roll1(); return { mode, faces: [a, b], nat: mode === 'adv' ? Math.max(a, b) : Math.min(a, b) };
  }
}
const rotl = (x, k) => ((x << k) | (x >>> (32 - k))) >>> 0;

export function parseDice(expr) {
  const s = String(expr).replace(/\s+/g, '').toLowerCase(); const terms = []; let bonus = 0;
  for (const m of s.matchAll(/([+-]?)(\d*)d(\d+)|([+-]?)(\d+)/g)) {
    if (m[3]) { const n = +(m[2] || 1); if (m[1] === '-') throw new Error('negative dice not supported'); terms.push({ n, d: +m[3] }); }
    else if (m[5]) bonus += (m[4] === '-' ? -1 : 1) * +m[5];
  }
  return { terms, bonus };
}
export const avgDice = expr => { const p = parseDice(expr); return p.terms.reduce((a, t) => a + t.n * (t.d + 1) / 2, 0) + p.bonus; };
export const maxDice = expr => { const p = parseDice(expr); return p.terms.reduce((a, t) => a + t.n * t.d, 0) + p.bonus; };
export const minDice = expr => { const p = parseDice(expr); return p.terms.reduce((a, t) => a + t.n, 0) + p.bonus; };
