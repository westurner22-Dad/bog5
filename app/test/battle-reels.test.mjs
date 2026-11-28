import { test } from 'node:test';
import assert from 'node:assert/strict';
import { reelFor, reelHtml, REELS } from '../content/battle-reels.js';

test('Night 33 / a1n20 recap is wired to the Dylan Stewart battle reel', () => {
  const byNight = reelFor(33);
  const byScene = reelFor(null, 'a1n20');
  const byBoth = reelFor(33, 'a1n20');
  assert.ok(byNight);
  assert.equal(byNight, byScene);
  assert.equal(byNight, byBoth);
  assert.equal(byNight.title, 'Battle reel: The Fall of Dylan Stewart');
  assert.equal(byNight.src, 'assets/videos/dylan-fight.mp4');
  assert.equal(byNight.poster, 'assets/videos/dylan-fight.jpg');
  assert.match(byNight.credit, /MintoDog/);
  assert.match(byNight.credit, /CC0/);
});

test('nights and scenes without a reel get nothing (old recaps unchanged)', () => {
  assert.equal(reelFor(32), null);
  assert.equal(reelFor(32, 'a1n19'), null);
  assert.equal(reelFor(undefined, 'a1n19'), null);
  assert.equal(reelHtml(null), '');
  assert.equal(reelHtml(undefined), '');
});

test('reel HTML is a muted-autoplay video with controls, poster, and credit, and does not leak raw tags', () => {
  const html = reelHtml(reelFor(33, 'a1n20'));
  assert.match(html, /class="card dark recap-reel"/);
  assert.match(html, />Battle reel</);
  assert.match(html, />The Fall of Dylan Stewart</);
  assert.match(html, /<video controls playsinline muted autoplay preload="metadata"/);
  assert.match(html, /poster="assets\/videos\/dylan-fight\.jpg"/);
  assert.match(html, /src="assets\/videos\/dylan-fight\.mp4"/);
  assert.match(html, /MintoDog \(CC0, OpenGameArt\.org\)/);
  const nasty = reelHtml({ title: 'Battle reel: <xss>', src: 'x" onerror="1', credit: '<b>no</b>' });
  assert.equal(nasty.includes('<xss>'), false);
  assert.match(nasty, /src="x&quot; onerror=&quot;1"/);
  assert.match(nasty, /&lt;b&gt;no&lt;\/b&gt;/);
});

test('REELS entries always carry a src and at least one night or scene key', () => {
  assert.ok(REELS.length >= 1);
  for (const r of REELS) {
    assert.ok(r.src, 'src required');
    assert.ok((r.nights && r.nights.length) || (r.scenes && r.scenes.length), r.title);
  }
});

test('Night 52 / a1_gulpwell_4 recap is wired to the Gulpwell boss battle reel', () => {
  const r = reelFor(52, 'a1_gulpwell_4');
  assert.ok(r);
  assert.equal(r, reelFor(52));
  assert.equal(r, reelFor(null, 'a1_gulpwell_4'));
  assert.equal(r.title, 'Battle reel: The Reckoning of Commissar Gulpwell');
  assert.equal(r.src, 'assets/videos/gulpwell-fight.mp4');
  assert.equal(r.poster, 'assets/videos/gulpwell-fight.jpg');
  assert.match(r.credit, /MintoDog/);
  assert.equal(reelFor(51, 'a1_gulpwell_3'), null);
});
