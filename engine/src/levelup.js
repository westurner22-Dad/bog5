// BoG V · Phase 5 · level-up (SRD 5.2.1 / 2024 rules). Pure functions over an engine character.
// The app renders levelUpPlan(); the batch applies actions.levelUp(), which re-validates with validateLevelUp().
// HP is the fixed average per level (Lock P2-2); the SRD has one subclass per class, so it is assigned at level 3.
import { CLASSES, XP_TABLE, PB, row, cantripsKnown, preparedMax, slotsFor, weaponMasteryCount } from './rules/classes.js';
import { FEATS, SKILLS, ABILITIES, SPECIES, BACKGROUNDS } from './rules/origins.js';
import { deriveSheet, abilityScores, classSpellList } from './character.js';
import { masteryWeapons, INVOCATIONS, nice } from './forge.js';
import SRD from '../srd/data/srd.js';
const clone = v => JSON.parse(JSON.stringify(v));
const ABN = { str: 'Strength', dex: 'Dexterity', con: 'Constitution', int: 'Intelligence', wis: 'Wisdom', cha: 'Charisma' };
// feats a hero may take in place of the ASI ("the Ability Score Improvement feat or another feat for which you qualify")
export const LEVELUP_FEATS = ['ability_score_improvement', 'grappler', 'alert', 'savage_attacker', 'skilled'];
const ownedFeats = ch => [BACKGROUNDS[ch.background].feat.id, ...(SPECIES[ch.species].featFrom ? SPECIES[ch.species].featFrom(ch.speciesChoices) : []),
  ...Object.values(ch.choices.asi || {}).filter(a => a.feat).map(a => a.feat)];
const profSkills = ch => { const s = deriveSheet(ch); return Object.entries(s.skills).filter(([, v]) => v.prof).map(([k]) => k); };
const invCount = L => +row('warlock', L).eldritch_invocations || 0;

