import { test } from 'node:test'; import assert from 'node:assert/strict';
import { deriveSheet, rebuild } from '../src/index.js';
import * as N from '../src/night.js';
import { attack, castSpell, takeTurn, resolveBattle, combatant } from '../src/combat.js';
import { spellModel } from '../src/rules/spellEffects.js';
import { actionSpells, bonusSpells, smiteSpells, bonusFeatures, actionFeatures, canSacredWeapon } from '../src/orders.js';
import { Rigged, party, duel, solo, quickBuild } from './helpers.js';

const tx = (g, fn) => { g.begin('test'); try { return fn(); } finally { g.end(); } };
const C = (g, u) => g.state.encounter.combatants[u];
const pcAtk = (g, cid, i = 0) => deriveSheet(g.state.chars[cid]).attacks[i];
const ids = list => list.map(x => x.id || x.do);

test('Shield of Faith and Dragon’s Breath are bonus-action models', () => {
  assert.equal(spellModel('shield_of_faith').bonusAction, true);
  assert.equal(spellModel('dragons_breath').bonusAction, true);
  assert.equal(spellModel('healing_word').bonusAction, true);
  assert.equal(spellModel('divine_smite').kind, 'smite');
  assert.equal(spellModel('searing_smite').kind, 'smite');
});

test('paladin orders list Shield of Faith as a bonus and smites as on-hit riders, not as the Action', () => {
  const g = party('opts'); const c = g.state.chars.biggus; c.prepared = [...c.prepared, 'searing_smite'];
  const s = deriveSheet(c);
  const acts = ids(actionSpells(c, s));
  const bonus = ids(bonusSpells(c, s));
  const smites = smiteSpells(c, s);
  assert.ok(acts.includes('bless') && acts.includes('command') && acts.includes('heroism'));
  assert.ok(!acts.includes('shield_of_faith') && !acts.includes('divine_smite') && !acts.includes('searing_smite'));
  assert.ok(bonus.includes('shield_of_faith'));
  assert.ok(!bonus.includes('divine_smite') && !bonus.includes('searing_smite'));
  assert.deepEqual(smites.map(x => x.id).sort(), ['divine_smite', 'searing_smite']);
  assert.ok(smites.find(x => x.id === 'divine_smite').free);
  assert.ok(actionFeatures(c, s).some(f => f.do === 'lay_on_hands'));
  assert.ok(canSacredWeapon(c, s));
});

test('other classes see their legal bonus spells and features', () => {
  const g = party('opts2');
  const cleric = deriveSheet(g.state.chars.cumbeard);
  const cBonus = ids(bonusSpells(g.state.chars.cumbeard, cleric));
  const cActs = ids(actionSpells(g.state.chars.cumbeard, cleric));
  assert.ok(cBonus.includes('healing_word') && cBonus.includes('shield_of_faith') && cBonus.includes('spiritual_weapon'));
  assert.ok(!cActs.includes('healing_word') && !cActs.includes('shield_of_faith') && !cActs.includes('spiritual_weapon'));
  assert.ok(cActs.includes('guiding_bolt'));

  const ranger = deriveSheet(g.state.chars.skynflute);
  assert.ok(ids(bonusSpells(g.state.chars.skynflute, ranger)).includes('hunters_mark'));
  assert.ok(!ids(bonusSpells(g.state.chars.skynflute, ranger)).includes('ensnaring_strike'));

  const sorc = deriveSheet(g.state.chars.edgington);
  assert.ok(bonusFeatures(g.state.chars.edgington, sorc).some(f => f.do === 'innate_sorcery'));
  assert.ok(!ids(bonusSpells(g.state.chars.edgington, sorc)).includes('misty_step'));

  const fighter = solo(quickBuild('fighter', 3));
  const fid = Object.keys(fighter.state.chars)[0];
  assert.ok(bonusFeatures(fighter.state.chars[fid], deriveSheet(fighter.state.chars[fid])).some(f => f.do === 'second_wind'));

  const bard = solo(quickBuild('bard', 3));
  const bid = Object.keys(bard.state.chars)[0];
  assert.ok(bonusFeatures(bard.state.chars[bid], deriveSheet(bard.state.chars[bid])).some(f => f.do === 'bardic_inspiration'));
});

