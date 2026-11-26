// Gear tab must open even when the night's shop id is missing from a stale catalog,
// and The Pump Stall (thimbleby) must list for every seat.
import { test } from 'node:test'; import assert from 'node:assert/strict';
import * as F from '../../engine/src/forge.js';
import { Game, actions as A } from '../../engine/src/index.js';
import * as SH from '../../engine/src/shop.js';
import { partyDrafts } from '../../engine/test/fixtures.js';
import * as G from '../gear.js';

function table() {
  const g = new Game({});
  const players = partyDrafts().map(h => { A.addCharacter(g, F.toSpec(h.draft)); const cid = g.state.party.order.at(-1); return { pid: h.pid, name: g.state.chars[cid].name, cid }; });
  return { g, players };
}

function boot({ g, players }, { shop = 'thimbleby', pid = players[0].pid } = {}) {
  const me = players.find(p => p.pid === pid);
  const T = {
    me, game: { state: g.state }, players,
    scene: { n: 44, id: 'a1n31', title: 'The Pump Stall', place: 'Thimbleby · the square', shop, status: 'open', cutoffMs: Date.now() + 8.64e7 },
    cart: [], shopTab: 'foryou', restPick: {}, lootPick: {}, open: {},
  };
  G.init({
    T,
    esc: s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])),
    AV: () => '',
    first: n => String(n || '').split(' ')[0],
    now: () => Date.now(),
    canAct: (sc, t) => sc && sc.status === 'open' && t < sc.cutoffMs,
    sgn: n => (n >= 0 ? '+' : '−') + Math.abs(n),
    store: {},
    OWNER: pid,
  });
  return T;
}

test('shopView: The Pump Stall lists for every seat; unknown shop ids still throw in the engine', () => {
  const { g, players } = table();
  assert.equal(SH.SHOPS.thimbleby.name, 'The Pump Stall');
  assert.ok(SH.SHOPS.thimbleby.stock.includes('rations'));
  assert.ok(!SH.SHOPS.thimbleby.stock.includes('cloak_of_protection'));
  for (const p of players) {
    const v = SH.shopView(g.state, p.cid, 'thimbleby', 'foryou');
    assert.equal(v.shop.name, 'The Pump Stall');
    assert.ok(Array.isArray(v.rows));
    const supplies = SH.shopView(g.state, p.cid, 'thimbleby', 'supplies');
    assert.ok(supplies.rows.some(r => /ration/i.test(r.name) || r.key === 'rations'), `${p.name} supplies include rations`);
  }
  assert.throws(() => SH.shopView(g.state, players[0].cid, 'no_such_shop', 'foryou'), /no shop/);
});

test('gear tab: The Pump Stall opens and lists for every seat', () => {
  const { g, players } = table();
  for (const p of players) {
    boot({ g, players }, { shop: 'thimbleby', pid: p.pid });
    const html = G.gearView();
    assert.match(html, /The Pump Stall/, `${p.name} sees the stall name`);
    assert.match(html, />Pack</, `${p.name} sees pack`);
    assert.match(html, /Equipped/, `${p.name} sees paperdoll`);
    assert.match(html, /Rations|rations/i, `${p.name} sees rations in the shop or pack`);
    assert.doesNotMatch(html, /failed to load|not in this catalog/i);
  }
});

test('gear tab: an unknown shop id must not take down pack or paperdoll (pre-fix shopView throw blanked the tab)', () => {
  const { g, players } = table();
  const p = players[0];
  boot({ g, players }, { shop: 'no_such_shop', pid: p.pid });
  let html;
  assert.doesNotThrow(() => { html = G.gearView(); });
  assert.match(html, />Pack</);
  assert.match(html, /Equipped/);
  assert.match(html, /not in this catalog|could not be built|try this tab again/i);
  assert.doesNotMatch(html, /This tab failed to load/);
});

test('Gear tab: mission board is only under the Teslandia guild shop, never at the Pump Stall', () => {
  const { g, players } = table();
  for (const p of players) {
    boot({ g, players }, { shop: 'thimbleby', pid: p.pid });
    const html = G.gearView();
    assert.doesNotMatch(html, /id="guildboard"|Teslandia mission board|Office Hours|The Melt Day|Side quests/i, `${p.name} must not see a board at the Pump Stall`);
  }
  const { g: g2, players: ps2 } = table();
  g2.state.story = { flags: {}, quests: { spy: { status: 'done' } } };
  boot({ g: g2, players: ps2 }, { shop: 'capital', pid: ps2[0].pid });
  const html = G.gearView();
  assert.match(html, /id="shop"/);
  assert.match(html, /The Guildhall Bazaar/);
  assert.match(html, /id="guildboard"/);
  assert.match(html, /Teslandia mission board/);
  assert.match(html, /Office Hours/);
  assert.ok(html.indexOf('id="shop"') < html.indexOf('id="guildboard"'), 'board is underneath the guild shop catalog');
  assert.doesNotMatch(html, /<h2>Side quests<\/h2>/);
});

test('old questCard helper no longer renders the relic/spy list', () => {
  const { g, players } = table();
  g.state.story = { flags: { spy_seen: true, spy_showdown: true }, quests: { spy: { status: 'done' } } };
  boot({ g, players }, { shop: 'thimbleby', pid: players[0].pid });
  assert.equal(G.questCard(), '');
  assert.doesNotMatch(G.gearView(), /The Agent at Court|Side quests/);
});
