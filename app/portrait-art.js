// BoG V painted portraits (Phase 5 art pass, Lock 13: every portrait epic, one heroic style).
// Layers, top to bottom:  1. gear overlay (live from the engine inventory: armor, weapon, shield, magic glow)
//                         2. painted base bust (keyed by the builder's look choices; no armor, no weapons)
//                         3. procedural SVG portrait (portrait.js): the offline-safe fallback if 2 is missing
// The painted library lives in app/assets/portraits/ (manifest.json); `gm portraits` lists heroes without one
// and prints the exact prompt to paint it with. Everything here is pure/deterministic and runs in node too.
import { portraitSpec, renderPortrait, svgDataUrl, fallbackCrest } from './portrait.js';

export const STYLE = 'Epic heroic fantasy oil painting, classic fantasy book-cover style, painterly visible brushstrokes, rich glazes. '
  + 'Head-and-shoulders bust portrait, centered, the head in the upper middle of the frame, eyes about 38% from the top, shoulders spanning the full lower edge, three-quarter view, noble determined expression, serious and heroic, never comic. '
  + 'Dramatic warm golden rim light from the upper left, deep shadow. Background: dark oak-brown and deep wine-red vignette with a soft gold sunburst glow behind the head. '
  + 'Tavern Ledger palette: oak brown, parchment gold, wine red, candle light. No armor, no weapons, no hands, no shield, no jewelry except as described, no text, no frame, no border, no logo, no watermark.';
const SPECIES = {
  human: 'human', aasimar: 'aasimar (a mortal touched by celestial light, faintly luminous skin, gentle radiant glow in the eyes)', dwarf: 'dwarf (stout and broad-shouldered, sturdy, round human-like ears, not an elf)',
  elf: 'elf (long elegant pointed ears, fine high cheekbones)', gnome: 'gnome (one of the small folk, clearly not an elf: a round sturdy face, a broad rounded nose, large bright eyes, small slightly pointed ears, rosy cheeks)', goliath: 'goliath (towering, stone-grey skin with darker stony markings, heavy brow)',
  halfling: 'halfling (small, youthful round face, curly hair, slightly pointed ears)', orc: 'orc (strong heavy brow, small lower tusks, broad face, noble bearing)',
  tiefling: 'tiefling (two curved ram horns sweeping back from the forehead, solid-colored eyes)', dragonborn: 'dragonborn (a proud dragon-headed humanoid with a scaled snout, frilled crest of horns, no hair, no ears)' };
const CLASS_GARB = {
  barbarian: 'rugged fur-trimmed tunic of hide and wool', bard: 'fine slashed doublet with gold embroidery', cleric: 'white and gold priestly vestments with a sun motif embroidered on the collar',
  druid: 'layered green and brown robes with leaf and antler motifs', fighter: 'quilted gambeson tunic with brass buttons', monk: 'simple wrapped orange-and-rust monastic robe',
  paladin: 'white surcoat with gold trim over a quilted tunic', ranger: 'weathered green hunting leathers with a hood resting on the shoulders', rogue: 'dark close-fitting charcoal jerkin',
  sorcerer: 'crimson silk robe with flame-like gold embroidery', warlock: 'deep violet high-collared robe with eldritch green trim', wizard: 'royal blue scholar robe with gold star embroidery on the collar' };
