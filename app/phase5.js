// BoG V · Phase 5 · Spells tab (mockup 05), the level-up screen, rest planning, and Ask the GM.
// Same contract as the Gear tab: players never edit a sheet. Level-up picks, out-of-battle casts, spellbook copies,
// rest choices and the post-rest prepared list are saved with tonight's action; the GM's batch runs them through the
// engine (validated, event-logged). Every preview here is the same engine code on a copy of the public state.
import { deriveSheet, classSpellList } from '../engine/src/character.js';
import { CLASSES } from '../engine/src/rules/classes.js';
import { itemDef } from '../engine/src/rules/items.js';
import { spellModel, cantripDice } from '../engine/src/rules/spellEffects.js';
import { levelUpPlan, previewLevelUp, suggestPicks } from '../engine/src/levelup.js';
import { SKILLS } from '../engine/src/rules/origins.js';
import SRD from '../engine/srd/data/srd.js';
import * as SI from './spell-info.js';

let X; export const init = ctx => { X = ctx; };
const esc = s => X.esc(s); const sgn = n => (n >= 0 ? '+' : '\u2212') + Math.abs(n);
const nice = id => String(id).replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()).replace(/\bOf\b/g, 'of').replace(/\bThe\b/g, 'the');
const me = () => X.T.me; const st = () => X.T.game?.state; const myC = () => me() && st()?.chars?.[me().cid];
const open = () => !!(X.T.scene && X.canAct(X.T.scene, X.now()) && me());
const inBattle = () => !!X.T.scene?.battle && ['active', 'awaiting_orders', 'paused'].includes(st()?.encounter?.status);
const ORD = ['', '1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th'];
const RES = { sorcery_points: 'Sorcery pts', channel_divinity: 'Channel Div.', arcane_recovery: 'Arcane Rec.', wild_shape: 'Wild Shape', bardic_inspiration: 'Bardic Insp.', lay_on_hands: 'Lay on Hands' };

// ---------- spell rows
function effectTags(id, s, c) { const sp = SRD.spells[id]; const m = spellModel(id); const sc = s.spellcasting; const out = [];
  if (m.kind === 'auto_hit') { out.push([`${m.darts} darts \u00d7 ${m.dice} ${m.type}`, 'm']); if (m.dartsPerSlot) out.push([`+${m.dartsPerSlot} dart per slot level`, '']); }
  else if (m.kind === 'attack') out.push([`spell attack ${sgn(sc?.attack ?? 0)} \u00b7 ${m.cantrip ? cantripDice(m, c.level) : m.dice} ${m.type || ''}`.trim(), 'm']);
  else if (m.kind === 'heal') out.push([`heals ${m.dice}${m.addMod ? ' + ' + (s.mods[sc?.ability] ?? 0) : ''}`, 'g']);
  else if (m.save) out.push([`${m.save.toUpperCase()} save DC ${sc?.dc ?? '?'}${m.dice ? ` \u00b7 ${m.cantrip ? cantripDice(m, c.level) : m.dice} ${m.type || ''}` : ''}${m.condition ? ` \u00b7 ${m.condition}` : ''}${m.half ? ' (half on a save)' : ''}`, 'm']);
  else if (m.kind === 'summon_attack') out.push([`${m.dice} ${m.type} \u00b7 bonus-action attacks`, 'm']);
  else if (m.kind === 'buff') out.push([{ shield_spell: '+5 AC until your next turn', bless: '+1d4 to attacks and saves', mage_armor: 'AC 13 + DEX', shield_of_faith: '+2 AC' }[m.effect] || nice(m.effect || 'buff'), 'b']);
  else if (m.kind === 'gm') out.push(['the GM rules its effect', '']);
  if (sp.concentration) out.push(['Concentration', 'w']); if (sp.ritual) out.push(['Ritual', 'g']);
  const mat = sp.components.match(/M \(([^)]*)\)/); if (sp.materialGp) { const has = c.inventory.some(i => itemDef(i).forSpell === id || (id === 'identify' && i.id === 'pearl_100') || (/holy symbol/i.test(mat?.[1] || '') && /holy_symbol|amulet|emblem|reliquary/.test(i.id))); out.push([`M: ${sp.materialGp} gp${sp.materialConsumed ? ', used up' : ''} ${has ? '\u2713 carried' : '\u2717 not carried'}`, has ? 'g' : 'w']); }
  else out.push([sp.components.replace(/ \(.*\)/, '') + (mat ? ' (focus works)' : ''), '']);
  return out; }
const short = t => String(t).replace(/, which you take when you are hit by an attack roll or targeted by the _Magic Missile_ spell/, ' when hit').replace(/ or Ritual/, ' or ritual').replace(/feet/, 'ft');
function spellRow(id, s, c, { badge = null, btn = '' } = {}) { const sp = SRD.spells[id]; if (!sp) return '';
  return `<div class="item spellrow"><div class="thumb lv ${sp.level ? '' : 'c'}">${sp.level || '\u25CB'}</div><div style="flex:1;min-width:0"><div class="nm">${esc(sp.name)}${badge ? ` <span class="tag ${badge[1]}" style="vertical-align:2px">${esc(badge[0])}</span>` : ''}</div>
   <div class="meta" style="margin-top:2px">${esc(short(sp.castingTime))} \u00b7 ${esc(short(sp.range))} \u00b7 ${esc(sp.duration.replace('Concentration, up to', 'conc.'))}</div><div class="tags">${effectTags(id, s, c).map(([t, k]) => `<span class="tag ${k}">${esc(t)}</span>`).join('')}</div>${spellInfo(id)}</div>${btn}</div>`; }
