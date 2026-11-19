// Combat: initiative, turns, attacks, damage, spells, concentration, death saves, battle orders (≤3 rounds per
// batch) with stop triggers, absentee stances, and pause/resume at the 9 PM PT cutoff. Each turn is one event.
import { deriveSheet, mod } from './character.js';
import { itemDef, componentFor } from './rules/items.js';
import { spellModel, cantripDice } from './rules/spellEffects.js';
import { CONDITIONS, flag } from './rules/conditions.js';
import { monsterTemplate } from './monsters.js';
import { SPECIES } from './rules/origins.js';
import SRD from '../srd/data/srd.js';

export const STOP = { ally_down: 'An ally dropped to 0 HP', new_enemy: 'New enemies arrived', boss_phase: 'The boss changed phase', concentration_broken: 'Concentration broke', order_impossible: 'An order could not be carried out', round_limit: 'Three rounds resolved', victory: 'Victory', defeat: 'The party fell', fled: 'The party fled' };
export const STANCES = { cautious: 'Dodge when threatened, hold ground, spend nothing', support: 'Help / heal-cantrip / stabilize allies, free attacks otherwise', aggressive: 'Attack the nearest enemy with the best free attack' };

// ---------- accessors
const enc = g => g.state.encounter;
const C = (g, uid) => enc(g)?.combatants[uid];
const base = c => (c.kind === 'pc' ? ['chars', c.cid] : ['encounter', 'combatants', c.uid]);
const obj = (g, c) => g.get(base(c));
const ch = (g, c) => g.state.chars[c.cid];
const sheet = (g, c) => deriveSheet(ch(g, c));
export const hpOf = (g, c) => obj(g, c).hp.cur;
const maxHp = (g, c) => (c.kind === 'pc' ? sheet(g, c).hpMax : c.maxHp);
const conds = (g, c) => obj(g, c).conditions || [];
const effects = (g, c) => obj(g, c).effects || [];
const hasCond = (g, c, id) => conds(g, c).some(x => x.id === id);
const hasEff = (g, c, id) => effects(g, c).some(x => x.id === id);
const isDead = (g, c) => (c.kind === 'pc' ? ch(g, c).death.dead : hpOf(g, c) <= 0) || c.fled;
const conscious = (g, c) => !isDead(g, c) && hpOf(g, c) > 0 && !flag(conds(g, c), 'noActions');
const up = (g, c) => !isDead(g, c) && hpOf(g, c) > 0;
const side = (g, s) => Object.values(enc(g).combatants).filter(c => c.side === s);
const foesOf = (g, c) => side(g, c.side === 'party' ? 'foe' : 'party');
const alliesOf = (g, c) => side(g, c.side);
function setConds(g, c, list) { g.set([...base(c), 'conditions'], list); }
function setEffects(g, c, list) { g.set([...base(c), 'effects'], list); }
function addCond(g, c, cond) { if (c.condImmune?.includes(cond.id)) return false; const l = conds(g, c).filter(x => x.id !== cond.id); l.push(cond); setConds(g, c, l); return true; }
function remCond(g, c, id) { if (hasCond(g, c, id)) setConds(g, c, conds(g, c).filter(x => x.id !== id)); }
function addEff(g, c, e) { const l = effects(g, c).filter(x => !(x.id === e.id && x.src === e.src)); l.push(e); setEffects(g, c, l); }
function remEff(g, c, pred) { const l = effects(g, c); const k = l.filter(x => !pred(x)); if (k.length !== l.length) setEffects(g, c, k); }
const say = (g, s) => g.note(s);
const trig = (g, id, detail) => { if (!g.triggers.some(t => t.id === id)) g.triggers.push({ id, detail }); };

// ---------- geometry (5-ft squares, Chebyshev distance between footprints)
export function dist(a, b) {
  const ax2 = a.pos[0] + (a.size || 1) - 1, ay2 = a.pos[1] + (a.size || 1) - 1, bx2 = b.pos[0] + (b.size || 1) - 1, by2 = b.pos[1] + (b.size || 1) - 1;
  const dx = Math.max(0, b.pos[0] - ax2, a.pos[0] - bx2), dy = Math.max(0, b.pos[1] - ay2, a.pos[1] - by2); return 5 * Math.max(dx, dy);
}
const occupied = (g, mover, x, y) => Object.values(enc(g).combatants).some(o => o.uid !== mover.uid && !isDead(g, o) && x + (mover.size || 1) - 1 >= o.pos[0] && x <= o.pos[0] + (o.size || 1) - 1 && y + (mover.size || 1) - 1 >= o.pos[1] && y <= o.pos[1] + (o.size || 1) - 1);
const terrain = (g, x, y) => enc(g).map.terrain?.[`${x},${y}`] || null;
const inMap = (g, x, y, s = 1) => x >= 0 && y >= 0 && x + s - 1 < enc(g).map.w && y + s - 1 < enc(g).map.h;
function speedOf(g, c) {
  let s = c.kind === 'pc' ? sheet(g, c).speed : c.speed - (c.tactics?.exhaustion || 0);
  if (flag(conds(g, c), 'speed0') || hasCond(g, c, 'grappled')) return 0;
  if (effects(g, c).some(e => e.id === 'slow')) s = Math.max(0, s - 10);
  return s;
}
// greedy step-by-step movement toward a goal distance; triggers opportunity attacks; returns feet used
function moveToward(g, T, c, goal, wantDist, budget) {
  let used = 0; const st = enc(g);
  while (used < budget && dist(c, goal) > wantDist && up(g, c)) {
    let best = null;
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
      if (!dx && !dy) continue; const x = c.pos[0] + dx, y = c.pos[1] + dy;
      if (!inMap(g, x, y, c.size) || occupied(g, c, x, y) || terrain(g, x, y) === 'wall') continue;
      const cost = terrain(g, x, y) === 'difficult' ? 10 : 5; if (used + cost > budget) continue;
      const d = dist({ pos: [x, y], size: c.size }, goal); if (!best || d < best.d || (d === best.d && cost < best.cost)) best = { x, y, d, cost };
    }
    if (!best || best.d >= dist(c, goal)) break;
    // opportunity attacks: leaving an enemy's reach
    if (!T.disengaged) for (const f of foesOf(g, c)) {
      if (!conscious(g, f) || !st.combatants[f.uid].reaction) continue;
      const reach = f.kind === 'pc' ? Math.max(5, ...sheet(g, f).attacks.filter(a => a.melee).map(a => a.reach)) : 5;
      if (dist(c, f) <= reach && dist({ pos: [best.x, best.y], size: c.size }, f) > reach) {
        if (f.kind === 'pc' && T.orders?.[f.cid]?.reactions?.opportunity === false) continue;
        g.set(['encounter', 'combatants', f.uid, 'reaction'], false); say(g, `${f.name} makes an opportunity attack on ${c.name}.`);
        const FT = { attacker: f, orders: T.orders, oa: true }; const atk = f.kind === 'pc' ? bestWeapon(g, f, c, true) : f.attacks.find(a => a.melee) || f.attacks[0];
        if (atk) attack(g, FT, f, c, atk); if (!up(g, c)) return used;
      }
    }
    c = C(g, c.uid); g.set(['encounter', 'combatants', c.uid, 'pos'], [best.x, best.y]); c = C(g, c.uid); used += best.cost;
  }
  return used;
}

// ---------- d20 tests
function d20Test(g, c, kind, { adv = false, dis = false, why = '' } = {}) {
  const o = obj(g, c); const ex = o.exhaustion || 0;
  if (kind === 'attack' || kind === 'check') { if (flag(conds(g, c), 'attackDis') && kind === 'attack') dis = true; if (kind === 'check' && flag(conds(g, c), 'checkDis')) dis = true; }
  const luck = c.kind === 'pc' && !!SPECIES[ch(g, c).species].luck;
  const r = g.d20({ adv, dis, luck }, `${c.name} ${kind}${why ? ' ' + why : ''}`); let bonus = -2 * ex; const parts = ex ? [{ src: `Exhaustion ${ex}`, v: -2 * ex }] : [];
  if (kind !== 'check' && effects(g, c).some(e => e.id === 'bless')) { const b = g.roll('1d4', {}, 'Bless').total; bonus += b; parts.push({ src: 'Bless', v: b }); }
  if (kind !== 'check' && effects(g, c).some(e => e.id === 'bane')) { const b = g.roll('1d4', {}, 'Bane').total; bonus -= b; parts.push({ src: 'Bane', v: -b }); }
  return { ...r, bonus, parts };
}
function saveRoll(g, c, ab, dc, why) {
  if (['str', 'dex'].includes(ab) && flag(conds(g, c), 'autoFailStrDex')) { say(g, `${c.name} auto-fails the ${ab.toUpperCase()} save (${why}).`); return { ok: false, total: 0, auto: true }; }
  let m, adv = false, dis = false;
  if (c.kind === 'pc') { const s = sheet(g, c); m = s.saves[ab].v; if (ab === 'str' && hasEff(g, c, 'rage')) adv = true; if (ab === 'dex' && ch(g, c).cls === 'barbarian' && ch(g, c).level >= 2 && !flag(conds(g, c), 'noActions')) adv = true; }
  else m = c.saves[ab];
  if (ab === 'dex' && hasCond(g, c, 'restrained')) dis = true;
  const r = d20Test(g, c, 'save', { adv, dis, why: `${ab.toUpperCase()} save vs DC ${dc} (${why})` }); const total = r.nat + m + r.bonus;
  return { ok: total >= dc, total, nat: r.nat, mod: m, bonus: r.bonus };
}

