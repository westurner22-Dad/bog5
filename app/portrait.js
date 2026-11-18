// BoG V epic portrait generator (JS port of phase0/tools/portrait_bog5.py). Everyone is epic (Lock 13).
// Hand-built layered SVG from look preferences + equipped gear; deterministic per hero; fully offline.
const OL = '#3A2620'; const O = `stroke="${OL}" stroke-width="10" stroke-linejoin="round" stroke-linecap="round"`;
export const PALETTE = {
  skin: { human: ['#F2C9A0', '#D9A57A', '#A9744F', '#7A4E33'], aasimar: ['#F3D2AE', '#E6C39B', '#B98A63', '#8C5E3E'], dwarf: ['#E8B48E', '#C98F66', '#9C6644'], elf: ['#F5D7B8', '#E2B98F', '#B98A63', '#8FA7C9'],
    gnome: ['#F5CDA8', '#D9A57A', '#A9744F'], goliath: ['#B9B2A8', '#9A9EA6', '#C9A88A'], halfling: ['#F2C9A0', '#D9A57A', '#A9744F'], orc: ['#8DB36B', '#6F9A55', '#A3A877', '#7E8C86'],
    tiefling: ['#D9566B', '#9C4FB0', '#5C7BD6', '#C98F66'], dragonborn: ['#4FA36B', '#C9A227', '#C2513A', '#3F7FC0', '#2E2E36', '#D8D8E0', '#B87333'] },
  hair: ['#2E2018', '#5A3A22', '#7A4A2A', '#B5462E', '#C9822E', '#E8C468', '#F1E3A6', '#C0C8D8', '#3B2A4A', '#F2F2F2'],
  cape: ['#8E1B3A', '#2F4FA8', '#2E4A26', '#5A1420', '#4B2E6B', '#1E3A4A', '#C9A227', '#2B1C12'],
  glow: { gold: '#FFE9A8', cyan: '#7FE8FF', violet: '#C9A8FF', ember: '#FFB347', green: '#9BE05A' },
  eyes: ['#2A5BD7', '#3D7A3A', '#7A4E33', '#7D1D2E', '#F7C948', '#9A9A9A'],
};
export const HAIR_STYLES = ['swept', 'long', 'cropped', 'mohawk', 'bald', 'hood'];
export const BEARDS = ['none', 'short', 'long'];
const CLS = { barbarian: ['#8A5A3A', '#D2BC98'], bard: ['#3FA0A0', '#FFC21A'], cleric: ['#F2EEDC', '#FFC21A'], druid: ['#5E8F4E', '#B5D98A'], fighter: ['#7D8A99', '#C9D2DC'], monk: ['#E07A2E', '#7A3E1E'],
  paladin: ['#EDE6D2', '#C9A227'], ranger: ['#3F5E30', '#A07A4A'], rogue: ['#3E4452', '#8A93A6'], sorcerer: ['#B3303F', '#FF9A3A'], warlock: ['#4B2E6B', '#9BE05A'], wizard: ['#3A55B0', '#FFC21A'] };
const SPEC = { human: { f: [], h: [0, 1] }, aasimar: { f: ['halo'], h: [0, 1] }, dwarf: { f: ['wide'], h: [26, 1.06] }, elf: { f: ['ears_long'], h: [-6, 0.97] }, gnome: { f: ['ears_short', 'big_nose'], h: [44, 1.1] },
  goliath: { f: ['wide', 'marks', 'heavy_brow'], h: [-10, 1.0] }, halfling: { f: [], h: [40, 1.08] }, orc: { f: ['tusks', 'wide', 'heavy_brow'], h: [-4, 1.02] }, tiefling: { f: ['horns', 'ears_short', 'tail'], h: [0, 1] }, dragonborn: { f: ['snout', 'crest'], h: [-8, 1.02] } };
const DRAGON = { black: '#2E2E36', blue: '#3F7FC0', brass: '#C9A24A', bronze: '#B87333', copper: '#C2703A', gold: '#C9A227', green: '#4FA36B', red: '#C2513A', silver: '#D8D8E0', white: '#EEF0F4' };
// deterministic RNG from a string (FNV-1a + xorshift); same hero, same picture
export function rng(seed) { let h = 2166136261; for (const c of String(seed)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } let x = h >>> 0 || 1;
  const f = () => { x ^= x << 13; x >>>= 0; x ^= x >> 17; x ^= x << 5; x >>>= 0; return x / 4294967296; }; return { f, pick: a => a[Math.floor(f() * a.length) % a.length], r: (a, b) => a + (b - a) * f() }; }
