// Out-of-combat commands: party setup, inventory/equip/attune, shop, potions & scrolls, spellbook copying,
// rests (Hit Point Dice, resources), supplies (rations, water, torches), XP/level-up, death & return.
import { createCharacter, deriveSheet, makeItem, mod, SLOTS, classSpellList } from './character.js';
import { itemDef } from './rules/items.js';
import { CLASSES, PB, XP_TABLE, levelForXp, slotsFor } from './rules/classes.js';
import { SCROLL_DC, sellValue, isMagic, componentFor } from './rules/items.js';
import { castSpell, heal as healC, endConcentration, knowsSpell } from './combat.js';
import { spellModel } from './rules/spellEffects.js';
import SRD from '../srd/data/srd.js';
import { validateLevelUp, _bump as bumpLevel } from './levelup.js';
import { FEATS } from './rules/origins.js';
const FEATS_NAME = id => FEATS[id]?.name || id;
const clone = v => JSON.parse(JSON.stringify(v));
export class GameError extends Error {}
const need = (ok, msg) => { if (!ok) throw new GameError(msg); };
const chr = (g, cid) => { const c = g.state.chars[cid]; need(c, 'no character ' + cid); return c; };
const inv = (g, cid, uid) => { const c = chr(g, cid); const i = c.inventory.findIndex(x => x.uid === uid || (!x.uid && x.id === uid)); need(i >= 0, `${c.name} has no item ${uid}`); return [i, c.inventory[i]]; };
const pcRef = (g, cid) => ({ kind: 'pc', cid, uid: cid, name: g.state.chars[cid].name });
const notInBattle = g => need(!g.state.encounter || !['active', 'awaiting_orders'].includes(g.state.encounter.status), 'not during a battle');
const setInv = (g, cid, list) => g.set(['chars', cid, 'inventory'], list);

export function addCharacter(g, spec) {
  const ch = createCharacter(spec); ch.inventory.forEach((it, n) => { it.uid = `${ch.id}-${n + 1}`; }); ch.uidN = ch.inventory.length;
  return g.event('char_add', { cid: ch.id }, () => { g.set(['chars', ch.id], ch); g.set(['party', 'order'], [...g.state.party.order, ch.id]); });
}
const nextUid = (g, cid) => { const n = (g.state.chars[cid].uidN || 0) + 1; g.set(['chars', cid, 'uidN'], n); return `${cid}-${n}`; };
export function giveItem(g, cid, item, { banked = false, why = 'loot' } = {}) {
  return g.event('item_gain', { cid, why }, () => { const it = makeItem(typeof item === 'string' ? { id: item } : item); it.uid = nextUid(g, cid); it.banked = banked; it.slot = null; it.attuned = false;
    const c = chr(g, cid); const stack = c.inventory.findIndex(x => x.id === it.id && !it.reskin && !it.scroll && !it.plus && !x.plus && !x.reskin && !x.scroll && itemDef(x).kind !== 'weapon' && itemDef(x).kind !== 'armor' && itemDef(x).kind !== 'shield' && itemDef(x).kind !== 'magic' && !itemDef(x).attune && !x.slot && x.banked === banked && !!x.unid === !!it.unid && (x.name || null) === (it.name || null));
    if (stack >= 0) g.set(['chars', cid, 'inventory', stack, 'qty'], c.inventory[stack].qty + it.qty); else setInv(g, cid, [...c.inventory, it]); g.note(`${c.name} gains ${it.qty > 1 ? it.qty + '× ' : ''}${itemDef(it).name}.`); });
}
export function buy(g, cid, item, qty = 1, { unitCost = null, shop = null } = {}) {
  notInBattle(g); const d = itemDef(typeof item === 'string' ? { id: item } : item); const c = chr(g, cid); const cost = Math.round((unitCost ?? d.cost) * qty);
  need(d.kind !== 'keepsake', 'keepsakes are not for sale');
  need(c.coin >= cost, `${c.name} can't afford ${d.name} (${cost / 100} gp > ${c.coin / 100} gp)`);
  g.event('buy', { cid, item: d.id, qty, cost, shop }, () => g.set(['chars', cid, 'coin'], c.coin - cost));
  return giveItem(g, cid, { ...(typeof item === 'string' ? { id: item } : item), qty }, { banked: true, why: 'bought' });
}
export function sell(g, cid, uid, qty = 1, { shop = null } = {}) { notInBattle(g); const [i, it] = inv(g, cid, uid); need(it.qty >= qty && !it.slot, 'unequip it first / not enough');
  const d = itemDef(it); need(d.kind !== 'keepsake', `${d.name} is a keepsake: it isn't for sale, at any price`); need(!it.unid, `the merchant won't price an unidentified item: identify it first`); need(!it.attuned, 'end your attunement first');
  const price = it.qty > 0 ? Math.floor(sellValue(it) * qty) : 0;
  return g.event('sell', { cid, uid, item: it.id, qty, price, shop }, () => { const c = chr(g, cid); const l = clone(c.inventory); if (l[i].qty === qty) l.splice(i, 1); else l[i].qty -= qty; setInv(g, cid, l); g.set(['chars', cid, 'coin'], c.coin + price); }); }
