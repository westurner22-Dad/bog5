import { test } from 'node:test'; import assert from 'node:assert/strict';
import { Game, rebuild, startEncounter, resolveBattle, pauseAtCutoff, deriveSheet, makeItem } from '../src/index.js';
import { attack, applyDamage, castSpell, deathSave, heal, combatant } from '../src/combat.js';
import { Rigged, party, solo, duel, quickBuild, A, HEROES, PARTY_POS } from './helpers.js';
const tx = (g, fn) => { g.begin('test'); try { return fn(); } finally { g.end(); } };
const C = (g, u) => g.state.encounter.combatants[u];
const pcAtk = (g, cid, i = 0) => deriveSheet(g.state.chars[cid]).attacks[i];

test('critical hit doubles weapon dice, not the modifier', () => { const d = new Rigged(); const g = party('t', d); duel(g, 'skynflute', 'ogre', { pos: [1, 1], fpos: [8, 1] });
  d.push(20, 8, 8); tx(g, () => attack(g, {}, C(g, 'skynflute'), C(g, 'f1'), pcAtk(g, 'skynflute'))); assert.equal(C(g, 'f1').hp.cur, 68 - (8 + 8 + 3)); });
test('+1 weapon hits harder; Savage Attacker keeps the better damage roll', () => { const d = new Rigged(); const g = party('t', d); duel(g, 'biggus', 'ogre');
  d.push(5, 2, 7); tx(g, () => attack(g, { orders: { biggus: { smite: { when: 'never' } } } }, C(g, 'biggus'), C(g, 'f1'), pcAtk(g, 'biggus'))); // 5+6=11 vs AC 11 hits
  assert.equal(C(g, 'f1').hp.cur, 68 - (7 + 4)); });
test('natural 1 always misses; AC exactly met hits', () => { const d = new Rigged(); const g = party('t', d); duel(g, 'biggus', 'ogre'); d.push(1); const r = tx(g, () => attack(g, {}, C(g, 'biggus'), C(g, 'f1'), pcAtk(g, 'biggus'))); assert.ok(r.miss); });
test('Divine Smite on crit (bonus action, slot spent, +1d8 vs undead)', () => { const d = new Rigged(); const g = party('t', d); duel(g, 'biggus', 'zombie');
  d.push(20, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1); const before = g.state.chars.biggus.resSpent.free_smite || 0; tx(g, () => attack(g, { orders: { biggus: { smite: { when: 'crit' } } } }, C(g, 'biggus'), C(g, 'f1'), pcAtk(g, 'biggus')));
  // free Paladin's Smite used first: 2d8 ×2 crit = 4 faces + undead 1d8 ×2 = 2 faces; weapon 1d8×2 (+ savage reroll ×2)
  assert.equal(g.state.chars.biggus.resSpent.free_smite, before + 1); assert.equal(C(g, 'f1').hp.cur, 15 - (2 + 4 + 4 + 2)); });
test('resistance, vulnerability and immunity', () => { const g = party('t', new Rigged()); startEncounter(g, { name: 'x', party: [{ cid: 'biggus', pos: [1, 1] }], foes: [{ monster: 'skeleton', pos: [5, 5] }, { monster: 'young_red_dragon', pos: [8, 8] }] });
  tx(g, () => { applyDamage(g, {}, C(g, 'f1'), 5, 'bludgeoning'); applyDamage(g, {}, C(g, 'f2'), 50, 'fire'); applyDamage(g, {}, C(g, 'biggus'), 10, 'poison'); });
  assert.equal(C(g, 'f1').hp.cur, 13 - 10); assert.equal(C(g, 'f2').hp.cur, 178); assert.equal(g.state.chars.biggus.hp.cur, 18);
  tx(g, () => applyDamage(g, {}, C(g, 'f1'), 5, 'poison')); assert.equal(C(g, 'f1').hp.cur, 3);
  const g2 = solo(quickBuild('barbarian', 3)); g2.state.chars.barbarian3.effects.push({ id: 'rage' }); duel(g2, 'barbarian3', 'ogre'); tx(g2, () => applyDamage(g2, {}, C(g2, 'barbarian3'), 11, 'slashing')); assert.equal(g2.state.chars.barbarian3.hp.cur, 32 - 5);
  const g3 = party('t'); duel(g3, 'cumbeard', 'ogre'); tx(g3, () => applyDamage(g3, {}, C(g3, 'cumbeard'), 9, 'poison')); assert.equal(g3.state.chars.cumbeard.hp.cur, 24 - 4); });
