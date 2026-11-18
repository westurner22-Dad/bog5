// The Forge: the guided level-3 character builder's rules layer (Phase 2). Pure functions over a "draft";
// the app renders whatever this module says is legal, and every number shown comes from deriveSheet().
import { CLASSES, PB, cantripsKnown, preparedMax, slotsFor, weaponMasteryCount, row } from './rules/classes.js';
import { SPECIES, BACKGROUNDS, FEATS, SKILLS, ABILITIES, POINT_BUY, STANDARD_ARRAY } from './rules/origins.js';
import { createCharacter, deriveSheet, classSpellList, RuleError, alwaysPrepared } from './character.js';
import { classGearOptions, backgroundGearOptions, startingInventory, starterShop } from './startingGear.js';
import { itemDef } from './rules/items.js';
import SRD from '../srd/data/srd.js';

export const FORGE_LEVEL = 3;
export const STEPS = ['forge', 'name', 'species', 'class', 'background', 'abilities', 'skills', 'spells', 'equipment', 'look', 'review'];
const PRI = { barbarian: ['str', 'con', 'dex'], bard: ['cha', 'dex', 'con'], cleric: ['wis', 'con', 'str'], druid: ['wis', 'con', 'dex'], fighter: ['str', 'con', 'dex'], monk: ['dex', 'wis', 'con'],
  paladin: ['str', 'cha', 'con'], ranger: ['dex', 'wis', 'con'], rogue: ['dex', 'con', 'wis'], sorcerer: ['cha', 'con', 'dex'], warlock: ['cha', 'con', 'dex'], wizard: ['int', 'con', 'dex'] };
export const primaryOf = cls => PRI[cls];
export const METAMAGIC = ['careful', 'distant', 'empowered', 'extended', 'heightened', 'quickened', 'seeking', 'subtle', 'transmuted', 'twinned'];
export const INVOCATIONS = ['agonizing_blast', 'armor_of_shadows', 'devils_sight', 'eldritch_mind', 'eldritch_spear', 'fiendish_vigor', 'mask_of_many_faces', 'misty_visions', 'otherworldly_leap', 'pact_of_the_blade', 'pact_of_the_chain', 'pact_of_the_tome', 'repelling_blast'];
const WIZ_SCHOLAR = ['arcana', 'history', 'investigation', 'medicine', 'nature', 'religion'];
export const nice = id => String(id).replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()).replace(/\bOf\b/g, 'of').replace(/\bThe\b/g, 'the').replace(/^the/, 'The').replace(/s S/, "'s S");