export function equip(g, cid, uid, slot) {
  const [i, it] = inv(g, cid, uid); const d = itemDef(it); const c = chr(g, cid);
  slot = slot || d.slot; if (d.slot === 'ring') slot = slot === 'ring' || !slot ? (c.inventory.some(x => x.slot === 'ring1') ? 'ring2' : 'ring1') : slot;
  need(SLOTS.includes(slot), `can't equip ${d.name}`); const inB = g.state.encounter?.status === 'active' || g.state.encounter?.status === 'awaiting_orders';
  need(!(inB && (d.kind === 'armor' || slot === 'armor')), "armor can't be donned during a battle");
  if (d.kind === 'weapon' && d.properties.includes('two_handed')) need(!c.inventory.some(x => x.slot === 'off'), 'two-handed: free your off hand first');
  return g.event('equip', { cid, uid, slot }, () => { const l = clone(c.inventory); for (const x of l) if (x.slot === slot) x.slot = null; l[i].slot = slot; if (slot === 'off') for (const x of l) if (x.slot === 'main' && itemDef(x).properties?.includes('two_handed')) x.slot = null; setInv(g, cid, l); });
}
export function unequip(g, cid, uid) { const [i] = inv(g, cid, uid); return g.event('unequip', { cid, uid }, () => g.set(['chars', cid, 'inventory', i, 'slot'], null)); }
// attunement: max 3 items; takes a short rest (caller says the party is resting)
export function attune(g, cid, uid) {
  const [i, it] = inv(g, cid, uid); const c = chr(g, cid); need(!it.unid, 'identify it first: you don\u2019t yet know what it is or whether it needs attunement'); const d = itemDef(it); need(d.attune, `${d.name} doesn't require attunement`); need(!it.attuned, 'already attuned');
  need(!c.inventory.some(x => x.attuned && x.id === it.id && x.uid !== it.uid), `you can't attune to more than one ${d.name}`);
  need(c.inventory.filter(x => x.attuned).length < 3, `${c.name} is already attuned to 3 items (max 3)`);
  return g.event('attune', { cid, uid }, () => g.set(['chars', cid, 'inventory', i, 'attuned'], true));
}
export function unattune(g, cid, uid) { const [i] = inv(g, cid, uid); return g.event('unattune', { cid, uid }, () => g.set(['chars', cid, 'inventory', i, 'attuned'], false)); }
function consume(g, cid, i, n = 1) { const c = chr(g, cid); const l = clone(c.inventory); l[i].qty -= n; if (l[i].qty <= 0) l.splice(i, 1); setInv(g, cid, l); }
// drink/administer a potion outside battle (inside battle use battle orders)
export function usePotion(g, cid, uid, targetCid = cid) {
  const [i, it] = inv(g, cid, uid); const d = itemDef(it); need(d.kind === 'consumable' && d.use, `${d.name} isn't a usable consumable`);
  return g.event('potion', { cid, uid, target: targetCid }, () => { consume(g, cid, i); if (d.use.heal) { const r = g.roll(d.use.heal, {}, d.name); healOut(g, targetCid, r.total, d.name); } if (d.use.effect === 'resistance_potion') g.set(['chars', targetCid, 'effects'], [...chr(g, targetCid).effects, { id: 'resistance_potion', type: it.type || 'fire', rounds: 600 }]); });
}
function healOut(g, cid, amt, why) { const c = chr(g, cid); if (c.death.dead) return 0; const max = deriveSheet(c).hpMax; const cur0 = c.hp.cur; const n = Math.min(max, cur0 + amt); g.set(['chars', cid, 'hp', 'cur'], n);
  if (cur0 === 0 && n > 0) { g.set(['chars', cid, 'death'], { s: 0, f: 0, stable: false, dead: false }); g.set(['chars', cid, 'conditions'], c.conditions.filter(x => x.id !== 'unconscious')); } g.note(`${c.name} regains ${n - cur0} HP (${why}).`); return n - cur0; }