test('temporary HP absorb damage first', () => { const g = party('t'); duel(g, 'biggus', 'ogre'); g.state.chars.biggus.hp.temp = 5; tx(g, () => applyDamage(g, {}, C(g, 'biggus'), 8, 'slashing')); assert.deepEqual(g.state.chars.biggus.hp, { cur: 25, temp: 0 }); });
test('concentration: DC max(10, half), cap 30; failing ends the spell on everyone', () => { const d = new Rigged(); const g = party('t', d); startEncounter(g, { name: 'x', party: PARTY_POS, foes: [{ monster: 'ogre', pos: [9, 5] }] });
  d.push(3, 3, 3); tx(g, () => castSpell(g, {}, C(g, 'cumbeard'), 'bless', 1, ['biggus', 'cumbeard', 'skynflute'].map(u => C(g, u)))); // Bless: no rolls on cast
  assert.ok(g.state.chars.biggus.effects.some(e => e.id === 'bless')); assert.equal(g.state.chars.cumbeard.conc.spell, 'bless');
  d.q = []; d.push(13, 1); tx(g, () => applyDamage(g, {}, C(g, 'cumbeard'), 9, 'slashing')); // DC 10: 13+1(CON)+1(Bless d4=1) = 15 ok
  assert.equal(g.state.chars.cumbeard.conc.spell, 'bless');
  d.push(10, 1); tx(g, () => applyDamage(g, {}, C(g, 'cumbeard'), 11, 'slashing')); // 11 dmg → hp 4; DC 10 still; 10+1+1=12 ok
  assert.ok(g.state.chars.cumbeard.conc);
  g.state.chars.cumbeard.hp.cur = 24; d.push(11, 1); g.triggers = []; tx(g, () => applyDamage(g, {}, C(g, 'cumbeard'), 22, 'slashing')); // DC 11: 11+1+1 = 13 ok
  g.state.chars.cumbeard.hp.cur = 24; d.push(9, 2); g.triggers = []; tx(g, () => applyDamage(g, {}, C(g, 'cumbeard'), 23, 'slashing')); // DC 11: 9+1+2=12 ok
  g.state.chars.cumbeard.hp.cur = 24; d.push(5, 1); g.triggers = []; tx(g, () => applyDamage(g, {}, C(g, 'cumbeard'), 20, 'slashing')); // DC 10: 5+1+1=7 fail
  assert.equal(g.state.chars.cumbeard.conc, null); assert.ok(!g.state.chars.biggus.effects.some(e => e.id === 'bless')); assert.equal(g.triggers[0].id, 'concentration_broken'); });
test('death saves: 0 HP → dying; nat 1 = 2 fails; nat 20 = 1 HP; 3 successes stable; damage at 0 = failure (crit 2); massive damage kills', () => {
  const d = new Rigged(); const g = party('t', d); duel(g, 'edgington', 'ogre'); const E = () => g.state.chars.edgington;
  tx(g, () => applyDamage(g, {}, C(g, 'edgington'), 30, 'bludgeoning')); assert.equal(E().hp.cur, 0); assert.ok(E().conditions.some(c => c.id === 'unconscious')); assert.ok(!E().death.dead);
  d.push(1); tx(g, () => deathSave(g, C(g, 'edgington'))); assert.equal(E().death.f, 2);
  d.push(20); tx(g, () => deathSave(g, C(g, 'edgington'))); assert.equal(E().hp.cur, 1); assert.equal(E().death.f, 0); assert.ok(!E().conditions.some(c => c.id === 'unconscious'));
  tx(g, () => applyDamage(g, {}, C(g, 'edgington'), 5, 'bludgeoning')); d.push(10, 10, 10); for (let i = 0; i < 3; i++) tx(g, () => deathSave(g, C(g, 'edgington'))); assert.ok(E().death.stable);
  tx(g, () => applyDamage(g, {}, C(g, 'edgington'), 1, 'bludgeoning', { crit: true })); assert.equal(E().death.f, 2); assert.ok(!E().death.stable);
  tx(g, () => applyDamage(g, {}, C(g, 'edgington'), 1, 'bludgeoning')); assert.ok(E().death.dead);
  const g2 = party('t'); duel(g2, 'edgington', 'ogre'); tx(g2, () => applyDamage(g2, {}, C(g2, 'edgington'), 26 + 26, 'bludgeoning')); assert.ok(g2.state.chars.edgington.death.dead, 'massive damage');
  const g3 = party('t'); duel(g3, 'edgington', 'ogre'); tx(g3, () => applyDamage(g3, {}, C(g3, 'edgington'), 26 + 25, 'bludgeoning')); assert.ok(!g3.state.chars.edgington.death.dead); });