// note 4: one-line summary + tap for the full SRD rules text (T.open['sp:' + id], the table's existing toggle)
function spellInfo(id) { const k = 'sp:' + id; const on = !!X.T.open?.[k]; return SI.summaryLine(id) + SI.rulesLink(`data-t="toggle" data-v="${esc(k)}"`, on) + (on ? SI.rulesBlock(id) : ''); }

// ---------- the Spells tab
export function spellsView() {
  const T = X.T; if (!me()) return '<div class="card"><div class="note">You are watching. Spells are per hero.</div></div>';
  const c = myC(); const s = deriveSheet(c); const sc = s.spellcasting; const cls = CLASSES[c.cls];
  if (!sc) return `<div class="stephead"><div class="eyebrow">${esc(s.className)} ${s.level}</div><div class="title">Spells</div></div><div class="card"><h2>No spellcasting</h2><div class="note">${esc(s.className)}s don\u2019t cast spells. Spell scrolls are only readable from your own class list. Your fighting options are on the Table tab\u2019s battle orders.</div></div>`;
  const tab = T.spellTab || 'prepared'; const always = new Set(sc.always); const prepNow = T.prepPick?.list || c.prepared; const editing = !!T.prepEdit;
  const resK = Object.keys(s.resources).find(k => RES[k]); const res = resK ? s.resources[resK] : null;
  const slots = sc.pact ? [`<li>Pact slots (level ${sc.pact.level})<span class="r">${pips(sc.pactLeft, sc.pact.count)}</span></li>`] : sc.slots.map((n, i) => n ? `<li>${ORD[i + 1]}-level slots<span class="r">${pips(sc.slotsLeft[i], n)}</span></li>` : '');
  const conc = c.conc ? SRD.spells[c.conc.spell]?.name || c.conc.spell : null;
  const head = `<div class="card"><div class="row" style="gap:10px">${X.AV(me().pid, ';width:52px;height:52px')}<div style="flex:1;min-width:0"><div class="title" style="font-size:17px;margin:0">${esc(X.first(c.name))}\u2019s spells</div><div class="meta">${esc(s.subclass || s.className)} \u00b7 ${sc.ability.toUpperCase()} ${sgn(s.mods[sc.ability])}</div></div></div>
   <div class="big3"><div><div class="k">Save DC</div><div class="v">${sc.dc}</div></div><div><div class="k">Attack</div><div class="v">${sgn(sc.attack)}</div></div><div><div class="k">${res ? RES[resK] : 'Cantrips'}</div><div class="v">${res ? `${res.left}<span style="font-size:12px">/${res.max}</span>` : c.cantrips.length}</div></div><div><div class="k">Prepared</div><div class="v">${prepNow.length}<span style="font-size:12px">${always.size ? '+' + always.size : '/' + sc.preparedMax}</span></div></div></div>
   <ul class="list" style="margin-top:8px">${slots.join('')}<li>Concentrating on<span class="r">${conc ? `<b>${esc(conc)}</b>` : 'nothing'}</span></li></ul>
   <div class="seg" style="margin-top:8px">${[['prepared', 'Prepared'], ['cantrips', 'Cantrips'], ['list', 'Class list'], ['scrolls', 'Scrolls']].map(([k, l]) => `<span class="${k === tab ? 'on' : ''}" data-t="sptab" data-v="${k}">${l}</span>`).join('')}</div></div>`;
  let body = '';
  const castBtn = id => { const sp = SRD.spells[id]; const m = spellModel(id); const L = sp.level; const ok = sc.pact ? sc.pactLeft > 0 && L <= sc.pact.level : (sc.slotsLeft || []).slice(L - 1).some(n => n > 0);
    if (inBattle()) return `<button class="btn sm wine" data-t="spcast" data-v="${id}" style="width:auto">Cast</button>`;
    if (m.kind === 'heal' && open()) { const q = (T.castQ || []).some(x => x.spell === id); return `<button class="btn sm ${q ? 'gold' : 'wine'}" data-t="spcast" data-v="${id}" style="width:auto" ${ok || q ? '' : 'disabled'}>${q ? '\u2713 Queued' : 'Cast'}</button>`; }
    return ''; };
  if (tab === 'prepared') { const lv = [...new Set([...prepNow, ...always].map(id => SRD.spells[id]?.level).filter(Boolean))].sort();
    const list = [...[...always].map(id => [id, ['always', 'm']]), ...prepNow.filter(id => !always.has(id)).map(id => [id, null])].sort((a, b) => SRD.spells[a[0]].level - SRD.spells[b[0]].level);
    const canPrep = c.prepWindow || (X.T.scene?.rest?.kind === 'long' && open()); const rule = cls.caster.prepares === 'levelup' ? 'This class changes one spell only when it gains a level (on the level-up screen).' : ['paladin', 'ranger'].includes(c.cls) ? 'After a long rest you can replace one prepared spell.' : 'After a long rest you can change the whole list.';
    body = `<div class="card"><h2>Prepared \u00b7 ${lv.map(l => ORD[l]).join(' & ') || 'none'} level</h2>${list.map(([id, b]) => spellRow(id, s, c, { badge: b, btn: castBtn(id) })).join('') || '<div class="note">Nothing prepared.</div>'}
     <div class="note">${esc(rule)} ${cls.caster.prepares !== 'levelup' ? (canPrep ? `<b>${c.prepWindow ? 'You can change it now' : 'Tonight\u2019s long rest lets you change it'}</b>: use the Class list tab.` : '') : ''} Out of battle, healing spells can be cast between scenes (queued for tonight\u2019s batch); everything else goes in your battle orders. Material components with a gp cost must be in your pack; the engine checks.</div>${T.prepPick ? `<div class="note" style="color:#2f6a2c">\u2713 New prepared list saved: applied ${c.prepWindow ? 'in tonight\u2019s batch' : 'after tonight\u2019s long rest'}.</div>` : ''}</div>`; }
  if (tab === 'cantrips') body = `<div class="card"><h2>Cantrips \u00b7 ${c.cantrips.length} / ${sc.cantripsMax}</h2>${c.cantrips.map(id => spellRow(id, s, c, { btn: inBattle() ? castBtn(id) : '' })).join('')}${(sc.species?.cantrips || []).map(id => spellRow(id, s, c, { badge: ['species', 'g'] })).join('')}<div class="note">Cantrips scale with your character level and cost no slot. New ones come at level-up.</div></div>`;
  if (tab === 'list') { const L = classSpellList(c.cls).filter(id => SRD.spells[id].level >= 1 && SRD.spells[id].level <= sc.maxSpellLevel).sort((a, b) => SRD.spells[a].level - SRD.spells[b].level || SRD.spells[a].name.localeCompare(SRD.spells[b].name));
    const book = cls.caster.spellbook; const canPrep = c.prepWindow || (X.T.scene?.rest?.kind === 'long' && open() && cls.caster.prepares !== 'levelup');
    const row = id => { const inP = prepNow.includes(id), inB = c.spellbook.includes(id), al = always.has(id); const tag = al ? ['always', 'm'] : inP ? ['prepared', 'g'] : book ? (inB ? ['in spellbook', 'b'] : ['not in book', '']) : null;
      const btn = canPrep && !al && (!book || inB) && editing ? `<button class="btn sm ${inP ? 'gold' : 'ghost'}" data-t="spprep" data-v="${id}" style="width:auto">${inP ? '\u2713' : 'Prepare'}</button>` : ''; return spellRow(id, s, c, { badge: tag, btn }); };
    body = `<div class="card"><h2>${esc(s.className)} spells \u00b7 up to ${ORD[sc.maxSpellLevel]} level</h2>${canPrep ? `<div class="row" style="margin:6px 0 2px">${editing ? `<span class="meta" style="flex:1">${prepNow.length} / ${sc.preparedMax} prepared${['paladin', 'ranger'].includes(c.cls) ? ' \u00b7 replace one' : ''}</span><button class="btn sm" data-t="spprepsave" style="width:auto">Save list</button><button class="btn sm ghost" data-t="spprepcancel" style="width:auto;margin-left:6px">Cancel</button>` : `<button class="btn sm gold" data-t="spprepedit" style="width:auto">Change prepared spells</button>`}</div>` : ''}
     ${T.prepErr ? `<div class="note warn">${esc(T.prepErr)}</div>` : ''}${L.map(row).join('')}<div class="note">${book ? 'Wizards prepare from their spellbook. Two spells are added free at each level; others are copied from scrolls (2 h and 50 gp per spell level).' : 'Your whole class list is open to you up to your highest slot level.'}</div></div>`; }
  if (tab === 'scrolls') { const scrolls = c.inventory.filter(i => itemDef(i).kind === 'scroll'); const mine = classSpellList(c.cls);
    const row = it => { const d = itemDef(it); const on = mine.includes(d.spell); const above = d.level > sc.maxSpellLevel; const canCopy = cls.caster.spellbook && on && !c.spellbook.includes(d.spell) && d.level <= sc.maxSpellLevel && open(); const q = (T.copyQ || []).some(x => x.scroll === it.uid);
      return `<div class="item">${'<div class="thumb"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M7 4h11a2 2 0 0 1 0 4h-1 M7 4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V8"/></svg></div>'}<div style="flex:1"><div class="nm">${esc(d.name)}</div><div class="tags"><span class="tag ${on ? 'g' : 'w'}">${on ? `\u2713 on the ${esc(s.className)} list` : `\u2717 not on the ${esc(s.className)} list`}</span><span class="tag">${ORD[d.level] || 'cantrip'} level${on ? (above ? ` \u00b7 needs a DC ${10 + d.level} check` : ' \u00b7 you can cast it') : ''}</span></div></div>${canCopy ? `<button class="btn sm ${q ? 'gold' : 'ghost'}" data-t="spcopy" data-v="${d.spell}" data-k="${it.uid}" style="width:auto">${q ? '\u2713 Copy' : `Copy \u00b7 ${50 * d.level} gp`}</button>` : ''}</div>`; };
    body = `<div class="card"><h2>Scroll rack</h2>${scrolls.map(row).join('') || '<div class="note">No scrolls in your pack. Shops sell them on some nights (Gear tab).</div>'}<div class="note">Anyone can read a scroll if the spell is on their class list; above your level it takes a spellcasting check. Wizards can copy one into the spellbook (2 h + 50 gp per level, Arcana check, the scroll is used up).</div></div>`; }
  const queued = (T.castQ || []).length || (T.copyQ || []).length ? `<div class="card"><h2>Between scenes, tonight</h2><ul class="list">${(T.castQ || []).map((q, i) => `<li><span style="flex:1">Cast <b>${esc(SRD.spells[q.spell].name)}</b> on ${esc(q.targets.map(t => X.first(X.T.players.find(p => p.cid === t)?.name || t)).join(', '))}</span><button class="btn ghost sm" data-t="spcastrm" data-v="${i}" style="width:auto">\u2715</button></li>`).join('')}${(T.copyQ || []).map((q, i) => `<li><span style="flex:1">Copy <b>${esc(SRD.spells[q.spell].name)}</b> into the spellbook</span><button class="btn ghost sm" data-t="spcopyrm" data-v="${i}" style="width:auto">\u2715</button></li>`).join('')}</ul><div class="note">Applied by the GM\u2019s batch before tonight\u2019s scene, with a slot spent. The engine refuses anything you can\u2019t do and says why.</div></div>` : '';
  return head + body + queued;
}
const pips = (left, n) => Array.from({ length: n }, (_, i) => `<span class="pip ${i < left ? 'f' : ''}"></span>`).join('');

