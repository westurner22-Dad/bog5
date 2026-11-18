// Character creation (validated, SRD 5.2.1) and the derived sheet. deriveSheet() is the single source of every
// number a player sees; each total carries an itemized "parts" list so the UI can show where it came from.
import { ABILITIES, SKILLS, SPECIES, BACKGROUNDS, FEATS, POINT_BUY, STANDARD_ARRAY } from './rules/origins.js';
import { CLASSES, PB, XP_TABLE, row, slotsFor, cantripsKnown, preparedMax, classResources, weaponMasteryCount, martialArtsDie, sneakDice, FEATURE_SUPPORT } from './rules/classes.js';
import { itemDef } from './rules/items.js';
import SRD from '../srd/data/srd.js';

export const mod = s => Math.floor((s - 10) / 2);
export const SLOTS = ['armor', 'off', 'main', 'ranged', 'head', 'cloak', 'neck', 'hands', 'ring1', 'ring2', 'belt', 'feet'];
let uidN = 0; export const newUid = (p = 'i') => `${p}${(++uidN).toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export function validateScores(method, scores) {
  const v = ABILITIES.map(a => scores[a]); const errs = [];
  if (v.some(x => typeof x !== 'number')) return ['all six ability scores are required'];
  if (method === 'array') { if ([...v].sort((a, b) => b - a).join() !== STANDARD_ARRAY.join()) errs.push('standard array must be exactly 15, 14, 13, 12, 10, 8'); }
  else if (method === 'pointbuy') { if (v.some(x => x < 8 || x > 15)) errs.push('point buy scores must be 8-15'); else { const cost = v.reduce((a, x) => a + POINT_BUY[x], 0); if (cost > 27) errs.push(`point buy costs ${cost} > 27`); } }
  else errs.push('method must be array or pointbuy');
  return errs;
}

// spec -> character state (throws with a list of rule errors)
export function createCharacter(spec) {
  const errs = []; const cls = CLASSES[spec.cls]; const sp = SPECIES[spec.species]; const bg = BACKGROUNDS[spec.background];
  if (!cls) errs.push('unknown class ' + spec.cls); if (!sp) errs.push('unknown species ' + spec.species); if (!bg) errs.push('unknown background ' + spec.background);
  if (errs.length) throw new RuleError(errs);
  errs.push(...validateScores(spec.method, spec.scores));
  const bonus = spec.bgBonus || {}; const bvals = Object.values(bonus).sort().join();
  if (!Object.keys(bonus).every(k => bg.abilities.includes(k))) errs.push(`background bonuses must go to ${bg.abilities.join('/')}`);
  if (!(bvals === '1,2' || (bvals === '1,1,1' && Object.keys(bonus).length === 3))) errs.push('background bonus must be +2/+1 or +1/+1/+1');
  const level = spec.level || 1; if (level < 1 || level > 20) errs.push('level must be 1-20');
  const skills = spec.skills || [];
  if (skills.length !== cls.skillChoice.n) errs.push(`${cls.name} picks exactly ${cls.skillChoice.n} skills`);
  for (const s of skills) if (!cls.skillChoice.from.includes(s)) errs.push(`${s} is not a ${cls.name} skill option`);
  for (const [k, opts] of Object.entries(sp.choices || {})) if (k !== 'spell_ability' || sp.lineage || sp.legacy) { if (!spec.speciesChoices || !opts.includes(spec.speciesChoices[k])) errs.push(`${sp.name} needs a valid ${k}`); }
  if (spec.size && !sp.size.includes(spec.size)) errs.push(`${sp.name} can't be ${spec.size}`);
  if (cls.id === 'fighter' || (level >= 2 && (cls.id === 'paladin' || cls.id === 'ranger'))) { if (!FEATS[spec.fightingStyle] || FEATS[spec.fightingStyle].cat !== 'fighting_style') errs.push('needs a fighting style feat'); }
  const wm = weaponMasteryCount(cls.id, level); if ((spec.masteries || []).length > wm) errs.push(`only ${wm} weapon masteries at level ${level}`);
  if ((spec.masteries || []).some(w => !SRD.weapons[w])) errs.push('mastery must name an SRD weapon');
  if (cls.id === 'cleric' && !['protector', 'thaumaturge'].includes(spec.divineOrder)) errs.push('cleric needs Divine Order');
  if (cls.id === 'druid' && !['magician', 'warden'].includes(spec.primalOrder)) errs.push('druid needs Primal Order');
  const asi = spec.asi || {}; for (const L of cls.asiLevels.filter(l => l <= level)) { const a = asi[L]; if (!a) errs.push(`level ${L} needs an ASI or feat`); else if (!a.feat || a.feat === 'ability_score_improvement') { const t = Object.entries(a).filter(([k]) => ABILITIES.includes(k)).reduce((x, [, y]) => x + y, 0); if (t !== 2) errs.push(`ASI at ${L} must total +2`); } }
  if (level >= 3 && spec.subclass && spec.subclass !== cls.subclass.id) errs.push(`only SRD subclass ${cls.subclass.name} is available`);
  const ch = {
    id: spec.id || newUid('c'), name: spec.name, player: spec.player || null, flavor: spec.flavor || {},
    species: spec.species, speciesChoices: spec.speciesChoices || {}, size: spec.size || sp.size[0], background: spec.background, bgBonus: bonus,
    method: spec.method, scores: { ...spec.scores }, cls: cls.id, subclass: level >= 3 ? cls.subclass.id : null, level, xp: spec.xp ?? XP_TABLE[level - 1],
    choices: { skills, expertise: spec.expertise || [], fightingStyle: spec.fightingStyle || null, masteries: spec.masteries || [], divine_order: spec.divineOrder || null,
      primal_order: spec.primalOrder || null, asi, feats: spec.feats || {}, landType: spec.landType || 'arid', hunters_prey: spec.huntersPrey || 'colossus_slayer',
      dragon: spec.dragon || null, metamagic: spec.metamagic || [], invocations: spec.invocations || [], resistChoice: spec.resistChoice || null, bonusSkills: spec.bonusSkills || [], magicInitiate: spec.magicInitiate || null },
    hpRolls: spec.hpRolls || [], hp: { cur: 0, temp: 0 }, hdSpent: 0, slotsSpent: [], pactSpent: 0, resSpent: {},
    conditions: [], effects: [], exhaustion: 0, conc: null, death: { s: 0, f: 0, stable: false, dead: false }, inspiration: false,
    inventory: [], coin: spec.coin ?? 0, cantrips: spec.cantrips || [], prepared: spec.prepared || [], spellbook: spec.spellbook || [], hunger: { daysNoFood: 0, foodDebt: false, waterDebt: false }, deaths: 0,
  };
  for (const it of spec.inventory || []) ch.inventory.push(makeItem(it));
  // spells legality
  const s0 = deriveSheet(ch);
  if (s0.spellcasting) {
    const sc = s0.spellcasting; const lists = spellListOf(ch);
    if (ch.cantrips.length > sc.cantripsMax) errs.push(`too many cantrips (${ch.cantrips.length}/${sc.cantripsMax})`);
    if (ch.prepared.length > sc.preparedMax) errs.push(`too many prepared spells (${ch.prepared.length}/${sc.preparedMax})`);
    for (const id of ch.cantrips) { const s = SRD.spells[id]; if (!s || s.level !== 0 || !lists.includes(id)) errs.push(`${id} is not a ${cls.name} cantrip`); }
    for (const id of ch.prepared) { const s = SRD.spells[id]; if (!s || s.level < 1 || s.level > sc.maxSpellLevel || !lists.includes(id)) errs.push(`${id} can't be prepared by this ${cls.name}`); if (cls.caster.spellbook && !ch.spellbook.includes(id)) errs.push(`${id} is not in the spellbook`); }
  }
  const mi = feats0(ch).includes('magic_initiate');
  if (mi) { const list = BACKGROUNDS[ch.background].feat.id === 'magic_initiate' ? BACKGROUNDS[ch.background].feat.list : (spec.magicInitiate?.list); const x = spec.magicInitiate; const L = list && classSpellList(list);
    if (!x || !L) errs.push('Magic Initiate needs {list, cantrips:[2], spell, ability}');
    else { if ((x.cantrips || []).length !== 2 || x.cantrips.some(id => SRD.spells[id]?.level !== 0 || !L.includes(id))) errs.push(`Magic Initiate: pick 2 ${list} cantrips`);
      if (SRD.spells[x.spell]?.level !== 1 || !L.includes(x.spell)) errs.push(`Magic Initiate: pick one level 1 ${list} spell`); if (!['int', 'wis', 'cha'].includes(x.ability)) errs.push('Magic Initiate ability must be INT, WIS or CHA');
      ch.choices.magicInitiate = { ...x, list }; } }
  if (errs.length) throw new RuleError(errs);
  ch.hp.cur = s0.hpMax; return ch;
}
const feats0 = ch => [BACKGROUNDS[ch.background].feat.id, ...(SPECIES[ch.species].featFrom ? SPECIES[ch.species].featFrom(ch.speciesChoices) : [])];
export class RuleError extends Error { constructor(list) { super(list.join('; ')); this.list = list; } }
export function makeItem(it) { const o = typeof it === 'string' ? { id: it } : { ...it }; o.uid = o.uid || newUid(); o.qty = o.qty ?? 1; o.slot = o.slot || null; o.attuned = !!o.attuned; o.banked = o.banked ?? true; itemDef(o); return o; }
export const classSpellList = cls => Object.values(SRD.spells).filter(s => s.classes.includes(cls)).map(s => s.id);
export function spellListOf(ch) { return classSpellList(ch.cls); }
export function alwaysPrepared(ch) {
  const c = CLASSES[ch.cls]; const out = [];
  if (ch.subclass) for (const [L, list] of Object.entries(c.subclass.spells)) if (ch.level >= +L) out.push(...list);
  if (ch.cls === 'paladin' && ch.level >= 2) out.push('divine_smite');
  if (ch.cls === 'paladin' && ch.level >= 5) out.push('find_steed');
  if (ch.cls === 'ranger') out.push('hunters_mark');
  const sp = SPECIES[ch.species]; const lin = sp.lineage?.[ch.speciesChoices.lineage] || sp.legacy?.[ch.speciesChoices.legacy];
  if (lin) for (const [L, s] of Object.entries(lin.spells)) if (ch.level >= +L) out.push(s);
  return [...new Set(out)].filter(id => SRD.spells[id]);
}