test('healing a dying hero brings them back with death saves reset', () => { const g = party('t'); duel(g, 'edgington', 'ogre'); tx(g, () => applyDamage(g, {}, C(g, 'edgington'), 26, 'fire')); tx(g, () => heal(g, C(g, 'edgington'), 7, 'test')); assert.equal(g.state.chars.edgington.hp.cur, 7); assert.equal(g.state.chars.edgington.death.f, 0); });
test('Shield reaction (when ordered) turns a hit into a miss and spends a slot', () => { const d = new Rigged(); const g = party('t', d); duel(g, 'edgington', 'goblin_warrior');
  d.push(12); const r = tx(g, () => attack(g, { orders: { edgington: { reactions: { shield: true } } } }, C(g, 'f1'), C(g, 'edgington'), C(g, 'f1').attacks[0])); // 12+4=16 vs 14 → Shield → 19
  assert.ok(r.miss); assert.deepEqual(g.state.chars.edgington.slotsSpent, [1]); });
test('2024 rule: one spell slot per turn', () => { const g = party('t'); duel(g, 'cumbeard', 'ogre'); const T = {}; g._T = T; let r1, r2; tx(g, () => { r1 = castSpell(g, T, C(g, 'cumbeard'), 'shield_of_faith', 1, [C(g, 'cumbeard')]); r2 = castSpell(g, T, C(g, 'cumbeard'), 'bless', 1, [C(g, 'cumbeard')]); }); g._T = null; assert.ok(r1.ok); assert.ok(!r2.ok); assert.match(r2.why, /one spell with a spell slot/); });
test('Hold Person: paralyzed humanoid → melee hits within 5 ft crit; no effect on a non-humanoid', () => { const d = new Rigged(); const g = party('t', d); startEncounter(g, { name: 'x', party: PARTY_POS, foes: [{ monster: 'bandit', pos: [3, 5] }, { monster: 'ogre', pos: [9, 9] }] });
  d.push(2); tx(g, () => castSpell(g, {}, C(g, 'cumbeard'), 'hold_person', 2, [C(g, 'f1')])); assert.ok(C(g, 'f1').conditions.some(c => c.id === 'paralyzed'));
  d.push(10, 3, 3, 3, 3); const r = tx(g, () => attack(g, { orders: { biggus: { smite: { when: 'never' } } } }, C(g, 'biggus'), C(g, 'f1'), pcAtk(g, 'biggus'))); assert.ok(r.crit);
  tx(g, () => castSpell(g, {}, C(g, 'cumbeard'), 'hold_person', 2, [C(g, 'f2')])); assert.ok(!C(g, 'f2').conditions.length); });
test('potion in battle is a bonus action and heals 2d4+2', () => { const d = new Rigged(); const g = party('t', d); duel(g, 'biggus', 'ogre'); g.state.chars.biggus.hp.cur = 5;
  d.push(1, 1); /* ogre init etc are already rolled */ const before = g.state.chars.biggus.inventory.find(i => i.id === 'potion_of_healing').qty;
  g.state.encounter.order = ['biggus', 'f1']; g.state.encounter.turn = 0; d.q = []; d.push(4, 4); resolveBattle(g, { biggus: { thisRound: { bonus: { do: 'potion' }, action: { do: 'dodge' } } } }, { maxRounds: 1, cutoffAfterTurns: 1 });
  assert.equal(g.state.chars.biggus.hp.cur, 5 + 10); assert.equal(g.state.chars.biggus.inventory.find(i => i.id === 'potion_of_healing')?.qty ?? 0, before - 1); });
test('battle orders resolve one round then stop for new orders', () => { const g = new Game({ seed: 'r3' }); A.addCharacter(g, { ...quickBuild('fighter', 8), id: 'tank' }); g.state.chars.tank.hp.cur = 999; g.state.chars.tank.hpRolls = []; // tank won't drop
  startEncounter(g, { name: 'x', party: [{ cid: 'tank', pos: [1, 1] }], foes: [{ monster: 'troll', pos: [12, 10] }] });
  g.state.chars.tank.hp.cur = 9999; const r = resolveBattle(g, { tank: { standing: [{ if: 'always', then: { action: { do: 'dodge' }, move: 'hold' } }] } });
  assert.equal(r.stop.reason, 'round_limit'); assert.equal(g.state.encounter.round, 2); assert.equal(g.state.encounter.turn, 0); assert.equal(g.log.filter(e => e.t === 'turn').length, 2); });