test('Shield of Faith as a bonus action with Attack grants +2 AC and ends Bless', () => {
  const d = new Rigged(); const g = party('sof', d); duel(g, 'biggus', 'goblin_warrior');
  const ac0 = deriveSheet(g.state.chars.biggus).ac.v;
  tx(g, () => castSpell(g, {}, C(g, 'biggus'), 'bless', 1, [C(g, 'biggus')]));
  assert.equal(g.state.chars.biggus.conc.spell, 'bless');
  g.state.encounter.order = ['biggus', 'f1']; g.state.encounter.turn = 0;
  d.q = []; d.push(18, 4, 4, 4, 4, 4, 4, 4, 4, 18, 4, 4, 4, 4);
  resolveBattle(g, { biggus: { thisRound: { bonus: { do: 'cast', spell: 'shield_of_faith', target: 'self' }, action: { do: 'attack', target: 'nearest' } }, smite: { when: 'never' } } }, { cutoffAfterTurns: 1 });
  assert.equal(g.state.chars.biggus.conc.spell, 'shield_of_faith');
  assert.ok(g.state.chars.biggus.effects.some(e => e.id === 'shield_of_faith'));
  assert.ok(!g.state.chars.biggus.effects.some(e => e.id === 'bless'));
  assert.equal(deriveSheet(g.state.chars.biggus).ac.v, ac0 + 2);
});

test('Searing Smite on a hit deals fire, spends a slot, and burns at the start of the target’s turn', () => {
  const d = new Rigged(); const g = party('sear', d); duel(g, 'biggus', 'ogre');
  g.state.chars.biggus.prepared = [...g.state.chars.biggus.prepared, 'searing_smite'];
  const slots0 = g.state.chars.biggus.slotsSpent[0] || 0;
  const free0 = g.state.chars.biggus.resSpent.free_smite || 0;
  const hp0 = C(g, 'f1').hp.cur;
  d.q = []; d.push(18, 4, 3, 4, 4, 4, 4); // hit, weapon, searing 3 fire (maybe savage)
  const r = tx(g, () => attack(g, { orders: { biggus: { smite: { when: 'always', spell: 'searing_smite' } } } }, C(g, 'biggus'), C(g, 'f1'), pcAtk(g, 'biggus')));
  assert.ok(r.hit);
  assert.equal(g.state.chars.biggus.slotsSpent[0] || 0, slots0 + 1);
  assert.equal(g.state.chars.biggus.resSpent.free_smite || 0, free0);
  assert.ok(C(g, 'f1').effects?.some(e => e.id === 'searing_smite'));
  const afterHit = C(g, 'f1').hp.cur;
  assert.ok(afterHit < hp0);
  g.state.encounter.order = ['f1', 'biggus']; g.state.encounter.turn = 0;
  const burnHp = C(g, 'f1').hp.cur;
  d.q = []; d.push(2, 1); // 2 fire, CON 1 fail (ogre may have +mod)
  takeTurn(g, 'f1', {});
  assert.equal(C(g, 'f1').hp.cur, burnHp - 2);
  assert.ok(C(g, 'f1').effects?.some(e => e.id === 'searing_smite'), 'failed save keeps the burn');
});

test('a bonus-action Shield of Faith uses the bonus, so a smite will not go off the same turn', () => {
  const d = new Rigged(); const g = party('both', d); duel(g, 'biggus', 'ogre');
  const slots0 = [...(g.state.chars.biggus.slotsSpent || [])];
  const free0 = g.state.chars.biggus.resSpent.free_smite || 0;
  g.state.encounter.order = ['biggus', 'f1']; g.state.encounter.turn = 0;
  d.q = []; d.push(18, 4, 4, 4, 4, 4, 4, 4, 4, 18, 4, 4, 4, 4);
  resolveBattle(g, { biggus: { thisRound: { bonus: { do: 'cast', spell: 'shield_of_faith', target: 'self' }, action: { do: 'attack', target: 'nearest' } }, smite: { when: 'always', spell: 'divine_smite' } } }, { cutoffAfterTurns: 1 });
  assert.ok(g.state.chars.biggus.effects.some(e => e.id === 'shield_of_faith'));
  assert.equal(g.state.chars.biggus.resSpent.free_smite || 0, free0);
  assert.equal((g.state.chars.biggus.slotsSpent[0] || 0) - (slots0[0] || 0), 1);
});


test('combat write-ins map to a slot and a legal 5e action', () => {
  assert.deepEqual(N.mapCombatWriteIn('I shove the clerk into the ditch').do, 'shove');
  assert.equal(N.mapCombatWriteIn('I shove the clerk into the ditch').skill, 'athletics');
  assert.equal(N.mapCombatWriteIn('I shove the clerk into the ditch').slot, 'action');
  assert.equal(N.mapCombatWriteIn('I grapple the rider').do, 'grapple');
  assert.equal(N.mapCombatWriteIn('I hide in the weeds').do, 'hide');
  assert.equal(N.mapCombatWriteIn('I take the Dodge action').do, 'dodge');
  assert.equal(N.mapCombatWriteIn('I help Gorlock').do, 'help');
  assert.equal(N.mapCombatWriteIn('I drink a potion as a bonus action').slot, 'bonus');
  assert.equal(N.mapCombatWriteIn('I drink a potion as a bonus action').do, 'potion');
  assert.equal(N.mapCombatWriteIn('As a move I hold position').slot, 'move');
  assert.equal(N.mapCombatWriteIn('I climb the wagon').do, 'check');
  assert.equal(N.mapCombatWriteIn('I climb the wagon').skill, 'athletics');
});