// cast a spell outside battle (healing, buffs, utility); targets are cids
export function castOutOfCombat(g, cid, spell, level, targetCids = [cid], opt = {}) {
  notInBattle(g); const c = chr(g, cid); need(c.hp.cur > 0, `${c.name} is down`);
  return g.event('cast', { cid, spell, level, targets: targetCids }, () => { const r = castSpell(g, null, pcRef(g, cid), spell, level, targetCids.map(t => pcRef(g, t)), opt); need(r.ok, r.why); });
}
// Spell Scroll (SRD): on your class list; above your level → spellcasting check DC 10 + spell level; uses the scroll's DC/attack
export function useScroll(g, cid, uid, targetCids = [cid]) {
  notInBattle(g); const [i, it] = inv(g, cid, uid); const d = itemDef(it); need(d.kind === 'scroll', 'not a scroll'); const c = chr(g, cid); const s = deriveSheet(c);
  need(classSpellList(c.cls).includes(d.spell), `${SRD.spells[d.spell].name} is not on the ${c.cls} spell list — the scroll is unintelligible`);
  return g.event('scroll', { cid, uid, spell: d.spell }, () => {
    consume(g, cid, i); const max = s.spellcasting?.maxSpellLevel ?? 0;
    if (d.level > max) { const r = g.d20({}, 'scroll check'); const tot = r.nat + s.mods[s.spellcasting.ability]; const dc = 10 + d.level; g.note(`Spellcasting check ${tot} vs DC ${dc}.`); if (tot < dc) { g.note('The magic fizzles; the scroll is lost.'); return; } }
    const m = spellModel(d.spell); g.note(`${c.name} reads ${d.name} (DC ${SCROLL_DC[d.level][0]}, attack +${SCROLL_DC[d.level][1]}).`);
    if (m.kind === 'heal') { const amt = g.roll(m.dice, {}, d.name).total + (m.addMod ? s.mods[s.spellcasting.ability] : 0); for (const t of targetCids) healOut(g, t, amt, d.name); }
    else if (m.kind === 'revive') { /* handled by resurrect() */ }
    else g.note('(effect resolved by the GM outside battle)');
  });
}
// Wizard: copy a spell into the spellbook (2 h & 50 GP per level). From a scroll: INT (Arcana) DC 10 + level, scroll destroyed either way.
export function copyToSpellbook(g, cid, spell, { fromScrollUid = null } = {}) {
  notInBattle(g); const c = chr(g, cid); need(c.cls === 'wizard', 'only wizards keep a spellbook'); const sp = SRD.spells[spell]; need(sp && sp.level >= 1, 'pick a level 1+ spell');
  need(classSpellList('wizard').includes(spell), `${sp.name} is not a Wizard spell`); need(!c.spellbook.includes(spell), 'already in the spellbook');
  const s = deriveSheet(c); need(sp.level <= s.spellcasting.maxSpellLevel, `need level ${sp.level} spell slots to copy ${sp.name}`);
  const savant = c.subclass === 'evoker' && sp.school === 'Evocation'; const cost = (savant ? 2500 : 5000) * sp.level; need(c.coin >= cost, `copying costs ${cost / 100} GP`);
  return g.event('spellbook_copy', { cid, spell, hours: (savant ? 1 : 2) * sp.level, cost }, () => {
    if (fromScrollUid) { const [i, it] = inv(g, cid, fromScrollUid); need(itemDef(it).spell === spell, 'that scroll holds a different spell'); consume(g, cid, i);
      const r = g.d20({}, 'Arcana to copy'); const tot = r.nat + s.skills.arcana.v; const dc = 10 + sp.level; g.note(`Arcana ${tot} vs DC ${dc}; the scroll is destroyed.`); if (tot < dc) { g.note('Copy failed; no gold spent.'); return; } }
    g.set(['chars', cid, 'coin'], c.coin - cost); g.set(['chars', cid, 'spellbook'], [...c.spellbook, spell]); g.note(`${sp.name} copied into the spellbook (${2 * sp.level} h, ${cost / 100} GP).`);
  });
}

const aOrAn = n => (/^[aeiou]/i.test(n) ? 'an ' : 'a ') + n;
// Identify (SRD level 1 Divination, ritual; M: a pearl worth 100+ GP, not consumed): learn a magic item's properties
export function castIdentify(g, casterCid, ownerCid, uid, { ritual = true } = {}) {
  notInBattle(g); const cc = chr(g, casterCid); const s = deriveSheet(cc);
  const knows = cc.prepared.includes('identify') || (cc.cls === 'wizard' && cc.spellbook.includes('identify')) || (s.spellcasting?.always || []).includes('identify');
  need(knows, `${cc.name} can't cast Identify${cc.cls === 'wizard' ? ' (it isn\u2019t in the spellbook)' : ''}`);
  need(ritual ? (cc.cls === 'wizard' || cc.prepared.includes('identify')) : (s.spellcasting?.slotsLeft?.some(n => n > 0)), ritual ? 'needs Ritual casting' : 'no spell slot left');
  need(cc.inventory.some(i => i.id === 'pearl_100'), `Identify needs a pearl worth 100+ GP (${cc.name} has none)`);
  const [i, it] = inv(g, ownerCid, uid); need(it.unid, `${itemDef(it).name} is already identified`);
  return g.event('identify', { caster: casterCid, cid: ownerCid, uid, ritual }, () => {
    if (!ritual) { const L = s.spellcasting.slotsLeft.findIndex(n => n > 0); const ss = [...cc.slotsSpent]; ss[L] = (ss[L] || 0) + 1; g.set(['chars', casterCid, 'slotsSpent'], ss); }
    g.set(['chars', ownerCid, 'inventory', i, 'unid'], false); const d = itemDef(chr(g, ownerCid).inventory[i]);
    g.note(`${cc.name} casts Identify${ritual ? ' as a ritual (11 minutes)' : ''}: it is ${aOrAn(d.name)}${d.attune ? ', which requires attunement' : ''}${d.gm ? ' (the GM rules its effect)' : ''}.`); });
}
// prepare spells (after a long rest for prepare-on-rest casters; at level-up for the others)
export function prepareSpells(g, cid, list, { cantrips } = {}) {
  const c = chr(g, cid); const cls = CLASSES[c.cls]; need(cls.caster, 'not a spellcaster'); const s = deriveSheet(c); const L = classSpellList(c.cls);
  need(list.length <= s.spellcasting.preparedMax, `at most ${s.spellcasting.preparedMax} prepared spells`);
  for (const id of list) { const sp = SRD.spells[id]; need(sp && sp.level >= 1 && sp.level <= s.spellcasting.maxSpellLevel && L.includes(id), `${id} can't be prepared`); if (cls.caster.spellbook) need(c.spellbook.includes(id), `${sp.name} isn't in the spellbook`); }
  const changedN = Math.max(list.filter(x => !c.prepared.includes(x)).length, c.prepared.filter(x => !list.includes(x)).length);
  if (cls.caster.prepares === 'long_rest') { need(c.prepWindow || changedN === 0, 'prepare after a long rest'); if (['paladin', 'ranger'].includes(c.cls)) need(changedN <= 1, `after a long rest a ${cls.name} replaces one spell (SRD); you changed ${changedN}`); } else { const changed = list.filter(x => !c.prepared.includes(x)).length; need(c.prepWindow || changed <= (c.levelSwap || 0), 'this class changes one prepared spell per level gained'); }
  need(new Set(list).size === list.length, 'no duplicates'); const always = new Set(s.spellcasting.always); for (const id of list) need(!always.has(id), `${SRD.spells[id].name} is always prepared already`);
  if (cantrips) { need(cantrips.length <= s.spellcasting.cantripsMax, `at most ${s.spellcasting.cantripsMax} cantrips`); need(cantrips.every(id => c.cantrips.includes(id)) || false, 'cantrips change only when you gain a level'); }
  return g.event('prepare', { cid, list }, () => { g.set(['chars', cid, 'prepared'], list); g.set(['chars', cid, 'levelSwap'], 0); if (['paladin', 'ranger'].includes(c.cls) && changedN) g.set(['chars', cid, 'prepWindow'], false); if (cantrips) g.set(['chars', cid, 'cantrips'], cantrips); g.note(`${c.name} prepares ${list.map(id => SRD.spells[id].name).join(', ')}.`); });
}