// ---------- level-up
export const canLevel = () => { const c = myC(); return !!(c && levelUpPlan(c).canLevel); };
export function levelBanner() { const c = myC(); if (!c) return ''; const plan = levelUpPlan(c); if (!plan.canLevel) return '';
  const saved = X.T.levelPick && X.T.mine?.levelUp; return `<button class="card ribbon lvl" data-t="go" data-v="levelup"><span>\u2726 <b>Level ${plan.to} is ready</b>${saved ? ' \u00b7 \u2713 picks saved' : ''}</span><span>${saved ? 'Review' : 'Level up'} \u2192</span></button>`; }
export function levelUpView() {
  const T = X.T; const c = myC(); if (!c) return '<div class="card"><div class="note">Pick a seat to level up.</div></div>';
  const plan = levelUpPlan(c); if (!plan.canLevel) return `<div class="stephead"><div class="eyebrow">Level ${c.level}</div><div class="title">Level up</div></div><div class="card"><div class="note">${esc(plan.why)}. XP comes with the nightly results.</div></div>`;
  const p = T.levelPick || (T.levelPick = suggestPicks(c)); const pv = previewLevelUp(c, p); const s0 = deriveSheet(c); const s1 = pv.sheet; const can = open();
  const chip = (k, id, label, on, dis = false, hint = '') => `<button class="chip ${on ? 'on' : ''}" ${can && !dis ? `data-t="lu" data-k="${k}" data-v="${esc(id)}"` : 'disabled'} ${hint ? `title="${esc(hint)}"` : ''}>${esc(label)}${hint ? `<small>${esc(hint)}</small>` : ''}</button>`;
  // note 4: spell chips carry the one-line summary and a tap for the full SRD rules (shown under the chips)
  const spChip = (k, id, on, pre = '') => { const o = !!X.T.open?.['lusp:' + id]; return `<button class="chip ${on ? 'on' : ''}" ${can ? `data-t="lu" data-k="${k}" data-v="${esc(id)}"` : 'disabled'}>${esc(SRD.spells[id]?.name || id)}<small>${pre ? esc(pre) + ' \u00b7 ' : ''}${esc(SI.summary(id))}</small><small><span data-t="toggle" data-v="lusp:${esc(id)}" style="text-decoration:underline;color:inherit">${o ? 'Hide rules \u25b4' : 'Full rules \u25be'}</span></small></button>`; };
  const spRules = ids => ids.filter(id => X.T.open?.['lusp:' + id]).map(id => `<div style="margin-top:8px"><b>${esc(SRD.spells[id]?.name || id)}</b>${SI.rulesBlock(id)}</div>`).join('');
  const cards = [];
  cards.push(`<div class="card dark"><div class="row"><div><div class="sc" style="font-size:11px;color:#cdb27a">${esc(s0.className)} ${plan.from} \u2192 ${plan.to}</div><div class="timer" style="font-size:30px">Level ${plan.to}</div></div><div class="sp"></div>${X.AV(me().pid, ';width:58px;height:58px')}</div>
   <ul class="list" style="margin-top:8px">${plan.changes.map(x => `<li style="color:#efe0bb">${esc(x.what)}<span class="r" style="color:#f0d58a">${esc(x.delta)}</span></li>`).join('')}</ul><div class="meta" style="color:#cdb27a;margin-top:6px">${esc(plan.hp.note)}</div></div>`);
  if (plan.subclass || plan.features.length) cards.push(`<div class="card"><h2>New at level ${plan.to}</h2>${plan.subclass ? `<div class="note"><b>${esc(plan.subclass.name)}</b> (${esc(plan.subclass.note)}).</div>` : ''}<ul class="list">${plan.features.map(f => `<li style="display:block"><b>${esc(f.name)}</b>${f.sub ? ' <span class="tag m">subclass</span>' : ''}${f.text ? `<div class="meta">${esc(f.text.replace(/\s+/g, ' ').slice(0, 220))}${f.text.length > 220 ? '\u2026' : ''}</div>` : ''}</li>`).join('')}</ul></div>`);
  for (const g of plan.groups) {
    if (g.kind === 'asi') { const a = p.asi || {}; const featMode = a.feat && a.feat !== 'ability_score_improvement';
      const abil = ['str', 'dex', 'con', 'int', 'wis', 'cha'].map(k => { const v = a[k] || 0; return `<div class="abl ${v ? 'up' : ''}"><div class="k">${k.toUpperCase()}</div><div class="v">${g.scores[k] + (featMode ? 0 : v)}</div><div class="pm"><button ${can && !featMode && v > 0 ? `data-t="luasi" data-k="${k}" data-v="-1"` : 'disabled'}>\u2212</button><button ${can && !featMode && g.scores[k] + v < 20 ? `data-t="luasi" data-k="${k}" data-v="1"` : 'disabled'}>+</button></div></div>`; }).join('');
      const feats = g.feats.filter(f => f.id !== 'ability_score_improvement').map(f => chip('feat', f.id, f.name, a.feat === f.id, !f.ok, f.ok ? f.hint : f.why)).join('');
      const sub = a.feat === 'grappler' ? `<div class="row" style="gap:6px;margin-top:6px">${['str', 'dex'].map(k => chip('grab', k, `+1 ${k.toUpperCase()}`, a.ability === k)).join('')}</div>` : a.feat === 'skilled' ? `<div class="meta" style="margin-top:6px">Three skills (${(a.skills || []).length}/3):</div><div class="chips">${Object.keys(SKILLS).filter(k => !s0.skills[k].prof).map(k => chip('skill', k, nice(k), (a.skills || []).includes(k))).join('')}</div>` : '';
      cards.push(`<div class="card" id="lu-asi"><h2>${esc(g.label)}</h2><div class="seg" style="margin-top:8px"><span class="${featMode ? '' : 'on'}" ${can ? 'data-t="lumode" data-v="asi"' : ''}>+2 to scores</span><span class="${featMode ? 'on' : ''}" ${can ? 'data-t="lumode" data-v="feat"' : ''}>Take a feat</span></div>
       ${featMode ? `<div class="chips" style="margin-top:8px">${feats}</div>${sub}` : `<div class="abls">${abil}</div><div class="note">+2 to one score or +1 to two, to a maximum of 20 (SRD: Ability Score Improvement).</div>`}</div>`); continue; }
    if (g.kind === 'pick') { const v = p[g.key] || []; const isSp = ['cantrips', 'spellbookAdd'].includes(g.key); cards.push(`<div class="card"><h2>${esc(g.label)} <span class="meta">${v.length}/${g.n}</span></h2><div class="chips" style="margin-top:6px">${g.options.slice(0, 60).map(o => isSp ? spChip(g.key, o.id, v.includes(o.id), o.hint || '') : chip(g.key, o.id, o.label, v.includes(o.id), false, o.hint || '')).join('')}</div>${isSp ? spRules(g.options.slice(0, 60).map(o => o.id)) : ''}</div>`); continue; }
    if (g.kind === 'prepared') { const v = p.prepared || g.current; const book = [...c.spellbook, ...(p.spellbookAdd || [])]; const always = new Set(s0.spellcasting.always);
      const pool = (g.options ? g.options.map(o => o.id) : book.filter(id => SRD.spells[id] && SRD.spells[id].level >= 1 && SRD.spells[id].level <= g.maxLevel && !always.has(id))).filter((id, i, a) => a.indexOf(id) === i);
      const dropped = g.current.filter(id => !v.includes(id));
      cards.push(`<div class="card"><h2>${esc(g.label)} <span class="meta">${v.length}/${g.max}</span></h2><div class="note" style="margin-top:4px">${esc(g.rule)}${dropped.length ? ` Replacing: <b>${esc(dropped.map(id => SRD.spells[id].name).join(', '))}</b>.` : ''}</div>
       <div class="chips" style="margin-top:6px">${pool.sort((a, b) => SRD.spells[a].level - SRD.spells[b].level || SRD.spells[a].name.localeCompare(SRD.spells[b].name)).map(id => spChip('prepared', id, v.includes(id), `${ORD[SRD.spells[id].level]}${g.current.includes(id) ? ' \u00b7 had it' : ''}`)).join('')}</div>${spRules(pool)}</div>`); }
  }
  const after = s1 ? `<div class="card"><h2>After the level-up</h2><div class="big3"><div><div class="k">HP</div><div class="v">${s1.hpMax}</div><div class="s">was ${s0.hpMax}</div></div><div><div class="k">AC</div><div class="v">${s1.ac.v}</div><div class="s">was ${s0.ac.v}</div></div><div><div class="k">Prof.</div><div class="v">${sgn(s1.pb)}</div><div class="s">was ${sgn(s0.pb)}</div></div><div><div class="k">${s1.spellcasting ? 'Save DC' : 'Init.'}</div><div class="v">${s1.spellcasting ? s1.spellcasting.dc : sgn(s1.initiative.v)}</div><div class="s">was ${s1.spellcasting ? s0.spellcasting.dc : sgn(s0.initiative.v)}</div></div></div>
   ${s1.attacks[0] ? `<div class="meta" style="margin-top:8px">${esc(s1.attacks[0].name)}: ${sgn(s1.attacks[0].toHit)} to hit, ${esc(s1.attacks[0].dice)}${s1.attacks[0].dmgBonus ? sgn(s1.attacks[0].dmgBonus) : ''}${s1.extraAttacks > 1 ? ` \u00b7 ${s1.extraAttacks} attacks per Attack action` : ''}</div>` : ''}</div>` : '';
  const saved = T.mine?.levelUp; const same = saved && JSON.stringify(saved) === JSON.stringify(p);
  const foot = `<div class="card ${pv.ok ? '' : 'locked'}">${pv.ok ? '<div class="note" style="color:#2f6a2c">\u2713 The engine accepts these picks.</div>' : `<h2>Not yet</h2><ul class="list">${pv.errors.map(e => `<li class="warn">${esc(e)}</li>`).join('')}</ul>`}
   <div class="row" style="margin-top:9px;gap:6px"><button class="btn" data-t="lusave" style="flex:1" ${pv.ok && can && !same ? '' : 'disabled'}>${same ? '\u2713 Level-up saved' : 'Save my level-up'}</button><button class="btn ghost sm" data-t="lusuggest" style="width:auto" ${can ? '' : 'disabled'}>Suggested</button></div>
   <div class="note">${can ? 'Saved with tonight\u2019s action. The GM\u2019s batch applies it first, before the scene, as an engine event (you\u2019ll see it in Sheet changes). Change it until the table locks.' : 'The table is locked: level-ups are saved with a night\u2019s action, so this opens with the next scene.'} HP is the fixed average (no rolling).</div></div>`;
  return `<div class="stephead"><div class="eyebrow">${esc(c.name)}</div><div class="title">Level up</div></div>` + cards.join('') + after + foot;
}

