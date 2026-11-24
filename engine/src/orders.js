// Combat-order option lists shared by the table UI and tests.
// Bonus-action spells (except after-hit smites) and class features that the
// engine can actually resolve this turn. Smites are listed separately as
// on-hit riders, not as a pre-attack bonus cast.
import SRD from '../srd/data/srd.js';
import { spellModel } from './rules/spellEffects.js';

const bonusKinds = new Set(['heal', 'buff', 'summon_attack', 'cure']);

export function knownSpellIds(c, s) {
  return [...new Set([...(c.cantrips || []), ...(c.prepared || []), ...(s.spellcasting?.always || [])])];
}

export function isActionSpell(id, { v2 = false, castRounds } = {}) {
  const sp = SRD.spells[id]; if (!sp) return false;
  if (/^action/i.test(sp.castingTime || '')) return true;
  if (v2 && typeof castRounds === 'function') { const n = castRounds(sp); return n > 1 && n <= 10; }
  return false;
}

export function isHitRiderSpell(id) {
  const sp = SRD.spells[id]; if (!sp) return false;
  if (spellModel(id)?.kind === 'smite') return true;
  return /immediately after hitting/i.test(sp.castingTime || '');
}

export function isBonusSpell(id) {
  const sp = SRD.spells[id]; if (!sp) return false;
  if (!/^bonus/i.test(sp.castingTime || '')) return false;
  if (isHitRiderSpell(id)) return false;
  const m = spellModel(id);
  return !!(m && bonusKinds.has(m.kind));
}

export function isSmiteSpell(id) { return spellModel(id)?.kind === 'smite'; }

function withSlots(ids, s, { freeable } = {}) {
  const slots = s.spellcasting?.slotsLeft || [];
  return ids.map(id => {
    const sp = SRD.spells[id]; if (!sp) return null;
    const free = !!(freeable && freeable(id));
    return { id, name: sp.name, level: sp.level, free, concentration: !!sp.concentration };
  }).filter(x => x && (x.level === 0 || x.free || slots.slice(x.level - 1).some(n => n > 0)))
    .sort((a, b) => a.level - b.level || a.name.localeCompare(b.name));
}

export function actionSpells(c, s, opts = {}) {
  if (!s.spellcasting) return [];
  return withSlots(knownSpellIds(c, s).filter(id => isActionSpell(id, opts)), s);
}

export function bonusSpells(c, s) {
  if (!s.spellcasting) return [];
  return withSlots(knownSpellIds(c, s).filter(isBonusSpell), s);
}

export function smiteSpells(c, s) {
  if (!s.spellcasting && !(s.resources?.free_smite?.left > 0)) return [];
  const freeDivine = (s.resources?.free_smite?.left || 0) > 0;
  return withSlots(knownSpellIds(c, s).filter(isSmiteSpell), s, { freeable: id => id === 'divine_smite' && freeDivine });
}

export function bonusFeatures(c, s) {
  const out = [];
  const effects = c.effects || [];
  const left = id => s.resources?.[id]?.left || 0;
  if (left('second_wind') > 0) out.push({ do: 'second_wind', name: 'Second Wind', left: left('second_wind') });
  if (left('bardic_inspiration') > 0) out.push({ do: 'bardic_inspiration', name: 'Bardic Inspiration', left: left('bardic_inspiration'), die: s.resources.bardic_inspiration.die, needsAlly: true });
  if (left('innate_sorcery') > 0 && !effects.some(e => e.id === 'innate_sorcery')) out.push({ do: 'innate_sorcery', name: 'Innate Sorcery', left: left('innate_sorcery') });
  if (left('celestial_revelation') > 0 && !effects.some(e => e.id === 'celestial_revelation')) out.push({ do: 'celestial_revelation', name: 'Celestial Revelation', left: left('celestial_revelation') });
  return out;
}

export function actionFeatures(c, s) {
  const out = [];
  if ((s.resources?.healing_hands?.left || 0) > 0) out.push({ do: 'healing_hands', name: 'Healing Hands', left: s.resources.healing_hands.left });
  if ((s.resources?.lay_on_hands?.left || 0) > 0) out.push({ do: 'lay_on_hands', name: 'Lay on Hands', left: s.resources.lay_on_hands.left });
  return out;
}

export function canSacredWeapon(c, s) {
  return c.cls === 'paladin' && c.subclass === 'devotion' && (s.resources?.channel_divinity?.left || 0) > 0 && !(c.effects || []).some(e => e.id === 'sacred_weapon');
}
