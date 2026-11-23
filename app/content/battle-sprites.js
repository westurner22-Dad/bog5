// Optional battle-map sprites. Static app content, keyed by character id/name or enemy type/name/uid.
// Nothing here is written to Firebase or the save. Combatant positions, HP, selection, and clicks are unchanged.
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const SPRITE_BASE = 'assets/sprites/';

export const PC_SPRITES = {
  'hero-p1': { id: 'biggus', src: 'assets/sprites/pc/biggus.webp', name: 'Biggus Dickus' },
  'hero-p2': { id: 'gorlock', src: 'assets/sprites/pc/gorlock.webp', name: 'Gorlock the Queerslayer' },
  'hero-p3': { id: 'boobington', src: 'assets/sprites/pc/boobington.webp', name: 'Boobington' },
  'hero-p4': { id: 'yaest', src: 'assets/sprites/pc/yaest.webp', name: 'Yäest of Nutrient' },
};

// Name slugs (lowercase, punctuation stripped) also map to the four party sprites.
export const PC_BY_NAME = {
  'biggus dickus': 'hero-p1',
  'gorlock the queerslayer': 'hero-p2',
  gorlock: 'hero-p2',
  boobington: 'hero-p3',
  'yaest of nutrient': 'hero-p4',
  yaest: 'hero-p4',
};

export const FOE_SPRITES = [
  { id: 'dylan', src: 'assets/sprites/foe/dylan.webp', types: ['bandit_captain'], uids: ['dylan'], nameRe: /dylan(\s+stewart)?/i },
  { id: 'sergeant', src: 'assets/sprites/foe/sergeant.webp', types: ['tough'], uids: ['sgt', 'tsgt'], nameRe: /sergeant/i },
  { id: 'clerk', src: 'assets/sprites/foe/clerk.webp', types: ['bandit'], nameRe: /\b(clerk|stamp clerk|late clerk)\b/i },
  { id: 'guard', src: 'assets/sprites/foe/guard.webp', types: ['guard'], nameRe: /\bguards?\b/i },
  { id: 'rider', src: 'assets/sprites/foe/rider.webp', types: ['rider'], nameRe: /\briders?\b/i },
  { id: 'armor', src: 'assets/sprites/foe/armor.webp', types: ['animated_armor'], uids: ['counting'], nameRe: /counting thing|animated armour|animated armor/i },
  { id: 'sword', src: 'assets/sprites/foe/sword.webp', types: ['animated_flying_sword'], nameRe: /counting blade|flying sword/i },
];

export const FALLBACK_SPRITE = { id: 'fallback', src: 'assets/sprites/foe/fallback.webp', fallback: true };

export const foeLabel = c => {
  const nm = c.name || '';
  const n = nm.match(/(\d+)$/);
  const ini = nm.replace(/\s*\d+$/, '').split(/\s+/).map(w => w[0]).filter(Boolean).join('').slice(0, 2).toUpperCase();
  return c.boss ? ini.slice(-1) : ini + (n ? n[1] : '');
};

export const isPc = c => c && (c.kind === 'pc' || c.side === 'pc' || (c.side === 'party' && c.kind !== 'npc'));