// ---------- rest planning (Table tab), on nights whose scene ends in a rest
export function restCard() {
  const T = X.T; const r = T.scene?.rest; const c = myC(); if (!r || !c || T.scene.status !== 'open') return ''; const s = deriveSheet(c); const rp = T.restPick || {}; const can = open(); const hd = rp.hitDice || 0; const left = s.hitDice.left;
  const avg = Math.max(1, s.hitDice.die / 2 + 0.5 + s.mods.con); const cls = CLASSES[c.cls];
  const shortBits = `<div class="row" style="margin-top:8px;gap:8px"><span style="flex:1"><b>Hit Point Dice to spend</b><div class="meta">d${s.hitDice.die} ${sgn(s.mods.con)} each (about ${avg.toFixed(1)}), stops at full HP \u00b7 ${left} of ${s.hitDice.total} left</div></span>
     <div class="stepper"><button ${can && hd > 0 ? 'data-t="resthd" data-v="-1"' : 'disabled'}>\u2212</button><b>${hd}</b><button ${can && hd < left ? 'data-t="resthd" data-v="1"' : 'disabled'}>+</button></div></div>
   ${c.cls === 'wizard' && s.resources.arcane_recovery?.left > 0 ? `<div class="row" style="margin-top:8px;gap:6px"><span style="flex:1"><b>Arcane Recovery</b><div class="meta">Get back spent slots worth up to ${Math.ceil(c.level / 2)} levels (none 6+), once per long rest.</div></span>${[[1], [1, 1], [2]].filter(x => x.reduce((a, b) => a + b, 0) <= Math.ceil(c.level / 2)).map(x => `<button class="btn sm ${JSON.stringify(rp.arcane || []) === JSON.stringify(x) ? 'gold' : 'ghost'}" ${can ? `data-t="restarc" data-v="${x.join(',')}"` : 'disabled'} style="width:auto">${x.map(l => ORD[l]).join('+')}</button>`).join('')}</div>` : ''}
   <div class="note">${rp.identify || rp.attune ? '\u2713 Focus on one item during the rest (set on the Gear tab).' : 'You can also focus on one magic item through the rest, to identify or attune to it: Gear tab.'}</div>`;
  const longBits = `<ul class="list" style="margin-top:6px"><li>Back: all HP, all Hit Point Dice, every spell slot and feature; Exhaustion \u22121</li><li>Eats a ration${r.water ? '; water from the ' + esc(r.water) : ' and a day\u2019s water'}${c.inventory.some(i => i.id === 'rations') ? '' : ' <span class="warn">(you have no rations)</span>'}</li>${cls.caster && cls.caster.prepares !== 'levelup' ? `<li><span style="flex:1">After the rest: ${['paladin', 'ranger'].includes(c.cls) ? 'replace one prepared spell' : 'change your prepared spells'}</span><button class="btn sm ${T.prepPick ? 'gold' : 'ghost'}" data-t="go" data-v="spells" style="width:auto">${T.prepPick ? '\u2713 Saved' : 'Spells \u2192'}</button></li>` : ''}</ul>
   ${r.risk ? `<div class="note warn">\u26A0 ${esc(r.risk)}</div>` : ''}<div class="note">SRD: a long rest is stopped by Initiative, a non-cantrip spell, damage, or an hour of exertion. With 1 hour rested you still get a short rest\u2019s benefits, or the rest can resume (+1 hour).</div>${r.risk ? `<div class="meta" style="margin-top:6px">If it\u2019s cut short you\u2019d spend: </div>${shortBits}` : ''}`;
  return `<div class="card" id="restcard"><h2>${r.kind === 'long' ? 'Long' : 'Short'} rest${r.ifVictory ? ' \u00b7 if you win' : ' tonight'}</h2>${r.kind === 'short' ? `<div class="meta" style="margin-top:4px">One hour. ${r.ifVictory ? 'Only if the fight ends in victory tonight. ' : ''}Interrupted (Initiative, a spell, damage) = no benefit.</div>${shortBits}` : longBits}</div>`;
}

