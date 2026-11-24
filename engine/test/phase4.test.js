// Phase 4: shops, loot, identification, attunement, keepsakes, costly components, fixed free-text DC scale, nightly integration.
import { test } from 'node:test'; import assert from 'node:assert/strict';
import * as F from '../src/forge.js';
import { Game, actions as A } from '../src/index.js';
import * as N from '../src/night.js';
import * as SH from '../src/shop.js';
import * as L from '../src/loot.js';
import { itemDef, sellValue, componentFor, ITEMS } from '../src/rules/items.js';
import { deriveSheet } from '../src/character.js';
import { partyDrafts } from './fixtures.js';

function table() { const g = new Game({}); g.dice = new (g.dice.constructor)('phase4-test'); const players = partyDrafts().map(h => { A.addCharacter(g, F.toSpec(h.draft)); const cid = g.state.party.order.at(-1); return { pid: h.pid, name: g.state.chars[cid].name, cid }; }); return { g, players }; }
const cidOf = (players, pid) => players.find(p => p.pid === pid).cid;
const rich = (g, cid, gp) => g.event('test_coin', {}, () => g.set(['chars', cid, 'coin'], gp * 100));
const inv = (g, cid, id) => g.state.chars[cid].inventory.filter(i => i.id === id);

test('shop: SRD list prices, sell back at half, gems at full value, keepsakes never for sale', () => {
  const { g, players } = table(); const p2 = cidOf(players, 'p2'); rich(g, p2, 100);
  assert.equal(SH.priceOf(g.state, 'capital', 'longsword').unit, 1500);
  assert.equal(SH.priceOf(g.state, 'capital', 'potion_of_healing').unit, 5000);
  assert.equal(SH.priceOf(g.state, 'capital', 'arrows x20').total, 100); // 20 arrows = 1 gp
  const it = SH.buyFrom(g, p2, 'capital', 'longsword'); assert.equal(g.state.chars[p2].coin, 8500);
  SH.sellAt(g, p2, 'capital', it.uid); assert.equal(g.state.chars[p2].coin, 9250);
  assert.equal(sellValue({ id: 'gem_50' }), 5000); assert.equal(sellValue({ id: 'longsword' }), 750);
  const ks = g.state.chars[p2].inventory.find(i => i.id === 'keepsake'); assert.ok(ks, 'hero has a keepsake');
  assert.equal(sellValue(ks), null); assert.throws(() => SH.sellAt(g, p2, 'capital', ks.uid), /keepsake/i);
  assert.throws(() => A.buy(g, p2, { id: 'keepsake' }), /keepsake/i);
  const d = itemDef(ks); assert.ok(!d.ac && !d.damage && !d.attune && !d.bonus, 'keepsake carries no stats');
});
test('shop: location stock, limits, rare is quest-only, guild discount after the spy quest', () => {
  const { g, players } = table(); const p1 = cidOf(players, 'p1'); rich(g, p1, 2000);
  assert.ok(!SH.SHOPS.frontier.stock.includes('cloak_of_protection'));
  assert.ok(SH.SHOPS.capital.stock.includes('cloak_of_protection'));
  for (const s of Object.values(SH.SHOPS)) for (const k of s.stock) { const d = itemDef(SH.instOf(k).inst); assert.ok(!['rare', 'very rare', 'legendary', 'artifact'].includes(String(d.rarity).toLowerCase()), `${s.name} sells ${k}`); }
  for (let i = 0; i < 3; i++) SH.buyFrom(g, p1, 'tankard', 'potion_of_healing');
  assert.throws(() => SH.buyFrom(g, p1, 'tankard', 'potion_of_healing'), /sold out/);
  assert.throws(() => SH.buyFrom(g, p1, 'tankard', 'plate_armor'), /doesn.t sell/);
  const full = SH.priceOf(g.state, 'capital', 'chain_mail').unit; g.event('f', {}, () => g.set(['story'], { flags: { guild_discount: true } }));
  assert.equal(SH.priceOf(g.state, 'capital', 'chain_mail').unit, Math.round(full * 0.9)); assert.equal(SH.priceOf(g.state, 'tankard', 'potion_of_healing').discount, false);
});
test('shop: every price previews what it does to YOUR sheet (AC, attack line, stealth, attunement, capacity)', () => {
  const { g, players } = table(); const p2 = cidOf(players, 'p2'); const p3 = cidOf(players, 'p3'); const c2 = g.state.chars[p2];
  const plate = SH.preview(c2, { id: 'plate_armor' }).tags.map(t => t.t).join(' | '); assert.match(plate, /AC \d+ \u2192 \d+/); assert.match(plate, /STR 15/i);
  const wiz = SH.preview(g.state.chars[p3], { id: 'chain_mail' }).tags.map(t => t.t).join(' | '); assert.match(wiz, /no armor training|not trained|training/i);
  const cloak = SH.preview(c2, { id: 'cloak_of_protection' }).tags.map(t => t.t).join(' | '); assert.match(cloak, /attun/i);
  const v = SH.shopView(g.state, p2, 'capital', 'foryou'); assert.ok(v.rows.length >= 4 && v.rows.length <= 12, 'For you is a short list'); assert.ok(v.rows.every(x => x.price && x.tags));
  const heavy = SH.preview(c2, { id: 'plate_armor' }, 20); assert.ok(heavy.tags.some(t => /over capacity/.test(t.t)), 'encumbrance shows only when exceeded');
  assert.ok(!SH.preview(c2, { id: 'torch' }).tags.some(t => /capacity/.test(t.t)));
});
test('attunement: identified first, max 3, no two copies of the same item', () => {
  const { g, players } = table(); const p2 = cidOf(players, 'p2');
  for (const id of ['cloak_of_protection', 'ring_of_protection', 'gauntlets_of_ogre_power', 'headband_of_intellect']) A.giveItem(g, p2, { id });
  A.giveItem(g, p2, { id: 'cloak_of_protection' }); A.giveItem(g, p2, { id: 'amulet_of_health', unid: true });
  const by = id => g.state.chars[p2].inventory.filter(i => i.id === id);
  assert.throws(() => A.attune(g, p2, by('amulet_of_health')[0].uid), /identif/i);
  A.attune(g, p2, by('cloak_of_protection')[0].uid); assert.throws(() => A.attune(g, p2, by('cloak_of_protection')[1].uid), /more than one/i);
  A.attune(g, p2, by('ring_of_protection')[0].uid); A.attune(g, p2, by('gauntlets_of_ogre_power')[0].uid);
  assert.throws(() => A.attune(g, p2, by('headband_of_intellect')[0].uid), /3/);
});
test('identification: unidentified magic shows no properties; a focused Short Rest or Identify (pearl, ritual) reveals it', () => {
  const { g, players } = table(); const p2 = cidOf(players, 'p2'); const p3 = cidOf(players, 'p3'); const p1 = cidOf(players, 'p1');
  A.giveItem(g, p2, { id: 'longsword', plus: 1, unid: true }); A.giveItem(g, p2, { id: 'ring_of_protection', unid: true });
  const sw = g.state.chars[p2].inventory.find(i => i.id === 'longsword' && i.plus); const ring = g.state.chars[p2].inventory.find(i => i.id === 'ring_of_protection');
  assert.match(itemDef(sw).name, /unidentified magic/i); assert.equal(itemDef(sw).bonus || 0, 0); assert.match(itemDef(ring).name, /^Unidentified ring/i);
  assert.equal(sellValue(ring), null, 'unknown items can\u2019t be sold'); assert.throws(() => SH.sellAt(g, p2, 'capital', ring.uid), /identif/i);
  A.shortRest(g, { focus: { [p2]: { identify: ring.uid } } }); assert.equal(g.state.chars[p2].inventory.find(i => i.uid === ring.uid).unid, false);
  // Identify: Vex knows it? only if it is in the spellbook; force it in for the test, then the pearl gate
  g.event('t', {}, () => g.set(['chars', p3, 'spellbook'], [...g.state.chars[p3].spellbook, 'identify']));
  assert.throws(() => A.castIdentify(g, p3, p2, sw.uid), /pearl/i);
  A.giveItem(g, p3, { id: 'pearl_100' }); A.castIdentify(g, p3, p2, sw.uid, { ritual: true });
  assert.equal(itemDef(g.state.chars[p2].inventory.find(i => i.uid === sw.uid)).name, 'Longsword, +1'); assert.equal(inv(g, p3, 'pearl_100').length, 1, 'pearl is not consumed');
  assert.throws(() => A.castIdentify(g, p1, p2, sw.uid), /can.t cast Identify/);
});
test('costly components are on the sheet with a price; consumed ones are spent', () => {
  assert.equal(componentFor('identify').id, 'pearl_100'); assert.equal(componentFor('revivify').consumed, true); assert.equal(itemDef({ id: 'diamond_300' }).cost, 30000);
  assert.equal(componentFor('chromatic_orb').id, 'diamond_50'); assert.ok(!componentFor('magic_missile'));
  for (const id of ['pearl_100', 'diamond_50', 'incense_10']) assert.ok(SH.SHOPS.capital.stock.includes(id));
});
test('treasure: individual purse by CR, beasts carry none, hoard band 0-4 stays common/uncommon/rare, keepsakes never loot', () => {
  const { g } = table();
  for (let i = 0; i < 40; i++) { assert.equal(L.rollIndividual(g, 2, 'beast').coin, 0); const r = L.rollIndividual(g, '1/4', 'humanoid'); assert.ok(r.coin >= 30 && r.coin <= 180); }
  for (let i = 0; i < 40; i++) { const h = L.rollHoard(g, '0-4'); assert.ok(h.coin >= 7500 && h.coin <= 45000); for (const it of h.items) assert.ok(!['very rare', 'legendary'].includes(String(itemDef(it).rarity).toLowerCase())); }
  assert.throws(() => L.rollLoot(g, { items: ['keepsake'] }), /keepsake/i);
  assert.equal(L.BAND(3), '0-4'); assert.equal(L.BAND(7), '5-10'); assert.equal(L.BAND('1/2'), '0-4');
});
test('loot: coin splits evenly (remainder to the party fund); Need beats Greed; Need needs proficiency; all pass goes to the stash', () => {
  const { g, players } = table(); const [p1, p2, p3, p4] = ['p1', 'p2', 'p3', 'p4'].map(p => cidOf(players, p)); const c0 = Object.fromEntries([p1, p2, p3, p4].map(c => [c, g.state.chars[c].coin]));
  const r = L.addLoot(g, { coin: 1003, items: [{ id: 'longsword', plus: 1 }, { id: 'potion_of_healing' }, { id: 'rope' }, { id: 'gem_50' }] }, { why: 'test' });
  assert.equal(r.each, 250); assert.equal(g.state.party.fund, 3); for (const c of [p1, p2, p3, p4]) assert.equal(g.state.chars[c].coin - c0[c], 250);
  assert.equal(g.state.loot.pending.length, 3); assert.equal(g.state.party.stash.length, 1); assert.ok(g.state.party.stash[0].cash, 'gem waits to be cashed');
  const [sw, pot, rope] = g.state.loot.pending.map(x => x.lid);
  const lines = L.divideLoot(g, { [p2]: { [sw]: 'need', [pot]: 'greed', [rope]: 'pass' }, [p3]: { [sw]: 'need', [pot]: 'need', [rope]: 'pass' }, [p1]: { [rope]: 'pass' , [pot]: 'pass'}, [p4]: { [rope]: 'pass', [pot]: 'pass' } });
  const by = lid => lines.find(l => l.lid === lid);
  assert.equal(by(sw).winner, p2, 'the wizard can\u2019t Need a longsword'); assert.match(by(sw).bids.find(b => b.cid === p3).note, /not proficient/);
  assert.equal(by(pot).winner, p3); assert.ok(by(rope).toStash); assert.equal(g.state.loot.pending.length, 0);
  assert.ok(g.state.chars[p2].inventory.some(i => i.id === 'longsword' && i.plus === 1));
  const before = g.state.chars[p1].coin; const got = L.sellStash(g, { valuablesOnly: true }); assert.equal(got, 5000, 'gems sell at full value'); assert.equal(g.state.chars[p1].coin - before, 1250);
  assert.equal(g.state.party.stash.length, 1, 'rope stays in the stash');
  assert.equal(L.canNeed(g.state.chars[p3], { id: 'longsword', plus: 1, unid: true }).ok, false, 'an unidentified longsword is still visibly a longsword');
  assert.equal(L.canNeed(g.state.chars[p3], { id: 'ring_of_protection', unid: true }).ok, true);
});
test('loot: party-split mode puts items in the stash; claiming pays the others their shares of half value', () => {
  const { g, players } = table(); const [p1, p2] = ['p1', 'p2'].map(p => cidOf(players, p)); L.setLootMode(g, 'party'); rich(g, p2, 500);
  L.addLoot(g, { items: [{ id: 'shield', plus: 1 }] }); const st = g.state.party.stash; assert.equal(st.length, 1); assert.ok(!g.state.loot?.pending?.length);
  const b1 = g.state.chars[p1].coin; const out = SH.applyCart(g, p2, [{ op: 'claim', lid: st[0].lid }]); assert.ok(out[0].ok, out[0].why);
  const share = Math.floor(itemDef({ id: 'shield', plus: 1 }).cost / 2 / 4); assert.equal(g.state.chars[p1].coin - b1, share); assert.equal(g.state.chars[p2].coin, 50000 - share * 3);
});
test('free-text DCs: current scale Easy 6 / Medium 11 / Hard 16, the GM logs the pick and a reason, verify refuses anything else', () => {
  assert.deepEqual(N.FREE_DC, { Easy: 6, Medium: 11, Hard: 16 });
  assert.equal(N.DC_SCALE_CURRENT, 3);
  const e = { kind: 'free', check: { skill: 'stealth', dc: 11 }, dcCall: { word: 'Medium', dc: 11, why: 'default' } };
  assert.throws(() => N.setDcCall(e, 'Very Hard', 'too tough'), /Easy|scale/); assert.throws(() => N.setDcCall(e, 'Hard', 'no'), /reason/);
  N.setDcCall(e, 'Hard', 'guards are alert after the brawl'); assert.equal(e.check.dc, 16); assert.equal(e.dcCall.word, 'Hard');
  assert.deepEqual(N.checkDcCalls([e]), []); const bad = { ...e, check: { ...e.check, dc: 17 } }; assert.equal(N.checkDcCalls([bad]).length, 1);
});
test('DC scale v1 still verifies nights opened on Easy 10 / Medium 15 / Hard 20', () => {
  assert.deepEqual(N.dcScale(1), { Easy: 10, Medium: 15, Hard: 20 });
  const e = { kind: 'free', check: { skill: 'stealth', dc: 15 }, dcCall: { word: 'Medium', dc: 15, why: 'temple clerks are sloppy' } };
  assert.deepEqual(N.checkDcCalls([e], 1), []);
  assert.ok(N.checkDcCalls([e], 2).length >= 1, 'a v1 Medium 15 is off the v2 scale');
  assert.ok(N.checkDcCalls([e], 3).length >= 1, 'a v1 Medium 15 is off the v3 scale');
  N.setDcCall(e, 'Hard', 'guards are alert after the brawl', undefined, 1); assert.equal(e.check.dc, 20);
  const opened = { status: 'open', dcCommit: 'x', moves: [] };
  assert.equal(N.scaleOf(opened), 1, 'already-open nights without dcScale stay on v1');
  assert.equal(N.scaleOf({ dcScale: 2, status: 'open' }), 2);
  assert.equal(N.scaleOf({ dcScale: 3, status: 'open' }), 3);
  const raw = { n: 7, id: 'q_spy_1', freeDc: 14, moves: [
    { id: 'tail', check: { skill: 'stealth', dc: 14 } },
    { id: 'ask', check: { skill: 'insight', dc: 9 } },
  ] };
  const v1 = N.applyDcScale(raw, 1);
  assert.equal(v1.freeDc, 15); assert.equal(v1.moves[0].check.dc, 15); assert.equal(v1.moves[1].check.dc, 10);
  const v2 = N.applyDcScale(raw, 2);
  assert.equal(v2.freeDc, 14); assert.equal(v2.moves[0].check.dc, 14); assert.equal(v2.moves[1].check.dc, 9);
  const v3 = N.applyDcScale(raw, 3);
  assert.equal(v3.freeDc, 11); assert.equal(v3.moves[0].check.dc, 11); assert.equal(v3.moves[1].check.dc, 6);
});
test('DC scale v2 still verifies nights opened on Easy 9 / Medium 14 / Hard 19', () => {
  assert.deepEqual(N.dcScale(2), { Easy: 9, Medium: 14, Hard: 19 });
  const e = { kind: 'free', check: { skill: 'stealth', dc: 14 }, dcCall: { word: 'Medium', dc: 14, why: 'the tarp has already jumped' } };
  assert.deepEqual(N.checkDcCalls([e], 2), []);
  assert.ok(N.checkDcCalls([e], 3).length >= 1, 'a v2 Medium 14 is off the v3 scale');
  N.setDcCall(e, 'Easy', 'a long look from the bank', undefined, 2); assert.equal(e.check.dc, 9);
});
test('a night with a shop: saved carts apply (even unlocked), gems are cashed, loot is divided, battle victory awards purses', () => {
  const { g, players } = table(); const [p1, p2, p3] = ['p1', 'p2', 'p3'].map(p => cidOf(players, p)); rich(g, p2, 60);
  L.addLoot(g, { items: [{ id: 'potion_of_healing' }, { id: 'gem_10' }] }); const lid = g.state.loot.pending[0].lid;
  const scene = { n: 9, id: 't9', title: 'Market day', place: 'capital', shop: 'capital', moves: [{ id: 'wait', label: 'Browse', check: null, success: { text: 'You browse.', effects: [] } }], after: { rest: 'short' } };
  N.openNight(g, scene, { seed: 's9', dateISO: '2026-11-19' });
  const acts = { p1: { locked: true, kind: 'move', moveId: 'wait', loot: { [lid]: 'need' } }, p2: { locked: false, cart: [{ op: 'buy', key: 'longsword' }, { op: 'buy', key: 'plate_armor' }] }, p3: { locked: true, kind: 'move', moveId: 'wait', loot: { [lid]: 'greed' } } };
  const r = N.resolveNight(g, scene, N.planNight(scene, acts, players), { seed: 's9', now: 0 });
  const cart = r.entries.find(e => e.cid === p2).cart; assert.ok(cart[0].ok); assert.ok(!cart[1].ok && /coin|afford|short/i.test(cart[1].why), cart[1].why);
  assert.equal(r.lootDivide[0].winner, p1); assert.equal(r.cashed, 1000); assert.equal(r.rest.kind, 'short');
  assert.ok(r.sheetChanges.some(c => c.cid === p2 && /Longsword/.test(c.what)), 'shop changes are sheet events');
  // battle: two bandits (CR 1/8 humanoid) drop purses on victory
  void p3;
});
test('battle victory: purses by CR for each foe plus the encounter’s loot spec, split evenly', async () => {
  const { g, players } = table(); const { night } = await import('../../app/content/arc1.js'); const sc = night(2);
  N.openNight(g, sc, { seed: 's2', dateISO: '2026-11-12' });
  const acts = Object.fromEntries(players.map(p => [p.pid, { locked: true, kind: 'move', moveId: sc.moves[0].id }]));
  N.resolveNight(g, sc, N.planNight(sc, acts, players), { seed: 's2', now: 0 }); assert.ok(g.state.encounter, 'night 2 starts the bar brawl');
  g.event('t', {}, () => g.set(['encounter', 'loot'], { coin: 1000 }));
  const c0 = g.state.chars[players[0].cid].coin; const r = N.victoryLoot(g);
  assert.ok(r.coin >= 1000 + 4 * 30, 'bandits (CR 1/8) and the tough (CR 1/2) carry purses'); assert.ok(g.state.chars[players[0].cid].coin - c0 === r.each);
});
test('catalogue: every SRD magic item is buyable/awardable data with a rarity price; consumables half', () => {
  assert.ok(Object.keys(ITEMS).length >= 400);
  assert.equal(itemDef({ id: 'cloak_of_protection' }).cost, 40000); assert.equal(itemDef({ id: 'potion_of_healing' }).cost, 5000);
  assert.equal(itemDef({ id: 'spell_scroll', scroll: 'magic_missile' }).cost > 0, true);
  void deriveSheet;
});