// ---------- damage / healing / death
export function applyDamage(g, T, tgt, amount, type, opt = {}) {
  tgt = C(g, tgt.uid); if (isDead(g, tgt) || amount <= 0) return 0;
  let resist = [], immune = [], vuln = [];
  if (tgt.kind === 'pc') { resist = sheet(g, tgt).resist; } else { resist = tgt.resist; immune = tgt.immune; vuln = tgt.vuln; }
  if (flag(conds(g, tgt), 'resistAll')) resist = [...resist, type];
  let dmg = amount; const why = [];
  if (immune.includes(type)) { dmg = 0; why.push('immune'); } else { if (resist.includes(type)) { dmg = Math.floor(dmg / 2); why.push('resisted'); } if (vuln.includes(type)) { dmg *= 2; why.push('vulnerable'); } }
  if (dmg <= 0) { say(g, `${tgt.name} takes no ${type} damage (${why.join(', ')}).`); return 0; }
  const o = obj(g, tgt); let temp = o.hp.temp || 0, cur = o.hp.cur;
  const fromTemp = Math.min(temp, dmg); temp -= fromTemp; let rest = dmg - fromTemp;
  const max = maxHp(g, tgt);
  if (tgt.kind === 'pc') {
    const P = base(tgt); const c0 = ch(g, tgt);
    if (cur === 0) { // damage while at 0 HP
      g.set([...P, 'hp', 'temp'], temp);
      if (rest >= max) { kill(g, tgt, 'massive damage at 0 HP'); return dmg; }
      const f = c0.death.f + (opt.crit ? 2 : 1); g.set([...P, 'death', 'f'], Math.min(3, f)); g.set([...P, 'death', 'stable'], false); say(g, `${tgt.name} takes damage at 0 HP: ${opt.crit ? 2 : 1} death save failure(s).`);
      if (f >= 3) kill(g, tgt, 'three failed death saves'); return dmg;
    }
    let nhp = cur - rest;
    if (nhp <= 0) {
      const over = -nhp;
      if (over >= max) { g.set([...P, 'hp'], { cur: 0, temp }); kill(g, tgt, `massive damage (${over} over 0 ≥ ${max} max HP)`); return dmg; }
      const sh = sheet(g, tgt);
      if (SPECIES[c0.species].relentless && sh.resources.relentless_endurance?.left > 0) { g.set([...P, 'resSpent', 'relentless_endurance'], (c0.resSpent.relentless_endurance || 0) + 1); g.set([...P, 'hp'], { cur: 1, temp }); say(g, `${tgt.name}'s Relentless Endurance: drops to 1 HP instead.`); return dmg; }
      g.set([...P, 'hp'], { cur: 0, temp }); g.set([...P, 'death'], { s: 0, f: 0, stable: false, dead: false });
      addCond(g, tgt, { id: 'unconscious', src: 'dying' }); addCond(g, tgt, { id: 'prone', src: 'dying' });
      say(g, `${tgt.name} drops to 0 HP and is dying!`); endConcentration(g, tgt, 'unconscious'); trig(g, 'ally_down', tgt.name); remEff(g, tgt, e => e.id === 'rage');
      return dmg;
    }
    g.set([...P, 'hp'], { cur: nhp, temp });
  } else {
    const before = cur; const nhp = Math.max(0, cur - rest); g.set([...base(tgt), 'hp'], { cur: nhp, temp });
    if (tgt.boss && before > max / 2 && nhp <= max / 2 && nhp > 0) { trig(g, 'boss_phase', `${tgt.name} is bloodied`); g.set([...base(tgt), 'phase'], 2); }
    if (nhp === 0) { say(g, `${tgt.name} falls.`); endConcentration(g, tgt, 'died');
      const by = opt.by && opt.by.kind === 'pc' ? ch(g, opt.by) : null; if (by && by.cls === 'warlock' && by.subclass === 'fiend') { const tmp = Math.max(1, deriveSheet(by).mods.cha + by.level); if (tmp > by.hp.temp) { g.set(['chars', by.id, 'hp', 'temp'], tmp); say(g, `${by.name}: Dark One's Blessing, ${tmp} temp HP.`); } } }
  }
  // concentration
  const o2 = obj(g, tgt);
  if (o2.conc && up(g, tgt)) { const dc = Math.min(30, Math.max(10, Math.floor(dmg / 2))); const r = saveRoll(g, tgt, 'con', dc, 'concentration'); if (!r.ok) { say(g, `${tgt.name} loses concentration on ${o2.conc.spell} (CON ${r.total} vs DC ${dc}).`); endConcentration(g, tgt, 'failed save'); } else say(g, `${tgt.name} keeps concentration (CON ${r.total} vs DC ${dc}).`); }
  return dmg;
}
function kill(g, c, why) {
  if (c.kind !== 'pc') { g.set([...base(c), 'hp', 'cur'], 0); return; }
  const P = base(c); g.set([...P, 'hp', 'cur'], 0); g.set([...P, 'death'], { s: 0, f: 3, stable: false, dead: true });
  say(g, `${c.name} DIES (${why}).`); endConcentration(g, c, 'died'); trig(g, 'ally_down', `${c.name} died`);
}
export function heal(g, tgt, amt, src) {
  tgt = C(g, tgt.uid) || tgt; if (isDead(g, tgt)) return 0; const o = obj(g, tgt); const max = maxHp(g, tgt);
  const cur0 = o.hp.cur; const n = Math.min(max, cur0 + amt); const got = n - cur0; g.set([...base(tgt), 'hp', 'cur'], n);
  if (cur0 === 0 && n > 0 && tgt.kind === 'pc') { g.set([...base(tgt), 'death'], { s: 0, f: 0, stable: false, dead: false }); remCond(g, tgt, 'unconscious'); say(g, `${tgt.name} is back up!`); }
  say(g, `${tgt.name} regains ${got} HP (${src}).`); return got;
}
export function endConcentration(g, c, why) {
  const o = obj(g, c); if (!o?.conc) return; const sp = o.conc.spell; g.set([...base(c), 'conc'], null);
  const all = [...Object.values(g.state.encounter?.combatants || {}).filter(x => x.kind === 'npc'), ...Object.keys(g.state.chars).map(cid => ({ kind: 'pc', cid, uid: cid, name: g.state.chars[cid].name }))];
  for (const x of all) { const ob = obj(g, x); if (!ob) continue;
    if ((ob.effects || []).some(e => e.conc === c.uid)) setEffects(g, x, ob.effects.filter(e => e.conc !== c.uid));
    if ((ob.conditions || []).some(e => e.conc === c.uid)) setConds(g, x, ob.conditions.filter(e => e.conc !== c.uid)); }
  if (g.state.encounter && ['failed save', 'unconscious', 'incapacitated'].includes(why)) trig(g, 'concentration_broken', `${c.name}: ${SRD.spells[sp]?.name || sp}`);
}
export function deathSave(g, c) {
  const c0 = ch(g, c); if (c0.death.dead || c0.death.stable || c0.hp.cur > 0) return;
  const r = d20Test(g, c, 'save', { why: 'death save' }); const tot = r.nat + r.bonus; const P = base(c);
  if (r.nat === 20) { heal(g, c, 1, 'natural 20 on a death save'); return; }
  if (r.nat === 1) { const f = c0.death.f + 2; g.set([...P, 'death', 'f'], Math.min(3, f)); say(g, `${c.name} rolls a natural 1 on a death save: two failures (${f}/3).`); if (f >= 3) kill(g, c, 'three failed death saves'); return; }
  if (tot >= 10) { const s = c0.death.s + 1; g.set([...P, 'death', 's'], s); say(g, `${c.name} death save: ${tot} (success ${s}/3).`); if (s >= 3) { g.set([...P, 'death'], { s: 0, f: 0, stable: true, dead: false }); say(g, `${c.name} is stable.`); } }
  else { const f = c0.death.f + 1; g.set([...P, 'death', 'f'], f); say(g, `${c.name} death save: ${tot} (failure ${f}/3).`); if (f >= 3) kill(g, c, 'three failed death saves'); }
}