// ---------- Ask the GM (Table and Chronicle tabs)
export function askCard({ full = false } = {}) {
  const T = X.T; if (!T.camp) return ''; const all = T.asks || []; const mine = all.filter(a => a.by === X.OWNER); const shown = full ? all : [...mine, ...all.filter(a => a.by !== X.OWNER && a.status === 'answered')].slice(0, 4);
  const who = pid => X.first(T.players.find(p => p.pid === pid)?.name || pid);
  const row = a => `<li style="display:block"><div class="meta"><b>${esc(who(a.by))}</b> \u00b7 night ${a.night}${a.status === 'answered' ? ' \u00b7 <span style="color:#2f6a2c">answered</span>' : ' \u00b7 with the GM'}</div><div style="font:600 14.5px/1.3 Alegreya,serif;margin-top:2px">\u201c${esc(a.text)}\u201d</div>${a.answer ? `<div class="called" style="margin-top:6px">${esc(a.answer.text)}${a.answer.srd ? ` <span style="color:#cdb27a">(${esc(a.answer.srd)})</span>` : ''}</div>` : ''}</li>`;
  return `<div class="card" id="ask"><h2>Ask the GM</h2><div class="meta" style="margin-top:4px">Questions about the world or the rules (\u201cIs the river deep enough to swim?\u201d). The GM answers here. Answers are words only: anything that changes a sheet goes through the engine in the nightly batch.</div>
   ${me() ? `<textarea rows="2" data-f="ask" style="margin-top:8px" placeholder="Ask the GM\u2026">${esc(T.askText || '')}</textarea><div class="row" style="margin-top:7px"><span class="meta" style="flex:1">${T.askDone ? '<span style="color:#2f6a2c">\u2713 Sent. The answer shows up here.</span>' : 'Everyone at the table can read questions and answers.'}</span><button class="btn sm" data-t="asksend" style="width:auto">Ask</button></div>` : ''}
   ${shown.length ? `<ul class="list" style="margin-top:6px">${shown.map(row).join('')}</ul>` : ''}${!full && all.length > shown.length ? `<button class="btn ghost sm" data-t="go" data-v="asks" style="width:auto;margin-top:6px">All questions (${all.length})</button>` : ''}</div>`;
}
export const asksView = () => `<div class="stephead"><div class="eyebrow">The table</div><div class="title">Ask the GM</div></div>` + askCard({ full: true });