export function newDraft(id) {
  return { id: id || 'h' + Date.now().toString(36), name: '', pronouns: '', player: '', species: null, speciesChoices: {}, size: null, cls: null, background: null,
    method: 'array', scores: {}, bonusMode: '2-1', plus2: null, plus1: null, choices: {}, skills: [], expertise: [], bonusSkills: [], skilled: [],
    cantrips: [], prepared: [], spellbook: [], mi: { cantrips: [], spell: null, ability: null, list: null }, gear: { cls: null, bg: null, bought: [] }, keepsake: '', look: {} };
}
// ---------- option lists ----------
export const speciesList = () => Object.entries(SPECIES).map(([id, s]) => ({ id, name: s.name, houseRule: !!s.houseRule, speed: s.speed, darkvision: s.darkvision || 0, sizes: s.size, traits: s.traits }));
export const classList = () => Object.values(CLASSES).map(c => ({ id: c.id, name: c.name, hd: c.hd, subclass: c.subclass.name, caster: c.caster?.ability || null, primary: PRI[c.id], saves: c.saves }));
export const backgroundList = () => Object.entries(BACKGROUNDS).map(([id, b]) => ({ id, name: b.name, abilities: b.abilities, feat: FEATS[b.feat.id].name + (b.feat.list ? ` (${nice(b.feat.list)})` : ''), skills: b.skills, tool: b.tool }));
export const features3 = cls => { const c = SRD.classes[cls]; return [...c.features.filter(f => f.level <= FORGE_LEVEL), ...c.subclass.features.filter(f => f.level <= FORGE_LEVEL).map(f => ({ ...f, sub: true }))]; };
const opt = (ids, f = nice) => ids.map(id => ({ id, label: f(id) }));
// groups of choices the draft still needs, per step. {key, step, label, n, options, value}
export function choiceGroups(d) {
  const G = []; const sp = SPECIES[d.species]; const c = CLASSES[d.cls]; const bg = BACKGROUNDS[d.background];
  if (sp) {
    for (const [k, opts] of Object.entries(sp.choices || {})) { if (k === 'spell_ability' && !(sp.lineage || sp.legacy)) continue; if (k === 'skillful') continue;
      let options = opt(opts); if (k === 'versatile_feat') options = opts.filter(f => !(f === bg?.feat.id && !FEATS[f].repeatable) && !(f === 'magic_initiate' && bg?.feat.id === 'magic_initiate')).map(f => ({ id: f, label: FEATS[f].name }));
      if (k === 'ancestry') options = opts.map(a => ({ id: a, label: `${nice(a.split(':')[0])} (${a.split(':')[1]})` }));
      G.push({ key: 'sc.' + k, step: 'species', label: { lineage: 'Lineage', keen_senses: 'Keen Senses skill', spell_ability: 'Spellcasting ability for species spells', legacy: 'Fiendish Legacy', giant: 'Giant Ancestry', ancestry: 'Draconic Ancestry', versatile_feat: 'Versatile: origin feat' }[k] || nice(k), n: 1, options, value: d.speciesChoices[k] ? [d.speciesChoices[k]] : [] }); }
    if (sp.size.length > 1) G.push({ key: 'size', step: 'species', label: 'Size', n: 1, options: opt(sp.size), value: d.size ? [d.size] : [] });
  }
  if (c) {
    if (d.cls === 'fighter' || d.cls === 'paladin' || d.cls === 'ranger') G.push({ key: 'ch.fightingStyle', step: 'class', label: 'Fighting Style', n: 1, options: Object.entries(FEATS).filter(([, f]) => f.cat === 'fighting_style').map(([id, f]) => ({ id, label: f.name })), value: val(d.choices.fightingStyle) });
    if (d.cls === 'cleric') G.push({ key: 'ch.divineOrder', step: 'class', label: 'Divine Order', n: 1, options: [{ id: 'protector', label: 'Protector (heavy armor, martial weapons)' }, { id: 'thaumaturge', label: 'Thaumaturge (extra cantrip, WIS to Arcana/Religion)' }], value: val(d.choices.divineOrder) });
    if (d.cls === 'druid') { G.push({ key: 'ch.primalOrder', step: 'class', label: 'Primal Order', n: 1, options: [{ id: 'magician', label: 'Magician (extra cantrip, WIS to Arcana/Nature)' }, { id: 'warden', label: 'Warden (medium armor, martial weapons)' }], value: val(d.choices.primalOrder) });
      G.push({ key: 'ch.landType', step: 'class', label: 'Circle of the Land: land', n: 1, options: [{ id: 'arid', label: 'Arid (engine-supported; other lands come later)' }], value: val(d.choices.landType) }); }
    if (d.cls === 'sorcerer') { G.push({ key: 'ch.dragon', step: 'class', label: 'Draconic ancestor', n: 1, options: SPECIES.dragonborn.choices.ancestry.map(a => ({ id: a, label: `${nice(a.split(':')[0])} (${a.split(':')[1]})` })), value: val(d.choices.dragon) });
      G.push({ key: 'ch.metamagic', step: 'class', label: 'Metamagic (choose 2)', n: 2, options: opt(METAMAGIC), value: d.choices.metamagic || [] }); }
    if (d.cls === 'warlock') G.push({ key: 'ch.invocations', step: 'class', label: `Eldritch Invocations (choose ${+row('warlock', FORGE_LEVEL).eldritch_invocations})`, n: +row('warlock', FORGE_LEVEL).eldritch_invocations, options: opt(INVOCATIONS), value: d.choices.invocations || [] });
    if (d.cls === 'ranger') G.push({ key: 'ch.huntersPrey', step: 'class', label: "Hunter's Prey", n: 1, options: [{ id: 'colossus_slayer', label: 'Colossus Slayer (+1d8 to a hurt target, once a turn)' }, { id: 'horde_breaker', label: 'Horde Breaker (extra attack on a second foe)' }], value: val(d.choices.huntersPrey) });
    const wm = weaponMasteryCount(d.cls, FORGE_LEVEL);
    if (wm) G.push({ key: 'ch.masteries', step: 'class', label: `Weapon Mastery (choose ${wm})`, n: wm, options: masteryWeapons(d.cls), value: d.choices.masteries || [] });
  }
  if (c && bg && sp) {
    const granted = grantedSkills(d); const from = c.skillChoice.from.filter(s => !granted.includes(s));
    G.push({ key: 'skills', step: 'skills', label: `${c.name} skills (choose ${c.skillChoice.n})`, n: c.skillChoice.n, options: opt(from), value: d.skills });
    if (sp.choices?.skillful) G.push({ key: 'sc.skillful', step: 'skills', label: 'Skillful (Human): one extra skill', n: 1, options: opt(Object.keys(SKILLS).filter(s => !bg.skills.includes(s) && !d.skills.includes(s) && !d.skilled.includes(s) && !(d.cls === 'bard' && d.bonusSkills.includes(s)))), value: val(d.speciesChoices.skillful) });
    if (humanFeat(d) === 'skilled' || bg.feat.id === 'skilled') G.push({ key: 'skilled', step: 'skills', label: 'Skilled feat: three more skills', n: 3, options: opt(Object.keys(SKILLS).filter(s => !profNoSkilled(d).includes(s))), value: d.skilled });
    if (d.cls === 'bard') G.push({ key: 'bonusSkills', step: 'skills', label: 'College of Lore: three bonus skills', n: 3, options: opt(Object.keys(SKILLS).filter(s => !profNoBonus(d).includes(s))), value: d.bonusSkills });
    const ex = { rogue: 2, bard: 2, ranger: 1, wizard: 1 }[d.cls];
    if (ex) { let pool = proficient(d); if (d.cls === 'wizard') pool = pool.filter(s => WIZ_SCHOLAR.includes(s));
      G.push({ key: 'expertise', step: 'skills', label: { rogue: 'Expertise (choose 2)', bard: 'Expertise (choose 2)', ranger: 'Deft Explorer: Expertise (choose 1)', wizard: 'Scholar: Expertise (choose 1)' }[d.cls], n: ex, options: opt(pool), value: d.expertise }); }
  }
  if (c?.caster) {
    const k = cantripsKnown(d.cls, FORGE_LEVEL, { choices: { divine_order: d.choices.divineOrder, primal_order: d.choices.primalOrder } }); const { slots, pact } = slotsFor(d.cls, FORGE_LEVEL); const max = pact ? pact.level : slots.length;
    const list = classSpellList(d.cls).map(id => SRD.spells[id]); const always = alwaysFor(d);
    const free = speciesCantrips(d); if (k) G.push({ key: 'cantrips', step: 'spells', label: `Cantrips (choose ${k})`, n: k, options: list.filter(s => s.level === 0 && !free.includes(s.id)).map(spellOpt), value: d.cantrips });
    const pm = preparedMax(d.cls, FORGE_LEVEL);
    if (d.cls === 'wizard') { const n = 6 + 2 * (FORGE_LEVEL - 1); G.push({ key: 'spellbook', step: 'spells', label: `Spellbook (choose ${n} wizard spells, level 1-${max})`, n, options: list.filter(s => s.level >= 1 && s.level <= max).map(spellOpt), value: d.spellbook });
      G.push({ key: 'prepared', step: 'spells', label: `Prepared from your spellbook (choose ${pm})`, n: pm, options: d.spellbook.map(id => spellOpt(SRD.spells[id])), value: d.prepared }); }
    else G.push({ key: 'prepared', step: 'spells', label: `Prepared spells (choose ${pm}, level 1-${max})`, n: pm, options: list.filter(s => s.level >= 1 && s.level <= max && !always.includes(s.id)).map(spellOpt), value: d.prepared, always });
  }
  if (bg && sp && miList(d)) { const L = miList(d); const ids = classSpellList(L).map(id => SRD.spells[id]);
    G.push({ key: 'mi.cantrips', step: 'spells', label: `Magic Initiate (${nice(L)}): 2 cantrips`, n: 2, options: ids.filter(s => s.level === 0 && !d.cantrips.includes(s.id) && !speciesCantrips(d).includes(s.id)).map(spellOpt), value: d.mi.cantrips });
    G.push({ key: 'mi.spell', step: 'spells', label: `Magic Initiate (${nice(L)}): one level 1 spell (free cast 1/long rest)`, n: 1, options: ids.filter(s => s.level === 1).map(spellOpt), value: val(d.mi.spell) });
    G.push({ key: 'mi.ability', step: 'spells', label: 'Magic Initiate: spellcasting ability', n: 1, options: [{ id: 'int', label: 'Intelligence' }, { id: 'wis', label: 'Wisdom' }, { id: 'cha', label: 'Charisma' }], value: val(d.mi.ability) });
    if (humanFeat(d) === 'magic_initiate') G.push({ key: 'mi.list', step: 'spells', label: 'Magic Initiate: spell list', n: 1, options: opt(['cleric', 'druid', 'wizard']), value: val(d.mi.list) }); }
  return G;
}
const val = x => (x ? [x] : []);
// cantrips the species already grants (Aasimar Light, elf/tiefling lineage cantrips): not offered again
function speciesCantrips(d) { const sp = SPECIES[d.species]; if (!sp) return []; const lin = sp.lineage?.[d.speciesChoices.lineage] || sp.legacy?.[d.speciesChoices.legacy]; return [sp.cantrip, lin?.cantrip].filter(Boolean); }
const spellOpt = s => ({ id: s.id, label: s.name, hint: `${s.level ? 'Level ' + s.level : 'Cantrip'} · ${s.castingTime} · ${s.range}${s.concentration ? ' · Concentration' : ''}`, level: s.level });
export function masteryWeapons(cls) { const W = Object.values(SRD.weapons).filter(w => w.mastery);
  const ok = w => cls === 'barbarian' ? (w.simple || w.melee) && w.melee : cls === 'rogue' ? w.simple || w.properties.includes('finesse') || w.properties.includes('light') : true;
  return W.filter(ok).map(w => ({ id: w.id, label: w.name, hint: `mastery: ${nice(w.mastery)}` })); }