const shade = (hex, k) => '#' + [1, 3, 5].map(i => Math.max(0, Math.min(255, Math.round(parseInt(hex.slice(i, i + 2), 16) * k))).toString(16).padStart(2, '0')).join('');
const WEAP = { greatsword: 'great', glaive: 'great', halberd: 'greataxe', greataxe: 'greataxe', pike: 'spear', maul: 'maul', greatclub: 'maul', longsword: 'blade', shortsword: 'blade', scimitar: 'blade', rapier: 'blade',
  battleaxe: 'axe', handaxe: 'axe', war_pick: 'axe', mace: 'mace', morningstar: 'mace', flail: 'mace', warhammer: 'maul', light_hammer: 'mace', club: 'mace', quarterstaff: 'staff', spear: 'spear', javelin: 'spear', trident: 'spear', lance: 'spear', dagger: 'dagger', sickle: 'dagger', whip: 'dagger' };
const ARM = { chain_mail: 'chain', ring_mail: 'chain', splint_armor: 'plate', plate_armor: 'plate', chain_shirt: 'chain', scale_mail: 'chain', breastplate: 'plate', half_plate_armor: 'plate', leather_armor: 'leather', padded_armor: 'leather', studded_leather_armor: 'studded', hide_armor: 'leather' };
// what the portrait shows, from the draft + engine character (equipped gear) + look prefs
export function portraitSpec(d, ch) {
  const look = d.look || {}; const r = rng(d.id + (d.name || '')); const sp = SPEC[d.species] ? d.species : 'human';
  const inv = ch?.inventory || []; const main = inv.find(i => i.slot === 'main')?.id; const ranged = inv.find(i => i.slot === 'ranged')?.id; const armor = inv.find(i => i.slot === 'armor')?.id; const shield = inv.some(i => i.slot === 'off' && i.id === 'shield');
  const caster = ['wizard', 'sorcerer', 'warlock'].includes(d.cls);
  let weapon = WEAP[main] || (ranged ? 'bow' : caster ? 'spell' : d.cls === 'monk' ? 'fists' : 'blade');
  if (look.prop === 'ranged' && ranged) weapon = 'bow'; else if (look.prop === 'spell') weapon = 'spell'; else if (!look.prop || look.prop === 'auto') { if (d.cls === 'ranger' && ranged) weapon = 'bow'; if (d.cls === 'monk' && (!main || main === 'spear' || main === 'dagger')) weapon = 'fists'; if ((d.cls === 'sorcerer' || d.cls === 'warlock') && (!main || ['dagger', 'spear', 'sickle'].includes(main))) weapon = 'spell'; }
  const ancestry = (d.speciesChoices?.ancestry || '').split(':')[0];
  return { seed: d.id, species: sp, cls: d.cls || 'fighter', armor: ARM[armor] || (['wizard', 'sorcerer', 'warlock', 'druid', 'cleric', 'bard'].includes(d.cls) ? 'robe' : 'tunic'), weapon, shield,
    emblem: look.emblem || (['cleric', 'paladin'].includes(d.cls) ? 'coin' : 'none'),
    skin: look.skin || (sp === 'dragonborn' && DRAGON[ancestry]) || r.pick(PALETTE.skin[sp]), hair: look.hair || r.pick(PALETTE.hair), hairStyle: look.hairStyle || (d.cls === 'rogue' ? 'hood' : sp === 'dragonborn' ? 'bald' : 'swept'),
    beard: look.beard || (sp === 'dwarf' && !/^she/i.test(d.pronouns || '') ? 'long' : 'none'), cape: look.cape || r.pick(PALETTE.cape), glow: PALETTE.glow[look.glow] || (sp === 'aasimar' ? PALETTE.glow.gold : PALETTE.glow.cyan), eyes: look.eyes || (sp === 'aasimar' ? '#F7C948' : '#2A5BD7'),
    small: d.size === 'small', clsColor: look.outfit || CLS[d.cls]?.[0] || '#7D8A99', trim: CLS[d.cls]?.[1] || '#C9D2DC', spellColor: d.cls === 'warlock' ? '#9BE05A' : d.cls === 'wizard' ? '#7FB8FF' : '#FF7A2A' };
}
function bg(glow) {
  const rays = Array.from({ length: 12 }, (_, i) => { const a = i * 0.52; return `<path d="M256,150 L${(256 + 600 * Math.cos(a)).toFixed(0)},${(150 + 600 * Math.sin(a)).toFixed(0)} L${(256 + 600 * Math.cos(a + 0.12)).toFixed(0)},${(150 + 600 * Math.sin(a + 0.12)).toFixed(0)}Z" fill="#FFE9A8" opacity="0.16"/>`; }).join('');
  return `<defs><radialGradient id="eg" cx="0.5" cy="0.34" r="0.78"><stop offset="0" stop-color="#F7C948"/><stop offset="0.26" stop-color="#C2513A"/><stop offset="0.62" stop-color="#4B1F5E"/><stop offset="1" stop-color="#14123A"/></radialGradient>
<linearGradient id="sw" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="${glow}"/><stop offset="1" stop-color="#FFFFFF"/></linearGradient>
<pattern id="mail" width="18" height="14" patternUnits="userSpaceOnUse"><rect width="18" height="14" fill="#9AA6B2"/><path d="M0,7 a9,7 0 0 1 18,0" fill="none" stroke="#5E6B78" stroke-width="3"/><path d="M-9,14 a9,7 0 0 1 18,0 M9,14 a9,7 0 0 1 18,0" fill="none" stroke="#5E6B78" stroke-width="3"/></pattern>
<pattern id="stud" width="34" height="30" patternUnits="userSpaceOnUse"><rect width="34" height="30" fill="#6B4A2E"/><circle cx="9" cy="8" r="4" fill="#C9A227" stroke="#3A2620" stroke-width="2"/><circle cx="26" cy="23" r="4" fill="#C9A227" stroke="#3A2620" stroke-width="2"/></pattern>
<linearGradient id="plate" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#E4EAF0"/><stop offset="0.5" stop-color="#A9B4C0"/><stop offset="1" stop-color="#6E7A88"/></linearGradient>
<radialGradient id="halo" cx="0.5" cy="0.5" r="0.5"><stop offset="0.62" stop-color="${glow}" stop-opacity="0"/><stop offset="0.8" stop-color="${glow}" stop-opacity="0.95"/><stop offset="1" stop-color="${glow}" stop-opacity="0"/></radialGradient>
<radialGradient id="aura" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="${glow}" stop-opacity="0.55"/><stop offset="1" stop-color="${glow}" stop-opacity="0"/></radialGradient></defs>
<rect width="512" height="512" fill="url(#eg)"/>${rays}<ellipse cx="256" cy="300" rx="250" ry="230" fill="url(#aura)"/>
<path d="M0,470 L90,400 L160,440 L250,380 L340,445 L430,395 L512,450 L512,512 L0,512Z" fill="#1E1840" ${O}/>`;
}
const cape = col => `<path d="M150,330 C60,380 20,470 10,512 L502,512 C490,440 470,360 362,330 Z" fill="${col}" ${O}/><path d="M60,512 C90,440 120,400 160,360" fill="none" stroke="${shade(col, 1.3)}" stroke-width="12"/>`;
function coin(x, y, r) { return `<circle cx="${x}" cy="${y}" r="${r}" fill="#E8C468" ${O}/><circle cx="${x}" cy="${y}" r="${(r * 0.68).toFixed(0)}" fill="none" stroke="#9C7A1E" stroke-width="5"/><path d="M${x},${(y - r * 0.45).toFixed(0)} v${(r * 0.9).toFixed(0)} M${(x - r * 0.3).toFixed(0)},${(y - r * 0.25).toFixed(0)} h${(r * 0.45).toFixed(0)} a${(r * 0.2).toFixed(0)},${(r * 0.2).toFixed(0)} 0 0 1 0,${(r * 0.4).toFixed(0)} h-${(r * 0.3).toFixed(0)} a${(r * 0.2).toFixed(0)},${(r * 0.2).toFixed(0)} 0 0 0 0,${(r * 0.4).toFixed(0)} h${(r * 0.45).toFixed(0)}" fill="none" stroke="#9C7A1E" stroke-width="5"/>`; }
function sun(x, y, r) { return Array.from({ length: 8 }, (_, i) => { const a = i * Math.PI / 4; return `<line x1="${(x + r * 0.7 * Math.cos(a)).toFixed(0)}" y1="${(y + r * 0.7 * Math.sin(a)).toFixed(0)}" x2="${(x + r * 1.25 * Math.cos(a)).toFixed(0)}" y2="${(y + r * 1.25 * Math.sin(a)).toFixed(0)}" stroke="#FFC21A" stroke-width="7" stroke-linecap="round"/>`; }).join('') + `<circle cx="${x}" cy="${y}" r="${(r * 0.62).toFixed(0)}" fill="#FFC21A" ${O}/>`; }
function star(x, y, r) { const p = []; for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5; const rr = i % 2 ? r * 0.45 : r; p.push(`${(x + rr * Math.cos(a)).toFixed(0)},${(y + rr * Math.sin(a)).toFixed(0)}`); } return `<path d="M${p.join(' L')}Z" fill="#E8C468" ${O}/>`; }
const EMB = { coin, sun, star, none: null };
function torso(s) {
  const sh = 150, top = 330; const d = `M${256 - sh},512 C${256 - sh},${top + 40} ${256 - sh + 30},${top} 256,${top} C${256 + sh - 30},${top} ${256 + sh},${top + 40} ${256 + sh},512Z`;
  const fill = { chain: 'url(#mail)', studded: 'url(#stud)', plate: 'url(#plate)', leather: '#7A5236' }[s.armor] || s.clsColor;
  const out = [`<rect x="226" y="285" width="60" height="60" fill="${s.skin}" ${O}/>`, `<path d="${d}" fill="${fill}" ${O}/>`];
  if (s.armor === 'chain' || s.armor === 'plate') out.push(`<path d="M196,${top + 10} L316,${top + 10} L300,512 L212,512Z" fill="${s.clsColor}" ${O}/><path d="M206,${top + 14} L256,${top + 60} L306,${top + 14}" fill="none" stroke="${s.trim}" stroke-width="12" stroke-linecap="round"/>`);
  else if (s.armor === 'robe') out.push(`<path d="M206,${top + 4} L256,${top + 60} L306,${top + 4}" fill="none" stroke="${s.trim}" stroke-width="14" stroke-linecap="round"/><path d="M256,${top + 60} L256,512" stroke="${s.trim}" stroke-width="10"/>`);
  else out.push(`<path d="M206,${top + 4} L256,${top + 60} L306,${top + 4}" fill="none" stroke="${s.trim}" stroke-width="14" stroke-linecap="round"/><path d="M150,${top + 120} L362,${top + 70}" stroke="#4A2E1A" stroke-width="22" ${O}/>`);
  if (EMB[s.emblem]) out.push(EMB[s.emblem](256, top + 120, 30));
  const pc = s.armor === 'plate' ? 'url(#plate)' : s.armor === 'robe' ? shade(s.clsColor, 0.8) : '#C9D2DC';
  out.push(`<ellipse cx="${256 - sh + 30}" cy="${top + 30}" rx="54" ry="36" fill="${pc}" ${O}/><ellipse cx="${256 + sh - 30}" cy="${top + 30}" rx="54" ry="36" fill="${pc}" ${O}/>`);
  out.push(`<path d="M${256 - sh + 4},500 C${256 - sh + 4},${top + 90} ${256 - sh + 14},${top + 50} ${256 - sh + 40},${top + 28}" stroke-linecap="round" stroke="${s.glow}" stroke-width="6" fill="none"/>`);
  return out.join('');
}
function head(s, F) {
  const rx = F.includes('wide') ? 104 : 92, ry = 102, cx = 256, cy = 210, skin = s.skin, out = [];
  if (s.hairStyle === 'long' && s.hair && !F.includes('snout')) out.push(`<path d="M${cx - 96},${cy - 20} C${cx - 130},${cy + 80} ${cx - 120},${cy + 150} ${cx - 90},${cy + 170} L${cx + 90},${cy + 170} C${cx + 120},${cy + 150} ${cx + 130},${cy + 80} ${cx + 96},${cy - 20}Z" fill="${shade(s.hair, 0.85)}" ${O}/>`);
  if (F.includes('horns')) for (const k of [-1, 1]) out.push(`<path d="M${cx + k * 50},${cy - 80} C${cx + k * 70},${cy - 150} ${cx + k * 130},${cy - 150} ${cx + k * 140},${cy - 100} C${cx + k * 110},${cy - 120} ${cx + k * 90},${cy - 100} ${cx + k * 80},${cy - 70}Z" fill="#3B2A4A" ${O}/>`);
  if (F.includes('crest')) out.push(`<path d="M${cx - 60},${cy - 70} L${cx - 40},${cy - 140} L${cx - 10},${cy - 90} L${cx + 10},${cy - 150} L${cx + 35},${cy - 90} L${cx + 60},${cy - 135} L${cx + 70},${cy - 60}Z" fill="${shade(skin, 0.75)}" ${O}/>`);
  for (const k of [-1, 1]) { if (F.includes('ears_long')) out.push(`<path d="M${cx + k * 80},${cy - 10} L${cx + k * 165},${cy - 70} L${cx + k * 88},${cy + 30}Z" fill="${skin}" ${O}/>`);
    else if (F.includes('ears_short')) out.push(`<path d="M${cx + k * 82},${cy - 5} L${cx + k * 128},${cy - 40} L${cx + k * 90},${cy + 30}Z" fill="${skin}" ${O}/>`);
    else if (!F.includes('snout')) out.push(`<circle cx="${cx + k * rx}" cy="${cy + 5}" r="22" fill="${skin}" ${O}/>`); }
  out.push(`<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${skin}" ${O}/>`);
  if (F.includes('snout')) { out.push(`<ellipse cx="${cx}" cy="${cy + 60}" rx="74" ry="48" fill="${skin}" ${O}/><circle cx="${cx - 22}" cy="${cy + 45}" r="6" fill="${OL}"/><circle cx="${cx + 22}" cy="${cy + 45}" r="6" fill="${OL}"/>`);
    for (const [x, y] of [[-60, -50], [55, -45], [-70, 10], [68, 15], [0, -75]]) out.push(`<path d="M${cx + x - 10},${cy + y} q10,-12 20,0" fill="none" stroke="${shade(skin, 0.7)}" stroke-width="5"/>`); }
  else if (s.hair && s.hairStyle !== 'bald' && s.hairStyle !== 'hood') {
    if (s.hairStyle === 'cropped') out.push(`<path d="M${cx - rx},${cy - 15} C${cx - rx},${cy - 125} ${cx + rx},${cy - 125} ${cx + rx},${cy - 15} C${cx + 50},${cy - 70} ${cx - 50},${cy - 70} ${cx - rx},${cy - 15}Z" fill="${s.hair}" ${O}/>`);
    else if (s.hairStyle === 'mohawk') out.push(`<path d="M${cx - 22},${cy - 70} C${cx - 30},${cy - 150} ${cx + 10},${cy - 175} ${cx + 60},${cy - 160} C${cx + 30},${cy - 140} ${cx + 26},${cy - 110} ${cx + 22},${cy - 72}Z" fill="${s.hair}" ${O}/>`);
    else out.push(`<path d="M${cx - 92},${cy - 10} C${cx - 100},${cy - 110} ${cx + 40},${cy - 140} ${cx + 150},${cy - 90} C${cx + 110},${cy - 80} ${cx + 100},${cy - 60} ${cx + 92},${cy - 20} C${cx + 40},${cy - 70} ${cx - 40},${cy - 70} ${cx - 92},${cy - 10}Z" fill="${s.hair}" ${O}/>`); }
  if (F.includes('heavy_brow')) out.push(`<path d="M${cx - 70},${cy - 30} Q${cx},${cy - 55} ${cx + 70},${cy - 30}" fill="none" stroke="${shade(skin, 0.7)}" stroke-width="18" stroke-linecap="round"/>`);
  if (F.includes('marks')) out.push(`<path d="M${cx - 70},${cy + 10} l20,-30 M${cx - 58},${cy + 30} l16,-24 M${cx + 52},${cy - 60} l26,10" stroke="${shade(skin, 0.6)}" stroke-width="6" stroke-linecap="round"/>`);
  return out.join('');
}
function beard(s) { if (s.beard === 'none' || !s.hair) return ''; const cx = 256, cy = 210;
  if (s.beard === 'short') return `<path d="M${cx - 92},${cy + 10} C${cx - 96},${cy + 90} ${cx - 40},${cy + 120} ${cx},${cy + 122} C${cx + 40},${cy + 120} ${cx + 96},${cy + 90} ${cx + 92},${cy + 10} C${cx + 60},${cy + 60} ${cx - 60},${cy + 60} ${cx - 92},${cy + 10}Z" fill="${s.hair}" ${O}/>`;
  return `<path d="M${cx - 95},${cy + 10} C${cx - 110},${cy + 150} ${cx - 30},${cy + 190} ${cx},${cy + 200} C${cx + 30},${cy + 190} ${cx + 110},${cy + 150} ${cx + 95},${cy + 10} C${cx + 60},${cy + 60} ${cx - 60},${cy + 60} ${cx - 95},${cy + 10}Z" fill="${s.hair}" ${O}/>`; }