// ---------- clicks (return 'save' to persist tonight's extras, 'render' to redraw, null if not ours)
export async function onClick(t, v, k) {
  const T = X.T; const c = myC();
  if (t === 'sptab') { T.spellTab = v; return 'render'; }
  if (t === 'spprepedit') { T.prepEdit = true; T.prepDraft = [...(T.prepPick?.list || c.prepared)]; T.prepErr = null; T.prepPick = T.prepPick || null; T.prepTmp = [...T.prepDraft]; return 'render'; }
  if (t === 'spprepcancel') { T.prepEdit = false; T.prepTmp = null; return 'render'; }
  if (t === 'spprep') { const L = T.prepTmp || [...c.prepared]; const i = L.indexOf(v); if (i >= 0) L.splice(i, 1); else L.push(v); T.prepTmp = L; T.prepPick = { list: L }; T._prepUnsaved = true; return 'render'; }
  if (t === 'spprepsave') { const s = deriveSheet(c); const L = T.prepTmp || c.prepared; T.prepErr = L.length > s.spellcasting.preparedMax ? `at most ${s.spellcasting.preparedMax} prepared` : (['paladin', 'ranger'].includes(c.cls) && L.filter(x => !c.prepared.includes(x)).length > 1) ? 'replace only one spell after a long rest (SRD)' : null; if (T.prepErr) return 'render';
    T.prepPick = { list: [...L] }; T.prepEdit = false; T._prepUnsaved = false; return 'save'; }
  if (t === 'spcast') { if (inBattle()) { const r = T.orders.thisRound; r.action = { do: 'cast', spell: v, target: spellModel(v).kind === 'heal' || spellModel(v).kind === 'buff' ? 'ally_lowest' : 'nearest' }; T.view = 'table'; T._top = false; return 'render'; }
    const q = T.castQ || []; const i = q.findIndex(x => x.spell === v); if (i >= 0) q.splice(i, 1); else { const hurt = [...T.players].map(p => ({ cid: p.cid, c: st().chars[p.cid] })).filter(x => x.c).sort((a, b) => (a.c.hp.cur / deriveSheet(a.c).hpMax) - (b.c.hp.cur / deriveSheet(b.c).hpMax))[0]; q.push({ spell: v, level: SRD.spells[v].level, targets: [hurt?.cid || c.id] }); } T.castQ = q; return 'save'; }
  if (t === 'spcastrm') { T.castQ.splice(+v, 1); return 'save'; }
  if (t === 'spcopy') { const q = T.copyQ || []; const i = q.findIndex(x => x.scroll === k); if (i >= 0) q.splice(i, 1); else q.push({ spell: v, scroll: k }); T.copyQ = q; return 'save'; }
  if (t === 'spcopyrm') { T.copyQ.splice(+v, 1); return 'save'; }
  if (t === 'lusuggest') { T.levelPick = suggestPicks(c); return 'render'; }
  if (t === 'lumode') { const sg = suggestPicks(c).asi || {}; T.levelPick = { ...T.levelPick, asi: v === 'feat' ? { feat: 'alert' } : (sg.feat ? {} : sg) }; return 'render'; }
  if (t === 'luasi') { const a = { ...(T.levelPick.asi || {}) }; delete a.feat; const tot = Object.values(a).reduce((x, y) => x + y, 0); const d = +v; if (d > 0 && tot >= 2) { const other = Object.keys(a).find(x => x !== k && a[x] > 0); if (other) { a[other]--; if (!a[other]) delete a[other]; } else if (a[k] >= 2) return 'render'; }
    a[k] = Math.max(0, (a[k] || 0) + d); if (!a[k]) delete a[k]; T.levelPick = { ...T.levelPick, asi: a }; return 'render'; }
  if (t === 'lu') { const p = { ...T.levelPick };
    if (k === 'feat') p.asi = { feat: v, ...(v === 'grappler' ? { ability: 'str' } : {}), ...(v === 'skilled' ? { skills: [] } : {}) };
    else if (k === 'grab') p.asi = { ...p.asi, ability: v };
    else if (k === 'skill') { const L = [...(p.asi.skills || [])]; const i = L.indexOf(v); if (i >= 0) L.splice(i, 1); else if (L.length < 3) L.push(v); p.asi = { ...p.asi, skills: L }; }
    else { const g = levelUpPlan(c).groups.find(x => x.key === k); const L = [...(p[k] || (k === 'prepared' ? g.current : []))]; const i = L.indexOf(v); if (i >= 0) L.splice(i, 1); else if (L.length < (g.n ?? g.max)) L.push(v); else if (g.n === 1) L.splice(0, 1, v); p[k] = L;
      if (k === 'spellbookAdd' && p.prepared) p.prepared = p.prepared.filter(id => g.current?.includes?.(id) || c.spellbook.includes(id) || L.includes(id)); }
    T.levelPick = p; return 'render'; }
  if (t === 'lusave') { const pv = previewLevelUp(c, T.levelPick); if (!pv.ok) return 'render'; T.levelSaved = true; return 'save'; }
  if (t === 'resthd') { T.restPick = { ...(T.restPick || {}), hitDice: Math.max(0, (T.restPick?.hitDice || 0) + +v) }; if (!T.restPick.hitDice) delete T.restPick.hitDice; return 'save'; }
  if (t === 'restarc') { const x = v.split(',').map(Number); const cur = JSON.stringify(T.restPick?.arcane || []); T.restPick = { ...(T.restPick || {}), arcane: cur === JSON.stringify(x) ? [] : x }; if (!T.restPick.arcane.length) delete T.restPick.arcane; return 'save'; }
  if (t === 'asksend') { const text = (T.askText || '').trim(); if (text.length < 3) { alert('Ask a question (a few words is fine).'); return 'render'; } const id = 'q' + X.now().toString(36) + Math.floor(Math.random() * 1296).toString(36).padStart(2, '0');
    await X.store.ask({ id, by: X.OWNER, night: T.n || 0, text, about: T.view }); T.askText = ''; T.askDone = id; T.asks = await X.store.listAsks(); return 'render'; }
  return null;
}
// the extras this module adds to tonight's action
export function extras() { const T = X.T; return { ...(T.levelSaved && T.levelPick ? { levelUp: T.levelPick } : {}), ...(T.castQ?.length ? { casts: T.castQ } : {}), ...(T.copyQ?.length ? { copy: T.copyQ } : {}), ...(T.prepPick && !T._prepUnsaved ? { prepare: T.prepPick } : {}) }; }
export function loadExtras(mine) { const T = X.T; T.levelPick = mine?.levelUp || null; T.levelSaved = !!mine?.levelUp; T.castQ = mine?.casts || []; T.copyQ = mine?.copy || []; T.prepPick = mine?.prepare || null; }