const humanFeat = d => (d.species === 'human' ? d.speciesChoices.versatile_feat : null);
function miList(d) { const bg = BACKGROUNDS[d.background]; if (bg?.feat.id === 'magic_initiate') return bg.feat.list; if (humanFeat(d) === 'magic_initiate') return d.mi.list || 'wizard'; return null; }
function grantedSkills(d) { const bg = BACKGROUNDS[d.background]; const sp = SPECIES[d.species]; return [...(bg?.skills || []), ...(sp?.skillFrom ? sp.skillFrom(d.speciesChoices).filter(Boolean) : [])]; }
const profNoSkilled = d => [...new Set([...grantedSkills(d), ...d.skills, ...(d.cls === 'bard' ? d.bonusSkills : [])])];
const profNoBonus = d => [...new Set([...grantedSkills(d), ...d.skills, ...d.skilled])];
const proficient = d => [...new Set([...profNoSkilled(d), ...d.skilled])];
function alwaysFor(d) { if (!d.cls) return []; try { return alwaysPrepared({ cls: d.cls, level: FORGE_LEVEL, subclass: CLASSES[d.cls].subclass.id, species: d.species || 'human', speciesChoices: d.speciesChoices, choices: { dragon: d.choices.dragon, landType: d.choices.landType } }); } catch { return []; } }