// what the next level asks for: groups of picks (like the Forge) + what changes on the sheet
export function levelUpPlan(ch) {
  const cls = CLASSES[ch.cls]; const L = ch.level + 1; const s0 = deriveSheet(ch);
  const plan = { cid: ch.id, name: ch.name, cls: ch.cls, className: cls.name, from: ch.level, to: L, xp: ch.xp, xpNeed: XP_TABLE[ch.level] ?? null,
    canLevel: ch.level < 20 && ch.xp >= XP_TABLE[ch.level], why: ch.level >= 20 ? 'level 20 is the cap' : ch.xp < XP_TABLE[ch.level] ? `needs ${XP_TABLE[ch.level].toLocaleString()} XP (has ${ch.xp.toLocaleString()})` : null, groups: [], features: [], changes: [] };
  if (ch.level >= 20) return plan;
  const avg = cls.hd / 2 + 1; plan.hp = { die: cls.hd, avg, con: s0.mods.con, note: `d${cls.hd} average ${avg} + CON ${s0.mods.con >= 0 ? '+' : ''}${s0.mods.con} (fixed average, P2-2)` };
  plan.features = cls.features.filter(f => f.level === L).map(f => ({ id: f.id, name: f.name, sub: !!f.sub, text: (f.text || f.desc || '').slice(0, 400) }));
  if (L === 3) plan.subclass = { id: cls.subclass.id, name: cls.subclass.name, note: 'SRD 5.2.1 has one subclass per class' };
  if (cls.asiLevels.includes(L)) {
    const sc = abilityScores(ch).scores; const owned = ownedFeats(ch);
    plan.groups.push({ key: 'asi', kind: 'asi', label: 'Ability Score Improvement or a feat', scores: sc,
      feats: LEVELUP_FEATS.map(id => { const f = FEATS[id]; let ok = true, why = null;
        if (!f.repeatable && id !== 'ability_score_improvement' && owned.includes(id)) { ok = false; why = 'you already have it'; }
        if (id === 'grappler' && sc.str < 13 && sc.dex < 13) { ok = false; why = 'needs STR or DEX 13'; }
        if (id === 'grappler' && sc.str >= 20 && sc.dex >= 20) { ok = false; why = 'STR and DEX are already 20'; }
        return { id, name: f.name, cat: f.cat, ok, why, hint: FEAT_HINT[id] }; }) });
  }
  if (L === 3 && ch.cls === 'bard') plan.groups.push({ key: 'bonusSkills', kind: 'pick', label: 'College of Lore: three bonus skills', n: 3, options: Object.keys(SKILLS).filter(k => !profSkills(ch).includes(k)).map(id => ({ id, label: nice(id) })) });
  const wm0 = weaponMasteryCount(ch.cls, ch.level), wm1 = weaponMasteryCount(ch.cls, L);
  if (wm1 > wm0) plan.groups.push({ key: 'masteries', kind: 'pick', label: `Weapon Mastery: ${wm1 - wm0} more weapon`, n: wm1 - wm0, options: masteryWeapons(ch.cls).filter(o => !ch.choices.masteries.includes(o.id)) });
  if (ch.cls === 'warlock' && invCount(L) > invCount(ch.level)) plan.groups.push({ key: 'invocations', kind: 'pick', label: `Eldritch Invocations: ${invCount(L) - invCount(ch.level)} more`, n: invCount(L) - invCount(ch.level), options: INVOCATIONS.filter(i => !ch.choices.invocations.includes(i)).map(id => ({ id, label: nice(id) })) });
  if (cls.caster) {
    const c1 = cantripsKnown(ch.cls, L, ch), c0 = cantripsKnown(ch.cls, ch.level, ch); const list = classSpellList(ch.cls);
    const slots1 = slotsFor(ch.cls, L); const max1 = slots1.pact ? slots1.pact.level : slots1.slots.length; const p0 = preparedMax(ch.cls, ch.level), p1 = preparedMax(ch.cls, L);
    if (c1 > c0) plan.groups.push({ key: 'cantrips', kind: 'pick', label: `New cantrip${c1 - c0 > 1 ? 's' : ''} (${c1 - c0})`, n: c1 - c0, options: list.filter(id => SRD.spells[id].level === 0 && !ch.cantrips.includes(id)).map(spellOpt) });
    if (cls.caster.spellbook) plan.groups.push({ key: 'spellbookAdd', kind: 'pick', label: 'Two Wizard spells for your spellbook (free at level-up)', n: 2, options: list.filter(id => SRD.spells[id].level >= 1 && SRD.spells[id].level <= max1 && !ch.spellbook.includes(id)).map(spellOpt) });
    const always = new Set(s0.spellcasting.always);
    plan.groups.push({ key: 'prepared', kind: 'prepared', label: `Prepared spells (${p1}${p1 > p0 ? `, +${p1 - p0}` : ''})`, n: p1, current: [...ch.prepared], max: p1, maxLevel: max1,
      swaps: 1, rule: cls.caster.prepares === 'levelup' ? 'You may replace one prepared spell now (and must pick the new ones now: this class changes spells only when it gains a level).' : cls.caster.spellbook ? 'New prepared spells come from your spellbook. You can change the whole list after any long rest.' : ['paladin', 'ranger'].includes(ch.cls) ? 'Add the new ones now. After a long rest you can replace one spell.' : 'Add the new ones now. You can change the whole list after any long rest.',
      options: cls.caster.spellbook ? null : list.filter(id => SRD.spells[id].level >= 1 && SRD.spells[id].level <= max1 && !always.has(id)).map(spellOpt), required: cls.caster.prepares === 'levelup' });
    if (max1 > s0.spellcasting.maxSpellLevel) plan.changes.push({ what: 'Spell level', delta: `level ${max1} spells unlocked` });
  }
  // the sheet before/after with no picks (for the summary); ASI/feat effects are previewed by previewLevelUp
  const ch1 = bump(ch, L, {}); const s1 = deriveSheet(ch1);
  plan.changes.unshift({ what: 'Hit points', delta: `${s0.hpMax} \u2192 ${s1.hpMax} (+${s1.hpMax - s0.hpMax})` });
  if (s1.pb !== s0.pb) plan.changes.push({ what: 'Proficiency bonus', delta: `+${s0.pb} \u2192 +${s1.pb}` });
  if (s1.hitDice.total !== s0.hitDice.total) plan.changes.push({ what: 'Hit Point Dice', delta: `${s0.hitDice.total}d${cls.hd} \u2192 ${s1.hitDice.total}d${cls.hd}` });
  if (s1.extraAttacks > s0.extraAttacks) plan.changes.push({ what: 'Attacks per Attack action', delta: `${s0.extraAttacks} \u2192 ${s1.extraAttacks}` });
  if (s1.sneakAttack && s1.sneakAttack !== s0.sneakAttack) plan.changes.push({ what: 'Sneak Attack', delta: `${s0.sneakAttack} \u2192 ${s1.sneakAttack}` });
  if (s1.rageDamage !== s0.rageDamage) plan.changes.push({ what: 'Rage damage', delta: `+${s0.rageDamage} \u2192 +${s1.rageDamage}` });
  if (s1.spellcasting) { const a = s0.spellcasting, b = s1.spellcasting; const fmt = x => x.pact ? `${x.pact.count} \u00d7 level ${x.pact.level}` : x.slots.join(' / ');
    if (fmt(a) !== fmt(b)) plan.changes.push({ what: 'Spell slots', delta: `${fmt(a) || 'none'} \u2192 ${fmt(b)}` });
    if (b.preparedMax !== a.preparedMax) plan.changes.push({ what: 'Prepared spells', delta: `${a.preparedMax} \u2192 ${b.preparedMax}` });
    if (b.cantripsMax !== a.cantripsMax) plan.changes.push({ what: 'Cantrips', delta: `${a.cantripsMax} \u2192 ${b.cantripsMax}` });
    if (b.dc !== a.dc) plan.changes.push({ what: 'Spell save DC', delta: `${a.dc} \u2192 ${b.dc}` }); }
  for (const [k, r] of Object.entries(s1.resources)) { const m0 = s0.resources[k]?.max ?? 0; if (r.max !== m0) plan.changes.push({ what: nice(k), delta: `${m0} \u2192 ${r.max}` }); }
  if (s1.speed !== s0.speed) plan.changes.push({ what: 'Speed', delta: `${s0.speed} \u2192 ${s1.speed} ft` });
  return plan;
}
const spellOpt = id => { const s = SRD.spells[id]; return { id, label: s.name, level: s.level, school: s.school, ritual: !!s.ritual, conc: !!s.concentration, hint: `${s.level ? 'level ' + s.level : 'cantrip'} \u00b7 ${s.school}${s.ritual ? ' \u00b7 ritual' : ''}${s.concentration ? ' \u00b7 concentration' : ''}` }; };
const FEAT_HINT = { ability_score_improvement: '+2 to one score, or +1 to two (max 20)', grappler: '+1 STR or DEX; Punch and Grab; Advantage vs the creature you grapple', alert: 'add your Proficiency Bonus to Initiative; swap Initiative with an ally',
  savage_attacker: 'once per turn, roll weapon damage twice and use either', skilled: 'proficiency in three skills' };