const slug = s => String(s || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

export function spriteFor(c) {
  if (!c) return null;
  if (isPc(c)) {
    if (c.cid && PC_SPRITES[c.cid]) return { ...PC_SPRITES[c.cid], kind: 'pc' };
    const key = PC_BY_NAME[slug(c.name)];
    if (key && PC_SPRITES[key]) return { ...PC_SPRITES[key], kind: 'pc' };
    return null; // unknown hero: caller keeps the existing painted-bust token
  }
  const typ = String(c.type || c.monster || '').toLowerCase();
  const uid = String(c.uid || '');
  const name = String(c.name || '');
  for (const row of FOE_SPRITES) {
    if (typ && (row.types || []).includes(typ)) return { ...row, kind: 'foe' };
    if (uid && (row.uids || []).includes(uid)) return { ...row, kind: 'foe' };
    if (name && row.nameRe && row.nameRe.test(name)) return { ...row, kind: 'foe' };
  }
  return { ...FALLBACK_SPRITE, kind: 'foe' };
}

// tokenHtml: visual only. Positions stay pos*S+3; size stays 38 (or 20 for the old down-X if no sprite).
export function tokenHtml(c, { isMe = false, left, top, size = 38, z = 1, pcFallback = '' } = {}) {
  const down = (c.hp ?? 1) <= 0;
  const bloodied = !down && c.max > 0 && c.hp <= c.max / 2;
  const spr = spriteFor(c);
  const pc = isPc(c);
  if (pc) {
    const cls = `tok sprite pc${isMe ? ' me' : ''}${down ? ' down' : ''}${bloodied ? ' bl' : ''}`;
    const inner = spr
      ? `<img src="${esc(spr.src)}" alt="" draggable="false">`
      : (pcFallback || '');
    return `<div class="${cls}" style="left:${left}px;top:${top}px;width:${size}px;height:${size}px;z-index:${z}">${inner}</div>`;
  }
  const label = esc(foeLabel(c));
  if (down && !spr) {
    return `<div class="tok foe gone" style="left:${left + 9}px;top:${top + 9}px;width:20px;height:20px;z-index:${z}"><b>\u2715</b></div>`;
  }
  const cls = `tok sprite foe${c.boss ? ' big' : ''}${bloodied ? ' bl' : ''}${down ? ' down' : ''}`;
  const src = (spr || FALLBACK_SPRITE).src;
  const mark = down ? `<b class="tok-x">\u2715</b>` : '';
  return `<div class="${cls}" style="left:${left}px;top:${top}px;width:${size}px;height:${size}px;z-index:${z}"><img src="${esc(src)}" alt="" draggable="false"><span class="tok-lbl">${label}</span>${mark}</div>`;
}

export function mapHtml(view, { dest = null, clickable = false, paused = null, isMe = () => false, pcFallback = () => '' } = {}) {
  if (!view?.map) return '';
  const { w, h, terrain = {} } = view.map;
  const S = 44;
  let cells = '';
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const t = terrain[`${x},${y}`];
    const cls = t === 'wall' ? (view.map.water ? 'water' : 'bar') : t === 'difficult' ? 'tbl' : (x + y) % 2 ? 'floor' : 'floor2';
    cells += `<div class="cell ${cls}" ${clickable && t !== 'wall' ? `data-t="cell" data-x="${x}" data-y="${y}"` : ''}>${x === 0 ? `<i>${y + 1}</i>` : y === 0 ? `<i>${'ABCDEFGHIJ'[x]}</i>` : ''}</div>`;
  }
  const toks = [...(view.combatants || [])].sort((a, b) => (a.pos[1] - b.pos[1]) || (a.pos[0] - b.pos[0])).map(c => {
    const sz = 38;
    const left = c.pos[0] * S + 3, top = c.pos[1] * S + 3;
    const pid = c.cid || null;
    const z = c.pos[1] * 20 + c.pos[0];
    return tokenHtml(c, { isMe: !!(pid && isMe(pid)), left, top, size: sz, z, pcFallback: pid ? pcFallback(pid) : '' });
  }).join('');
  const destEl = dest ? `<div class="dest" style="left:${dest[0] * 44 + 3}px;top:${dest[1] * 44 + 3}px"></div>` : '';
  const pausedEl = paused ? `<div class="paused"><span>${esc(paused)}</span></div>` : '';
  return `<div class="map" style="grid-template-columns:repeat(${w},44px);grid-template-rows:repeat(${h},44px);width:${w * 44}px;height:${h * 44}px">${cells}${toks}${destEl}${pausedEl}</div>`;
}

export function initIcon(c, { isMe = false, pcFallback = '' } = {}) {
  const spr = spriteFor(c);
  if (spr) return `<img class="ini-spr" src="${esc(spr.src)}" alt="">`;
  if (isPc(c)) return pcFallback || '';
  return `<span class="fd">${esc(foeLabel(c))}</span>`;
}

export function initStripHtml(view, { isMe = () => false, pcFallback = () => '', firstName = n => String(n || '').split(/\s+/)[0] } = {}) {
  const order = view.order || [];
  const cur = order[view.turn];
  return `<div class="init">${order.map(u => {
    const c = (view.combatants || []).find(x => x.uid === u);
    if (!c || (c.hp <= 0 && !isPc(c))) return '';
    const pid = c.cid || null;
    const mine = !!(pid && isMe(pid));
    return `<span class="ini ${u === cur ? 'now' : ''}${c.hp <= 0 ? ' down' : ''}">${initIcon(c, { isMe: mine, pcFallback: pid ? pcFallback(pid) : '' })}${mine ? 'you' : esc(firstName(c.name))}</span>`;
  }).join('')}</div>`;
}