const HAIR = { swept: 'swept-back', long: 'long flowing', cropped: 'close-cropped', mohawk: 'braided mohawk', bald: 'shaved head (bald)', hood: 'a deep hood drawn up, a few strands of' };
const GLOW = { '#FFE9A8': 'golden', '#7FE8FF': 'cyan', '#C9A8FF': 'violet', '#FFB347': 'ember-orange', '#9BE05A': 'green' };
const NAMED = [['black', '#14110F'], ['near-black brown', '#2E2018'], ['dark brown', '#5A3A22'], ['chestnut brown', '#7A4A2A'], ['auburn red', '#B5462E'], ['copper', '#C9822E'], ['golden blond', '#E8C468'], ['pale flaxen blond', '#F1E3A6'],
  ['silver', '#C0C8D8'], ['white', '#F2F2F2'], ['plum', '#3B2A4A'], ['porcelain', '#F5D7B8'], ['fair', '#F2C9A0'], ['warm tan', '#D9A57A'], ['golden brown', '#B98A63'], ['bronze-brown', '#A9744F'], ['deep brown', '#7A4E33'], ['rich umber brown', '#8C5E3E'],
  ['ruddy', '#E8B48E'], ['stone grey', '#9A9EA6'], ['pale grey', '#B9B2A8'], ['sage green', '#8DB36B'], ['olive green', '#6F9A55'], ['crimson red', '#D9566B'], ['amethyst purple', '#9C4FB0'], ['sapphire blue', '#5C7BD6'], ['pale blue', '#8FA7C9'],
  ['emerald green', '#4FA36B'], ['gold', '#C9A227'], ['red-copper', '#C2513A'], ['steel blue', '#3F7FC0'], ['obsidian black', '#2E2E36'], ['silver-white', '#D8D8E0'], ['bronze', '#B87333'], ['deep wine red', '#8E1B3A'], ['royal blue', '#2F4FA8'],
  ['forest green', '#2E4A26'], ['dark burgundy', '#5A1420'], ['deep violet', '#4B2E6B'], ['dark teal', '#1E3A4A'], ['mustard gold', '#C9A227'], ['dark oak brown', '#2B1C12'], ['bright blue', '#2A5BD7'], ['green', '#3D7A3A'], ['brown', '#7A4E33'],
  ['red', '#7D1D2E'], ['glowing gold', '#F7C948'], ['grey', '#9A9A9A']];