// set a group's value (UI calls this; enforces n and membership so an illegal pick is impossible)
export function pick(d, key, id) {
  const g = choiceGroups(d).find(x => x.key === key); if (!g) return d; if (!g.options.some(o => o.id === id)) return d;
  const cur = [...g.value]; let next;
  if (g.n === 1) next = cur[0] === id ? [] : [id]; else next = cur.includes(id) ? cur.filter(x => x !== id) : cur.length < g.n ? [...cur, id] : cur;
  return setGroup(d, key, next);
}
function setGroup(d, key, v) {
  d = structuredClone(d); const one = v[0] || null;
  if (key.startsWith('sc.')) d.speciesChoices[key.slice(3)] = one; else if (key === 'size') d.size = one;
  else if (key.startsWith('ch.')) { const k = key.slice(3); d.choices[k] = ['metamagic', 'invocations', 'masteries'].includes(k) ? v : one; }
  else if (key === 'mi.cantrips') d.mi.cantrips = v; else if (key === 'mi.spell') d.mi.spell = one; else if (key === 'mi.ability') d.mi.ability = one; else if (key === 'mi.list') { d.mi.list = one; d.mi.cantrips = []; d.mi.spell = null; }
  else d[key] = v;
  if (key === 'spellbook') d.prepared = d.prepared.filter(x => v.includes(x));
  return prune(d);
}
// drop picks that became illegal after an upstream change (e.g. switching class)
export function prune(d) {
  for (let i = 0; i < 3; i++) for (const g of choiceGroups(d)) { const legal = g.value.filter(x => g.options.some(o => o.id === x)).slice(0, g.n); if (legal.length !== g.value.length) d = setGroupRaw(d, g.key, legal); }
  return d;
}
function setGroupRaw(d, key, v) { const one = v[0] || null; if (key.startsWith('sc.')) d.speciesChoices[key.slice(3)] = one; else if (key === 'size') d.size = one; else if (key.startsWith('ch.')) { const k = key.slice(3); d.choices[k] = ['metamagic', 'invocations', 'masteries'].includes(k) ? v : one; } else if (key === 'mi.cantrips') d.mi.cantrips = v; else if (key === 'mi.spell') d.mi.spell = one; else if (key === 'mi.ability') d.mi.ability = one; else if (key === 'mi.list') d.mi.list = one; else d[key] = v; return d; }
export function setField(d, field, v) { d = structuredClone(d); d[field] = v;
  if (field === 'cls') { d.choices = {}; d.skills = []; d.expertise = []; d.bonusSkills = []; d.cantrips = []; d.prepared = []; d.spellbook = []; d.gear = { cls: null, bg: d.gear.bg, bought: [] }; }
  if (field === 'species') { d.speciesChoices = {}; d.size = null; }
  if (field === 'background') { d.plus2 = null; d.plus1 = null; d.gear = { ...d.gear, bg: null }; d.mi = { cantrips: [], spell: null, ability: null, list: null }; }
  if (field === 'method') d.scores = v === 'pointbuy' ? defaultPB() : {};
  return prune(d); }