// ---------- rests and supplies
// Short rest (1 h): spend Hit Point Dice (die + CON each, min 1); short-rest resources; Pact slots; Arcane Recovery.
export function shortRest(g, { spend = {}, arcaneRecovery = {}, focus = {}, noClock = false } = {}) {
  notInBattle(g);
  // SRD: during a Short Rest a hero can focus on ONE magic item, either to learn its properties or to attune to it (not both)
  for (const [cid, f] of Object.entries(focus)) { const c = chr(g, cid); const it = c.inventory.find(x => x.uid === (f.identify || f.attune)); need(it, `${c.name} has no such item`);
    if (f.identify) need(it.unid, `${itemDef(it).name} is already identified`);
    if (f.attune) { need(!it.unid, 'identify it first'); const d = itemDef(it); need(d.attune && !it.attuned, `${d.name} can't be attuned now`); need(c.inventory.filter(x => x.attuned).length < 3, `${c.name} is already attuned to 3 items (max 3)`); need(!c.inventory.some(x => x.attuned && x.id === it.id), `can't attune to two of ${d.name}`); } }
  return g.event('short_rest', { spend, focus }, () => {
    for (const [cid, f] of Object.entries(focus)) { const c = chr(g, cid); const i = c.inventory.findIndex(x => x.uid === (f.identify || f.attune));
      if (f.identify) { g.set(['chars', cid, 'inventory', i, 'unid'], false); const d = itemDef(chr(g, cid).inventory[i]); g.note(`${c.name} studies the item through the rest: it is ${aOrAn(d.name)}${d.attune ? ' (requires attunement)' : ''}.`); }
      else { g.set(['chars', cid, 'inventory', i, 'attuned'], true); g.note(`${c.name} attunes to ${itemDef(c.inventory[i]).name}.`); } }
    for (const cid of g.state.party.order) { const c = chr(g, cid); if (c.death.dead || c.hp.cur === 0 && !c.death.stable) continue; const s = deriveSheet(c);
      let n = Math.min(spend[cid] || 0, s.hitDice.left); const hp0 = c.hp.cur; let hp = hp0; const rolls = [];
      while (n-- > 0 && hp < s.hpMax) { const r = g.roll(`1d${s.hitDice.die}`, {}, `${c.name} Hit Point Die`); const v = Math.max(1, r.total + s.mods.con); rolls.push(v); hp = Math.min(s.hpMax, hp + v); g.set(['chars', cid, 'hdSpent'], chr(g, cid).hdSpent + 1); }
      if (hp !== hp0) { g.set(['chars', cid, 'hp', 'cur'], hp); g.note(`${c.name} spends ${rolls.length} Hit Point Dice: +${rolls.join(', +')} → ${hp}/${s.hpMax}.`); if (hp0 === 0) { g.set(['chars', cid, 'death'], { s: 0, f: 0, stable: false, dead: false }); g.set(['chars', cid, 'conditions'], c.conditions.filter(x => x.id !== 'unconscious')); } }
      const spent = { ...chr(g, cid).resSpent }; for (const [k, r] of Object.entries(s.resources)) { if (r.reset === 'short') spent[k] = 0; else if (r.shortRegain && spent[k]) spent[k] = Math.max(0, spent[k] - r.shortRegain); } g.set(['chars', cid, 'resSpent'], spent);
      if (s.spellcasting?.pact) g.set(['chars', cid, 'pactSpent'], 0);
      if (c.cls === 'wizard' && arcaneRecovery[cid] && s.resources.arcane_recovery?.left > 0) { const want = arcaneRecovery[cid]; const budget = Math.ceil(c.level / 2); const total = want.reduce((a, l) => a + l, 0); need(total <= budget && want.every(l => l < 6), `Arcane Recovery: up to ${budget} combined levels, none 6+`); const ss = [...chr(g, cid).slotsSpent]; const got = []; for (const l of want) { if (ss[l - 1] > 0) { ss[l - 1]--; got.push(l); } }
        if (got.length) { g.set(['chars', cid, 'slotsSpent'], ss); g.set(['chars', cid, 'resSpent', 'arcane_recovery'], 1); g.note(`${c.name} uses Arcane Recovery: back ${got.map(l => 'a level ' + l).join(' and ')} slot.`); } else g.note(`${c.name} had no spent slot to recover (Arcane Recovery kept for later).`); }
      // effects lasting ≤ 1 hour end; longer ones lose an hour
      g.set(['chars', cid, 'effects'], chr(g, cid).effects.filter(e => e.rounds == null || e.rounds > 600).map(e => (e.rounds ? { ...e, rounds: e.rounds - 600 } : e)));
      if (chr(g, cid).conc) endConcentration(g, pcRef(g, cid), 'expired');
    }
    if (!noClock) advance(g, 1);
  });
}
// Long rest (8 h): needs ≥1 HP; eats a day's food & water (malnutrition / dehydration), then full HP & Hit Point Dice,
// slots, resources; Exhaustion -1 (not while starving/dehydrated); one per 24 h (16 h gap after the last ended).
export function longRest(g, { water = 'carried', food = 'carried', force = false, extraHours = 0, startedHoursAgo = 0 } = {}) {
  notInBattle(g); const clk = g.state.clock; const now = (clk.day - 1) * 24 + clk.hour - startedHoursAgo; need(force || now - clk.lastLongRestHour >= 16, "can't start another long rest within 16 hours of the last one");
  return g.event('long_rest', { water, food }, () => {
    for (const cid of g.state.party.order) { const c = chr(g, cid); if (c.death.dead) continue; daySupplies(g, cid, { water, food });
      const c2 = chr(g, cid); if (c2.exhaustion >= 6) continue; if (c2.hp.cur < 1) { g.note(`${c.name} is at 0 HP and gains no benefit.`); continue; }
      let s = deriveSheet({ ...c2, effects: [] }); g.set(['chars', cid, 'effects'], c2.effects.filter(e => e.permanent));
      if (c2.conc) g.set(['chars', cid, 'conc'], null);
      const ex = c2.exhaustion > 0 && !c2.hunger.foodDebt && !c2.hunger.waterDebt ? c2.exhaustion - 1 : c2.exhaustion; g.set(['chars', cid, 'exhaustion'], ex);
      s = deriveSheet(chr(g, cid)); g.set(['chars', cid, 'hp'], { cur: s.hpMax, temp: 0 }); g.set(['chars', cid, 'hdSpent'], 0); g.set(['chars', cid, 'slotsSpent'], []); g.set(['chars', cid, 'pactSpent'], 0); g.set(['chars', cid, 'resSpent'], {});
      g.set(['chars', cid, 'death'], { s: 0, f: 0, stable: false, dead: false }); g.set(['chars', cid, 'conditions'], chr(g, cid).conditions.filter(x => x.permanent)); g.set(['chars', cid, 'prepWindow'], true);
      if (c.species === 'human') g.set(['chars', cid, 'inspiration'], true);
    }
    const end = now + 8 + extraHours; g.set(['clock'], { day: Math.floor(end / 24) + 1, hour: end % 24, lastLongRestHour: end });
    if (extraHours) g.note(`The long rest resumes and takes ${8 + extraHours} hours in all (+${extraHours} for the interruption).`);
  });
}
// A rest inside a regular scene, with SRD interruptions (SRD 5.2.1 Rules Glossary, "Short Rest" / "Long Rest"):
//  short: stopped by rolling Initiative, casting a non-cantrip spell, or taking damage → no benefits.
//  long:  stopped by those or 1 hour of walking/exertion → if at least 1 hour was rested, Short Rest benefits;
//         or resume immediately: +1 hour per interruption, then the full Long Rest benefits.
// interrupt: { atHour, by: 'initiative'|'spell'|'damage'|'exertion', text, hours? } ; resume: boolean
export const INTERRUPTS = { initiative: 'rolling Initiative', spell: 'casting a spell other than a cantrip', damage: 'taking damage', exertion: '1 hour of walking or other physical exertion' };
export function restScene(g, { kind = 'short', spend = {}, arcaneRecovery = {}, focus = {}, water = 'carried', food = 'carried', interrupt = null, resume = false } = {}) {
  notInBattle(g); need(['short', 'long'].includes(kind), 'rest kind is short or long');
  if (!interrupt) return kind === 'short' ? { kind, done: true, ev: shortRest(g, { spend, arcaneRecovery, focus }) } : { kind, done: true, ev: longRest(g, { water, food }) };
  need(INTERRUPTS[interrupt.by], `unknown interruption ${interrupt.by}`); if (kind === 'short') need(interrupt.by !== 'exertion', 'exertion interrupts only a long rest');
  const at = Math.max(0, Math.min(kind === 'short' ? 1 : 8, interrupt.atHour ?? 1)); const extra = interrupt.by === 'exertion' ? Math.max(1, interrupt.hours ?? 1) : 0;
  g.event('rest_interrupted', { kind, by: interrupt.by, atHour: at, resume }, () => { g.note(`The ${kind} rest is interrupted after ${at} hour${at === 1 ? '' : 's'}: ${interrupt.text || INTERRUPTS[interrupt.by]} (SRD: ${INTERRUPTS[interrupt.by]}).`); advance(g, at + extra); });
  if (kind === 'short') { g.event('rest_no_benefit', { kind }, () => g.note('An interrupted Short Rest confers no benefits.')); return { kind, done: false, interrupted: interrupt.by, benefit: 'none' }; }
  if (resume && interrupt.by !== 'initiative') { const ev = longRest(g, { water, food, extraHours: 1, startedHoursAgo: at + extra }); return { kind, done: true, interrupted: interrupt.by, resumed: true, benefit: 'long', ev }; }
  if (at >= 1) { g.event('rest_partial', { kind }, () => g.note('They rested at least 1 hour before the interruption: they gain the benefits of a Short Rest (SRD).'));
    const ev = shortRest(g, { spend, arcaneRecovery, focus, noClock: true }); return { kind, done: false, interrupted: interrupt.by, benefit: 'short', ev }; }
  g.event('rest_no_benefit', { kind }, () => g.note('Interrupted within the first hour: no benefit.')); return { kind, done: false, interrupted: interrupt.by, benefit: 'none' };
}
function advance(g, hours) { const c = g.state.clock; const t = (c.day - 1) * 24 + c.hour + hours; g.set(['clock', 'day'], Math.floor(t / 24) + 1); g.set(['clock', 'hour'], t % 24); }
// one day of food and water for a Medium/Small creature: 1 lb food, 1 gallon (8 pints) water. Rations = 1 day each.
function daySupplies(g, cid, { water, food }) {
  const c = chr(g, cid); const h = { ...c.hunger }; const l = clone(c.inventory);
  if (food === 'carried') { const r = l.find(i => i.id === 'rations' && i.qty > 0); if (r) { r.qty--; h.daysNoFood = 0; h.foodDebt = false; g.note(`${c.name} eats a ration (${r.qty} left).`); } else { h.daysNoFood++; h.foodDebt = true; g.note(`${c.name} has no food (${h.daysNoFood} day(s)).`); } }
  else { h.daysNoFood = 0; h.foodDebt = false; }
  if (water === 'carried') { let needP = 8; for (const w of l.filter(i => i.id === 'waterskin')) { const take = Math.min(needP, w.pints ?? 0); w.pints = (w.pints ?? 0) - take; needP -= take; } const drank = 8 - needP; if (drank < 4) { h.waterDebt = true; g.set(['chars', cid, 'exhaustion'], Math.min(6, c.exhaustion + 1)); g.note(`${c.name} drank ${drank} pints (< half): Dehydration, +1 Exhaustion.`); } else { if (drank >= 8) h.waterDebt = false; if (drank < 8) g.note(`${c.name} drank ${drank}/8 pints${h.waterDebt ? ' (dehydration Exhaustion stays until a full day of water)' : ''}.`); } }
  else h.waterDebt = false;
  for (let k = l.length - 1; k >= 0; k--) if (l[k].qty <= 0) l.splice(k, 1);
  g.set(['chars', cid, 'inventory'], l); g.set(['chars', cid, 'hunger'], h);
  if (h.foodDebt) { const ex = chr(g, cid).exhaustion; if (h.daysNoFood >= 5) { g.set(['chars', cid, 'exhaustion'], Math.min(6, ex + 1)); g.note(`${c.name}: ${h.daysNoFood} days without food, +1 Exhaustion.`); } else { const s = deriveSheet(chr(g, cid)); const r = g.d20({}, 'malnutrition CON save'); const tot = r.nat + s.saves.con.v - 2 * ex; if (tot < 10) { g.set(['chars', cid, 'exhaustion'], Math.min(6, ex + 1)); g.note(`${c.name} fails the DC 10 CON save for malnutrition (${tot}): +1 Exhaustion.`); } } }
  if (chr(g, cid).exhaustion >= 6) { g.set(['chars', cid, 'death'], { s: 0, f: 3, stable: false, dead: true }); g.set(['chars', cid, 'hp', 'cur'], 0); g.note(`${c.name} dies of Exhaustion 6.`); }
}
export function refillWater(g, cids = g.state.party.order) { return g.event('refill_water', {}, () => { for (const cid of cids) chr(g, cid).inventory.forEach((it, i) => { if (it.id === 'waterskin') g.set(['chars', cid, 'inventory', i, 'pints'], 4); }); }); }
// travel/explore for N hours; torches burn 1 h each while lit
export function travel(g, { hours = 1, lightBearers = [] } = {}) {
  notInBattle(g);
  return g.event('travel', { hours, lightBearers }, () => {
    for (const cid of lightBearers) { let left = hours; const c = chr(g, cid); const l = clone(c.inventory); const lit = c.torchLeft || 0; let burn = Math.min(lit, left); left -= burn; let rem = lit - burn;
      while (left > 0) { const t = l.find(i => i.id === 'torch' && i.qty > 0); if (!t) { g.note(`${c.name} runs out of torches: darkness!`); break; } t.qty--; const b = Math.min(1, left); left -= b; rem = 1 - b; }
      for (let k = l.length - 1; k >= 0; k--) if (l[k].qty <= 0) l.splice(k, 1); g.set(['chars', cid, 'inventory'], l); g.set(['chars', cid, 'torchLeft'], rem); }
    advance(g, hours);
  });
}

