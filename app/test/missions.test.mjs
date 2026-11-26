import { test } from 'node:test'; import assert from 'node:assert/strict';
import { NIGHTS } from '../content/arc1.js';
import { SHOPS } from '../../engine/src/shop.js';
import { planNight, applyDcScale, DC_SCALE_CURRENT } from '../../engine/src/night.js';
import {
  BOARD_QUESTS, BOARD_SCENES, MAIN_QUEST, SIDE_QUEST_CAP, TOWN_LOOT,
  currentMissions, suggestedIdeas, pickWriteIn, ruledCheckLine, recapScope,
  inSettlement, startedSideCount,
} from '../content/missions.js';
import { GULPWELL_SCENE, GULPWELL, TALLY_BRISK, GULPWELL_XP } from '../content/gulpwell.js';

const hall = NIGHTS.find(s => s.id === 'a1n34');
const players = [
  { pid: 'p1', cid: 'hero-p1', name: 'Biggus Dickus' },
  { pid: 'p2', cid: 'hero-p2', name: 'Gorlock' },
  { pid: 'p3', cid: 'hero-p3', name: 'Boobington' },
  { pid: 'p4', cid: 'hero-p4', name: 'Yaest' },
];

test('main quest is recovered Harold\'s urn, always listed until urn_recovered', () => {
  assert.match(MAIN_QUEST.pitch, /Harold\'s urn/);
  assert.match(MAIN_QUEST.pitch, /Gulpwell/);
  assert.match(MAIN_QUEST.pitch, /counting hall/);
  const open = currentMissions({ flags: {}, quests: { spy: { status: 'done' } } }, hall);
  assert.equal(open.main.status, 'started');
  assert.equal(currentMissions({ flags: { urn_recovered: true } }, hall).main.status, 'done');
});

test('Teslandia board has 6-8 short side quests with hooks, DCs, rewards, and scenes', () => {
  assert.ok(BOARD_QUESTS.length >= 6 && BOARD_QUESTS.length <= 8);
  for (const q of BOARD_QUESTS) {
    assert.ok(q.hook && q.pitch && q.writeIn && q.reward);
    assert.ok(q.nights === 1 || q.nights === 2, q.id);
    assert.ok(['Easy', 'Medium', 'Hard'].includes(q.word), q.id);
    assert.ok([9, 14, 19].includes(q.dc), q.id + ' authored on the v2 scale');
    assert.ok(BOARD_SCENES.some(s => s.id === q.scenes[0]), q.id);
  }
  const live = currentMissions({ flags: { thimbleby_room: true }, quests: { spy: { status: 'done' } } }, hall);
  assert.equal(live.showBoard, true);
  assert.ok(live.available.length >= 6);
  assert.equal(live.atCap, false);
  assert.equal(live.cap, SIDE_QUEST_CAP);
});

test('active side-quest cap is 1-2 and is derived from existing story.quests, not a new field', () => {
  const story = { quests: { late_hours: { status: 'started' }, melt_day: { status: 'started' } } };
  const m = currentMissions(story, hall);
  assert.equal(startedSideCount(story), 2);
  assert.equal(m.atCap, true);
  assert.equal(m.active.length, 2);
});

test('Night 47 suggestions are 2-3 mission-tied ideas that prefill existing write-in text', () => {
  const ideas = suggestedIdeas({}, hall);
  assert.ok(ideas.length >= 2 && ideas.length <= 3);
  for (const i of ideas) {
    assert.equal(i.mission, 'Main quest');
    assert.ok(i.text.length >= 3);
    assert.equal(pickWriteIn(i.id, {}, hall), i.text);
  }
  assert.ok(ideas.some(i => /scout|counting hall/i.test(i.text)));
  assert.ok(ideas.some(i => /Gulpwell|hours|urn/i.test(i.text)));
});

test('existing preset move orders for Night 47 still plan and resolve', () => {
  const sc = applyDcScale({ ...hall, n: 47 }, DC_SCALE_CURRENT);
  const actions = {
    p1: { locked: true, kind: 'move', moveId: 'scout' },
    p2: { locked: true, kind: 'move', moveId: 'hours' },
    p3: { locked: true, kind: 'move', moveId: 'wayin' },
    p4: { locked: true, kind: 'free', text: 'Use stealth and steal horses for the party' },
  };
  const plan = planNight(sc, actions, players);
  assert.equal(plan.entries[0].kind, 'move');
  assert.equal(plan.entries[0].moveId, 'scout');
  assert.equal(plan.entries[0].check.skill, 'perception');
  assert.equal(plan.entries[0].check.dc, 11);
  assert.equal(plan.entries[3].kind, 'free');
  assert.match(plan.entries[3].text, /steal horses/);
});

test('ruled check line shows skill + difficulty word + DC for write-ins', () => {
  const line = ruledCheckLine({ kind: 'free', check: { skill: 'stealth', dc: 11, word: 'Medium' }, dcCall: { word: 'Medium', dc: 11, why: 'a quiet way in' } });
  assert.equal(line, 'Stealth \u00b7 Medium (DC 11)');
  assert.equal(recapScope({ entries: [{ check: { nat: 11 } }] }), 'short');
  assert.equal(recapScope({ entries: [{ check: { nat: 20 } }] }), 'full');
  assert.equal(recapScope({ battle: { name: "Gulpwell's Office", round: 3, status: 'victory' } }), 'full');
});

test('Fenwick and Tollford shops exist in the catalog with real stock', () => {
  for (const id of ['fenwick', 'tollford', 'thimbleby']) {
    assert.ok(SHOPS[id], id);
    assert.ok(SHOPS[id].stock.includes('rations'));
    assert.ok(SHOPS[id].stock.includes('potion_of_healing'));
  }
  assert.ok(SHOPS.fenwick.stock.includes('scale_mail'));
  assert.ok(SHOPS.tollford.stock.includes('scroll:cure_wounds'));
  assert.ok(TOWN_LOOT.fenwick.shop === 'fenwick');
  assert.ok(TOWN_LOOT.tollford.shop === 'tollford');
});

test('Gulpwell and Tally Brisk stat blocks and boss scene are ready to open, not on Night 47', () => {
  assert.equal(GULPWELL.boss, true);
  assert.equal(GULPWELL.monster, 'bandit_captain');
  assert.equal(TALLY_BRISK.monster, 'spy');
  assert.equal(GULPWELL_XP, 650);
  assert.equal(GULPWELL_SCENE.id, 'a1_gulpwell');
  assert.ok(GULPWELL_SCENE.after.startBattle.foes.some(f => f.boss && f.uid === 'gulpwell'));
  assert.notEqual(hall.id, GULPWELL_SCENE.id);
  assert.ok(inSettlement(hall));
});