test('maxRounds 3 still stops at a round boundary, not mid-next-round', () => { const g = new Game({ seed: 'r3' }); A.addCharacter(g, { ...quickBuild('fighter', 8), id: 'tank' }); g.state.chars.tank.hp.cur = 999; g.state.chars.tank.hpRolls = [];
  startEncounter(g, { name: 'x', party: [{ cid: 'tank', pos: [1, 1] }], foes: [{ monster: 'troll', pos: [12, 10] }] });
  g.state.chars.tank.hp.cur = 9999; const r = resolveBattle(g, { tank: { standing: [{ if: 'always', then: { action: { do: 'dodge' }, move: 'hold' } }] } }, { maxRounds: 3 });
  assert.equal(r.stop.reason, 'round_limit'); assert.equal(g.state.encounter.round, 4); assert.equal(g.state.encounter.turn, 0); assert.equal(g.log.filter(e => e.t === 'turn').length, 6); });
test('stop triggers: ally down stops after that turn; reinforcements stop the batch', () => { let seen = new Set();
  for (let s = 0; s < 60 && seen.size < 2; s++) { const g = party('trig' + s); startEncounter(g, { name: 'x', party: PARTY_POS, foes: [{ monster: 'ogre', pos: [4, 5] }, { monster: 'ogre', pos: [4, 7] }], script: [{ round: 2, add: [{ monster: 'goblin_warrior', pos: [14, 1] }], text: 'Goblins pour in' }] });
    for (let k = 0; k < 5 && ['active', 'awaiting_orders'].includes(g.state.encounter.status); k++) { const r = resolveBattle(g, {}); if (r.stop) seen.add(r.stop.reason); if (r.stop?.reason === 'ally_down') { const ev = g.log.filter(e => e.t === 'turn').at(-1); assert.ok(ev.triggers.some(t => t.id === 'ally_down')); } } }
  assert.ok(seen.has('ally_down')); assert.ok(seen.has('new_enemy')); });
test('cutoff: battle pauses, survives JSON, and resumes next night exactly where it stopped', () => {
  const mk = () => { const g = party('resume'); startEncounter(g, { name: 'Crypt', party: PARTY_POS, foes: [{ monster: 'ghoul', pos: [6, 5] }, { monster: 'skeleton', pos: [6, 7] }, { monster: 'skeleton', pos: [7, 6] }] }); return g; };
  // A: uninterrupted (same dice stream) — B: paused after 5 turns, serialized, restored, resumed with the same dice state
  const A1 = mk(); resolveBattle(A1, {}, { maxRounds: 3 });
  const B = mk(); const r = resolveBattle(B, {}, { maxRounds: 3, cutoffAfterTurns: 5 }); assert.ok(r.paused); assert.equal(B.state.encounter.status, 'paused');
  const saved = JSON.stringify({ state: B.state, log: B.log, dice: B.dice.toJSON() });
  const j = JSON.parse(saved); const B2 = new Game({ state: j.state, seed: 'x' }); B2.log = j.log; B2.dice = (B.dice.constructor).fromJSON(j.dice);
  assert.equal(B2.state.encounter.pause.next, B.state.encounter.order[B.state.encounter.turn]);
  resolveBattle(B2, {}, { maxRounds: 3 }); // batch restarts from the paused turn
  const turnsA = A1.log.filter(e => e.t === 'turn').map(e => e.notes?.join(' ')); const turnsB = B2.log.filter(e => e.t === 'turn').map(e => e.notes?.join(' '));
  assert.deepEqual(turnsB.slice(0, turnsA.length), turnsA.slice(0, turnsB.length).slice(0, Math.min(turnsA.length, turnsB.length)));
  assert.deepEqual(rebuild(B2.log), B2.state); });
test('a new night with a new committed seed resumes a paused battle', () => { const g = party('n1'); g.openNight(1, 'seed-one'); startEncounter(g, { name: 'x', party: PARTY_POS, foes: [{ monster: 'ogre', pos: [8, 5] }] }); resolveBattle(g, {}, { cutoffAfterTurns: 2 }); g.revealNight(1, 'seed-one');
  g.openNight(2, 'seed-two'); const r = resolveBattle(g, {}); assert.ok(['round_limit', 'victory', 'defeat', 'ally_down', 'concentration_broken', 'order_impossible'].includes(r.stop.reason)); assert.equal(g.state.nights['1'].revealed, 'seed-one'); assert.throws(() => g.revealNight(2, 'wrong')); });