// ---------- ability scores ----------
export function pointBuyCost(scores) { return ABILITIES.reduce((a, k) => a + (POINT_BUY[scores[k] ?? 8] ?? 99), 0); }
export function canRaise(d, a) { if (d.method !== 'pointbuy') return false; const s = { ...defaultPB(), ...d.scores }; return s[a] < 15 && pointBuyCost({ ...s, [a]: s[a] + 1 }) <= 27; }
export function canLower(d, a) { if (d.method !== 'pointbuy') return false; const s = { ...defaultPB(), ...d.scores }; return s[a] > 8; }
const defaultPB = () => Object.fromEntries(ABILITIES.map(a => [a, 8]));
export function bump(d, a, delta) { if ((delta > 0 && !canRaise(d, a)) || (delta < 0 && !canLower(d, a))) return d; d = structuredClone(d); const s = { ...defaultPB(), ...d.scores }; s[a] += delta; d.scores = s; return d; }
export function assignArray(d, a, v) { d = structuredClone(d); if (v == null) { delete d.scores[a]; return d; } for (const k of ABILITIES) if (d.scores[k] === v) delete d.scores[k]; d.scores[a] = v; return d; }
export function suggestScores(d) { const pri = PRI[d.cls] || ['str', 'dex', 'con']; const order = [...pri, ...ABILITIES.filter(a => !pri.includes(a))]; d = structuredClone(d); d.method = 'array'; d.scores = Object.fromEntries(order.map((a, i) => [a, STANDARD_ARRAY[i]])); return d; }
export function bgBonus(d) { const bg = BACKGROUNDS[d.background]; if (!bg) return {}; if (d.bonusMode === '1-1-1') return Object.fromEntries(bg.abilities.map(a => [a, 1])); const o = {}; if (d.plus2) o[d.plus2] = 2; if (d.plus1 && d.plus1 !== d.plus2) o[d.plus1] = 1; return o; }