// ---------- XP and level-up
export function awardXp(g, amount, cids = g.state.party.order, why = 'milestone') { return g.event('xp', { amount, why }, () => { for (const cid of cids) g.set(['chars', cid, 'xp'], chr(g, cid).xp + amount); }); }
// Level-up (SRD 5.2.1): every pick is checked by validateLevelUp (levelup.js); HP is the fixed average (Lock P2-2).
// picks: { asi: {str:2} | {feat, ability?, skills?}, cantrips:[new], spellbookAdd:[2 new], prepared:[full list], masteries:[new], invocations:[new], bonusSkills:[3] }
export function levelUp(g, cid, picks = {}) {
  notInBattle(g); const c = chr(g, cid); need(!c.death.dead, `${c.name} is dead`); need(c.level < 20, 'level 20 is the cap'); need(c.xp >= XP_TABLE[c.level], `${c.name} needs ${XP_TABLE[c.level]} XP`);
  const errs = validateLevelUp(c, picks); need(!errs.length, errs.join('; '));
  const cls = CLASSES[c.cls]; const L = c.level + 1; const clean = JSON.parse(JSON.stringify(picks));
  return g.event('level_up', { cid, level: L, picks: clean }, () => {
    const before = deriveSheet(c); const nc = bumpLevel(c, L, clean); nc.levelSwap = cls.caster?.prepares === 'levelup' ? 0 : 1;
    for (const k of ['level', 'hpRolls', 'subclass', 'choices', 'cantrips', 'spellbook', 'prepared', 'levelSwap']) if (JSON.stringify(nc[k]) !== JSON.stringify(c[k])) g.set(['chars', cid, k], nc[k]);
    const after = deriveSheet(chr(g, cid)); if (c.hp.cur > 0) g.set(['chars', cid, 'hp', 'cur'], c.hp.cur + (after.hpMax - before.hpMax)); else g.note(`${c.name} is at 0 HP: the new level raises the maximum, not current Hit Points (a level-up is not healing).`);
    const bits = [`HP ${before.hpMax} \u2192 ${after.hpMax}`]; if (L === 3) bits.push(after.subclass); if (picks.asi) bits.push(picks.asi.feat && picks.asi.feat !== 'ability_score_improvement' ? FEATS_NAME(picks.asi.feat) + (picks.asi.ability ? ` (+1 ${picks.asi.ability.toUpperCase()})` : '') : 'ASI ' + Object.entries(picks.asi).filter(([k]) => k !== 'feat').map(([k, v]) => `+${v} ${k.toUpperCase()}`).join(' '));
    for (const [k, lab] of [['cantrips', 'cantrip'], ['spellbookAdd', 'to the spellbook'], ['masteries', 'mastery'], ['invocations', 'invocation']]) if (picks[k]?.length) bits.push(`${lab}: ${picks[k].map(id => SRD.spells[id]?.name || id.replace(/_/g, ' ')).join(', ')}`);
    g.note(`${c.name} reaches level ${L}: ${bits.join(' \u00b7 ')}.`);
  });
}