export function abilityScores(ch) {
  const out = {}, parts = {};
  for (const a of ABILITIES) { out[a] = ch.scores[a]; parts[a] = [{ src: ch.method === 'array' ? 'standard array' : 'point buy', v: ch.scores[a] }]; }
  for (const [a, v] of Object.entries(ch.bgBonus)) { out[a] += v; parts[a].push({ src: BACKGROUNDS[ch.background].name, v }); }
  for (const [L, a] of Object.entries(ch.choices.asi)) if (+L <= ch.level) { if (!a.feat || a.feat === 'ability_score_improvement') { for (const [k, v] of Object.entries(a)) if (ABILITIES.includes(k)) { out[k] += v; parts[k].push({ src: `ASI (level ${L})`, v }); } }
    else if (a.ability && ABILITIES.includes(a.ability)) { out[a.ability] += 1; parts[a.ability].push({ src: `${FEATS[a.feat]?.name || a.feat} (level ${L})`, v: 1 }); } }
  for (const a of ABILITIES) if (out[a] > 20) { parts[a].push({ src: 'cap 20', v: 20 - out[a] }); out[a] = 20; }
  for (const it of equipped(ch)) { const d = itemDef(it); if (d.setScore && (!d.attune || it.attuned)) for (const [k, v] of Object.entries(d.setScore)) if (v > out[k]) { parts[k].push({ src: d.name, set: v }); out[k] = v; } }
  return { scores: out, parts };
}
export const equipped = ch => ch.inventory.filter(i => i.slot);
const has = (ch, eff) => ch.effects.some(e => e.id === eff);