// ---------- attacks
const acOf = (g, c) => (c.kind === 'pc' ? sheet(g, c).ac.v : c.ac + (hasEff(g, c, 'shield_of_faith') ? 2 : 0));
function bestWeapon(g, c, target, meleeOnly) {
  const s = sheet(g, c); const d = dist(c, target); let list = s.attacks.filter(a => a.weapon !== 'unarmed' || s.cls === 'monk');
  list = list.filter(a => (a.melee ? d <= a.reach : !meleeOnly && d <= (a.range?.[1] || 0) && (!a.ammo || ammoLeft(g, c, a) > 0)));
  if (!list.length) list = s.attacks.filter(a => a.melee && d <= a.reach);
  return list.sort((a, b) => (b.toHit * 2 + avg(b.dice) + b.dmgBonus) - (a.toHit * 2 + avg(a.dice) + a.dmgBonus))[0] || null;
}
const avg = e => { const m = String(e).match(/(\d+)d(\d+)/); return m ? m[1] * (+m[2] + 1) / 2 : 0; };
function ammoItem(g, c, a) { const c0 = ch(g, c); const w = itemDef({ id: a.weapon }); return c0.inventory.find(i => { const d = itemDef(i); return d.kind === 'ammo' && w.ammo && d.ammo === ammoKind(w) && i.qty > 0; }); }
const ammoKind = w => (['musket', 'pistol'].includes(w.id) ? 'firearm' : /arrow/i.test(w.ammo) ? 'arrow' : /bolt/i.test(w.ammo) ? 'bolt' : /bullet/i.test(w.ammo) ? 'bullet' : /needle/i.test(w.ammo) ? 'needle' : w.ammo);
function ammoLeft(g, c, a) { if (!a.ammo || c.kind !== 'pc') return Infinity; const it = ammoItem(g, c, a); return it ? it.qty : 0; }
function spendAmmo(g, c, a) {
  const c0 = ch(g, c); const it = ammoItem(g, c, a); if (!it) return false; const idx = c0.inventory.indexOf(it);
  g.set(['chars', c.cid, 'inventory', idx, 'qty'], it.qty - 1); const k = ['encounter', 'ammoSpent', c.cid, it.id]; g.set(k, (g.get(k) || 0) + 1); return true;
}
// one attack roll + damage. atk is a sheet attack (pc) or monster attack (npc)
export function attack(g, T, a, t, atk, opt = {}) {
  a = C(g, a.uid); t = C(g, t.uid); if (!up(g, t) && t.kind === 'npc') return { miss: true };
  const pc = a.kind === 'pc'; const d = dist(a, t); const melee = atk.melee && d <= (atk.reach || 5);
  if (pc && atk.ammo && !melee) { if (!spendAmmo(g, a, atk)) { say(g, `${a.name} is out of ammunition!`); trig(g, 'order_impossible', `${a.name} has no ammunition`); return { miss: true, noAmmo: true }; } }
  let adv = !!opt.adv, dis = !!opt.dis; const why = [];
  const tc = conds(g, t);
  if (flag(tc, 'attackedAdv')) { adv = true; why.push('target ' + tc.map(x => x.id).join('/')); }
  if (hasCond(g, t, 'prone')) { if (melee && d <= 5) adv = true; else { dis = true; why.push('prone target at range'); } }
  if (hasEff(g, t, 'dodge') && conscious(g, t)) { dis = true; why.push('target Dodging'); }
  if (hasEff(g, t, 'faerie_fire')) adv = true;
  if (hasEff(g, t, 'guiding_bolt_adv')) { adv = true; remEff(g, t, e => e.id === 'guiding_bolt_adv'); }
  if (hasEff(g, t, 'reckless')) adv = true;
  if (effects(g, a).some(e => e.id === 'vex' && e.target === t.uid)) { adv = true; remEff(g, a, e => e.id === 'vex' && e.target === t.uid); why.push('Vex'); }
  if (hasEff(g, a, 'sap')) { dis = true; remEff(g, a, e => e.id === 'sap'); why.push('Sapped'); }
  if (hasEff(g, a, 'help')) { adv = true; remEff(g, a, e => e.id === 'help'); }
  if (opt.reckless) adv = true;
  if (!atk.melee && foesOf(g, a).some(f => conscious(g, f) && dist(a, f) <= 5)) { dis = true; why.push('enemy adjacent to a ranged attacker'); }
  if (!atk.melee && atk.range && d > (atk.range[0] || atk.range)) { dis = true; why.push('long range'); }
  if (atk.spell && hasEff(g, a, 'innate_sorcery')) adv = true;
  const r = d20Test(g, a, 'attack', { adv, dis, why: `vs ${t.name}` });
  const sw = pc && atk.melee && !atk.spell && hasEff(g, a, 'sacred_weapon') ? Math.max(1, sheet(g, a).mods.cha) : 0;
  const ac = acOf(g, t); let total = r.nat + atk.toHit + r.bonus + sw;
  const critRange = pc ? sheet(g, a).critRange : 20;
  let crit = r.nat >= critRange; let hit = r.nat !== 1 && (crit || total >= ac);
  // Shield reaction (ordered only): +5 AC if that turns the hit into a miss
  if (hit && !crit && t.kind === 'pc' && C(g, t.uid).reaction && T.orders?.[t.cid]?.reactions?.shield && total < ac + 5 && canCastNow(g, t, 'shield', 1, true)) {
    spendSlot(g, t, 1); g.set(['encounter', 'combatants', t.uid, 'reaction'], false); addEff(g, t, { id: 'shield_spell', src: t.uid, rounds: 1 }); hit = false; say(g, `${t.name} casts Shield (reaction): AC ${ac + 5}.`);
  }
  if (!hit && r.nat !== 1 && pc) { const bi = effects(g, a).find(e => e.id === 'bardic_inspiration'); if (bi) { const b = g.roll(bi.die, {}, 'Bardic Inspiration').total; remEff(g, a, e => e.id === 'bardic_inspiration'); total += b; hit = total >= ac; say(g, `${a.name} adds Bardic Inspiration (+${b}).`); } }
  if (hit && flag(tc, 'critWithin5') && d <= 5) crit = true;
  const label = `${a.name} → ${t.name} (${atk.name}): d20 ${r.faces.join('/')}${r.mode !== 'normal' ? ' ' + r.mode : ''} ${fmt(atk.toHit + r.bonus)} = ${total} vs AC ${ac}`;
  if (!hit) {
    say(g, label + ' — miss.');
    if (pc && atk.mastery === 'graze') { const m = mod(sheet(g, a).scores[atk.ability]); if (m > 0) { say(g, 'Graze.'); applyDamage(g, T, t, m, atk.type, {}); } }
    return { miss: true, nat: r.nat };
  }
  // damage
  let dice = atk.dice; let flat = pc ? atk.dmgBonus : 0; const extra = [];
  const P = pc ? sheet(g, a) : null;
  if (pc) {
    if (hasEff(g, a, 'rage') && atk.ability === 'str') flat += +P.rageDamage || 0;
    const hm = effects(g, a).find(e => e.id === 'hunters_mark' && e.target === t.uid); if (hm) extra.push(['1d6', 'force', "Hunter's Mark"]);
    const hx = effects(g, a).find(e => e.id === 'hex' && e.target === t.uid); if (hx) extra.push(['1d6', 'necrotic', 'Hex']);
    if (!atk.spell && ch(g, a).cls === 'ranger' && ch(g, a).subclass && ch(g, a).choices.hunters_prey === 'colossus_slayer' && !T.colossus && hpOf(g, t) < maxHp(g, t)) { T.colossus = true; extra.push(['1d8', atk.type, 'Colossus Slayer']); }
    if (P.sneakAttack && !atk.spell && !T.sneak && (atk.properties.includes('finesse') || !atk.melee) && !dis && (adv || alliesOf(g, a).some(x => x.uid !== a.uid && conscious(g, x) && dist(x, t) <= 5))) { T.sneak = true; extra.push([P.sneakAttack, atk.type, 'Sneak Attack']); }
    { const rv = effects(g, a).find(e => e.id === 'celestial_revelation'); if (rv && !T.revelation) { T.revelation = true; extra.push([String(P.pb), rv.form === 'shroud' ? 'necrotic' : 'radiant', 'Celestial Revelation']); } }
    if (SPECIES[ch(g, a).species].onHit) { const oh = SPECIES[ch(g, a).species].onHit(ch(g, a).speciesChoices); /* Giant Ancestry: used only on orders */ }
    // Divine Smite (bonus action): by order {smite: {when:'crit'|'always'|'boss'|'never', level}}
    const sm = T.orders?.[a.cid]?.smite || (T.absent ? null : { when: 'crit' }); const c0 = ch(g, a);
    if (c0.cls === 'paladin' && c0.level >= 2 && melee && !atk.spell && !T.bonusUsed && sm && sm.when !== 'never' && (sm.when === 'always' || (sm.when === 'crit' && crit) || (sm.when === 'boss' && t.boss))) {
      const free = P.resources.free_smite?.left > 0; const L = free ? 1 : pickSlot(g, a, sm.level || 1);
      if (free || (L && canCastNow(g, a, 'divine_smite', L))) {
        if (free) g.set(['chars', a.cid, 'resSpent', 'free_smite'], (c0.resSpent.free_smite || 0) + 1); else { spendSlot(g, a, L); T.slotSpell = true; }
        T.bonusUsed = true; extra.push([`${1 + L}d8`, 'radiant', 'Divine Smite']); if (['Fiend', 'Undead'].includes(t.type)) extra.push(['1d8', 'radiant', 'Divine Smite vs ' + t.type]);
      }
    }
    if (!T.frenzy && c0.cls === 'barbarian' && c0.subclass && hasEff(g, a, 'rage') && hasEff(g, a, 'reckless') && atk.ability === 'str') { T.frenzy = true; extra.push([`${+P.rageDamage}d6`, atk.type, 'Frenzy']); }
    if (!T.divineStrike && c0.cls === 'cleric' && c0.level >= 7 && !atk.spell) { T.divineStrike = true; extra.push(['1d8', 'radiant', 'Blessed Strikes']); }
    if (atk.spell && atk.agonizing) flat += P.mods.cha;
    if (P.gwf && !atk.spell && atk.melee && (atk.twoHanded || atk.properties.includes('versatile'))) opt.gwf = true;
  } else if (atk.extra) extra.push([atk.extra.dice, atk.extra.type, 'rider']);
  let main;
  if (pc) {
    main = g.roll(dice, { crit, minFace: opt.gwf ? 3 : 0 }, `${atk.name} damage`);
    if (P.savage && !T.savage && !atk.spell && atk.weapon !== 'unarmed') { const again = g.roll(dice, { crit, minFace: opt.gwf ? 3 : 0 }, 'Savage Attacker reroll'); T.savage = true; if (again.total > main.total) main = again; }
    main = { ...main, total: main.total + (flat || 0) };
  } else main = g.roll(dice, { crit }, `${atk.name} damage`);
  const byType = { [atk.type]: Math.max(0, main.total) };
  for (const [e, ty] of extra) byType[ty] = (byType[ty] || 0) + g.roll(e, { crit }, ty + ' extra').total;
  say(g, label + (crit ? ' — CRITICAL HIT!' : ' — hit.') + ` ${Object.entries(byType).map(([k, v]) => `${v} ${k}`).join(' + ')}${extra.length ? ` (${extra.map(x => x[2]).join(', ')})` : ''}.`);
  // target reactions that reduce attack damage
  if (t.kind === 'pc' && C(g, t.uid).reaction && up(g, t)) { const tc0 = ch(g, t); const tot = Object.values(byType).reduce((x, y) => x + y, 0);
    if (tc0.cls === 'rogue' && tc0.level >= 5 && T.orders?.[t.cid]?.reactions?.uncanny_dodge !== false) { for (const k of Object.keys(byType)) byType[k] = Math.floor(byType[k] / 2); g.set(['encounter', 'combatants', t.uid, 'reaction'], false); say(g, `${t.name} uses Uncanny Dodge: damage halved.`); }
    else if (tc0.cls === 'monk' && tc0.level >= 3 && ['bludgeoning', 'piercing', 'slashing'].includes(atk.type) && T.orders?.[t.cid]?.reactions?.deflect !== false && tot >= 6) { const red = g.roll('1d10', {}, 'Deflect Attacks').total + sheet(g, t).mods.dex + tc0.level; byType[atk.type] = Math.max(0, byType[atk.type] - red); g.set(['encounter', 'combatants', t.uid, 'reaction'], false); say(g, `${t.name} Deflects Attacks: −${red}.`); } }
  let dealt = 0; for (const [ty, v] of Object.entries(byType)) dealt += applyDamage(g, T, t, v, ty, { crit, magical: atk.magical, by: a });
  if (pc && up(g, C(g, t.uid)) && ch(g, a).cls === 'monk' && ch(g, a).level >= 5 && atk.melee && !atk.spell && !T.stunUsed && T.orders?.[a.cid]?.stunningStrike && P.resources.focus?.left > 0) { T.stunUsed = true; g.set(['chars', a.cid, 'resSpent', 'focus'], (ch(g, a).resSpent.focus || 0) + 1); const sr = saveRoll(g, C(g, t.uid), 'con', 8 + P.mods.wis + P.pb, 'Stunning Strike'); if (!sr.ok) { addCond(g, C(g, t.uid), { id: 'stunned', src: a.uid, untilSrcTurn: true }); say(g, `${t.name} is Stunned.`); } else addEff(g, C(g, t.uid), { id: 'stun_half_speed', src: a.uid, rounds: 1 }); }
  // mastery riders (pc)
  if (pc && atk.mastery && up(g, t)) mastery(g, a, t, atk, P);
  return { hit: true, crit, dealt };
}
const fmt = n => (n >= 0 ? '+' + n : '' + n);
function mastery(g, a, t, atk, P) {
  const dc = 8 + P.mods[atk.ability] + P.pb;
  if (atk.mastery === 'sap') addEff(g, t, { id: 'sap', src: a.uid, rounds: 1 });
  if (atk.mastery === 'slow') addEff(g, t, { id: 'slow', src: a.uid, rounds: 1 });
  if (atk.mastery === 'vex') addEff(g, a, { id: 'vex', src: a.uid, target: t.uid, rounds: 2 });
  if (atk.mastery === 'topple') { const r = saveRoll(g, t, 'con', dc, 'Topple'); if (!r.ok) { addCond(g, t, { id: 'prone' }); say(g, `${t.name} is knocked Prone (Topple).`); } }
  if (atk.mastery === 'push' && (t.size || 1) <= 2) { const dx = Math.sign(t.pos[0] - a.pos[0]), dy = Math.sign(t.pos[1] - a.pos[1]); let p = [...t.pos]; for (let i = 0; i < 2; i++) { const n = [p[0] + dx, p[1] + dy]; if (!inMap(g, n[0], n[1], t.size) || occupied(g, t, n[0], n[1]) || terrain(g, n[0], n[1]) === 'wall') break; p = n; } g.set(['encounter', 'combatants', t.uid, 'pos'], p); }
}