test('planNight on a battle keeps orders and attaches a write-in with a default v3 DC', () => {
  const scene = { n: 40, id: 'a1n27', battle: true, freeDc: 14, dcScale: 3, moves: [] };
  const players = [{ pid: 'p1', cid: 'biggus', name: 'Biggus' }];
  const plan = N.planNight(scene, { p1: { locked: true, kind: 'orders', orders: { thisRound: { action: { do: 'attack', target: 'nearest' } } }, text: 'I shove the clerk prone' } }, players);
  const e = plan.entries[0];
  assert.equal(e.kind, 'orders');
  assert.equal(e.orders.thisRound.action.do, 'attack', 'locked Action is kept on the plan; apply happens at resolve');
  assert.equal(e.text, 'I shove the clerk prone');
  assert.equal(e.writeIn.do, 'shove');
  assert.equal(e.check.skill, 'athletics');
  assert.equal(e.check.dc, 11);
  assert.equal(e.dcCall.word, 'Medium');
  assert.deepEqual(N.checkDcCalls(plan.entries, 3), []);
  const plain = N.planNight(scene, { p1: { locked: true, kind: 'orders', orders: { thisRound: { action: { do: 'attack', target: 'nearest' } } } } }, players);
  assert.ok(!plain.entries[0].text && !plain.entries[0].check);
});

test('a shove write-in replaces the Attack, rolls on the called DC, and can knock the target Prone', () => {
  const d = new Rigged(); const g = party('shove', d); duel(g, 'biggus', 'ogre');
  g.state.encounter.order = ['biggus', 'f1']; g.state.encounter.turn = 0;
  g.initial = JSON.parse(JSON.stringify(g.state)); g.log = [];
  const scene = { n: 99, id: 't', battle: true, freeDc: 14, dcScale: 3, moves: [], after: { effects: [] } };
  const seed = 'shove-seed';
  N.openNight(g, scene, { seed, dateISO: '2026-11-24' });
  g.dice = d; d.q = []; d.push(18, 1, 1, 1, 1, 1, 1, 1, 1, 1);
  const players = [{ pid: 'p1', cid: 'biggus', name: 'Biggus Dickus' }];
  const plan = N.planNight(scene, { p1: { locked: true, kind: 'orders', orders: { thisRound: { action: { do: 'attack', target: 'nearest' } }, smite: { when: 'never' } }, text: 'I shove him to the ground' } }, players);
  const r = N.resolveNight(g, scene, plan, { seed });
  const row = r.entries[0];
  assert.equal(row.writeIn.do, 'shove');
  assert.ok(row.check, 'check is recorded on the result for verify and nat-20 payoffs');
  assert.equal(row.check.skill, 'athletics');
  assert.equal(row.check.dc, 11);
  assert.equal(row.check.nat, 18);
  assert.ok(row.check.ok);
  assert.ok(C(g, 'f1').conditions?.some(c => c.id === 'prone'), 'successful shove knocks the target Prone');
  assert.ok((r.battle.lines || []).some(l => /shoves/i.test(l) || /Athletics/i.test(l)));
  const replayed = rebuild(g.log, g.initial);
  assert.deepEqual(replayed, g.state);
});

test('a bonus-action write-in leaves the Attack in place; Dodge write-in needs no DC call', () => {
  const attack = { thisRound: { action: { do: 'attack', target: 'nearest' } } };
  const bonus = N.applyCombatWriteIn(attack, { text: 'I drink a potion as a bonus action', writeIn: { slot: 'bonus', do: 'potion' }, mapped: { slot: 'bonus', do: 'potion' } });
  assert.equal(bonus.thisRound.action.do, 'attack');
  assert.equal(bonus.thisRound.bonus.do, 'potion');
  const dodge = N.applyCombatWriteIn(attack, { text: 'I dodge', writeIn: { slot: 'action', do: 'dodge' }, mapped: { slot: 'action', do: 'dodge', needsCheck: false } });
  assert.equal(dodge.thisRound.action.do, 'dodge');
  const unruled = N.applyCombatWriteIn(attack, { text: 'I flip the satchel into the ditch', mapped: { slot: 'action', do: 'check', needsCheck: true } });
  assert.equal(unruled.thisRound.action.do, 'attack');
  assert.ok(unruled.writeInUnruled);
});