// ---------- death & return (Lock 8): paid resurrection, else the Kenny fallback
export function resurrect(g, cid, { casterCid = null, spell = 'revivify', payerCid, minutesDead = 1 } = {}) {
  notInBattle(g); const c = chr(g, cid); need(c.death.dead, `${c.name} isn't dead`); const m = spellModel(spell); need(m.kind === 'revive', 'not a revival spell');
  need(spell !== 'revivify' || minutesDead <= 1, 'Revivify works only within 1 minute of death');
  const payer = chr(g, payerCid || casterCid || cid); const dia = payer.inventory.findIndex(i => i.id === (m.cost >= 50000 ? 'diamond_500' : 'diamond_300'));
  const temple = !casterCid; const fee = temple ? m.cost : 0; // a temple casts it for the diamond's value
  need(temple ? payer.coin >= fee : dia >= 0, temple ? `the temple asks ${fee / 100} GP` : `${spell} needs a ${m.cost / 100} GP diamond`);
  if (casterCid) { const cc = chr(g, casterCid); need(knowsSpell(cc, spell), `${cc.name} hasn't prepared ${spell}`); }
  return g.event('resurrect', { cid, spell, temple }, () => {
    if (temple) g.set(['chars', payer.id, 'coin'], payer.coin - fee); else { const l = clone(payer.inventory); l[dia].qty--; if (!l[dia].qty) l.splice(dia, 1); g.set(['chars', payer.id, 'inventory'], l); }
    if (casterCid) { const cc = chr(g, casterCid); const s = deriveSheet(cc); const L = SRD.spells[spell].level; const ss = [...cc.slotsSpent]; need((s.spellcasting.slotsLeft[L - 1] || 0) > 0, 'no slot'); ss[L - 1] = (ss[L - 1] || 0) + 1; g.set(['chars', casterCid, 'slotsSpent'], ss); }
    const hp = m.hp === 'full' ? deriveSheet(c).hpMax : 1; g.set(['chars', cid, 'death'], { s: 0, f: 0, stable: false, dead: false }); g.set(['chars', cid, 'hp'], { cur: hp, temp: 0 });
    g.set(['chars', cid, 'conditions'], []); g.set(['chars', cid, 'deaths'], c.deaths + 1); g.note(`${c.name} returns to life (${SRD.spells[spell].name}${temple ? ', temple fee ' + fee / 100 + ' GP' : ''}).`);
    if (m.penalty) g.set(['chars', cid, 'effects'], [...c.effects, { id: 'raise_dead_penalty', d20: m.penalty, permanent: false }]);
  });
}
// Kenny: if nobody pays, the hero wakes in town next night with 1 Exhaustion; unbanked loot is lost
export function kennyReturn(g, cid) {
  const c = chr(g, cid); need(c.death.dead, `${c.name} isn't dead`);
  return g.event('kenny_return', { cid }, () => { const lost = c.inventory.filter(i => !i.banked); g.set(['chars', cid, 'inventory'], c.inventory.filter(i => i.banked).map(i => ({ ...i, slot: i.slot, attuned: i.attuned })));
    g.set(['chars', cid, 'death'], { s: 0, f: 0, stable: false, dead: false }); g.set(['chars', cid, 'exhaustion'], Math.min(5, c.exhaustion + 1)); g.set(['chars', cid, 'conditions'], []); g.set(['chars', cid, 'effects'], []);
    const s = deriveSheet(chr(g, cid)); g.set(['chars', cid, 'hp'], { cur: s.hpMax, temp: 0 }); g.set(['chars', cid, 'deaths'], c.deaths + 1);
    g.note(`They killed ${c.name}! ${c.name} wakes up in town with 1 Exhaustion${lost.length ? ' and without ' + lost.map(i => itemDef(i).name).join(', ') : ''}.`); });
}
export function bankLoot(g, cids = g.state.party.order) { notInBattle(g); return g.event('bank', {}, () => { for (const cid of cids) chr(g, cid).inventory.forEach((it, i) => { if (!it.banked) g.set(['chars', cid, 'inventory', i, 'banked'], true); }); }); }
export function setInspiration(g, cid, on = true, why = 'GM award') { return g.event('inspiration', { cid, on, why }, () => g.set(['chars', cid, 'inspiration'], on)); }
export function gainExhaustion(g, cid, n = 1, why = '') { return g.event('exhaustion', { cid, n, why }, () => { const e = Math.max(0, Math.min(6, chr(g, cid).exhaustion + n)); g.set(['chars', cid, 'exhaustion'], e); if (e >= 6) { g.set(['chars', cid, 'death'], { s: 0, f: 3, stable: false, dead: true }); g.set(['chars', cid, 'hp', 'cur'], 0); } }); }
export function addCondition(g, cid, id, extra = {}) { return g.event('condition', { cid, id }, () => g.set(['chars', cid, 'conditions'], [...chr(g, cid).conditions.filter(x => x.id !== id), { id, ...extra }])); }
export function removeCondition(g, cid, id) { return g.event('condition_end', { cid, id }, () => g.set(['chars', cid, 'conditions'], chr(g, cid).conditions.filter(x => x.id !== id))); }