// ---------- spells
function pickSlot(g, c, min) { const s = sheet(g, c).spellcasting; if (!s) return null; if (s.pact) return s.pactLeft > 0 && s.pact.level >= min ? s.pact.level : null; for (let L = min; L <= s.slots.length; L++) if (s.slotsLeft[L - 1] > 0) return L; return null; }
function spendSlot(g, c, L) { const c0 = ch(g, c); const s = sheet(g, c).spellcasting; if (s.pact) g.set(['chars', c.cid, 'pactSpent'], c0.pactSpent + 1); else { const a = [...c0.slotsSpent]; while (a.length < L) a.push(0); a[L - 1] = (a[L - 1] || 0) + 1; g.set(['chars', c.cid, 'slotsSpent'], a); } }
export function knowsSpell(c0, id) { const s = deriveSheet(c0).spellcasting; const mi = c0.choices.magicInitiate; if (s?.species?.cantrips.includes(id)) return true; return c0.cantrips.includes(id) || c0.prepared.includes(id) || (s?.always || []).includes(id) || (mi && (mi.cantrips.includes(id) || mi.spell === id)); }
function cannotCastWhy(g, c, id, L, T, opt = {}) {
  const c0 = ch(g, c); const s = sheet(g, c).spellcasting;
  if (flag(conds(g, c), 'noActions')) return 'cannot act';
  if (!s) return 'no spellcasting';
  if (!s.canCast) return s.note || 'cannot cast (no spellcasting)';
  if (!knowsSpell(c0, id)) return 'not prepared';
  if (L > 0 && T?.slotSpell && !opt.reaction) return 'only one spell with a spell slot per turn (2024 rule)';
  if (L > 0 && s.pact) return 'no pact slot left';
  if (L > 0) return `no level ${L}+ slot left`;
  return 'cannot cast';
}
function canCastNow(g, c, id, L, reaction) { const c0 = ch(g, c); const s = sheet(g, c).spellcasting; if (!s || !s.canCast || !knowsSpell(c0, id)) return false; if (flag(conds(g, c), 'noActions')) return false; if (L > 0) { if (!reaction && g._T?.slotSpell) return false; if (s.pact) return s.pactLeft > 0 && s.pact.level >= L; return s.slotsLeft[L - 1] > 0; } return true; }
function affinity(g, c, type, T) { const c0 = ch(g, c); if (c0.cls === 'sorcerer' && c0.level >= 6 && c0.choices.dragon?.endsWith(':' + type) && !T?.affinity) { if (T) T.affinity = true; return deriveSheet(c0).mods.cha; } return 0; }
const spellMod = (g, c, id) => { const c0 = ch(g, c); const s = sheet(g, c); const mi = c0.choices.magicInitiate; if (mi && (mi.cantrips.includes(id) || mi.spell === id) && !(s.spellcasting && classList(c0.cls).includes(id))) return { dc: s.spellcasting.miDc ?? 8 + s.mods[mi.ability] + s.pb, atk: s.spellcasting.miAttack ?? s.mods[mi.ability] + s.pb, mod: s.mods[mi.ability] }; const inn = c0.cls === 'sorcerer' && (obj(g, c).effects || []).some(e => e.id === 'innate_sorcery') ? 1 : 0; return { dc: s.spellcasting.dc + inn, atk: s.spellcasting.attack, mod: s.mods[s.spellcasting.ability] }; };
const _cl = {}; const classList = cls => (_cl[cls] = _cl[cls] || Object.values(SRD.spells).filter(s => s.classes.includes(cls)).map(s => s.id));
// cast a spell (in or out of combat). targets: combatant objects. Returns {ok, why}
export function castSpell(g, T, c, id, L, targets, opt = {}) {
  const sp = SRD.spells[id]; const m = spellModel(id); if (!sp) return { ok: false, why: 'unknown spell' };
  const c0 = ch(g, c); L = sp.level === 0 ? 0 : Math.max(L || sp.level, sp.level);
  const miFree = sp.level === 1 && c0.choices.magicInitiate?.spell === id && deriveSheet(c0).resources.magic_initiate?.left > 0 && opt.free;
  if (opt.freeCast) { /* feature-granted cast without a slot (e.g. Favored Enemy) */ } else
  if (!miFree && !canCastNow(g, c, id, L, opt.reaction)) return { ok: false, why: cannotCastWhy(g, c, id, L, T, opt) };
  // costly material components (SRD: a focus or pouch can't replace a component with a cost)
  const comp = c.cid && !opt.freeCast ? componentFor(id) : null;
  if (comp) { const inv0 = g.state.chars[c.cid].inventory; const ix = inv0.findIndex(i => i.id === comp.id && i.qty > 0); if (ix < 0) return { ok: false, why: `${sp.name} needs ${comp.name}` };
    if (comp.consumed) { const l = JSON.parse(JSON.stringify(inv0)); l[ix].qty--; if (!l[ix].qty) l.splice(ix, 1); g.set(['chars', c.cid, 'inventory'], l); say(g, `${c.name} uses up ${comp.name}.`); } }
  if (opt.freeCast) {} else if (miFree) g.set(['chars', c.cid, 'resSpent', 'magic_initiate'], (c0.resSpent.magic_initiate || 0) + 1); else if (L > 0) { spendSlot(g, c, L); if (T) T.slotSpell = true; }
  const up_ = Math.max(0, L - sp.level); const { dc, atk: satk, mod: smod } = spellMod(g, c, id);
  say(g, `${c.name} casts ${sp.name}${L > sp.level ? ` at level ${L}` : ''}.`);
  if (sp.concentration && m.kind !== 'smite') { endConcentration(g, c, 'new spell'); g.set([...base(c), 'conc'], { spell: id, rounds: 10 }); }
  const conc = sp.concentration ? c.uid : null;
  const dmgDice = (base_, upd) => { let d = base_; if (m.cantrip || sp.level === 0) d = cantripDice(m, c0.level); if (upd && up_) { const mm = String(upd).match(/(\d+)d(\d+)/); const bb = String(d).match(/^(\d+)d(\d+)(.*)$/); if (mm && bb && mm[2] === bb[2]) d = `${+bb[1] + mm[1] * up_}d${bb[2]}${bb[3]}`; else d = `${d}+${up_ * mm[1]}d${mm[2]}`; } return d; };
  const evoker = c0.cls === 'wizard' && c0.level >= 3; // Potent Cantrip: half on save success for cantrips
  const life = c0.cls === 'cleric' && c0.subclass === 'life' && L > 0;
  switch (m.kind) {
    case 'attack': {
      const n = (m.rays ? m.rays + (m.raysPerSlot || 0) * up_ : 0) || (m.beamsAt ? Object.entries(m.beamsAt).reduce((a, [l, k]) => (c0.level >= +l ? k : a), 1) : 1);
      for (let i = 0; i < n; i++) { const t = targets[i % targets.length]; if (!t || !up(g, C(g, t.uid))) continue; attack(g, T, c, t, { name: sp.name, melee: /touch|5 feet/i.test(sp.range || '') , reach: 5, range: [999], toHit: satk, dice: dmgDice(m.dice, m.upcast), dmgBonus: affinity(g, c, opt.dtype || m.type, T), agonizing: id === 'eldritch_blast' && c0.choices.invocations?.includes('agonizing_blast'), type: opt.dtype || m.type, magical: true, ammo: null, properties: [], spell: true }, {}); if (m.rider === 'guiding_bolt_adv' && up(g, C(g, t.uid))) addEff(g, C(g, t.uid), { id: 'guiding_bolt_adv', src: c.uid, rounds: 1 }); }
      break; }
    case 'auto_hit': { const n = m.darts + up_ * (m.dartsPerSlot || 1); for (let i = 0; i < n; i++) { const t = targets[i % targets.length]; if (t && up(g, C(g, t.uid))) applyDamage(g, T, t, g.roll(m.dice, {}, 'dart').total, m.type, { magical: true }); } break; }
    case 'save': {
      const d = dmgDice(m.dice, m.upcast); const dmg = g.roll(d, {}, sp.name + ' damage').total + affinity(g, c, m.type, T);
      for (const t of targets) { const tt = C(g, t.uid); if (!up(g, tt)) continue; const r = saveRoll(g, tt, m.save, dc, sp.name); let v = r.ok ? (m.half || (evoker && sp.level === 0) ? Math.floor(dmg / 2) : 0) : dmg;
        if (m.save === 'dex' && tt.kind === 'pc' && ((ch(g, tt).cls === 'rogue' && ch(g, tt).level >= 7) || (ch(g, tt).cls === 'monk' && ch(g, tt).level >= 7)) && m.half && conscious(g, tt)) v = r.ok ? 0 : Math.floor(dmg / 2); say(g, `${tt.name} ${r.ok ? 'saves' : 'fails'} (${r.total} vs DC ${dc}): ${v} ${m.type}.`); if (v) applyDamage(g, T, tt, v, m.type, { magical: true }); }
      break; }
    case 'heal': { for (const t of targets) { const amt = g.roll(dmgDice(m.dice, m.upcast), {}, sp.name).total + (m.addMod ? smod : 0) + (life ? 2 + L : 0); heal(g, t, amt, sp.name + (life ? ' + Disciple of Life' : '')); } break; }
    case 'buff': {
      for (const t of targets.slice(0, (m.targets || 1) + (m.targetsPerSlot || 0) * up_)) {
        const e = { id: m.effect, src: c.uid, conc, rounds: m.rounds || 10, spell: id };
        if (m.effect === 'hunters_mark' || m.effect === 'hex') { e.target = opt.markTarget?.uid; addEff(g, c, e); break; }
        if (m.effect === 'aid') { e.maxHp = 5 * (1 + up_); addEff(g, t, e); heal(g, t, e.maxHp, 'Aid'); continue; }
        if (m.effect === 'heroism') e.temp = smod;
        if (m.effect === 'false_life') { const tmp = g.roll(m.temp, {}, 'False Life').total + 5 * up_; g.set([...base(t), 'hp', 'temp'], Math.max(obj(g, t).hp.temp || 0, tmp)); continue; }
        addEff(g, t, e);
      }
      break; }
    case 'debuff': {
      const n = (m.targets || 1) + (m.targetsPerSlot || 0) * up_;
      for (const t of targets.slice(0, n)) { const tt = C(g, t.uid); if (!up(g, tt)) continue;
        if (m.condition === 'paralyzed' && tt.type && tt.type !== 'Humanoid' && id === 'hold_person') { say(g, `${tt.name} is not a Humanoid: Hold Person has no effect.`); continue; }
        const r = saveRoll(g, tt, m.save, dc, sp.name);
        if (r.ok) { say(g, `${tt.name} resists ${sp.name} (${r.total} vs DC ${dc}).`); continue; }
        if (m.condition) { if (addCond(g, tt, { id: m.condition, src: c.uid, conc, save: m.repeatSave ? m.save : null, dc, spell: id })) say(g, `${tt.name} is ${m.condition} (${sp.name}).`); }
        if (m.effect) addEff(g, tt, { id: m.effect, src: c.uid, conc, rounds: 10, spell: id });
      }
      break; }
    case 'summon_attack': { addEff(g, c, { id: 'spiritual_weapon', src: c.uid, conc, rounds: 10, dice: dmgDice(m.dice, m.upcast), type: m.type }); const t = targets[0]; if (t) attack(g, T, c, t, { name: 'Spiritual Weapon', melee: true, reach: 999, toHit: satk, dice: dmgDice(m.dice, m.upcast), dmgBonus: smod, type: m.type, magical: true, properties: [], spell: true }); break; }
    case 'aura': addEff(g, c, { id: 'aura', src: c.uid, conc, rounds: 100, save: m.save, dice: dmgDice(m.dice, m.upcast), type: m.type, dc, radius: 15 }); break;
    case 'cure': for (const t of targets) for (const x of m.removes) remCond(g, t, x); break;
    default: say(g, `(${sp.name}: GM adjudicates the effect.)`);
  }
  return { ok: true };
}