const rgb = h => [1, 3, 5].map(i => parseInt(String(h).slice(i, i + 2), 16) || 0);
export function colorName(hex) { if (!/^#[0-9a-f]{6}$/i.test(hex || '')) return ''; const [r, g, b] = rgb(hex); let best = null, bd = 1e9;
  for (const [n, h] of NAMED) { const [R, G, B] = rgb(h); const d = (r - R) ** 2 + (g - G) ** 2 + (b - B) ** 2; if (d < bd) { bd = d; best = n; } } return best; }
const presentation = p => /^she/i.test(p || '') ? 'woman' : /^he/i.test(p || '') ? 'man' : 'androgynous person';
// the look fields a painting depends on (gear is NOT here: it is the overlay)
export function lookOf(d, ch) { const s = portraitSpec(d, ch); return { species: s.species, cls: s.cls, who: presentation(ch?.flavor?.pronouns || d.flavor?.pronouns || d.pronouns), skin: s.skin, hair: s.hair, hairStyle: s.hairStyle, beard: s.beard, eyes: s.eyes, cape: s.cape, glow: s.glow, small: !!s.small }; }
export function fnv(str) { let h = 2166136261; for (const c of String(str)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return (h >>> 0).toString(16).padStart(8, '0'); }
export const lookKey = L => `${L.species}-${L.cls}-` + fnv(JSON.stringify([L.who, L.skin, L.hair, L.hairStyle, L.beard, L.eyes, L.cape, L.glow, L.small]).toLowerCase());
export function promptFor(L) {
  const sp = SPECIES[L.species] || L.species; const drag = L.species === 'dragonborn';
  const hair = drag ? '' : L.hairStyle === 'bald' ? 'a shaved bald head' : `${HAIR[L.hairStyle] || 'swept-back'} ${colorName(L.hair)} hair`;
  const beard = !drag && L.beard && L.beard !== 'none' ? `, a ${L.beard === 'long' ? 'long braided' : 'short trimmed'} ${colorName(L.hair)} beard` : '';
  const skin = drag ? `${colorName(L.skin)} scales` : `${colorName(L.skin)} skin`;
  const eyes = L.species === 'tiefling' ? `solid ${colorName(L.eyes)} eyes` : `${colorName(L.eyes)} eyes`;
  const glow = `${GLOW[L.glow] || 'golden'} magical light`;
  const lead = `${L.small && !/^(gnome|halfling)/.test(L.species) ? 'small ' : ''}${L.who === 'androgynous person' ? 'androgynous ' : ''}${sp}`;
  return `${STYLE} Subject: ${/^[aeiou]/i.test(lead) ? 'an' : 'a'} ${lead} ${L.who === 'androgynous person' ? 'hero' : L.who === 'woman' ? 'woman (clearly a woman, female features)' : L.who} who is a ${L.cls}, ${skin}, ${eyes}${hair ? ', ' + hair : ''}${beard}. `
    + `Wearing ${CLASS_GARB[L.cls] || 'a simple tunic'} under a heavy ${colorName(L.cape)} cloak clasped at the throat. `
    + (L.species === 'aasimar' ? `A faint radiant halo of ${glow} above the head. ` : `Subtle wisps of ${glow} drifting in the air around the shoulders. `)
    + 'The lower fifth of the image is shoulders and cloak only.';
}
// ---------- the painted library ----------
let MANIFEST = null; let BASE = './assets/';
export function setManifest(m, base) { MANIFEST = m || { portraits: {} }; if (base) BASE = base; }
export async function loadManifest(base = './assets/') { BASE = base; try { const r = await fetch(base + 'portraits/manifest.json', { cache: 'no-cache' }); MANIFEST = r.ok ? await r.json() : { portraits: {} }; } catch { MANIFEST = { portraits: {} }; } return MANIFEST; }
// the exact painting for this look, else null (fallback = procedural SVG; GM paints the missing one)
export function paintingFor(L) { const p = MANIFEST?.portraits?.[lookKey(L)]; return p ? BASE + 'portraits/' + p.file : null; }
// ---------- gear overlay (live: armor, weapon, shield, magic) ----------
const ARMOR_SPRITE = { chain: 'armor-chain', plate: 'armor-plate', leather: 'armor-leather', studded: 'armor-studded' };
const WEAPON_SPRITE = { great: 'w-greatsword', blade: 'w-longsword', axe: 'w-axe', greataxe: 'w-greataxe', mace: 'w-mace', maul: 'w-warhammer', staff: 'w-staff', spear: 'w-spear', dagger: 'w-dagger', bow: 'w-bow', spell: 'w-spell', fists: null }; // fists: no sprite, the monk's own painting carries it
export function gearOf(d, ch) { const s = portraitSpec(d, ch); const inv = ch?.inventory || []; const main = inv.find(i => i.slot === 'main' || (s.weapon === 'bow' && i.slot === 'ranged'));
  const magic = inv.filter(i => i.slot && (i.bonus || i.magic || /\+\d$/.test(i.id || '') || i.rarity)).length; const armorItem = inv.find(i => i.slot === 'armor');
  return { armor: ARMOR_SPRITE[s.armor] || null, weapon: WEAPON_SPRITE[s.weapon] || null, shield: !!s.shield, magic, magicWeapon: !!(main && (main.bonus || main.magic || main.rarity || /\+\d$/.test(main.id || ''))),
    magicArmor: !!(armorItem && (armorItem.bonus || armorItem.magic || armorItem.rarity)), glow: s.glow, spellColor: s.spellColor, cls: s.cls }; }
// CSS layers (an SVG used as a CSS image cannot load other files, so each sprite is its own background layer).
// Boxes are in the 512x512 portrait space and become % sizes/positions, so one style works at any avatar size.
const box = (url, x, y, w, h) => ({ url, x, y, w, h });
const glowBox = (col, cx, cy, rx, ry, a = 0.5) => ({ grad: `radial-gradient(ellipse closest-side, ${hexA(col, a)}, ${hexA(col, 0)})`, x: cx - rx, y: cy - ry, w: 2 * rx, h: 2 * ry });
function hexA(h, a) { const [r, g, b] = rgb(h); return `rgba(${r},${g},${b},${a})`; }
// [left x, bottom y, width] in the 512 space; height comes from the sprite's own aspect (manifest.gear) so nothing is stretched
export const SPRITE_BOX = { armor: [-22, 566, 556], shield: [-34, 548, 196], big: [346, 566, 200], small: [360, 548, 150] };
const BIG = ['w-greatsword', 'w-greataxe', 'w-spear', 'w-staff', 'w-bow', 'w-warhammer'];
const ASPECT = n => { const d = MANIFEST?.gear?.[n]; return d ? d[1] / d[0] : 1.5; };
const place = (url, name, [x, yb, w], maxH = 500) => { let h = w * ASPECT(name); if (h > maxH) { w = w * maxH / h; x += (SPRITE_BOX.big[2] - w) / 2 * (x > 256 ? 1 : 0); h = maxH; } return box(url, x, yb - h, w, h); };
export function overlayBoxes(G, sprite = n => BASE + 'gear/' + n + '.webp') {
  const out = []; // first = on top
  if (G.weapon) { const b = place(sprite(G.weapon), G.weapon, BIG.includes(G.weapon) ? SPRITE_BOX.big : SPRITE_BOX.small); out.push(b);
    if (G.magicWeapon || G.weapon === 'w-spell') out.push(glowBox(G.weapon === 'w-spell' ? G.spellColor : G.glow, b.x + b.w / 2, b.y + Math.min(b.h, 300) * 0.3, b.w * 0.95, Math.min(b.h, 300) * 0.55, 0.85)); }
  if (G.shield) out.push(place(sprite('shield'), 'shield', SPRITE_BOX.shield));
  if (G.armor) { out.push(place(sprite(G.armor), G.armor, SPRITE_BOX.armor)); if (G.magicArmor) out.push(glowBox(G.glow, 256, 470, 250, 90, 0.45)); }
  return out;
}
const pct = (v, size) => size === 512 ? '0%' : (v / (512 - size) * 100).toFixed(2) + '%';
export function cssLayers(boxes, base) {
  const all = [...boxes, ...base.map(u => ({ url: u, x: 0, y: 0, w: 512, h: 512 }))];
  return `background-image:${all.map(b => b.grad || `url("${b.url}")`).join(',')};background-size:${all.map(b => `${(b.w / 5.12).toFixed(2)}% ${(b.h / 5.12).toFixed(2)}%`).join(',')};`
    + `background-position:${all.map(b => `${pct(b.x, b.w)} ${pct(b.y, b.h)}`).join(',')};background-repeat:no-repeat`;
}
const BAD = new Set(); // paintings that failed to load (offline, missing file): drop to the SVG
export function markBad(url) { BAD.add(url); }
export const badCount = () => BAD.size;
let READY = null; // browser: load the manifest once (relative to the page: app/index.html -> ./assets/)
export function ready(base = './assets/') { return READY || (READY = MANIFEST ? Promise.resolve(MANIFEST) : loadManifest(base)); }
// check paintings actually load; a failure (offline, missing) marks it bad and calls back so the UI redraws with the SVG
export function verify(urls, onBad) { if (typeof Image === 'undefined') return; for (const u of new Set(urls.filter(Boolean))) { if (BAD.has(u)) continue; const im = new Image(); im.onerror = () => { BAD.add(u); onBad?.(u); }; im.src = u; } }
// background layers: gear sprites, painting, procedural SVG. No painting (or it failed) = the SVG alone, which draws its own gear.
export function layers(d, ch, { sprite } = {}) {
  let svg; try { svg = renderPortrait(portraitSpec(d, ch)); } catch { svg = fallbackCrest(d?.name); }
  const L = lookOf(d, ch); let paint = paintingFor(L); if (paint && BAD.has(paint)) paint = null; const G = gearOf(d, ch);
  const style = paint ? cssLayers(overlayBoxes(G, sprite), [paint, svgDataUrl(svg)]) : cssLayers([], [svgDataUrl(svg)]);
  return { painted: !!paint, paint, key: lookKey(L), look: L, gear: G, style, svg };
}
