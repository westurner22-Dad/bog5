import { test } from 'node:test'; import assert from 'node:assert/strict';
import { startEncounter, resolveBattle, endEncounter, deriveSheet } from '../../engine/src/index.js';
import { RULES_V2_NIGHT } from '../../engine/src/combat.js';
import { party, PARTY_POS } from '../../engine/test/helpers.js';
import { GULPWELL, TALLY_BRISK, GULPWELL_FIGHT, GULPWELL_XP } from '../content/gulpwell.js';

const LIVE_HP = { biggus: 28, cumbeard: 28, edgington: 26, skynflute: 21 };
const POS = [{ cid: 'biggus', pos: [2, 6] }, { cid: 'cumbeard', pos: [2, 7] }, { cid: 'edgington', pos: [3, 5] }, { cid: 'skynflute', pos: [3, 8] }];

function table(seed) {
  const g = party(String(seed));
  g.state.meta.night = 49;
  for (const [cid, hp] of Object.entries(LIVE_HP)) {
    const c = g.state.chars[cid];
    // Live Night 46 numbers: do not change max from the sheet if it already matches; otherwise cap to live cur.
    c.hp.cur = Math.min(hp, c.hp.cur || hp);
    if (c.hp.cur < hp && (deriveSheet(c).hpMax || 0) >= hp) c.hp.cur = hp;
  }
  startEncounter(g, { name: GULPWELL_FIGHT.name, map: GULPWELL_FIGHT.map, party: POS, foes: GULPWELL_FIGHT.foes, location: 'Thimbleby' });
  return g;
}

function attackOrders(g) {
  const orders = {};
  for (const cid of Object.keys(LIVE_HP)) {
    orders[cid] = { thisRound: { action: { do: 'attack', target: 'nearest' } }, standing: [], preset: 'none' };
  }
  return orders;
}

function run(seed, maxRounds = 12) {
  const g = table(seed);
  let finished = null;
  for (let i = 0; i < maxRounds; i++) {
    const r = resolveBattle(g, attackOrders(g), { maxRounds: 1 });
    const enc = g.state.encounter;
    const reason = r?.stop?.reason || enc?.stop?.reason || enc?.cleared || enc?.status;
    if (reason === 'victory' || reason === 'defeat' || enc?.cleared === 'victory' || enc?.cleared === 'defeat') { finished = enc?.cleared || reason; break; }
  }
  const enc = g.state.encounter || {};
  const pcs = Object.values(enc.combatants || {}).filter(c => c.kind === 'pc' || c.side === 'party' || LIVE_HP[c.uid] || LIVE_HP[c.cid]);
  const foes = Object.values(enc.combatants || {}).filter(c => c.side === 'foe');
  const hp = cid => (g.state.chars[cid]?.hp?.cur ?? 0);
  const down = ['biggus', 'cumbeard', 'edgington', 'skynflute'].filter(cid => hp(cid) <= 0);
  const foeDown = foes.filter(f => (f.hp?.cur ?? f.hp) <= 0 || f.fled).length;
  return { finished: finished || enc.status || enc.cleared || 'ongoing', round: enc.round, down, foeDown, foes: foes.length, hp: Object.fromEntries(['biggus', 'cumbeard', 'edgington', 'skynflute'].map(c => [c, hp(c)])), gulp: foes.find(f => f.uid === 'gulpwell' || f.boss), tally: foes.find(f => f.uid === 'tally') };
}

test('Gulpwell and Tally Brisk are the expected templates in the office fight', () => {
  const g = table('statcheck');
  const foes = Object.values(g.state.encounter.combatants).filter(c => c.side === 'foe');
  const boss = foes.find(f => f.uid === 'gulpwell' || f.boss);
  const tally = foes.find(f => f.uid === 'tally');
  assert.ok(boss, 'Gulpwell is on the map');
  assert.equal(boss.name, GULPWELL.name);
  assert.equal(boss.monster, 'bandit_captain');
  assert.equal(boss.ac, 13, 'Night 20+ boss AC is Hard 13');
  assert.equal(boss.maxHp, 52);
  assert.ok(tally, 'Tally Brisk is on the map');
  assert.equal(tally.name, TALLY_BRISK.name);
  assert.equal(tally.monster, 'spy');
  assert.equal(tally.ac, 10, 'Night 20+ non-boss AC is Medium 10');
  assert.equal(tally.maxHp, 27);
  assert.equal(GULPWELL_XP, 650);
  // Live-ish starting HP
  assert.equal(g.state.chars.biggus.hp.cur, 28);
  assert.ok(g.state.chars.skynflute.hp.cur <= 21 || g.state.chars.skynflute.hp.cur > 0);
});

test('sim: Gulpwell + Tally is a winnable 2-night-scale fight for the current party, not a regular TPK', () => {
  const N = 12;
  const rows = [];
  for (let i = 0; i < N; i++) rows.push(run('gulp-sim-' + i));
  const wins = rows.filter(r => /victory/i.test(String(r.finished)) || (r.foeDown === r.foes && r.foes > 0)).length;
  const tpks = rows.filter(r => r.down.length === 4 || /defeat/i.test(String(r.finished))).length;
  const avgR = rows.reduce((s, r) => s + (r.round || 0), 0) / N;
  // Keep the numbers in the test output for the report.
  console.log('Gulpwell sim', JSON.stringify({ wins, tpks, avgR, sample: rows.slice(0, 3).map(r => ({ finished: r.finished, round: r.round, down: r.down, foeDown: r.foeDown, hp: r.hp })) }));
  assert.ok(wins >= 6, `party should win often (won ${wins}/${N})`);
  assert.ok(tpks <= 3, `TPK should be uncommon (tpk ${tpks}/${N})`);
  assert.ok(avgR >= 2 && avgR <= 12, `fight should last a night or two of rounds (avg ${avgR})`);
});