// ---------- encounter lifecycle
export function startEncounter(g, { name, map = { w: 16, h: 12, terrain: {} }, party, foes, script = [], location = null }) {
  return g.event('battle_start', { name }, () => {
    const cmb = {};
    for (const p of party) { const c0 = g.state.chars[p.cid]; cmb[p.cid] = { uid: p.cid, cid: p.cid, kind: 'pc', side: 'party', name: c0.name, pos: p.pos, size: 1, reaction: true }; }
    foes.forEach((f, i) => { const uid = f.uid || `f${i + 1}`; cmb[uid] = { uid, side: 'foe', ...monsterTemplate(f.monster, { name: f.name || null }), name: f.name || `${monsterTemplate(f.monster).name} ${i + 1}`, pos: f.pos, boss: !!f.boss, tactics: f.tactics || {}, reaction: true }; });
    g.set(['encounter'], { name, location, map, round: 1, turn: 0, order: [], combatants: cmb, status: 'active', stop: null, batch: null, script, ammoSpent: {}, startedNight: g.state.meta.night, pause: null, xpAwarded: false });
    // initiative
    const rolls = [];
    for (const c of Object.values(cmb)) {
      let m, adv = false, dexm; if (c.kind === 'pc') { const s = deriveSheet(g.state.chars[c.cid]); m = s.initiative.v; adv = s.initiative.adv; dexm = s.mods.dex; } else { m = c.init; dexm = c.dexMod; }
      const r = d20Test(g, c, 'check', { adv, why: 'initiative' }); rolls.push({ uid: c.uid, total: r.nat + m + r.bonus, dex: dexm, pc: c.kind === 'pc' ? 1 : 0 });
    }
    rolls.sort((a, b) => b.total - a.total || b.dex - a.dex || b.pc - a.pc || (a.uid < b.uid ? -1 : 1));
    g.set(['encounter', 'order'], rolls.map(r => r.uid)); for (const r of rolls) g.set(['encounter', 'combatants', r.uid, 'init'], r.total);
    say(g, 'Initiative: ' + rolls.map(r => `${cmb[r.uid].name} ${r.total}`).join(', '));
  });
}
// stop the battle at the cutoff: everything is already in state; just mark it
export function pauseAtCutoff(g, why = '9:00 PM PT cutoff') {
  const e = enc(g); if (!e || !['active', 'awaiting_orders'].includes(e.status)) return null;
  return g.event('battle_paused', { why }, () => { g.set(['encounter', 'status'], 'paused'); g.set(['encounter', 'pause'], { round: e.round, turn: e.turn, night: g.state.meta.night, why, next: e.order[e.turn] }); say(g, `Battle paused at round ${e.round} (${C(g, e.order[e.turn]).name} is up next). It resumes tomorrow with new orders.`); });
}
// run up to maxRounds of turns. orders: {cid: {thisRound, standing, smite, reactions, stance, absent}}
// Locked (Wes, Nov 10): these triggers are NOTICES — logged and shown in the recap, the batch keeps going.
export const NOTICE_ONLY = ['boss_phase', 'concentration_broken'];
export function resolveBattle(g, orders = {}, { maxRounds = 3, cutoffAfterTurns = Infinity, notices = NOTICE_ONLY } = {}) {
  let e = enc(g); if (!e) throw new Error('no battle');
  if (e.status === 'paused' || e.status === 'awaiting_orders') g.event('battle_resume', {}, () => { g.set(['encounter', 'status'], 'active'); g.set(['encounter', 'pause'], null); });
  e = enc(g); if (e.status !== 'active') return { stop: e.stop };
  g.event('orders_locked', { orders }, () => g.set(['encounter', 'batch'], { startRound: e.round, startTurn: e.turn, used: {}, orders }));
  let turns = 0, deferredStops = [];
  for (;;) {
    e = enc(g);
    if (e.round >= e.batch.startRound + maxRounds && e.turn >= e.batch.startTurn) return stopBattle(g, 'round_limit');
    if (turns >= cutoffAfterTurns) { pauseAtCutoff(g); return { stop: { reason: 'cutoff' }, paused: true }; }
    const uid = e.order[e.turn]; g.triggers = []; takeTurn(g, uid, orders); turns++;
    e = enc(g); const end = checkEnd(g); if (end) return end;
    const note = g.triggers.filter(t => notices.includes(t.id)), stops = g.triggers.filter(t => !notices.includes(t.id));
    if (note.length) g.event('battle_notice', { notices: note }, () => { const e2 = enc(g); g.set(['encounter', 'notices'], [...(e2.notices || []), ...note.map(t => ({ ...t, text: STOP[t.id], round: e2.round }))]); for (const t of note) say(g, `Notice: ${STOP[t.id]}${t.detail ? ' — ' + t.detail : ''}. Orders keep running.`); });
    // Mid-round resume + reinforcements: do not skip unused thisRound orders. new_enemy
    // still stops the batch once every conscious present hero with a thisRound order has acted.
    const owed = heroesOwedThisRound(g, orders);
    if (stops.some(t => t.id !== 'new_enemy')) return { ...stopBattle(g, stops[0].id, [...deferredStops, ...stops]), notices: note };
    if (stops.length && owed.length) { deferredStops = deferredStops.concat(stops); continue; }
    const pending = [...deferredStops, ...stops];
    if (pending.length && !owed.length) { deferredStops = []; return { ...stopBattle(g, pending[0].id, pending), notices: note }; }
  }
}
function heroesOwedThisRound(g, orders) {
  const b = enc(g).batch || {}; const o = b.orders || orders || {};
  return side(g, 'party').filter(p => p.kind === 'pc' && up(g, p) && o[p.cid]?.thisRound && !o[p.cid]?.absent && !b.used?.[p.cid]);
}
function stopBattle(g, reason, triggers = []) {
  g.event('battle_stop', { reason }, () => { g.set(['encounter', 'status'], 'awaiting_orders'); g.set(['encounter', 'stop'], { reason, text: STOP[reason], triggers }); say(g, `Battle stops: ${STOP[reason]}${triggers[0]?.detail ? ' — ' + triggers[0].detail : ''}. New orders needed.`); });
  return { stop: enc(g).stop };
}
function checkEnd(g) {
  const e = enc(g); const foesLeft = side(g, 'foe').filter(f => up(g, f)); const pcsUp = side(g, 'party').filter(p => up(g, p));
  if (!foesLeft.length) return finish(g, 'victory');
  if (!pcsUp.length) return finish(g, 'defeat');
  return null;
}
function finish(g, outcome) {
  g.event('battle_end', { outcome }, () => {
    const e = enc(g); g.set(['encounter', 'status'], outcome); g.set(['encounter', 'stop'], { reason: outcome, text: STOP[outcome] });
    // recover half the spent ammunition after the fight (SRD Ammunition property)
    for (const [cid, by] of Object.entries(e.ammoSpent || {})) for (const [id, n] of Object.entries(by)) { const back = Math.floor(n / 2); if (!back) continue; const inv = g.state.chars[cid].inventory; const idx = inv.findIndex(i => i.id === id); if (idx >= 0) g.set(['chars', cid, 'inventory', idx, 'qty'], inv[idx].qty + back); say(g, `${g.state.chars[cid].name} recovers ${back} ${(back === 1 ? id.replace(/s$/, '') : id).replace(/_/g, ' ')}.`); }
    if (outcome === 'victory') {
      const xp = side(g, 'foe').reduce((a, f) => a + (f.xp || 0), 0); const party = g.state.party.order.length ? g.state.party.order : side(g, 'party').map(p => p.cid); const each = Math.floor(xp / party.length);
      for (const cid of party) g.set(['chars', cid, 'xp'], g.state.chars[cid].xp + each); g.set(['encounter', 'xpAwarded'], each); say(g, `Victory: ${xp} XP, ${each} each.`);
    }
    for (const p of side(g, 'party')) { remEff(g, p, x => ['dodge', 'reckless', 'sap', 'slow', 'vex', 'help', 'shield_spell', 'guiding_bolt_adv'].includes(x.id)); }
  });
  return { stop: enc(g).stop, outcome };
}
// After a won fight (SRD 5.2.1 Rules Glossary "Death Saving Throws", "Stable"): the party tends the fallen. Each try is a
// Healer's Kit (no check) or the best conscious Medicine DC 10 check; a downed hero who isn't stable yet makes a death
// save before each try (so a hero on 2 failures can still die). A stable hero who isn't healed regains 1 HP after 1d4 hours.
export function tendFallen(g) {
  if (!enc(g)) return null; const party = side(g, 'party').filter(c => c.kind === 'pc');
  const down = party.filter(c => !isDead(g, c) && hpOf(g, c) === 0); if (!down.length) return null;
  return g.event('tend_fallen', {}, () => {
    for (const d of down) {
      for (let tries = 0; tries < 10 && !isDead(g, d) && hpOf(g, d) === 0 && !ch(g, d).death.stable; tries++) {
        deathSave(g, d); if (isDead(g, d) || hpOf(g, d) > 0 || ch(g, d).death.stable) break;
        const medics = party.filter(c => c.uid !== d.uid && up(g, c)); if (!medics.length) { say(g, `Nobody is left standing to tend ${d.name}.`); break; }
        const kit = medics.map(c => ({ c, i: ch(g, c).inventory.findIndex(x => x.id === 'healers_kit' && (x.charges ?? 10) > 0) })).find(x => x.i >= 0);
        if (kit) { const it = ch(g, kit.c).inventory[kit.i]; g.set(['chars', kit.c.cid, 'inventory', kit.i, 'charges'], (it.charges ?? 10) - 1); g.set([...base(d), 'death', 'stable'], true); say(g, `After the fight ${kit.c.name} stabilizes ${d.name} with a Healer's Kit.`); break; }
        const m = medics.sort((a, b) => sheet(g, b).skills.medicine.v - sheet(g, a).skills.medicine.v)[0]; const r = d20Test(g, m, 'check', { why: 'Medicine DC 10' }); const tot = r.nat + sheet(g, m).skills.medicine.v + r.bonus;
        if (tot >= 10) { g.set([...base(d), 'death', 'stable'], true); say(g, `After the fight ${m.name} stabilizes ${d.name} (Medicine ${tot} vs DC 10).`); } else say(g, `${m.name} fails to stabilize ${d.name} (Medicine ${tot} vs DC 10).`);
      }
      if (!isDead(g, d) && hpOf(g, d) === 0 && ch(g, d).death.stable) { const h = g.roll('1d4', {}, `${d.name} hours until 1 HP`).total; heal(g, d, 1, `stable, ${h} hour${h === 1 ? '' : 's'} later (SRD)`); }
    }
  });
}
export function endEncounter(g) { return g.event('battle_clear', {}, () => g.set(['encounter'], null)); }