function face(s, F) { const cx = 256, cy = 225, out = [];
  for (const k of [-1, 1]) { const ex = cx + k * 38, ey = cy - 26;
    out.push(`<path d="M${ex - 22},${ey} Q${ex},${ey - 14} ${ex + 22},${ey} Q${ex},${ey + 10} ${ex - 22},${ey}Z" fill="#FFFFFF" ${O}/><circle cx="${ex}" cy="${ey}" r="6" fill="${s.eyes}"/>`);
    out.push(`<path d="M${ex + k * 26},${ey - 30} L${ex - k * 24},${ey - 16}" stroke="${OL}" stroke-width="14" stroke-linecap="round"/>`); }
  if (F.includes('big_nose')) out.push(`<circle cx="${cx}" cy="${cy + 12}" r="16" fill="${shade(s.skin, 0.9)}" ${O}/>`); else out.push(`<path d="M${cx - 6},${cy - 10} L${cx - 12},${cy + 20} L${cx + 4},${cy + 22}" fill="none" stroke="${shade(s.skin, 0.7)}" stroke-width="6"/>`);
  if (!(s.beard === 'long' && s.hair)) out.push(`<path d="M${cx - 26},${cy + 50} Q${cx},${cy + 44} ${cx + 30},${cy + 46}" fill="none" ${O}/>`);
  if (F.includes('tusks')) out.push(`<path d="M${cx - 30},${cy + 50} l-6,-26 12,4z M${cx + 30},${cy + 50} l6,-26 -12,4z" fill="#F4EEDC" ${O}/>`);
  out.push(`<path d="M${cx - 86},${cy - 40} C${cx - 96},${cy + 30} ${cx - 60},${cy + 80} ${cx - 20},${cy + 90}" fill="none" stroke="${s.glow}" stroke-width="7" opacity="0.9"/>`);
  return out.join(''); }