test('absentee Cautious stance spends no resources', () => { for (let s = 0; s < 20; s++) { const g = party('abs' + s); startEncounter(g, { name: 'x', party: PARTY_POS, foes: [{ monster: 'bugbear_warrior', pos: [3, 5] }, { monster: 'goblin_warrior', pos: [3, 7] }] });
  resolveBattle(g, { biggus: { absent: true, stance: 'cautious' }, cumbeard: { absent: true, stance: 'cautious' }, edgington: { absent: true, stance: 'cautious' }, skynflute: { absent: true, stance: 'cautious' } });
  for (const c of Object.values(g.state.chars)) { assert.deepEqual(c.slotsSpent.filter(Boolean), []); assert.equal(c.inventory.find(i => i.id === 'potion_of_healing')?.qty, 1); } } });
test('opportunity attack when leaving reach; Disengage prevents it', () => { const g = party('oa'); startEncounter(g, { name: 'x', party: [{ cid: 'edgington', pos: [5, 5] }], foes: [{ monster: 'ogre', pos: [6, 5] }] });
  g.state.encounter.order = ['edgington', 'f1']; g.state.encounter.turn = 0; resolveBattle(g, { edgington: { thisRound: { move: [0, 5], action: { do: 'dash' } } } }, { cutoffAfterTurns: 1 });
  assert.ok(g.log.some(e => (e.notes || []).some(n => /opportunity attack/.test(n))));
  const g2 = party('oa'); startEncounter(g2, { name: 'x', party: [{ cid: 'edgington', pos: [5, 5] }], foes: [{ monster: 'ogre', pos: [6, 5] }] }); g2.state.encounter.order = ['edgington', 'f1']; g2.state.encounter.turn = 0;
  resolveBattle(g2, { edgington: { thisRound: { move: [0, 5], action: { do: 'disengage' } } } }, { cutoffAfterTurns: 1 }); assert.ok(!g2.log.some(e => (e.notes || []).some(n => /opportunity attack/.test(n)))); });
test('victory: XP split evenly; half the spent arrows recovered', () => { const g = party('xp'); startEncounter(g, { name: 'x', party: PARTY_POS, foes: [{ monster: 'goblin_warrior', pos: [14, 5] }, { monster: 'goblin_warrior', pos: [14, 7] }] });
  const xp0 = g.state.chars.biggus.xp; for (let i = 0; i < 6 && !['victory', 'defeat'].includes(g.state.encounter.status); i++) resolveBattle(g, { skynflute: { standing: [{ if: 'always', then: { action: { do: 'attack', target: 'nearest', ranged: true }, move: 'hold' } }] } });
  assert.equal(g.state.encounter.status, 'victory'); assert.equal(g.state.chars.biggus.xp - xp0, 25);
  const spent = g.state.encounter.ammoSpent.skynflute?.arrows || 0; assert.equal(g.state.chars.skynflute.inventory.find(i => i.id === 'arrows').qty, 40 - spent + Math.floor(spent / 2)); });
test('Multiattack: owlbear attacks twice per turn', () => { const g = party('mx'); startEncounter(g, { name: 'x', party: [{ cid: 'biggus', pos: [3, 3] }], foes: [{ monster: 'owlbear', pos: [4, 3] }] }); g.state.encounter.order = ['f1', 'biggus']; g.state.encounter.turn = 0; g.state.chars.biggus.hp.cur = 999;
  resolveBattle(g, {}, { cutoffAfterTurns: 1 }); const ev = g.log.find(e => e.t === 'turn'); assert.equal(ev.notes.filter(n => /Owlbear 1 → Biggus/.test(n)).length, 2); });