// ---------- spec / validation / preview ----------
// Phase 5 note 6 (Wes, Nov 13 2026): every hero walks into the first adventure with exactly 75 gp in hand after Forge gear.
// King Elon's treasury pays a stipend that tops the purse up to 75 gp; a purse already above 75 gp is left alone.
// The kit's own gold (purseAfterGear) is still the shopping budget in the Forge; the stipend lands after shopping.
export const STIPEND_CP = 7500;
const kitOf = d => d.cls && d.background && d.gear.cls && d.gear.bg ? startingInventory(d.cls, d.gear.cls, d.background, d.gear.bg, d.gear.bought.map(b => [b.id, b.qty])) : { inventory: [], coin: 0 };
const spentOf = d => d.gear.bought.reduce((a, b) => a + itemDef({ id: b.id }).cost * b.qty, 0);
export function purseAfterGear(d) { return kitOf(d).coin - spentOf(d); }
export function stipendFor(purse) { return purse >= 0 ? Math.max(0, STIPEND_CP - purse) : 0; }
export function toSpec(d) {
  const sp = SPECIES[d.species]; const sc = { ...d.speciesChoices }; const inv = kitOf(d);
  const spent = spentOf(d); const purse = inv.coin - spent;
  const spec = { id: d.id, name: d.name.trim(), player: d.player || null, flavor: { pronouns: d.pronouns, keepsake: d.keepsake, look: d.look, glow: true }, level: FORGE_LEVEL, cls: d.cls, species: d.species, speciesChoices: sc, size: d.size || sp?.size[0],
    background: d.background, method: d.method, scores: d.scores, bgBonus: bgBonus(d), asi: {}, skills: d.skills, expertise: d.expertise, fightingStyle: d.choices.fightingStyle, masteries: d.choices.masteries || [],
    divineOrder: d.choices.divineOrder, primalOrder: d.choices.primalOrder, landType: d.choices.landType || 'arid', huntersPrey: d.choices.huntersPrey, dragon: d.choices.dragon, metamagic: d.choices.metamagic || [], invocations: d.choices.invocations || [],
    bonusSkills: d.bonusSkills, feats: d.skilled.length ? { skilled: d.skilled } : {}, cantrips: d.cantrips, prepared: d.prepared, spellbook: d.spellbook, subclass: CLASSES[d.cls]?.subclass.id,
    inventory: [...inv.inventory, ...(d.keepsake.trim() ? [{ id: 'keepsake', name: d.keepsake.trim().slice(0, 80) }] : [])], coin: purse + stipendFor(purse) };
  if (miList(d)) spec.magicInitiate = { list: miList(d), cantrips: d.mi.cantrips, spell: d.mi.spell, ability: d.mi.ability };
  return spec;
}
// forge-level errors for one step (or all); the engine's own RuleError list is added on the review step
export function stepErrors(d, step) {
  const E = []; const groups = choiceGroups(d).filter(g => !step || g.step === step);
  for (const g of groups) if (g.value.length !== g.n && !(g.key === 'prepared' && g.options.length < g.n)) E.push(`${g.label}: ${g.value.length}/${g.n}`);
  const need = (s, ok, msg) => { if ((!step || step === s) && !ok) E.push(msg); };
  need('name', d.name.trim().length >= 2, 'Name your hero (2+ letters)');
  need('species', !!d.species, 'Choose a species'); need('class', !!d.cls, 'Choose a class'); need('background', !!d.background, 'Choose a background');
  if (!step || step === 'background') { if (d.background && d.bonusMode === '2-1' && (!d.plus2 || !d.plus1 || d.plus1 === d.plus2)) E.push('Background bonus: pick +2 and +1 (different abilities)'); }
  if (!step || step === 'abilities') { const v = ABILITIES.map(a => d.scores[a]); if (d.method === 'array') { if (v.some(x => x == null)) E.push('Assign all six standard-array scores'); } else { const s = { ...defaultPB(), ...d.scores }; const c = pointBuyCost(s); if (c > 27) E.push(`Point buy over budget (${c}/27)`); else if (c < 27) E.push(`Point buy: ${27 - c} points left to spend`); } }
  if (!step || step === 'equipment') { if (!d.gear.cls || !d.gear.bg) E.push('Choose class and background equipment'); else if (purseAfterGear(d) < 0) E.push('Not enough gold for that shopping list'); }
  return E;
}
export function evaluate(d) {
  const errors = stepErrors(d); let ch = null, sheet = null; const ruleErrors = [];
  if (d.species && d.cls && d.background) { try { ch = createCharacter(toSpec(d)); sheet = deriveSheet(ch); } catch (e) { if (e instanceof RuleError) ruleErrors.push(...e.list); else ruleErrors.push(e.message); } }
  return { ok: !errors.length && !ruleErrors.length && !!sheet, errors, ruleErrors, ch, sheet };
}
// a live preview even while the draft is incomplete: fill gaps with legal defaults (marked pending)
export function preview(d) {
  if (!d.cls) return null; let x = structuredClone(d); const pending = [];
  if (!x.species) { x.species = 'human'; pending.push('species'); } if (!x.background) { x.background = { str: 'soldier', dex: 'criminal', con: 'soldier', int: 'sage', wis: 'sage', cha: 'acolyte' }[PRI[x.cls][0]]; pending.push('background'); }
  if (ABILITIES.some(a => x.scores[a] == null) || (x.method === 'pointbuy' && pointBuyCost(x.scores) > 27)) { x = { ...suggestScores(x), species: x.species, background: x.background }; pending.push('abilities'); }
  const bg = BACKGROUNDS[x.background]; if (!(x.bonusMode === '1-1-1' || (x.plus2 && x.plus1 && x.plus1 !== x.plus2))) { x.bonusMode = '2-1'; x.plus2 = bg.abilities.includes(PRI[x.cls][0]) ? PRI[x.cls][0] : bg.abilities[0]; x.plus1 = bg.abilities.find(a => a !== x.plus2); }
  for (let pass = 0; pass < 4; pass++) for (const key of choiceGroups(x).map(z => z.key)) { const g = choiceGroups(x).find(z => z.key === key); if (!g || !(g.value.length < g.n && g.options.length)) continue; const add = g.options.map(o => o.id).filter(id => !g.value.includes(id)).slice(0, g.n - g.value.length); x = setGroupRaw(x, g.key, [...g.value, ...add]); x = prune(x); if (!pending.includes(g.step)) pending.push(g.step); }
  if (!x.gear.cls) x.gear = { ...x.gear, cls: 'A' }; if (!x.gear.bg) x.gear = { ...x.gear, bg: 'A' };
  if (!x.name.trim()) x.name = 'Unnamed hero';
  try { const ch = createCharacter(toSpec(x)); return { sheet: deriveSheet(ch), ch, pending }; } catch (e) { return { sheet: null, error: e.message, pending }; }
}
// ---------- party gap hint ----------
export const ROLES = { frontline: 'Front line', healer: 'Healer', blaster: 'Spell damage', skills: 'Skills & locks', face: 'Talker', scout: 'Ranged & scouting' };
export function rolesOf(sheet, ch) {
  const r = new Set(); const sc = sheet.spellcasting; const known = [...(ch?.prepared || []), ...(ch?.cantrips || []), ...(sc?.always || [])];
  if (sheet.ac.v >= 16 && sheet.hpMax >= 24) r.add('frontline'); if (['barbarian', 'fighter', 'paladin'].includes(sheet.cls)) r.add('frontline');
  if (known.some(s => ['cure_wounds', 'healing_word', 'prayer_of_healing', 'aid'].includes(s)) || sheet.resources.lay_on_hands) r.add('healer');
  if (known.some(s => SRD.spells[s]?.level >= 0 && /damage/i.test(SRD.spells[s]?.text || '') && ['wizard', 'sorcerer', 'warlock', 'druid', 'bard', 'cleric'].includes(sheet.cls))) r.add('blaster');
  if (sheet.skills.stealth.v >= 5 || (ch?.choices.expertise || []).length || ['rogue'].includes(sheet.cls)) r.add('skills');
  if (Math.max(sheet.skills.persuasion.v, sheet.skills.deception.v, sheet.skills.intimidation.v) >= 4) r.add('face');
  if (sheet.attacks.some(a => !a.melee && a.toHit >= 5) || sheet.skills.perception.v >= 5) r.add('scout');
  return [...r];
}
export function partyGaps(members) { const have = {}; for (const m of members) for (const r of m.roles) (have[r] = have[r] || []).push(m.name); return Object.keys(ROLES).map(k => ({ role: k, label: ROLES[k], who: have[k] || [] })); }
export { classGearOptions, backgroundGearOptions, starterShop, STANDARD_ARRAY, POINT_BUY, ABILITIES, SKILLS, PB };