// apply picks to a copy (no validation): the level, HP average, subclass, choices
function bump(ch, L, p) { const c = clone(ch); const cls = CLASSES[c.cls];
  c.level = L; c.hpRolls = [...c.hpRolls.slice(0, L - 2)]; while (c.hpRolls.length < L - 1) c.hpRolls.push(cls.hd / 2 + 1); if (L === 3) c.subclass = cls.subclass.id;
  if (p.asi) c.choices.asi = { ...c.choices.asi, [String(L)]: p.asi };
  if (p.cantrips?.length) c.cantrips = [...c.cantrips, ...p.cantrips];
  if (p.spellbookAdd?.length) c.spellbook = [...c.spellbook, ...p.spellbookAdd];
  if (p.masteries?.length) c.choices.masteries = [...c.choices.masteries, ...p.masteries];
  if (p.invocations?.length) c.choices.invocations = [...c.choices.invocations, ...p.invocations];
  if (p.bonusSkills?.length) c.choices.bonusSkills = [...p.bonusSkills];
  if (p.prepared) c.prepared = [...p.prepared];
  return c; }

// every rule the level-up must satisfy; [] = legal
export function validateLevelUp(ch, picks = {}) {
  const errs = []; const plan = levelUpPlan(ch); if (!plan.canLevel) return [plan.why];
  if (picks.hpRoll && picks.hpRoll !== 'average') errs.push('HP is the fixed average at every level (Lock P2-2): no rolling');
  if (picks.subclass && picks.subclass !== CLASSES[ch.cls].subclass.id) errs.push(`only the SRD subclass ${CLASSES[ch.cls].subclass.name} is available`);
  const G = Object.fromEntries(plan.groups.map(g => [g.key, g]));
  for (const k of ['asi', 'cantrips', 'spellbookAdd', 'masteries', 'invocations', 'bonusSkills', 'prepared']) if (picks[k] != null && !G[k]) errs.push(`level ${plan.to} has no ${k} choice`);
  if (G.asi) { const a = picks.asi; const sc = G.asi.scores;
    if (!a) errs.push(`level ${plan.to} needs an Ability Score Improvement or a feat`);
    else if (!a.feat || a.feat === 'ability_score_improvement') { const inc = Object.fromEntries(Object.entries(a).filter(([k]) => ABILITIES.includes(k)));
      const tot = Object.values(inc).reduce((x, y) => x + y, 0); if (tot !== 2 || Object.values(inc).some(v => !(v === 1 || v === 2))) errs.push('ASI: +2 to one score or +1 to two');
      for (const [k, v] of Object.entries(inc)) if (sc[k] + v > 20) errs.push(`ASI can't raise ${ABN[k]} above 20 (it is ${sc[k]})`);
      if (Object.keys(a).some(k => !ABILITIES.includes(k) && k !== 'feat')) errs.push('ASI: unknown ability'); }
    else { const f = G.asi.feats.find(x => x.id === a.feat); if (!f) errs.push(`${a.feat} isn't offered at level-up${a.feat === 'magic_initiate' ? ' in this build' : ''}`); else if (!f.ok) errs.push(`${f.name}: ${f.why}`);
      if (a.feat === 'grappler') { if (!['str', 'dex'].includes(a.ability)) errs.push('Grappler: +1 to STR or DEX'); else if (sc[a.ability] >= 20) errs.push(`Grappler can't raise ${ABN[a.ability]} above 20`); else if (sc[a.ability] < 13 && sc[a.ability === 'str' ? 'dex' : 'str'] < 13) errs.push('Grappler needs STR or DEX 13'); }
      if (a.feat === 'skilled') { const have = profSkills(ch); if ((a.skills || []).length !== 3 || new Set(a.skills).size !== 3) errs.push('Skilled: pick three skills'); for (const s of a.skills || []) { if (!SKILLS[s]) errs.push(`Skilled: ${s} is not a skill`); else if (have.includes(s)) errs.push(`Skilled: you're already proficient in ${nice(s)}`); } }
      if (['alert', 'savage_attacker'].includes(a.feat) && (a.ability || a.skills)) errs.push(`${FEATS[a.feat].name} grants no ability or skill choice`); } }
  for (const k of ['cantrips', 'spellbookAdd', 'masteries', 'invocations', 'bonusSkills']) { const g = G[k]; if (!g) continue; const v = picks[k] || [];
    if (v.length !== g.n) errs.push(`${g.label}: pick ${g.n} (have ${v.length})`); if (new Set(v).size !== v.length) errs.push(`${g.label}: no duplicates`);
    for (const id of v) if (!g.options.some(o => o.id === id)) errs.push(`${g.label}: ${nice(id)} isn't an option`); }
  if (G.prepared && picks.prepared) { const g = G.prepared; const v = picks.prepared; const book = [...ch.spellbook, ...(picks.spellbookAdd || [])]; const list = classSpellList(ch.cls); const always = new Set(deriveSheet(ch).spellcasting.always);
    if (v.length > g.max) errs.push(`at most ${g.max} prepared spells (have ${v.length})`); if (new Set(v).size !== v.length) errs.push('prepared: no duplicates');
    for (const id of v) { const sp = SRD.spells[id]; if (!sp || sp.level < 1 || sp.level > g.maxLevel || !list.includes(id)) errs.push(`${sp?.name || id} can't be prepared by a level ${plan.to} ${plan.className}`); else if (CLASSES[ch.cls].caster.spellbook && !book.includes(id)) errs.push(`${sp.name} isn't in your spellbook`); else if (always.has(id)) errs.push(`${sp.name} is always prepared already`); }
    const dropped = g.current.filter(id => !v.includes(id)); if (dropped.length > g.swaps) errs.push(`at level-up you can replace one prepared spell (you dropped ${dropped.length}: ${dropped.map(id => SRD.spells[id]?.name || id).join(', ')})`); }
  if (G.prepared?.required) { const n = (picks.prepared || G.prepared.current).length; if (n < G.prepared.max) errs.push(`${plan.className}s choose their new spells at level-up: prepare ${G.prepared.max} (have ${n})`); }
  return errs;
}
// the sheet after the picks (for the app's "after" column); errors included
export function previewLevelUp(ch, picks = {}) { const errors = validateLevelUp(ch, picks); const c = bump(ch, ch.level + 1, picks); let sheet = null; try { sheet = deriveSheet(c); } catch (e) { errors.push(e.message); } return { ok: !errors.length, errors, ch: c, sheet }; }
export { bump as _bump };
// a legal default (the "Suggested" button and the playtest's test seats): +2 to the class's main score (else +1/+1),
// the first options in each list, and the prepared list topped up
const PRIMARY = { barbarian: ['str', 'con'], bard: ['cha', 'dex'], cleric: ['wis', 'con'], druid: ['wis', 'con'], fighter: ['str', 'con'], monk: ['dex', 'wis'], paladin: ['str', 'cha'], ranger: ['dex', 'wis'], rogue: ['dex', 'con'], sorcerer: ['cha', 'con'], warlock: ['cha', 'con'], wizard: ['int', 'con'] };
export function suggestPicks(ch) { const plan = levelUpPlan(ch); const p = {}; if (!plan.canLevel) return p;
  for (const gr of plan.groups) {
    if (gr.kind === 'asi') { const [a, b] = PRIMARY[ch.cls]; p.asi = gr.scores[a] <= 18 ? { [a]: 2 } : gr.scores[a] <= 19 && gr.scores[b] <= 19 ? { [a]: 1, [b]: 1 } : { [b]: 2 }; if (Object.entries(p.asi).some(([k, v]) => gr.scores[k] + v > 20)) p.asi = { feat: 'alert' }; }
    else if (gr.kind === 'pick') p[gr.key] = gr.options.slice(0, gr.n).map(o => o.id);
    else if (gr.kind === 'prepared') { const always = new Set(deriveSheet(ch).spellcasting.always); const pool = gr.options ? gr.options.map(o => o.id) : [...ch.spellbook, ...(p.spellbookAdd || [])].filter(id => !always.has(id));
      const list = [...gr.current]; for (const id of pool) if (list.length < gr.max && !list.includes(id)) list.push(id); p.prepared = list; } }
  return p; }
