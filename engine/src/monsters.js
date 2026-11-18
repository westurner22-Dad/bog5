// SRD 5.2.1 monsters → combatant templates. Monster special actions (breath weapons, spellcasting, legendary
// actions) are not automated: the engine runs their weapon attacks + Multiattack and flags the rest for the GM.
import SRD from '../srd/data/srd.js';
const BAD = new Set(['actions', 'bonus_actions', 'reactions']);
export const MONSTERS = Object.fromEntries(Object.entries(SRD.monsters).filter(([k]) => !BAD.has(k)));
const split = s => String(s || '').toLowerCase().split(/[;,]/).map(x => x.trim()).filter(Boolean);
const DT = ['acid', 'bludgeoning', 'cold', 'fire', 'force', 'lightning', 'necrotic', 'piercing', 'poison', 'psychic', 'radiant', 'slashing', 'thunder'];
export function monsterTemplate(id, over = {}) {
  const m = MONSTERS[id]; if (!m) throw new Error('unknown SRD monster ' + id);
  const mod = s => Math.floor((s - 10) / 2);
  const saves = Object.fromEntries(Object.entries(m.abilities).map(([a, v]) => [a, v.save ?? mod(v.score)]));
  const imm = split(m.immunities);
  const sizeSq = { Tiny: 1, Small: 1, Medium: 1, Large: 2, Huge: 3, Gargantuan: 4 }[m.size] || 1;
  return {
    kind: 'npc', monster: id, name: m.name, type: m.type, size: sizeSq, ac: m.ac, maxHp: m.hp, hp: { cur: m.hp, temp: 0 }, init: m.init, speed: m.speed,
    dexMod: mod(m.abilities.dex.score), saves, xp: m.xp, cr: m.cr,
    resist: split(m.resistances).filter(x => DT.includes(x)), immune: imm.filter(x => DT.includes(x)), condImmune: imm.filter(x => !DT.includes(x)), vuln: split(m.vulnerabilities).filter(x => DT.includes(x)),
    attacks: (m.attacks || []).map(a => ({ name: a.name, melee: a.kind === 'melee', ranged: a.kind === 'ranged' || /javelin|bow|crossbow|sling|dart|spear/i.test(a.name), toHit: a.bonus, dice: a.dice, type: a.type, extra: a.extra, reach: 5, range: a.kind === 'ranged' ? 80 : 30 })),
    multi: m.multiattack?.count || 1, conditions: [], effects: [], tactics: {}, ...over,
  };
}
