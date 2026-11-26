import { test } from 'node:test'; import assert from 'node:assert/strict';
import { planNight, applyDcScale, DC_SCALE_CURRENT } from '../../engine/src/night.js';
import { applyRulings, readRulings } from '../../engine/src/rulings.js';
import { NIGHTS } from '../content/arc1.js';

const hall = applyDcScale({ ...NIGHTS.find(s => s.id === 'a1n34'), n: 47 }, DC_SCALE_CURRENT);
const players = [
  { pid: 'p1', cid: 'hero-p1', name: 'Biggus' },
  { pid: 'p4', cid: 'hero-p4', name: 'Yaest' },
];

test('rulings file applies skill, difficulty, default 25 XP, and optional flag; no schema fields added', () => {
  const plan = planNight(hall, {
    p1: { locked: true, kind: 'move', moveId: 'scout' },
    p4: { locked: true, kind: 'free', text: 'Use stealth and steal horses for the party' },
  }, players);
  const raw = {
    night: 47,
    calls: [
      { pid: 'p4', word: 'Medium', skill: 'stealth', why: 'a quiet way toward the hall, not out of town', flag: 'hall_way_in', flagText: 'a way into the counting hall' },
    ],
  };
  const next = applyRulings(plan, raw);
  const e = next.entries.find(x => x.pid === 'p4');
  assert.equal(e.dcCall.word, 'Medium');
  assert.equal(e.dcCall.dc, 11);
  assert.equal(e.check.skill, 'stealth');
  assert.equal(e.check.dc, 11);
  assert.ok(e.success.effects.some(x => x.xp === 25 && x.who === 'self'));
  assert.ok(e.success.effects.some(x => x.flag === 'hall_way_in'));
  // preset move entry is untouched
  const m = next.entries.find(x => x.pid === 'p1');
  assert.equal(m.kind, 'move');
  assert.equal(m.check.dc, 11);
  assert.deepEqual(readRulings(raw).calls[0].pid, 'p4');
});

test('rulings file rejects a bad difficulty word and a missing reason', () => {
  const plan = planNight(hall, { p4: { locked: true, kind: 'free', text: 'sneak in' } }, [{ pid: 'p4', cid: 'hero-p4', name: 'Yaest' }]);
  assert.throws(() => applyRulings(plan, { calls: [{ pid: 'p4', word: 'Impossible', skill: 'stealth', why: 'nope' }] }), /Easy, Medium or Hard/);
  assert.throws(() => applyRulings(plan, { calls: [{ pid: 'p4', word: 'Medium', skill: 'stealth', why: '' }] }), /reason/);
});