// ---------- a single turn
export function takeTurn(g, uid, orders) {
  const e = enc(g); let c = C(g, uid);
  g.begin('turn', { round: e.round, who: uid });
  const T = { orders, absent: c.kind === 'pc' && (!orders[c.cid] || orders[c.cid].absent), bonusUsed: false, slotSpell: false, disengaged: false }; g._T = T;
  try {
    // round-start script (new enemies)
    if (e.turn === 0) for (const s of e.script || []) if (s.round === e.round && !s.done) { s.add.forEach((f, i) => { const u = f.uid || `r${e.round}_${i}`; g.set(['encounter', 'combatants', u], { uid: u, side: 'foe', ...monsterTemplate(f.monster), name: f.name || monsterTemplate(f.monster).name, pos: f.pos, boss: !!f.boss, tactics: f.tactics || {}, reaction: true, init: 0 }); g.set(['encounter', 'order'], [...enc(g).order, u]); }); g.set(['encounter', 'script', e.script.indexOf(s), 'done'], true); say(g, `Round ${e.round}: ${s.text || 'new enemies arrive'}!`); trig(g, 'new_enemy', s.text || 'reinforcements'); }
    c = C(g, uid);
    if (!isDead(g, c)) {
      g.set(['encounter', 'combatants', uid, 'reaction'], true);
      tickEffects(g, c);
      // Spirit-guardians style auras hurt enemies starting their turn inside
      for (const f of foesOf(g, c)) for (const a of effects(g, f).filter(x => x.id === 'aura')) if (up(g, f) && dist(f, c) <= a.radius && up(g, c)) { const r = saveRoll(g, c, a.save, a.dc, 'aura'); const dmg = g.roll(a.dice, {}, 'aura').total; applyDamage(g, T, c, r.ok ? Math.floor(dmg / 2) : dmg, a.type, { magical: true }); }
      c = C(g, uid);
      if (c.kind === 'pc') { const c0 = ch(g, c); const hero = effects(g, c).find(x => x.id === 'heroism'); if (hero && up(g, c)) g.set(['chars', c.cid, 'hp', 'temp'], Math.max(c0.hp.temp, hero.temp)); }
      if (c.kind === 'pc' && hpOf(g, c) === 0) deathSave(g, c);
      else if (conscious(g, c)) { if (c.kind === 'pc') pcTurn(g, T, c, orders[c.cid] || {}); else npcTurn(g, T, c); }
      else say(g, `${c.name} can't act (${conds(g, c).map(x => x.id).join(', ')}).`);
      // end-of-turn repeat saves
      c = C(g, uid); for (const x of conds(g, c).filter(x => x.save)) { if (!up(g, c)) break; const r = saveRoll(g, c, x.save, x.dc, SRD.spells[x.spell]?.name || x.id); if (r.ok) { remCond(g, c, x.id); say(g, `${c.name} shakes off ${x.id}.`); } }
    }
    // advance pointer
    const e2 = enc(g); let t = e2.turn + 1, r = e2.round; if (t >= e2.order.length) { t = 0; r++; }
    g.set(['encounter', 'turn'], t); g.set(['encounter', 'round'], r);
    g._T = null; return g.end({ triggers: g.triggers });
  } catch (err) { g._T = null; g.abort(); throw err; }
}
function tickEffects(g, c) {
  // effects sourced by this combatant (on anyone) and untargeted effects on itself tick down at its turn start
  const all = [...Object.values(enc(g).combatants)];
  for (const x of all) { const l = effects(g, x); if (!l.length) continue; let changed = false; const k = [];
    for (const ef of l) { if (ef.src === c.uid && ef.rounds != null) { changed = true; if (ef.rounds - 1 > 0) k.push({ ...ef, rounds: ef.rounds - 1 }); else { if (ef.conc && obj(g, C(g, ef.conc))?.conc?.spell === ef.spell) { /* concentration duration ended */ } } } else k.push(ef); }
    if (changed) setEffects(g, x, k); }
  const o = obj(g, c); if (o.conc) { const r = (o.conc.rounds ?? 10) - 1; if (r <= 0) endConcentration(g, c, 'expired'); else g.set([...base(c), 'conc', 'rounds'], r); }
  remCond(g, c, 'shield_spell'); remEff(g, c, x => x.id === 'shield_spell');
  for (const x of all) if (conds(g, x).some(k => k.untilSrcTurn && k.src === c.uid)) setConds(g, x, conds(g, x).filter(k => !(k.untilSrcTurn && k.src === c.uid)));
}