// ---------- ability checks (Lock 10): the player sees the difficulty word before rolling; the exact DC and every
// modifier are shown after. House scale (Wes, Nov 23 2026, 6:39 PM PT): Easy 6 / Medium 11 / Hard 16 from
// Night 38 on. Very Easy 4 / Very Hard 24 / Nearly Impossible 29 are unchanged. Thresholds also still
// label the v2 9/14/19 and v1 10/15/20 values with the same words, so nights 1–37 keep their published wording.
export const DC_WORDS = [[4, 'Very Easy'], [6, 'Easy'], [11, 'Medium'], [16, 'Hard'], [24, 'Very Hard'], [29, 'Nearly Impossible']];
export const difficultyWord = dc => DC_WORDS.reduce((w, [d, name]) => (dc >= d ? name : w), 'Very Easy');
export function skillCheck(g, cid, skill, dc, { adv = false, dis = false, guidance = false, why = '' } = {}) {
  const c = chr(g, cid); const s = deriveSheet(c); const sk = s.skills[skill] || { v: s.mods[skill], parts: [{ src: skill.toUpperCase(), v: s.mods[skill] }], prof: false };
  if (sk.adv) adv = true; if (sk.dis) dis = true; if (c.conditions.some(x => ['poisoned', 'frightened'].includes(x.id))) dis = true;
  const word = difficultyWord(dc);
  return g.event('check', { cid, skill, word, why }, () => {
    const r = g.d20({ adv, dis, luck: c.species === 'halfling' }, `${c.name} ${skill}`); let nat = r.nat; const parts = [...sk.parts];
    if (c.cls === 'rogue' && c.level >= 7 && sk.prof && nat < 10) { parts.push({ src: `Reliable Talent (d20 ${nat} → 10)`, v: 0 }); nat = 10; }
    if (c.exhaustion) parts.push({ src: `Exhaustion ${c.exhaustion}`, v: -2 * c.exhaustion });
    if (guidance) { const gd = g.roll('1d4', {}, 'Guidance').total; parts.push({ src: 'Guidance', v: gd }); }
    const total = nat + sk.v + (c.exhaustion ? -2 * c.exhaustion : 0) + (guidance ? parts.at(-1).v : 0);
    const res = { word, dc, nat: r.nat, faces: r.faces, mode: r.mode, total, parts, ok: total >= dc };
    g.note(`${c.name} — ${skill.replace(/_/g, ' ')} (${word}): d20 ${r.faces.join('/')}${r.mode !== 'normal' ? ' ' + r.mode : ''} ${parts.map(p => `${p.v >= 0 ? '+' : ''}${p.v} ${p.src}`).join(' ')} = ${total} vs DC ${dc} → ${res.ok ? 'success' : 'failure'}.`);
    g._lastCheck = res; return res;
  });
}
// House-rule Aasimar: Healing Hands out of combat (Magic action, touch): heal PB d4, once per long rest
export function healingHands(g, cid, targetCid = cid) {
  notInBattle(g); const c = chr(g, cid); const s = deriveSheet(c); need(s.resources.healing_hands?.left > 0, `${c.name} has no Healing Hands left`); need(c.hp.cur > 0, `${c.name} is down`);
  return g.event('healing_hands', { cid, target: targetCid }, () => { g.set(['chars', cid, 'resSpent', 'healing_hands'], (c.resSpent.healing_hands || 0) + 1); healOut(g, targetCid, g.roll(`${s.pb}d4`, {}, 'Healing Hands').total, 'Healing Hands'); });
}