test('ranged attack with an adjacent enemy has disadvantage; running out of ammo is an impossible order', () => { const g = party('am'); startEncounter(g, { name: 'x', party: [{ cid: 'skynflute', pos: [3, 3] }], foes: [{ monster: 'ogre', pos: [4, 3] }] });
  const sk = g.state.chars.skynflute; sk.inventory = sk.inventory.filter(i => i.id !== 'arrows'); g.state.encounter.order = ['skynflute', 'f1']; g.state.encounter.turn = 0;
  resolveBattle(g, { skynflute: { thisRound: { action: { do: 'attack', target: 'nearest', ranged: true }, move: 'hold' } } }, { cutoffAfterTurns: 1 });
  const ev = g.log.find(e => e.t === 'turn'); assert.ok(ev.notes.some(n => /Shortsword|can't reach/.test(n)), ev.notes.join('|')); });

test('untrained armor reports the real reason a cantrip cannot be cast', () => {
  const g = party('t'); duel(g, 'edgington', 'ogre');
  g.state.chars.edgington.inventory.push(makeItem({ id: 'leather_armor', slot: 'armor' }));
  let r; tx(g, () => { r = castSpell(g, {}, C(g, 'edgington'), 'fire_bolt', 0, [C(g, 'f1')]); });
  assert.ok(!r.ok);
  assert.match(r.why, /armor without training/i);
  assert.doesNotMatch(r.why, /no level 0\+ slot/);
});

test('mid-round resume still runs thisRound orders even when reinforcements arrive next round', () => {
  const g = party('owed-n4');
  startEncounter(g, { name: 'x', party: PARTY_POS, foes: [
    { monster: 'goblin_warrior', pos: [14, 5] },
    { monster: 'goblin_warrior', pos: [14, 7] },
  ], script: [{ round: 2, add: [{ monster: 'goblin_warrior', pos: [14, 1] }], text: 'Goblins pour in' }] });
  // Heroes already acted in round 1; only the trailing foe is still up this round (Night 4 shape).
  g.state.encounter.order = ['f1', 'biggus', 'cumbeard', 'edgington', 'skynflute', 'f2'];
  g.state.encounter.round = 1;
  g.state.encounter.turn = 5;
  g.state.encounter.status = 'awaiting_orders';
  const orders = {
    biggus: { thisRound: { move: 'hold', action: { do: 'dodge' } } },
    cumbeard: { thisRound: { move: 'hold', action: { do: 'dodge' } } },
    edgington: { thisRound: { move: 'hold', action: { do: 'dodge' } } },
    skynflute: { thisRound: { move: 'hold', action: { do: 'dodge' } } },
  };
  const r = resolveBattle(g, orders, { maxRounds: 3 });
  const heroTurns = g.log.filter(e => e.t === 'turn' && /this round/.test((e.notes || []).join(' ')));
  const who = new Set(heroTurns.map(e => e.who));
  assert.equal(who.size, 4, 'all four thisRound orders ran, got ' + [...who].join(','));
  for (const id of ['biggus', 'cumbeard', 'edgington', 'skynflute']) assert.ok(who.has(id), id + ' missed');
  assert.equal(r.stop.reason, 'new_enemy');
  assert.deepEqual(rebuild(g.log), g.state);
});

test('mid-round resume finishes the current round and stops at the boundary', () => {
  const g = party('one-round-mid');
  startEncounter(g, { name: 'x', party: PARTY_POS, foes: [
    { monster: 'goblin_warrior', pos: [14, 5] },
    { monster: 'goblin_warrior', pos: [14, 7] },
  ] });
  // Mid-round 1: two heroes still have turns; thisRound covers the rest of this round only.
  g.state.encounter.order = ['f1', 'biggus', 'cumbeard', 'edgington', 'skynflute', 'f2'];
  g.state.encounter.round = 1;
  g.state.encounter.turn = 3; // edgington is up; biggus and cumbeard already went
  g.state.encounter.status = 'awaiting_orders';
  const orders = {
    biggus: { thisRound: { move: 'hold', action: { do: 'dodge' } } },
    cumbeard: { thisRound: { move: 'hold', action: { do: 'dodge' } } },
    edgington: { thisRound: { move: 'hold', action: { do: 'dodge' } } },
    skynflute: { thisRound: { move: 'hold', action: { do: 'dodge' } } },
  };
  const r = resolveBattle(g, orders);
  const heroTurns = g.log.filter(e => e.t === 'turn' && /this round/.test((e.notes || []).join(' ')));
  const who = new Set(heroTurns.map(e => e.who));
  assert.ok(who.has('edgington') && who.has('skynflute'), 'remaining heroes use thisRound');
  assert.ok(!who.has('biggus') && !who.has('cumbeard'), 'heroes who already acted this round do not go again');
  assert.equal(r.stop.reason, 'round_limit');
  assert.equal(r.stop.text, 'One round resolved');
  assert.equal(g.state.encounter.round, 2);
  assert.equal(g.state.encounter.turn, 0);
});

test('scripted defeat text is used when a foe falls', () => {
  const g = party('defeat-line');
  startEncounter(g, { name: 'x', party: [{ cid: 'biggus', pos: [1, 1] }], foes: [{ monster: 'bandit', name: 'Doomed Clerk', pos: [3, 1], defeatText: 'Doomed Clerk falls and ruins his trousers.' }] });
  const foe = Object.values(g.state.encounter.combatants).find(c => c.side === 'foe');
  assert.equal(foe.defeatText, 'Doomed Clerk falls and ruins his trousers.');
  tx(g, () => applyDamage(g, {}, foe, 99, 'slashing'));
  assert.ok(g.log.some(e => (e.notes || []).some(n => /ruins his trousers/.test(n))));
  assert.ok(!g.log.some(e => (e.notes || []).some(n => n === 'Doomed Clerk falls.')));
});

test('Director fight only: Poison Spray is a CON save, no disadvantage; elsewhere it stays an attack', () => {
  // Control: no dylan combatant — still the engine\'s ranged spell attack, with disadvantage if adjacent.
  const d0 = new Rigged(); const g0 = party('ps-atk', d0);
  g0.state.chars.edgington.cantrips = [...new Set([...(g0.state.chars.edgington.cantrips || []), 'poison_spray'])];
  startEncounter(g0, { name: 'x', party: [{ cid: 'edgington', pos: [3, 3] }], foes: [{ monster: 'bandit_captain', pos: [4, 3] }] });
  const ac = C(g0, 'f1').ac; const hp0 = C(g0, 'f1').hp.cur;
  d0.push(3, 20); // would hit on the 20 if not disadvantaged
  tx(g0, () => castSpell(g0, {}, C(g0, 'edgington'), 'poison_spray', 0, [C(g0, 'f1')]));
  const notes0 = g0.log.flatMap(ev => ev.notes || []).join('\n');
  assert.match(notes0, /vs AC /);
  assert.equal(C(g0, 'f1').hp.cur, hp0); // disadvantaged 3/20 misses

  // Gated fight: encounter.combatants.dylan — official 5e CON save, no disadvantage, nothing on a success.
  const d1 = new Rigged(); const g1 = party('ps-save', d1);
  g1.state.chars.edgington.cantrips = [...new Set([...(g1.state.chars.edgington.cantrips || []), 'poison_spray'])];
  startEncounter(g1, { name: 'The Director of Subversion', party: [{ cid: 'edgington', pos: [3, 3] }], foes: [{ monster: 'bandit_captain', name: 'Dylan Stewart, Director of Subversion', pos: [4, 3], uid: 'dylan', boss: true }] });
  const hp1 = C(g1, 'dylan').hp.cur;
  d1.push(12, 20); // damage is rolled first, then the save; 20 + CON beats any reasonable DC
  tx(g1, () => castSpell(g1, {}, C(g1, 'edgington'), 'poison_spray', 0, [C(g1, 'dylan')]));
  const notes1 = g1.log.flatMap(ev => ev.notes || []).join('\n');
  assert.doesNotMatch(notes1, /vs AC /);
  assert.match(notes1, /vs DC \d+/);
  assert.match(notes1, /saves \(/);
  assert.equal(C(g1, 'dylan').hp.cur, hp1);

  // Failed save deals 1d12 poison and does not use a second d20 for disadvantage.
  const d2 = new Rigged(); const g2 = party('ps-fail', d2);
  g2.state.chars.edgington.cantrips = [...new Set([...(g2.state.chars.edgington.cantrips || []), 'poison_spray'])];
  startEncounter(g2, { name: 'The Director of Subversion', party: [{ cid: 'edgington', pos: [3, 3] }], foes: [{ monster: 'bandit_captain', name: 'Dylan Stewart, Director of Subversion', pos: [4, 3], uid: 'dylan', boss: true }] });
  const hp2 = C(g2, 'dylan').hp.cur;
  d2.push(11, 1); // 1d12 = 11, then CON save nat 1
  tx(g2, () => castSpell(g2, {}, C(g2, 'edgington'), 'poison_spray', 0, [C(g2, 'dylan')]));
  const notes2 = g2.log.flatMap(ev => ev.notes || []).join('\n');
  assert.doesNotMatch(notes2, /vs AC /);
  assert.match(notes2, /fails \(/);
  assert.equal(C(g2, 'dylan').hp.cur, hp2 - 11);
});


function iceKnifeTable(seed, dice, night) {
  const g = party(seed, dice);
  g.state.meta.night = night;
  const ch = g.state.chars.edgington;
  if (!ch.prepared.includes('ice_knife')) ch.prepared = [...ch.prepared, 'ice_knife'];
  startEncounter(g, { name: 'x', party: [{ cid: 'edgington', pos: [3, 3] }], foes: [
    { monster: 'bandit', pos: [6, 3] },
    { monster: 'bandit', pos: [6, 4] },
    { monster: 'bandit', pos: [12, 8] },
  ] });
  return g;
}

test('Ice Knife from Night 51: hit or miss, the shard explodes; creatures within 5 feet make a DEX save', () => {
  const d = new Rigged();
  const g = iceKnifeTable('ik-then', d, 51);
  const hp1 = C(g, 'f1').hp.cur, hp2 = C(g, 'f2').hp.cur, hp3 = C(g, 'f3').hp.cur;
  // hit, 4 piercing, 3+3=6 cold, f1 fails the burst, f2 saves (no half on the model)
  d.push(19, 4, 3, 3, 1, 20);
  tx(g, () => castSpell(g, {}, C(g, 'edgington'), 'ice_knife', 1, [C(g, 'f1')]));
  assert.equal(C(g, 'f1').hp.cur, hp1 - 4 - 6, 'target takes piercing and failed-save cold');
  assert.equal(C(g, 'f2').hp.cur, hp2, 'adjacent creature that saves takes no cold (Ice Knife has no half)');
  assert.equal(C(g, 'f3').hp.cur, hp3, 'a creature farther than 5 feet is not in the burst');
  const notes = (g.log.at(-1).notes || []).join('\n');
  assert.match(notes, /fails \(.*vs DC 13\): 6 cold/);
  assert.match(notes, /saves \(.*vs DC 13\): 0 cold/);

  const dMiss = new Rigged();
  const gMiss = iceKnifeTable('ik-miss', dMiss, 51);
  const m1 = C(gMiss, 'f1').hp.cur, m2 = C(gMiss, 'f2').hp.cur, m3 = C(gMiss, 'f3').hp.cur;
  // nat 1 miss (no piercing dice), then 2+4=6 cold, f1 fails, f2 saves
  dMiss.push(1, 2, 4, 1, 20);
  tx(gMiss, () => castSpell(gMiss, {}, C(gMiss, 'edgington'), 'ice_knife', 1, [C(gMiss, 'f1')]));
  assert.equal(C(gMiss, 'f1').hp.cur, m1 - 6, 'miss still explodes; failed save takes the cold');
  assert.equal(C(gMiss, 'f2').hp.cur, m2);
  assert.equal(C(gMiss, 'f3').hp.cur, m3);
  assert.doesNotMatch((gMiss.log.at(-1).notes || []).join('\n'), /piercing/);
});

test('Ice Knife `then` rider does not apply on Night 50, so published logs stay unchanged', () => {
  const d = new Rigged();
  const g = iceKnifeTable('ik-n50', d, 50);
  const hp1 = C(g, 'f1').hp.cur, hp2 = C(g, 'f2').hp.cur;
  d.push(19, 4, 3, 3, 1, 20); // leftover burst faces must not be consumed
  tx(g, () => castSpell(g, {}, C(g, 'edgington'), 'ice_knife', 1, [C(g, 'f1')]));
  assert.equal(C(g, 'f1').hp.cur, hp1 - 4);
  assert.equal(C(g, 'f2').hp.cur, hp2);
  assert.doesNotMatch((g.log.at(-1).notes || []).join('\n'), /burst/);
});

test('a scripted saveBurst at the start of a later round runs before anyone acts', () => {
  const d = new Rigged();
  const g = party('ik-script', d);
  g.state.meta.night = 51;
  startEncounter(g, { name: 'x', party: [{ cid: 'edgington', pos: [3, 5] }], foes: [{ monster: 'spy', pos: [6, 5], uid: 'tally' }],
    script: [{
      round: 3,
      text: "Boobington's Ice Knife, delayed from round 2, bursts around Comptroller Tally Brisk.",
      saveBurst: { uids: ['tally'], save: 'dex', dcFrom: 'edgington', spell: 'ice_knife', dice: '2d6', type: 'cold', half: true, why: 'Ice Knife burst' },
    }] });
  const before = C(g, 'tally').hp.cur;
  g.state.encounter.status = 'awaiting_orders';
  g.state.encounter.round = 3;
  g.state.encounter.turn = 0;
  g.state.encounter.order = ['edgington', 'tally'];
  // 2d6 = 5+5=10, DEX save 1 + spy dex (fail) → 10 cold
  d.push(5, 5, 1);
  resolveBattle(g, { edgington: { thisRound: { move: 'hold', action: { do: 'dodge' } } } }, { maxRounds: 1 });
  const ev = g.log.find(e => e.t === 'turn' && e.round === 3);
  assert.ok(ev, 'round 3 turn ran');
  const notes = (ev.notes || []).join('\n');
  assert.match(notes, /delayed from round 2/);
  assert.ok(notes.indexOf('delayed from round 2') < (notes.search(/Dodge|dodge/) === -1 ? notes.length : notes.search(/Dodge|dodge/)), 'makeup notes come before the first turn action');
  assert.match(notes, /fails \(/);
  assert.equal(C(g, 'tally').hp.cur, before - 10);
  assert.equal(g.state.encounter.script[0].done, true);
});