// ---------- PC decisions
function pickTarget(g, c, sel, pool) {
  pool = pool || foesOf(g, c).filter(f => up(g, f)); if (!pool.length) return null;
  if (sel && typeof sel === 'string' && enc(g).combatants[sel]) { const t = C(g, sel); if (up(g, t) || t.side === c.side) return t; }
  const by = { nearest: (a, b) => dist(c, a) - dist(c, b) || hpOf(g, a) - hpOf(g, b), weakest: (a, b) => hpOf(g, a) - hpOf(g, b) || dist(c, a) - dist(c, b), strongest: (a, b) => hpOf(g, b) - hpOf(g, a), boss: (a, b) => (b.boss ? 1 : 0) - (a.boss ? 1 : 0) || dist(c, a) - dist(c, b) };
  return [...pool].sort(by[sel] || by.nearest)[0];
}
function ruleMatches(g, c, cond) {
  if (!cond || cond === 'always' || cond.always) return true;
  const allies = alliesOf(g, c).filter(a => a.kind === 'pc');
  if (cond.ally_down) return allies.some(a => a.uid !== c.uid && !isDead(g, a) && hpOf(g, a) === 0);
  if (cond.self_below != null) return hpOf(g, c) / maxHp(g, c) < cond.self_below;
  if (cond.ally_below != null) return allies.some(a => up(g, a) && hpOf(g, a) / maxHp(g, a) < cond.ally_below);
  if (cond.enemies_gte != null) return foesOf(g, c).filter(f => up(g, f)).length >= cond.enemies_gte;
  return false;
}
function planFor(g, T, c, o) {
  const b = enc(g).batch; const used = b.used[c.cid];
  if (o.thisRound && !used) { g.set(['encounter', 'batch', 'used', c.cid], true); return { ...o.thisRound, src: 'this round' }; }
  for (const r of o.standing || []) if (ruleMatches(g, c, r.if)) return { ...r.then, src: 'standing order' };
  if (o.thisRound && !T.absent) { const a = o.thisRound.action; const leveled = a?.do === 'cast' && SRD.spells[a.spell]?.level > 0; return { ...o.thisRound, action: leveled ? { do: 'attack', target: a.target } : a, bonus: o.thisRound.bonus?.do === 'cast' && SRD.spells[o.thisRound.bonus.spell]?.level > 0 ? null : o.thisRound.bonus, src: 'repeating orders' }; }
  return stancePlan(g, c, o.stance || ch(g, c).flavor?.stance || 'cautious');
}
function stancePlan(g, c, stance) {
  const near = pickTarget(g, c, 'nearest'); const adj = near && dist(c, near) <= 5;
  if (stance === 'cautious') return adj ? { move: 'hold', action: { do: 'dodge' }, src: 'Cautious stance' } : { move: 'hold', action: { do: 'attack', target: 'nearest', rangedOnly: true }, src: 'Cautious stance' };
  if (stance === 'support') { const down = alliesOf(g, c).find(a => a.kind === 'pc' && a.uid !== c.uid && !isDead(g, a) && hpOf(g, a) === 0 && !ch(g, a).death.stable); if (down) return { action: { do: 'stabilize', target: down.uid }, src: 'Support stance' }; return { action: { do: 'attack', target: 'nearest' }, src: 'Support stance' }; }
  return { action: { do: 'attack', target: 'nearest' }, src: 'Aggressive stance' };
}
function pcTurn(g, T, c, o) {
  const plan = planFor(g, T, c, o); const s = sheet(g, c); const c0 = ch(g, c);
  say(g, `${c.name} (${plan.src}): ${describe(plan, g)}`);
  let budget = speedOf(g, c); const act = plan.action || { do: 'attack', target: 'nearest' };
  if (act.do === 'dash') budget *= 2; if (act.do === 'disengage') T.disengaged = true;
  // bonus actions first when they set up the attack
  if (plan.bonus) bonusAction(g, T, c, plan.bonus);
  if (o.actionSurge && s.resources.action_surge?.left > 0) { /* applied after main action */ }
  // decide target + position
  let target = null, want = 5;
  if (act.do === 'attack') { target = pickTarget(g, c, act.target); if (target) { const o = attackOptions(g, c); T.mode = act.melee ? 'melee' : (act.ranged || act.rangedOnly || (o.ranged && (!o.melee || o.ranged.ev >= o.melee.ev))) ? 'ranged' : 'melee'; if (T.mode === 'ranged' && !o.ranged) T.mode = 'melee';
      want = T.mode === 'ranged' ? Math.min(o.ranged.range, 60) : o.melee ? o.melee.reach : 5; if (act.rangedOnly && T.mode !== 'ranged') target = dist(c, target) <= 5 ? target : null; } }
  if (act.do === 'cast') { const sp = SRD.spells[act.spell]; const mdl = sp && spellModel(act.spell); const ally = ['heal', 'buff', 'cure'].includes(mdl?.kind); target = ally ? pickAlly(g, c, act.target) : pickTarget(g, c, act.target); const rng = parseInt(sp?.range) || (/touch/i.test(sp?.range || '') ? 5 : /self/i.test(sp?.range || '') ? 15 : 60); want = Math.min(rng, ally ? rng : 60); }
  if (['help', 'stabilize', 'lay_on_hands', 'healing_hands', 'potion'].includes(act.do)) { target = act.do === 'potion' ? pickAlly(g, c, act.target || 'self') : pickAlly(g, c, act.target); want = 5; }
  if (T.dash) budget *= 2; if (plan.move === 'hold' || act.do === 'dodge' || T.steady) budget = 0;
  if (Array.isArray(plan.move)) moveToward(g, T, c, { pos: plan.move, size: 1 }, 0, budget); else if (target && target.uid !== c.uid && budget > 0) moveToward(g, T, c, target, want, budget);
  c = C(g, c.uid); if (!conscious(g, c)) return;
  doAction(g, T, c, act, target);
  if (o.actionSurge && sheet(g, c).resources.action_surge?.left > 0 && foesOf(g, c).some(f => up(g, f))) { g.set(['chars', c.cid, 'resSpent', 'action_surge'], (c0.resSpent.action_surge || 0) + 1); say(g, `${c.name} uses Action Surge!`); doAction(g, T, c, act, pickTarget(g, c, act.target)); }
  // free bonus: monk Martial Arts strike, spiritual weapon
  c = C(g, c.uid);
  if (T.flurry && conscious(g, c)) { const n = c0.level >= 10 ? 3 : 2; for (let i = 0; i < n; i++) { const t = pickTarget(g, c, 'nearest'); if (t && dist(C(g, c.uid), t) <= 5) attack(g, T, C(g, c.uid), t, sheet(g, c).attacks.find(a => a.weapon === 'unarmed')); } }
  if (!T.bonusUsed && conscious(g, c) && c0.cls === 'monk' && act.do === 'attack') { const t = pickTarget(g, c, 'nearest'); if (t && dist(c, t) <= 5) { T.bonusUsed = true; attack(g, T, c, t, sheet(g, c).attacks.find(a => a.weapon === 'unarmed')); } }
  if (!T.bonusUsed && conscious(g, c) && hasEff(g, c, 'spiritual_weapon') && !T.castSW) { const w = effects(g, c).find(x => x.id === 'spiritual_weapon'); const t = pickTarget(g, c, act.target || 'nearest'); if (t) { T.bonusUsed = true; const sm = spellMod(g, c, 'spiritual_weapon'); attack(g, T, c, t, { name: 'Spiritual Weapon', melee: true, reach: 999, toHit: sm.atk, dice: w.dice, dmgBonus: sm.mod, type: w.type, magical: true, properties: [], spell: true }); } }
}
const spName = id => SRD.spells[id]?.name || id; const tgName = (g, t) => ({ nearest: 'nearest foe', weakest: 'weakest foe', boss: 'the boss' }[t] || g?.state.encounter?.combatants?.[t]?.name || t);
const describe = (p, g) => [p.move === 'hold' ? 'hold position' : Array.isArray(p.move) ? `move to ${p.move}` : null, p.bonus ? `bonus: ${p.bonus.do}${p.bonus.spell ? ' ' + spName(p.bonus.spell) : ''}` : null, p.action ? `${p.action.do === 'cast' ? 'cast ' + spName(p.action.spell) : p.action.do}${p.action.target ? ' \u2192 ' + tgName(g, p.action.target) : ''}` : null].filter(Boolean).join('; ');
function pickAlly(g, c, sel) {
  const allies = alliesOf(g, c).filter(a => !isDead(g, a));
  if (sel === 'self' || !sel) return c; if (enc(g).combatants[sel]) return C(g, sel);
  if (sel === 'ally_down') return allies.find(a => hpOf(g, a) === 0) || null;
  if (sel === 'ally_lowest') return [...allies].sort((a, b) => hpOf(g, a) / maxHp(g, a) - hpOf(g, b) / maxHp(g, b))[0];
  return c;
}
function doAction(g, T, c, act, target) {
  const s = sheet(g, c); const c0 = ch(g, c);
  switch (act.do) {
    case 'dodge': addEff(g, c, { id: 'dodge', src: c.uid, rounds: 1 }); say(g, `${c.name} takes the Dodge action.`); return;
    case 'dash': case 'disengage': return;
    case 'help': if (target) { const f = pickTarget(g, c, 'nearest'); if (f) addEff(g, target, { id: 'help', src: c.uid, rounds: 1 }); } return;
    case 'stabilize': { if (!target || hpOf(g, target) > 0 || dist(c, target) > 5) { say(g, `${c.name} can't reach anyone to stabilize.`); return; } const kitIdx = c0.inventory.findIndex(i => i.id === 'healers_kit' && (i.charges ?? 10) > 0);
      if (kitIdx >= 0) { const it = c0.inventory[kitIdx]; g.set(['chars', c.cid, 'inventory', kitIdx, 'charges'], (it.charges ?? 10) - 1); g.set(['chars', target.cid, 'death', 'stable'], true); say(g, `${c.name} stabilizes ${target.name} with a Healer's Kit.`); return; }
      const r = d20Test(g, c, 'check', { why: 'Medicine DC 10' }); const tot = r.nat + s.skills.medicine.v + r.bonus; if (tot >= 10) { g.set(['chars', target.cid, 'death', 'stable'], true); say(g, `${c.name} stabilizes ${target.name} (Medicine ${tot}).`); } else say(g, `${c.name} fails to stabilize ${target.name} (Medicine ${tot}).`); return; }
    case 'potion': return usePotionInCombat(g, T, c, act, target);
    case 'preserve_life': { if (!(c0.cls === 'cleric' && c0.subclass === 'life' && s.resources.channel_divinity?.left > 0)) { trig(g, 'order_impossible', `${c.name} can't use Preserve Life`); return; } g.set(['chars', c.cid, 'resSpent', 'channel_divinity'], (c0.resSpent.channel_divinity || 0) + 1);
      let pool = 5 * c0.level; const hurt = alliesOf(g, c).filter(a => !isDead(g, a) && dist(c, a) <= 30 && hpOf(g, a) < maxHp(g, a) / 2).sort((x, y) => hpOf(g, x) - hpOf(g, y));
      say(g, `${c.name} channels Preserve Life (${pool} HP).`); for (const a of hurt) { const cap = Math.floor(maxHp(g, a) / 2) - hpOf(g, a); const h = Math.min(cap, pool); if (h > 0) { heal(g, a, h, 'Preserve Life'); pool -= h; } } return; }
    case 'healing_hands': { if (!target || !(s.resources.healing_hands?.left > 0) || dist(c, target) > 5) { trig(g, 'order_impossible', `${c.name} can't use Healing Hands`); return; } g.set(['chars', c.cid, 'resSpent', 'healing_hands'], (c0.resSpent.healing_hands || 0) + 1); heal(g, target, g.roll(`${s.pb}d4`, {}, 'Healing Hands').total, 'Healing Hands'); return; }
    case 'lay_on_hands': { const pool = s.resources.lay_on_hands?.left || 0; if (!target || !pool || dist(c, target) > 5) { trig(g, 'order_impossible', `${c.name} can't Lay on Hands`); return; } const need = Math.min(pool, act.amount || maxHp(g, target) - hpOf(g, target)); g.set(['chars', c.cid, 'resSpent', 'lay_on_hands'], (c0.resSpent.lay_on_hands || 0) + need); heal(g, target, need, 'Lay on Hands'); return; }
    case 'cast': {
      const sp = SRD.spells[act.spell]; if (!sp) { trig(g, 'order_impossible', `unknown spell ${act.spell}`); return; }
      const mdl = spellModel(act.spell); let L = act.level || sp.level; if (L > 0 && !canCastNow(g, c, act.spell, L)) L = pickSlot(g, c, L) || 0;
      let targets = []; if (['save'].includes(mdl.kind) && target) targets = foesOf(g, c).filter(f => up(g, f) && dist(f, target) <= (act.radius ?? 5)).slice(0, act.maxTargets || 3); else if (target) targets = [target];
      if (mdl.kind === 'buff' && act.targets) targets = act.targets.map(u => C(g, u)).filter(Boolean);
      if (mdl.kind === 'heal' && mdl.targets && act.targets) targets = act.targets.map(u => C(g, u)).filter(Boolean);
      const okRange = target && dist(c, target) <= (parseInt(sp.range) || (/touch/i.test(sp.range) ? 5 : 60));
      const res = (sp.level === 0 || L) && (okRange || /self/i.test(sp.range)) ? castSpell(g, T, c, act.spell, L, targets.length ? targets : [c], { dtype: act.dtype, markTarget: target }) : { ok: false, why: okRange ? 'no slot left' : 'out of range' };
      if (!res.ok) { say(g, `${c.name} can't cast ${sp.name} (${res.why}); attacks instead.`); trig(g, 'order_impossible', `${c.name}: ${sp.name} — ${res.why}`); const t = pickTarget(g, c, 'nearest'); if (t) attackAction(g, T, c, t, {}); }
      return; }
    case 'attack': default: if (target) attackAction(g, T, c, target, act); else say(g, `${c.name} has no target in reach.`);
  }
}
// best free (no-resource) melee and ranged options: weapons with ammo, and attack/save cantrips
function attackOptions(g, c) {
  const s = sheet(g, c); const c0 = ch(g, c); let melee = null, ranged = null;
  for (const a of s.attacks) { if (a.weapon === 'unarmed' && s.cls !== 'monk') continue; const ev = avg(a.dice) + a.dmgBonus + a.toHit / 2; if (a.melee) { if (!melee || ev > melee.ev) melee = { ev, reach: a.reach, atk: a }; } else if (ammoLeft(g, c, a) > 0 && (!ranged || ev > ranged.ev)) ranged = { ev, range: a.range?.[0] || 30, atk: a }; }
  const mi = c0.choices.magicInitiate?.cantrips || [];
  for (const id of [...(c0.cantrips || []), ...mi]) { const m = spellModel(id); if (!['attack', 'save'].includes(m.kind) || !m.dice) continue; const r = parseInt(SRD.spells[id].range) || 5; const sm = s.spellcasting ? spellMod(g, c, id) : null; if (!sm) continue;
    const ev = avg(cantripDice(m, c0.level)) * (m.beamsAt ? 1 : 1) + (m.kind === 'attack' ? sm.atk : sm.dc - 8) / 2 + (c0.choices.invocations?.includes('agonizing_blast') && id === 'eldritch_blast' ? s.mods.cha : 0);
    const o = { ev, range: r, cantrip: id, reach: r }; if (r <= 5) { if (!melee || ev > melee.ev) melee = o; } else if (!ranged || ev > ranged.ev) ranged = o; }
  return { melee, ranged };
}
function attackAction(g, T, c, target, act) {
  { const o = attackOptions(g, c); const d = dist(c, target); const pick = T.mode === 'ranged' ? o.ranged : o.melee; const alt = T.mode === 'ranged' ? o.melee : o.ranged;
    const use = pick && d <= (pick.range || pick.reach) ? pick : alt && d <= (alt.range || alt.reach) ? alt : null;
    if (use?.cantrip) { castSpell(g, T, c, use.cantrip, 0, [target]); return; } }
  const s = sheet(g, c); const n = s.extraAttacks; const c0 = ch(g, c);
  if (act.sacredWeapon || T.orders?.[c.cid]?.sacredWeapon) { if (c0.cls === 'paladin' && c0.subclass === 'devotion' && !hasEff(g, c, 'sacred_weapon') && s.resources.channel_divinity?.left > 0) { g.set(['chars', c.cid, 'resSpent', 'channel_divinity'], (c0.resSpent.channel_divinity || 0) + 1); addEff(g, c, { id: 'sacred_weapon', src: c.uid, rounds: 100 }); say(g, `${c.name} invokes Sacred Weapon (+${Math.max(1, s.mods.cha)} to hit).`); } }
  let reckless = false; if (c0.cls === 'barbarian' && c0.level >= 2 && (act.reckless || T.orders?.[c.cid]?.reckless)) { reckless = true; addEff(g, c, { id: 'reckless', src: c.uid, rounds: 1 }); }
  for (let i = 0; i < n; i++) {
    let t = up(g, C(g, target.uid)) ? C(g, target.uid) : pickTarget(g, c, act.target === 'weakest' ? 'weakest' : 'nearest'); if (!t) return;
    let w = act.weapon ? s.attacks.find(a => a.uid === act.weapon || a.weapon === act.weapon) : null; if (w && !(w.melee ? dist(c, t) <= w.reach : ammoLeft(g, c, w) > 0)) w = null;
    w = w || bestWeapon(g, c, t, false);
    if (!w) { // move closer if possible? no movement left: try a cantrip
      const cant = (c0.cantrips || []).map(id => [id, spellModel(id)]).find(([id, m]) => ['attack', 'save'].includes(m.kind) && dist(c, t) <= (parseInt(SRD.spells[id].range) || 5));
      if (cant) { castSpell(g, T, c, cant[0], 0, [t]); return; }
      say(g, `${c.name} can't reach ${t.name}.`); return;
    }
    attack(g, T, c, t, w, { reckless: reckless && w.melee && w.ability === 'str', adv: T.steady });
    if (!conscious(g, C(g, c.uid))) return;
  }
}
function bonusAction(g, T, c, b) {
  const s = sheet(g, c); const c0 = ch(g, c); if (T.bonusUsed) return;
  if (b.do === 'rage' && c0.cls === 'barbarian' && !hasEff(g, c, 'rage') && s.resources.rage?.left > 0 && (!s.armor || s.armor.name && !/Plate|Chain Mail|Splint|Ring/.test(s.armor.name))) { g.set(['chars', c.cid, 'resSpent', 'rage'], (c0.resSpent.rage || 0) + 1); addEff(g, c, { id: 'rage', src: c.uid, rounds: 100 }); T.bonusUsed = true; say(g, `${c.name} RAGES!`); return; }
  if (b.do === 'second_wind' && s.resources.second_wind?.left > 0) { g.set(['chars', c.cid, 'resSpent', 'second_wind'], (c0.resSpent.second_wind || 0) + 1); heal(g, c, g.roll('1d10', {}, 'Second Wind').total + c0.level, 'Second Wind'); T.bonusUsed = true; return; }
  if (b.do === 'potion') { usePotionInCombat(g, T, c, b, pickAlly(g, c, b.target || 'self')); return; }
  const spend = (k, n = 1) => g.set(['chars', c.cid, 'resSpent', k], (ch(g, c).resSpent[k] || 0) + n);
  if (b.do === 'cunning' && c0.cls === 'rogue' && c0.level >= 2) { T.bonusUsed = true; if (b.what === 'disengage') T.disengaged = true; if (b.what === 'dash') T.dash = true; return; }
  if (b.do === 'steady_aim' && c0.cls === 'rogue' && c0.level >= 3) { T.bonusUsed = true; T.steady = true; return; }
  if (b.do === 'bardic_inspiration' && s.resources.bardic_inspiration?.left > 0) { const t = pickAlly(g, c, b.target || 'ally_lowest'); if (!t || t.uid === c.uid) return; spend('bardic_inspiration'); addEff(g, t, { id: 'bardic_inspiration', die: s.resources.bardic_inspiration.die, src: null, rounds: 100 }); T.bonusUsed = true; say(g, `${c.name} inspires ${t.name} (${s.resources.bardic_inspiration.die}).`); return; }
  if (b.do === 'celestial_revelation' && s.resources.celestial_revelation?.left > 0 && !hasEff(g, c, 'celestial_revelation')) {
    const form = ['wings', 'radiance', 'shroud'].includes(b.form) ? b.form : 'radiance'; spend('celestial_revelation'); addEff(g, c, { id: 'celestial_revelation', form, src: c.uid, rounds: 10 }); T.bonusUsed = true;
    say(g, `${c.name} reveals their celestial nature (${{ wings: 'Heavenly Wings', radiance: 'Inner Radiance', shroud: 'Necrotic Shroud' }[form]}).`);
    if (form === 'shroud') { const dc = 8 + s.mods.cha + s.pb; for (const f of foesOf(g, c)) if (up(g, f) && dist(c, f) <= 10) { const r = saveRoll(g, f, 'wis', dc, 'Necrotic Shroud'); if (!r.ok) { addCond(g, f, { id: 'frightened', src: c.uid, untilSrcTurn: true }); say(g, `${f.name} is frightened.`); } } }
    return; }
  if (b.do === 'innate_sorcery' && s.resources.innate_sorcery?.left > 0 && !hasEff(g, c, 'innate_sorcery')) { spend('innate_sorcery'); addEff(g, c, { id: 'innate_sorcery', src: c.uid, rounds: 10 }); T.bonusUsed = true; say(g, `${c.name} unleashes Innate Sorcery.`); return; }
  if (b.do === 'flurry' && c0.cls === 'monk' && s.resources.focus?.left > 0) { const t = pickTarget(g, c, b.target || 'nearest'); if (!t || dist(c, t) > 5) return; spend('focus'); T.bonusUsed = true; T.flurry = true; return; }
  if (b.do === 'patient_defense' && c0.cls === 'monk') { T.bonusUsed = true; if (s.resources.focus?.left > 0) { spend('focus'); addEff(g, c, { id: 'dodge', src: c.uid, rounds: 1 }); } T.disengaged = true; return; }
  if (b.do === 'cast') { const sp = SRD.spells[b.spell]; const m = spellModel(b.spell); if (!m?.bonusAction) return; const ally = ['heal', 'buff'].includes(m.kind) && m.effect !== 'hunters_mark' && m.effect !== 'hex'; const t = ally ? pickAlly(g, c, b.target || 'ally_lowest') : pickTarget(g, c, b.target || 'nearest');
    if (!t) return; if ((m.effect === 'hunters_mark' || m.effect === 'hex') && effects(g, c).some(e => e.id === m.effect && up(g, C(g, e.target) || {}) )) return;
    if (ally && m.kind === 'heal' && b.onlyIfDown && hpOf(g, t) > 0) return;
    const rng = parseInt(sp.range) || 60; if (dist(c, t) > rng) { trig(g, 'order_impossible', `${c.name}: ${sp.name} out of range`); return; }
    const fe = b.spell === 'hunters_mark' && s.resources.favored_enemy?.left > 0; if (fe) { g.set(['chars', c.cid, 'resSpent', 'favored_enemy'], (c0.resSpent.favored_enemy || 0) + 1); const r = castSpell(g, T, c, b.spell, 1, [t], { markTarget: t, freeCast: true }); if (r.ok) T.bonusUsed = true; return; }
    const L = sp.level ? pickSlot(g, c, b.level || sp.level) : 0; const r = castSpell(g, T, c, b.spell, L, [t], { markTarget: t }); if (r.ok) { T.bonusUsed = true; if (b.spell === 'spiritual_weapon') T.castSW = true; } else trig(g, 'order_impossible', `${c.name}: ${sp.name} — ${r.why}`); return; }
}
function usePotionInCombat(g, T, c, act, target) {
  const c0 = ch(g, c); target = target || c; const idx = c0.inventory.findIndex(i => (act.item ? i.uid === act.item || i.id === act.item : /^potion_of_healing/.test(i.id)) && i.qty > 0);
  if (idx < 0) { say(g, `${c.name} has no potion.`); trig(g, 'order_impossible', `${c.name} has no potion`); return; }
  if (dist(c, target) > 5) { say(g, `${target.name} is out of reach for a potion.`); return; }
  const it = c0.inventory[idx]; const d = itemDef(it); g.set(['chars', c.cid, 'inventory', idx, 'qty'], it.qty - 1); T.bonusUsed = true;
  if (d.use?.heal) heal(g, target, g.roll(d.use.heal, {}, d.name).total, d.name);
  if (d.use?.effect === 'resistance_potion') addEff(g, target, { id: 'resistance_potion', type: act.type || 'fire', rounds: 600 });
}