const hood = s => { const x = 256, y = 120; return `<path d="M${x - 110},${y + 190} C${x - 130},${y - 10} ${x - 40},${y - 30} ${x},${y - 30} C${x + 40},${y - 30} ${x + 130},${y - 10} ${x + 110},${y + 190} L${x + 86},${y + 100} C${x + 60},${y + 20} ${x - 60},${y + 20} ${x - 86},${y + 100}Z" fill="${shade(s.clsColor, 0.85)}" ${O}/>`; };
function shield(s) { const x = 132, y = 430; return `<path d="M${x - 62},${y - 80} L${x + 62},${y - 80} L${x + 62},${y - 10} C${x + 62},${y + 50} ${x + 10},${y + 86} ${x},${y + 96} C${x - 10},${y + 86} ${x - 62},${y + 50} ${x - 62},${y - 10}Z" fill="${shade(s.cape, 1.1)}" ${O}/><path d="M${x - 50},${y - 68} L${x + 50},${y - 68}" stroke="#C9A227" stroke-width="7"/>` + (EMB[s.emblem] || coin)(x, y - 4, 26); }
function weapon(s) { const hx = 420, hy = 450, skin = s.skin, g = s.glow; const hand = (x = hx, y = hy) => `<circle cx="${x}" cy="${y}" r="30" fill="${skin}" ${O}/>`;
  const blade = (w, len) => `<g transform="rotate(10 ${hx} ${hy})"><rect x="${hx - w - 20}" y="${hy - len - 40}" width="${2 * w + 40}" height="${len + 40}" rx="20" fill="${g}" opacity="0.35"/><path d="M${hx - w},${hy - 10} L${hx - w},${hy - len + 40} L${hx},${hy - len} L${hx + w},${hy - len + 40} L${hx + w},${hy - 10}Z" fill="url(#sw)" ${O}/><line x1="${hx}" y1="${hy - len + 30}" x2="${hx}" y2="${hy - 20}" stroke="${g}" stroke-width="6"/><rect x="${hx - w - 40}" y="${hy - 16}" width="${2 * w + 80}" height="28" rx="8" fill="#C9A227" ${O}/><rect x="${hx - 14}" y="${hy + 10}" width="28" height="60" fill="#5A3A22" ${O}/><circle cx="${hx}" cy="${hy + 76}" r="16" fill="#C9A227" ${O}/></g>` + hand();
  switch (s.weapon) {
    case 'great': return blade(36, 340); case 'blade': return blade(24, 290);
    case 'axe': case 'greataxe': { const big = s.weapon === 'greataxe' ? 1.35 : 1; return `<g transform="rotate(-12 ${hx} ${hy})"><circle cx="${hx + 40}" cy="${hy - 230}" r="${80 * big}" fill="${g}" opacity="0.3"/><rect x="${hx - 10}" y="${hy - 280}" width="20" height="320" fill="#8A5A3A" ${O}/><path d="M${hx},${hy - 290 * 1} C${hx + 110 * big},${hy - 310} ${hx + 120 * big},${hy - 170} ${hx},${hy - 180}Z" fill="url(#sw)" ${O}/></g>` + hand(); }
    case 'mace': case 'maul': return `<circle cx="${hx}" cy="${hy - 190}" r="70" fill="${g}" opacity="0.35"/><rect x="${hx - 10}" y="${hy - 180}" width="20" height="200" fill="#8A5A3A" ${O}/>` + (s.weapon === 'maul' ? `<rect x="${hx - 64}" y="${hy - 240}" width="128" height="70" rx="12" fill="url(#plate)" ${O}/>` : sun(hx, hy - 190, 44)) + hand();
    case 'staff': return `<circle cx="${hx}" cy="${hy - 300}" r="60" fill="${g}" opacity="0.45"/><rect x="${hx - 10}" y="${hy - 290}" width="20" height="360" rx="8" fill="#6B4A2E" ${O}/><circle cx="${hx}" cy="${hy - 300}" r="26" fill="${s.spellColor}" ${O}/><circle cx="${hx - 8}" cy="${hy - 308}" r="8" fill="#FFFFFF" opacity="0.8"/>` + hand();
    case 'spear': return `<g transform="rotate(6 ${hx} ${hy})"><rect x="${hx - 8}" y="${hy - 330}" width="16" height="400" fill="#8A5A3A" ${O}/><path d="M${hx},${hy - 400} L${hx + 26},${hy - 330} L${hx - 26},${hy - 330}Z" fill="url(#sw)" ${O}/><circle cx="${hx}" cy="${hy - 360}" r="50" fill="${g}" opacity="0.3"/></g>` + hand();
    case 'dagger': return `<circle cx="${hx}" cy="${hy - 80}" r="60" fill="${g}" opacity="0.3"/><path d="M${hx - 14},${hy - 10} L${hx},${hy - 150} L${hx + 14},${hy - 10}Z" fill="url(#sw)" ${O}/><rect x="${hx - 36}" y="${hy - 16}" width="72" height="16" fill="#3E4452" ${O}/>` + hand();
    case 'bow': return `<path d="M${hx - 10},${hy - 300} C${hx + 90},${hy - 180} ${hx + 90},${hy + 10} ${hx - 10},${hy + 70}" fill="none" stroke="#A07A4A" stroke-width="20"/><path d="M${hx - 10},${hy - 300} C${hx + 90},${hy - 180} ${hx + 90},${hy + 10} ${hx - 10},${hy + 70}" fill="none" stroke="${OL}" stroke-width="4"/><line x1="${hx - 10}" y1="${hy - 300}" x2="${hx - 10}" y2="${hy + 70}" stroke="#E8E0C8" stroke-width="4"/><path d="M${hx - 10},${hy - 300} l-8,22 16,0z M${hx - 10},${hy + 70} l-8,-22 16,0z" fill="#C9A227" ${O}/>` + hand(hx, hy - 110);
    case 'fists': return `<circle cx="${hx}" cy="${hy - 40}" r="64" fill="${g}" opacity="0.45"/><circle cx="${hx}" cy="${hy - 40}" r="34" fill="${skin}" ${O}/><path d="M${hx - 22},${hy - 56} h44 M${hx - 22},${hy - 40} h44" stroke="${OL}" stroke-width="5"/><rect x="${hx - 34}" y="${hy - 12}" width="68" height="18" rx="6" fill="${s.trim}" ${O}/>`;
    default: { const c = s.spellColor; return `<g transform="rotate(-25 ${hx} ${hy})"><rect x="${hx - 8}" y="${hy - 150}" width="16" height="170" rx="6" fill="#4A2E1A" ${O}/><circle cx="${hx}" cy="${hy - 160}" r="12" fill="#C9A227" ${O}/></g><circle cx="${hx + 10}" cy="${hy - 190}" r="66" fill="${c}" opacity="0.3"/><path d="M${hx + 10},${hy - 260} C${hx + 70},${hy - 200} ${hx + 60},${hy - 130} ${hx + 10},${hy - 125} C${hx - 40},${hy - 130} ${hx - 50},${hy - 200} ${hx + 10},${hy - 260}Z" fill="${c}" ${O}/><path d="M${hx + 10},${hy - 220} C${hx + 40},${hy - 180} ${hx + 34},${hy - 145} ${hx + 10},${hy - 142} C${hx - 14},${hy - 145} ${hx - 20},${hy - 180} ${hx + 10},${hy - 220}Z" fill="#FFF3B0"/>` + hand(); }
  } }
