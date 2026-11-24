import { test } from 'node:test'; import assert from 'node:assert/strict';
import { deriveSheet } from '../src/index.js';
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