// ---------- NPC AI: nearest conscious hero, Multiattack with weapon attacks, morale flee
function npcTurn(g, T, c) {
  if (c.tactics?.flee && hpOf(g, c) <= c.maxHp / 4 && !c.boss) { g.set(['encounter', 'combatants', c.uid, 'fled'], true); say(g, `${c.name} flees!`); return; }
  const pcs = foesOf(g, c).filter(p => !isDead(g, p)); let pool = pcs.filter(p => hpOf(g, p) > 0); if (c.tactics?.finisher) pool = pcs; if (!pool.length) return;
  const melee = c.attacks.find(a => a.melee) || null; const ranged = c.attacks.find(a => a.ranged && !a.melee) || c.attacks.find(a => a.ranged);
  let t = [...pool].sort((a, b) => dist(c, a) - dist(c, b) || hpOf(g, a) - hpOf(g, b))[0];
  let atk = melee;
  if (melee) { if (dist(c, t) > 5) moveToward(g, T, c, t, 5, speedOf(g, c)); c = C(g, c.uid); if (!up(g, c)) return; t = C(g, t.uid); if (dist(c, t) > 5) { const adj = pool.find(p => dist(c, p) <= 5); if (adj) t = adj; else if (ranged && dist(c, t) <= ranged.range) atk = ranged; else { say(g, `${c.name} closes in.`); return; } } }
  else if (ranged) { atk = ranged; if (dist(c, t) > ranged.range) moveToward(g, T, c, t, ranged.range, speedOf(g, c)); }
  if (!atk) { say(g, `${c.name}: no automated attack (GM runs its actions).`); return; }
  for (let i = 0; i < c.multi; i++) { t = C(g, t.uid); if (isDead(g, t) || (hpOf(g, t) === 0 && !c.tactics?.finisher)) { const n = pool.filter(p => up(g, p) && dist(C(g, c.uid), p) <= (atk.melee ? 5 : atk.range)); if (!n.length) return; t = n[0]; } attack(g, T, C(g, c.uid), t, atk); if (!up(g, C(g, c.uid))) return; }
}
export { sheet as pcSheet, C as combatant, up as isUp, isDead };
