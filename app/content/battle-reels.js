// Optional recap battle reels. Static app content, keyed by campaign night and/or scene id.
// Nothing here is written to Firebase or the save. Recaps without a matching entry look as they always did.
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const REELS = [
  {
    nights: [33],
    scenes: ['a1n20'],
    title: 'Battle reel: The Fall of Dylan Stewart',
    src: 'assets/videos/dylan-fight.mp4',
    poster: 'assets/videos/dylan-fight.jpg',
    credit: 'Music: Heavy Battle 1 by MintoDog (CC0, OpenGameArt.org)',
  },
  {
    nights: [40],
    scenes: ['a1n27'],
    title: 'Battle reel: The Claim on the Road',
    src: 'assets/videos/claim-fight.mp4',
    poster: 'assets/videos/claim-fight.jpg',
    credit: 'Music: Heavy Battle 1 by MintoDog (CC0, OpenGameArt.org)',
  },
];

export function reelFor(night, sceneId) {
  const n = Number(night);
  const id = sceneId == null || sceneId === '' ? null : String(sceneId);
  return REELS.find(r => (Number.isFinite(n) && r.nights?.includes(n)) || (id && r.scenes?.includes(id))) || null;
}

export function reelHtml(reel) {
  if (!reel) return '';
  const title = String(reel.title || 'Battle reel');
  const split = title.match(/^(Battle reel):\s*(.+)$/i);
  const eyebrow = split ? split[1] : 'Battle reel';
  const heading = split ? split[2] : title;
  const poster = reel.poster ? ` poster="${esc(reel.poster)}"` : '';
  const credit = reel.credit ? `<div class="meta recap-reel-credit">${esc(reel.credit)}</div>` : '';
  return `<div class="card dark recap-reel"><div class="eyebrow" style="color:#cdb27a">${esc(eyebrow)}</div><div class="title" style="color:#f0d58a">${esc(heading)}</div><video controls playsinline muted autoplay preload="metadata"${poster} src="${esc(reel.src)}"></video>${credit}</div>`;
}