function sparkles(r, n, col) { const out = []; for (let i = 0; i < n; i++) { let x, y, s; do { x = r.r(30, 482); y = r.r(30, 300); s = r.r(10, 22); } while (x > 120 && x < 392 && y > 70 && y < 330);
  out.push(`<path d="M${x.toFixed(0)},${(y - s).toFixed(0)} Q${x.toFixed(0)},${y.toFixed(0)} ${(x + s).toFixed(0)},${y.toFixed(0)} Q${x.toFixed(0)},${y.toFixed(0)} ${x.toFixed(0)},${(y + s).toFixed(0)} Q${x.toFixed(0)},${y.toFixed(0)} ${(x - s).toFixed(0)},${y.toFixed(0)} Q${x.toFixed(0)},${y.toFixed(0)} ${x.toFixed(0)},${(y - s).toFixed(0)}Z" fill="${col}" stroke="${OL}" stroke-width="3"/>`); } return out.join(''); }
export function renderPortrait(s) {
  const r = rng(s.seed); const F = SPEC[s.species].f; let [dy, sc] = SPEC[s.species].h; if (s.small && dy < 30) { dy = 34; sc = 1.07; }
  const fig = [cape(s.cape)];
  if (F.includes('tail')) fig.push(`<path d="M140,500 C60,470 50,400 80,370 L100,356 L92,386" fill="none" ${O}/>`);
  fig.push(torso(s));
  if (F.includes('halo')) fig.push(`<circle cx="256" cy="200" r="150" fill="url(#halo)"/><ellipse cx="256" cy="96" rx="96" ry="20" fill="none" stroke="${s.glow}" stroke-width="9" opacity="0.95"/>`);
  if (s.hairStyle === 'hood') fig.push(hood(s));
  fig.push(head(s, F), beard(s), face(s, F));
  if (F.includes('halo')) fig.push([-1, 1].map(k => `<circle cx="${256 + k * 38}" cy="199" r="6" fill="${s.glow}" opacity="0.95"/>`).join(''));
  if (s.species === 'dragonborn') fig.push([-1, 1].flatMap(k => [0, 1, 2].map(j => `<path d="M${256 + k * 62},${238 + j * 12} q${k * 8},-8 ${k * 16},0" fill="none" stroke="${shade(s.skin, 0.65)}" stroke-width="5"/>`)).join(''));
  if (s.shield) fig.push(shield(s));
  fig.push(weapon(s));
  const tf = `translate(${(256 * (1 - sc)).toFixed(1)},${(dy + 512 * (1 - sc) * 0.4).toFixed(1)}) scale(${sc})`;
  return dedupe(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">${bg(s.glow)}<g transform="${tf}">${fig.join('')}</g>${sparkles(r, 4, s.glow)}</svg>`);
}
// strict XML parsers (and <img src="data:image/svg+xml">) reject a repeated attribute; keep the last value
export function dedupe(svg) { return svg.replace(/<(\w+)(\s[^<>]*?)(\/?)>/g, (m, tag, attrs, sl) => { const seen = new Map(); for (const a of attrs.matchAll(/\s([\w:-]+)="([^"]*)"/g)) { seen.delete(a[1]); seen.set(a[1], a[2]); } return '<' + tag + [...seen].map(([k, v]) => ` ${k}="${v}"`).join('') + sl + '>'; }); }
export const svgDataUrl = svg => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
// raster copy for avatars/export; resolves null if the browser can't rasterize (the SVG itself still works)
export function svgToPng(svg, px = 512) { return new Promise(res => { try { const img = new Image(); img.onload = () => { try { const c = document.createElement('canvas'); c.width = c.height = px; c.getContext('2d').drawImage(img, 0, 0, px, px); res(c.toDataURL('image/png')); } catch { res(null); } }; img.onerror = () => res(null); img.src = svgDataUrl(svg); } catch { res(null); } }); }
// fallback crest if anything fails: initials on a gold coin (never blank)
export function fallbackCrest(name = '?') { const i = name.trim().split(/\s+/).map(w => w[0] || '').join('').slice(0, 2).toUpperCase() || '?';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" fill="#2b1c12"/><circle cx="256" cy="256" r="190" fill="#E8C468" stroke="#9C7A1E" stroke-width="16"/><text x="256" y="300" text-anchor="middle" font-family="Cinzel,serif" font-size="150" font-weight="700" fill="#5a3a12">${i.replace(/[<&>"]/g, '')}</text></svg>`; }
export function portraitFor(d, ch) { try { return renderPortrait(portraitSpec(d, ch)); } catch (e) { console.warn('portrait fallback', e); return fallbackCrest(d.name); } }