export function deriveSheet(ch) {
  const c = CLASSES[ch.cls], sp = SPECIES[ch.species], bg = BACKGROUNDS[ch.background], L = ch.level, pb = PB(L);
  const { scores, parts: scoreParts } = abilityScores(ch); const m = Object.fromEntries(ABILITIES.map(a => [a, mod(scores[a])]));
  const feats = [bg.feat.id, ...(sp.featFrom ? sp.featFrom(ch.speciesChoices) : []), ...(ch.choices.fightingStyle ? [ch.choices.fightingStyle] : []),
    ...Object.entries(ch.choices.asi).filter(([l, a]) => +l <= L && a.feat && a.feat !== 'ability_score_improvement').map(([, a]) => a.feat)];
  const hasFeat = f => feats.includes(f);
  const eq = equipped(ch).map(i => ({ inst: i, d: itemDef(i) }));
  const attunedOK = x => !x.d.attune || x.inst.attuned;
  const armor = eq.find(x => x.inst.slot === 'armor'); const shield = eq.find(x => x.inst.slot === 'off' && x.d.kind === 'shield');
  const armorTraining = [...c.armor, ...(ch.cls === 'cleric' && ch.choices.divine_order === 'protector' ? ['heavy'] : []), ...(ch.cls === 'druid' && ch.choices.primal_order === 'warden' ? ['medium'] : [])];
  const armorProf = !armor || armorTraining.includes(armor.d.armorType); const shieldProf = !shield || armorTraining.includes('shield');
  // ---- AC
  const ac = { parts: [] }; let acBase;
  if (armor) { const dx = Math.min(m.dex, armor.d.dexMax); acBase = { v: armor.d.base + dx, parts: [{ src: armor.d.name.replace(/, \+\d/, ''), v: armor.d.base }, ...(armor.d.dexMax ? [{ src: 'DEX' + (armor.d.dexMax === 2 ? ' (max 2)' : ''), v: dx }] : [])] }; if (armor.d.plus) acBase.parts.push({ src: `+${armor.d.plus} armor`, v: armor.d.plus }); acBase.v += armor.d.plus || 0; }
  else {
    const cands = [{ v: 10 + m.dex, parts: [{ src: 'unarmored 10', v: 10 }, { src: 'DEX', v: m.dex }] }];
    if (ch.cls === 'barbarian') cands.push({ v: 10 + m.dex + m.con, parts: [{ src: 'Unarmored Defense 10', v: 10 }, { src: 'DEX', v: m.dex }, { src: 'CON', v: m.con }] });
    if (ch.cls === 'monk' && !shield) cands.push({ v: 10 + m.dex + m.wis, parts: [{ src: 'Unarmored Defense 10', v: 10 }, { src: 'DEX', v: m.dex }, { src: 'WIS', v: m.wis }] });
    if (ch.cls === 'sorcerer' && L >= 3) cands.push({ v: 10 + m.dex + m.cha, parts: [{ src: 'Draconic Resilience 10', v: 10 }, { src: 'DEX', v: m.dex }, { src: 'CHA', v: m.cha }] });
    if (has(ch, 'mage_armor')) cands.push({ v: 13 + m.dex, parts: [{ src: 'Mage Armor 13', v: 13 }, { src: 'DEX', v: m.dex }] });
    acBase = cands.sort((a, b) => b.v - a.v)[0];
  }
  ac.v = acBase.v; ac.parts.push(...acBase.parts);
  if (shield && shieldProf) { ac.v += 2 + (shield.d.plus || 0); ac.parts.push({ src: 'Shield', v: 2 }); if (shield.d.plus) ac.parts.push({ src: `+${shield.d.plus} shield`, v: shield.d.plus }); }
  if (shield && !shieldProf) ac.parts.push({ src: 'Shield (no training: no bonus)', v: 0 });
  if (armor && hasFeat('defense')) { ac.v += 1; ac.parts.push({ src: 'Defense', v: 1 }); }
  for (const x of eq) if (attunedOK(x) && x.d.bonus) { if (x.d.bonus.ac) { ac.v += x.d.bonus.ac; ac.parts.push({ src: x.d.name, v: x.d.bonus.ac }); } if (x.d.bonus.acUnarmored && !armor && !shield) { ac.v += x.d.bonus.acUnarmored; ac.parts.push({ src: x.d.name, v: x.d.bonus.acUnarmored }); } }
  if (has(ch, 'shield_of_faith')) { ac.v += 2; ac.parts.push({ src: 'Shield of Faith', v: 2 }); }
  if (has(ch, 'shield_spell')) { ac.v += 5; ac.parts.push({ src: 'Shield (spell)', v: 5 }); }
  // ---- HP
  let hpMax = c.hd + m.con; const hpParts = [{ src: `level 1 (d${c.hd} max)`, v: c.hd }, { src: 'CON × level', v: m.con * L }];
  for (let l = 2; l <= L; l++) hpMax += (ch.hpRolls[l - 2] ?? (c.hd / 2 + 1)) + m.con;
  if (L > 1) hpParts.splice(1, 0, { src: `levels 2-${L}`, v: hpMax - c.hd - m.con * L });
  if (sp.hpPerLevel) { hpMax += L; hpParts.push({ src: 'Dwarven Toughness', v: L }); }
  if (ch.cls === 'sorcerer' && L >= 3) { hpMax += L; hpParts.push({ src: 'Draconic Resilience', v: L }); }
  const aid = ch.effects.find(e => e.id === 'aid'); if (aid) { hpMax += aid.maxHp; hpParts.push({ src: 'Aid', v: aid.maxHp }); }
  hpMax = Math.max(hpMax, L);
  // ---- saves
  const saveBonusItems = eq.filter(x => attunedOK(x) && x.d.bonus?.saves).reduce((a, x) => a + x.d.bonus.saves, 0);
  const aura = ch.cls === 'paladin' && L >= 6 ? Math.max(1, m.cha) : 0;
  const saves = Object.fromEntries(ABILITIES.map(a => { const prof = c.saves.includes(a); const parts = [{ src: a.toUpperCase(), v: m[a] }]; if (prof) parts.push({ src: 'proficiency', v: pb }); if (saveBonusItems) parts.push({ src: 'items', v: saveBonusItems }); if (aura) parts.push({ src: 'Aura of Protection', v: aura }); return [a, { v: parts.reduce((x, p) => x + p.v, 0), prof, parts }]; }));
  // ---- skills
  const profSkills = new Set([...ch.choices.skills, ...bg.skills, ...(sp.skillFrom ? sp.skillFrom(ch.speciesChoices) : []), ...(ch.cls === 'bard' && L >= 3 ? ch.choices.bonusSkills : []), ...(ch.choices.feats.skilled || []), ...Object.entries(ch.choices.asi).filter(([l, a]) => +l <= L && a.feat === 'skilled').flatMap(([, a]) => a.skills || [])]);
  const expertise = new Set(ch.choices.expertise);
  const joat = ch.cls === 'bard' && L >= 2;
  const skills = Object.fromEntries(Object.entries(SKILLS).map(([s, a]) => { const p = profSkills.has(s), e = expertise.has(s) && p; const parts = [{ src: a.toUpperCase(), v: m[a] }]; if (p) parts.push({ src: e ? 'expertise' : 'proficiency', v: e ? pb * 2 : pb }); else if (joat) parts.push({ src: 'Jack of All Trades', v: Math.floor(pb / 2) }); if (ch.cls === 'cleric' && ch.choices.divine_order === 'thaumaturge' && (s === 'arcana' || s === 'religion')) parts.push({ src: 'Thaumaturge', v: Math.max(1, m.wis) }); return [s, { v: parts.reduce((x, q) => x + q.v, 0), prof: p, expertise: e, ability: a, parts, adv: !!eq.find(x => x.d.advSkill?.includes(s)), dis: s === 'stealth' && !!armor?.d.stealthDis }]; }));
  // ---- speed / carry
  const lin = sp.lineage?.[ch.speciesChoices.lineage];
  let speed = lin?.speed || sp.speed; const spParts = [{ src: sp.name + (lin?.speed ? ' (Wood Elf)' : ''), v: speed }];
  const heavy = armor?.d.armorType === 'heavy';
  if (ch.cls === 'monk' && L >= 2 && !armor && !shield) { const v = parseInt(row('monk', L).unarmored_movement) || 0; speed += v; spParts.push({ src: 'Unarmored Movement', v }); }
  if (ch.cls === 'barbarian' && L >= 5 && !heavy) { speed += 10; spParts.push({ src: 'Fast Movement', v: 10 }); }
  if (ch.cls === 'ranger' && L >= 6 && !heavy) { speed += 10; spParts.push({ src: 'Roving', v: 10 }); }
  if (armor && armor.d.strReq > scores.str) { speed -= 10; spParts.push({ src: `${armor.d.name}: needs STR ${armor.d.strReq}`, v: -10 }); }
  if (ch.exhaustion) { speed -= 5 * ch.exhaustion; spParts.push({ src: `Exhaustion ${ch.exhaustion}`, v: -5 * ch.exhaustion }); }
  const carryCap = scores.str * 15 * (sp.carryAsSize === 'large' ? 2 : 1); const carried = Math.round(ch.inventory.reduce((a, i) => a + (itemDef(i).weight || 0) * i.qty, 0) * 100) / 100;
  if (carried > carryCap) { spParts.push({ src: `over carrying capacity (${carried}/${carryCap} lb)`, cap: 5 }); speed = Math.min(speed, 5); }
  speed = Math.max(0, speed);
  // ---- initiative
  const init = { v: m.dex + (hasFeat('alert') ? pb : 0) + (joat ? Math.floor(pb / 2) : 0), parts: [{ src: 'DEX', v: m.dex }, ...(hasFeat('alert') ? [{ src: 'Alert', v: pb }] : []), ...(joat ? [{ src: 'Jack of All Trades', v: Math.floor(pb / 2) }] : [])], adv: (ch.cls === 'barbarian' && L >= 7) || (ch.cls === 'fighter' && L >= 3) };
  // ---- resistances
  const resist = new Set(sp.resist ? sp.resist(ch.speciesChoices) : []);
  for (const x of eq) if (attunedOK(x) && x.d.resistChoice && ch.choices.resistChoice) resist.add(ch.choices.resistChoice);
  for (const e of ch.effects) { if (e.id === 'rage') ['bludgeoning', 'piercing', 'slashing'].forEach(t => resist.add(t)); if (e.id === 'resistance_potion') resist.add(e.type); }
  if (ch.cls === 'sorcerer' && L >= 6 && ch.choices.dragon) resist.add(ch.choices.dragon.split(':')[1]);
  // ---- attacks
  const wmasteries = new Set(weaponMasteryCount(ch.cls, L) ? ch.choices.masteries : []);
  const profWeapon = d => { if (d.simple) return true; if (c.weapons.martial) return true; if (ch.cls === 'cleric' && ch.choices.divine_order === 'protector') return true; if (ch.cls === 'druid' && ch.choices.primal_order === 'warden') return true; if (c.weapons.martialIf) return c.weapons.martialIf.some(p => d.properties.includes(p)); return false; };
  const monkWeapon = d => ch.cls === 'monk' && d.melee && (d.simple || d.properties.includes('light'));
  const attacks = [];
  const pushAtk = (inst, d, slot) => {
    const prof = profWeapon(d); const fin = d.properties.includes('finesse');
    let ab = d.melee ? 'str' : 'dex'; if (fin || monkWeapon(d)) ab = m.dex > m.str ? 'dex' : 'str';
    const parts = [{ src: ab.toUpperCase(), v: m[ab] }]; if (prof) parts.push({ src: 'proficiency', v: pb }); if (d.plus) parts.push({ src: `+${d.plus} weapon`, v: d.plus });
    if (!d.melee && hasFeat('archery')) parts.push({ src: 'Archery', v: 2 });
    let dice = d.dice; if (monkWeapon(d)) { const ma = martialArtsDie(L); if (avg(ma) > avg(dice)) dice = ma; }
    const twoHanded = d.versatile && !eq.find(x => x.inst.slot === 'off'); if (twoHanded) dice = d.versatile;
    const dmgParts = [{ src: ab.toUpperCase(), v: m[ab] }]; if (d.plus) dmgParts.push({ src: `+${d.plus} weapon`, v: d.plus });
    attacks.push({ uid: inst.uid, slot, name: d.name, weapon: d.id, ability: ab, proficient: prof, toHit: parts.reduce((a, p) => a + p.v, 0), parts, dice, dmgBonus: dmgParts.reduce((a, p) => a + p.v, 0), dmgParts,
      type: d.type, mastery: wmasteries.has(d.id) ? d.mastery : null, properties: d.properties, melee: d.melee, range: d.range, ammo: d.ammo, light: d.properties.includes('light'), heavy: d.properties.includes('heavy'), twoHanded: d.properties.includes('two_handed') || !!twoHanded, magical: !!d.plus, reach: d.properties.includes('reach') ? 10 : 5 });
  };
  for (const x of eq) if (x.d.kind === 'weapon' && ['main', 'off', 'ranged'].includes(x.inst.slot)) pushAtk(x.inst, x.d, x.inst.slot);
  { const ma = ch.cls === 'monk'; const ab = ma && m.dex > m.str ? 'dex' : 'str'; const dice = ma ? martialArtsDie(L) : '0d1';
    attacks.push({ uid: 'unarmed', slot: 'unarmed', name: 'Unarmed Strike', weapon: 'unarmed', ability: ab, proficient: true, toHit: m[ab] + pb, parts: [{ src: ab.toUpperCase(), v: m[ab] }, { src: 'proficiency', v: pb }], dice, dmgBonus: ma ? m[ab] : 1 + m[ab], dmgParts: [{ src: ma ? 'Martial Arts ' + ab.toUpperCase() : '1 + STR', v: ma ? m[ab] : 1 + m[ab] }], type: 'bludgeoning', mastery: null, properties: [], melee: true, reach: 5, magical: false }); }
  // ---- spellcasting
  let spellcasting = null;
  if (c.caster) {
    const ab = c.caster.ability; const itemBonus = 0; const { slots, pact } = slotsFor(ch.cls, L);
    spellcasting = { ability: ab, dc: 8 + m[ab] + pb + itemBonus, attack: m[ab] + pb + itemBonus, dcParts: [{ src: 'base', v: 8 }, { src: ab.toUpperCase(), v: m[ab] }, { src: 'proficiency', v: pb }],
      slots, pact, slotsLeft: slots.map((n, i) => n - (ch.slotsSpent[i] || 0)), pactLeft: pact ? pact.count - ch.pactSpent : 0,
      cantripsMax: cantripsKnown(ch.cls, L, ch), preparedMax: preparedMax(ch.cls, L), always: alwaysPrepared(ch), maxSpellLevel: pact ? pact.level : slots.length,
      canCast: armorProf, magicInitiate: ch.choices.magicInitiate, note: armorProf ? null : 'wearing armor without training: no spellcasting' };
  }
  if (!spellcasting && ch.choices.magicInitiate) { const ab = ch.choices.magicInitiate.ability; spellcasting = { ability: ab, dc: 8 + m[ab] + pb, attack: m[ab] + pb, dcParts: [{ src: 'base', v: 8 }, { src: ab.toUpperCase(), v: m[ab] }, { src: 'proficiency', v: pb }], slots: [], pact: null, slotsLeft: [], pactLeft: 0, cantripsMax: 0, preparedMax: 0, always: [], maxSpellLevel: 0, canCast: armorProf, magicInitiate: ch.choices.magicInitiate }; }
  const spLin = sp.lineage?.[ch.speciesChoices.lineage] || sp.legacy?.[ch.speciesChoices.legacy]; const spCan = [sp.cantrip, spLin?.cantrip].filter(Boolean); const spAb = sp.spellAbility || ch.speciesChoices.spell_ability;
  if (spCan.length && spAb) { const ab = spAb; if (!spellcasting) spellcasting = { ability: ab, dc: 8 + m[ab] + pb, attack: m[ab] + pb, dcParts: [{ src: 'base', v: 8 }, { src: ab.toUpperCase(), v: m[ab] }, { src: 'proficiency', v: pb }], slots: [], pact: null, slotsLeft: [], pactLeft: 0, cantripsMax: 0, preparedMax: 0, always: [], maxSpellLevel: 0, canCast: true };
    spellcasting.species = { cantrips: spCan, spells: spLin ? Object.entries(spLin.spells).filter(([lv]) => L >= +lv).map(([, id]) => id) : [], ability: ab, dc: 8 + m[ab] + pb, attack: m[ab] + pb }; }
  if (spellcasting?.magicInitiate) { const x = spellcasting.magicInitiate; spellcasting.miDc = 8 + m[x.ability] + pb; spellcasting.miAttack = m[x.ability] + pb; }
  const resources = { ...classResources(ch, m, L), ...(sp.resources ? sp.resources(L, pb) : {}), ...(ch.choices.magicInitiate ? { magic_initiate: { max: 1, reset: 'long' } } : {}) };
  for (const [k, r] of Object.entries(resources)) r.left = r.max - (ch.resSpent[k] || 0);
  const features = c.features.filter(f => f.level <= L).map(f => ({ level: f.level, name: f.name, id: f.id, sub: !!f.sub, support: FEATURE_SUPPORT[f.id] || (f.id.endsWith('_subclass') ? 'engine' : 'gm') }));
  return {
    id: ch.id, name: ch.name, level: L, cls: ch.cls, className: c.name, subclass: ch.subclass ? c.subclass.name : null, species: sp.name + (ch.speciesChoices.lineage ? ` (${ch.speciesChoices.lineage})` : ''), background: bg.name,
    pb, scores, scoreParts, mods: m, ac, hpMax, hpParts, hp: { ...ch.hp }, hitDice: { die: c.hd, total: L, left: L - ch.hdSpent }, saves, skills, passivePerception: 10 + skills.perception.v,
    speed, speedParts: spParts, initiative: init, resist: [...resist], immune: [], attacks, spellcasting, resources, features, feats,
    armor: armor ? { name: armor.d.name, proficient: armorProf, stealthDis: armor.d.stealthDis } : null, armorProf, shieldProf, carry: { carried, cap: carryCap },
    xp: { cur: ch.xp, next: XP_TABLE[Math.min(19, L)], level: L, canLevel: L < 20 && ch.xp >= XP_TABLE[L] }, conditions: ch.conditions.map(x => x.id), exhaustion: ch.exhaustion, concentration: ch.conc,
    death: { ...ch.death }, inspiration: ch.inspiration, coin: ch.coin, attuned: ch.inventory.filter(i => i.attuned).length,
    extraAttacks: Object.entries(c.extraAttack).reduce((a, [l, n]) => (L >= +l ? n : a), 1), sneakAttack: ch.cls === 'rogue' ? sneakDice(L) : null,
    rageDamage: ch.cls === 'barbarian' ? row('barbarian', L).rage_damage : 0, luck: !!sp.luck, savage: hasFeat('savage_attacker'), gwf: hasFeat('great_weapon_fighting'), twf: hasFeat('two_weapon_fighting'),
    critRange: ch.cls === 'fighter' && L >= 3 ? 19 : 20,
  };
}
const avg = e => { const mm = String(e).match(/(\d+)d(\d+)/); return mm ? mm[1] * (+mm[2] + 1) / 2 : 0; };
