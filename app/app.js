// BoG V · Phase 2 · the Forge (Session 0) and guided level-3 character builder.
// Every number on screen comes from the engine (deriveSheet via engine/src/forge.js). Choices the rules don't
// allow are never offered, and taps that would break a limit do nothing.
import * as F from '../engine/src/forge.js';
import { itemDef } from '../engine/src/rules/items.js';
import { SKILLS, ABILITIES } from '../engine/src/rules/origins.js';
import SRD from '../engine/srd/data/srd.js';
import { createStore, LockedError, RtdbRest } from './storage.js';
import { GoogleAuth, EMULATOR } from './auth.js';
import * as P from './portrait.js';
import * as PA from './portrait-art.js';
import * as SI from './spell-info.js';
const SPELL_KEYS = ['cantrips', 'spellbook', 'prepared', 'mi.cantrips', 'mi.spell'];  // Forge choice groups whose options are spells (note 4)
// portrait as CSS layers: painting + live gear when the library has this look, else the procedural SVG (offline-safe)
const pStyle = (d, ch) => { try { return d ? PA.layers(d, ch).style : ''; } catch (e) { console.warn('portrait', e); return ''; } };
const pEl = (cls, d, ch, svg) => `<span class="${cls}" role="img" aria-label="portrait" style="${esc(pStyle(d, ch) || `background-image:url("${P.svgDataUrl(svg || P.fallbackCrest(d?.name))}")`)}"></span>`;
import * as T from './forge-text.js';

const STEPS = ['forge', 'name', 'species', 'class', 'background', 'abilities', 'skills', 'spells', 'equipment', 'keepsake', 'look', 'party'];
const QS = new URLSearchParams(location.search); let OWNER = QS.get('player') || 'local';
// ?now=<ms|ISO> pins the clock for simulations (it keeps ticking from there); default is the real clock
const NOW0 = QS.get('now') ? (/^\d+$/.test(QS.get('now')) ? +QS.get('now') : Date.parse(QS.get('now'))) : null; const T0 = Date.now();
const now = () => NOW0 == null ? Date.now() : NOW0 + (Date.now() - T0);
const EMU = QS.get('store') === 'emulator'; let AUTH = null;
let store = EMU ? null : createStore(location.search, { owner: OWNER, now });
const S = { view: 'forge', step: 0, draft: F.newDraft(), heroes: [], drawer: null, hero: null, justForged: null };
const $ = sel => document.querySelector(sel);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const sgn = n => (n >= 0 ? '+' : '\u2212') + Math.abs(n);
const AB = { str: 'Strength', dex: 'Dexterity', con: 'Constitution', int: 'Intelligence', wis: 'Wisdom', cha: 'Charisma' };
const skillName = k => SKILLS[k]?.name || F.nice(k);
const gp = cp => { const g = Math.floor(cp / 100), s = Math.floor((cp % 100) / 10), c = cp % 10; return [g && g + ' gp', s && s + ' sp', c && c + ' cp'].filter(Boolean).join(' ') || '0 gp'; };
const stepKey = () => STEPS[S.step];
// show identical unequipped items once with a count (the engine keeps them as separate instances)
const stackInv = inv => { const out = []; for (const i of inv) { const same = !i.slot && out.find(o => !o.slot && o.id === i.id && !o.pints === !i.pints); if (same) same.qty = (same.qty || 1) + (i.qty || 1); else out.push({ ...i }); } return out; };

// ---------- engine glue (memoised per draft) ----------
let memo = { key: null, pv: null, ev: null };
function engine() { const key = JSON.stringify(S.draft); if (memo.key !== key) memo = { key, pv: F.preview(S.draft), ev: F.evaluate(S.draft) }; return memo; }
function stepErrors(k = stepKey()) {
  const d = S.draft;
  if (k === 'forge' || k === 'look') return [];
  if (k === 'keepsake') return d.keepsake.trim().length >= 2 ? [] : ['Name your keepsake (or tap an idea)'];
  if (k === 'party') { const ev = engine().ev; return ev.ok ? [] : [...ev.errors, ...ev.ruleErrors]; }
  return F.stepErrors(d, k);
}
const maxReach = () => { for (let i = 0; i < STEPS.length; i++) if (stepErrors(STEPS[i]).length) return i; return STEPS.length - 1; };
function setDraft(d) { S.draft = d; store.putDraft(OWNER, d); }

// ---------- generic choice group ----------
function group(g, style) {
  const full = g.value.length >= g.n; const asRows = style === 'rows' || g.options.some(o => o.hint) || g.options.some(o => o.label.length > 26);
  const head = `<h2>${esc(g.label)}<span class="count ${full ? 'ok' : ''}">${g.value.length}/${g.n}</span></h2>`;
  if (!g.options.length) return `<div class="card">${head}<div class="note">Nothing to choose yet; pick earlier steps first.</div></div>`;
  if (!asRows) return `<div class="card">${head}<div class="chips">${g.options.map(o => { const on = g.value.includes(o.id);
    return `<button class="chip ${on ? 'on' : full && g.n > 1 ? 'full' : ''}" data-a="pick" data-k="${g.key}" data-v="${o.id}">${esc(o.label)}</button>`; }).join('')}</div>${g.always?.length ? `<div class="note">Always prepared (free): ${g.always.map(id => esc(SRD.spells[id]?.name || id)).join(', ')}</div>` : ''}</div>`;
  return `<div class="card">${head}<div class="opts ${g.options.length > 8 ? 'compact' : ''}">${g.options.map(o => { const on = g.value.includes(o.id);
    const sp = SI.has(o.id) && SPELL_KEYS.includes(g.key); const ro = sp && S.rules?.[g.key + ':' + o.id];
    return `<button class="move ${on ? 'sel' : full && g.n > 1 ? 'full' : ''}" data-a="pick" data-k="${g.key}" data-v="${o.id}"><div class="t">${esc(o.label)}${o.hint ? `<small>${esc(o.hint)}</small>` : ''}${sp ? `<small>${esc(SI.summary(o.id))}</small><small><span data-a="sprules" data-k="${g.key}" data-v="${o.id}" style="text-decoration:underline;color:var(--wine)">${ro ? 'Hide rules \u25b4' : 'Full rules \u25be'}</span></small>` : ''}</div><span class="check"></span></button>`; }).join('')}</div>${g.options.filter(o => SPELL_KEYS.includes(g.key) && S.rules?.[g.key + ':' + o.id]).map(o => `<div style="margin-top:8px"><b>${esc(o.label)}</b>${SI.rulesBlock(o.id)}</div>`).join('')}${g.always?.length ? `<div class="note">Always prepared (free): ${g.always.map(id => esc(SRD.spells[id]?.name || id)).join(', ')}</div>` : ''}</div>`;
}
const groupsFor = k => F.choiceGroups(S.draft).filter(g => g.step === k);
const head = (k) => { const t = T.STEP[k]; return `<div class="stephead"><div class="eyebrow">${esc(t.eyebrow)}</div><div class="title">${esc(t.title)}</div></div>${t.say ? `<div class="say">${esc(t.say)}</div>` : ''}`; };

// ---------- steps ----------
const V = {};
V.forge = () => `<div class="stephead"><div class="eyebrow">${T.STEP.forge.eyebrow}</div><div class="title">${T.STEP.forge.title}</div></div>
  <div class="card intro">${T.INTRO.map(p => `<p><b class="k">${esc(p.k)}</b>${esc(p.t)}</p>`).join('')}</div>
  <div class="card dark"><h2>How the Forge works</h2><div class="note" style="color:#e8d8b4;font-size:13px">Twelve short steps. Every number is computed by the rules engine (SRD 5.2.1, 2024 rules), so you can't build an illegal hero. Your sheet updates live in the bar at the bottom. Your progress is saved on this device.</div></div>`;
V.name = () => { const d = S.draft; return head('name') + `<div class="card"><h2>Hero name</h2><input class="input" data-f="name" maxlength="40" placeholder="Shout-able across a battlefield" value="${esc(d.name)}" style="margin-top:9px">
  <div class="lbl">Pronouns</div><div class="chips">${['he/him', 'she/her', 'they/them'].map(p => `<button class="chip ${d.pronouns === p ? 'on' : ''}" data-a="field" data-k="pronouns" data-v="${p}">${p}</button>`).join('')}</div>
  <input class="input" data-f="pronouns" maxlength="24" placeholder="or type your own" value="${esc(['he/him', 'she/her', 'they/them'].includes(d.pronouns) ? '' : d.pronouns)}" style="margin-top:8px">
  <div class="lbl">Player</div><input class="input" data-f="player" maxlength="30" placeholder="Your real name (for the party list)" value="${esc(d.player)}" style="margin-top:6px"></div>`; };
V.species = () => { const d = S.draft; return head('species') + `<div class="pickgrid">${F.speciesList().map(s => `<button class="card pickcard ${d.species === s.id ? 'sel' : ''}" data-a="field" data-k="species" data-v="${s.id}">
  <div class="nm">${esc(s.name)}</div><div class="meta">Speed ${s.speed} ft${s.darkvision ? ` \u00b7 Darkvision ${s.darkvision}` : ''} \u00b7 ${s.sizes.map(F.nice).join('/')}</div>
  <div class="d">${s.houseRule ? '<span class="tag k">House rule</span>' : ''}${s.traits.slice(0, 3).map(t => `<span class="tag">${esc(t)}</span>`).join('')}</div></button>`).join('')}</div>
  ${d.species === 'aasimar' ? `<div class="card dark"><h2>Aasimar · house rule</h2><div class="note" style="color:#e8d8b4">Approved by Wes (not in SRD 5.2.1). Darkvision 60, resistance to radiant and necrotic, Healing Hands (roll your proficiency bonus in d4s, once per long rest), the Light cantrip (CHA), and Celestial Revelation from level 3. Rules text: engine/HOUSE_RULES.md.</div></div>` : ''}
  ${groupsFor('species').map(g => group(g)).join('')}`; };
V.class = () => { const d = S.draft; const sel = d.cls && F.classList().find(c => c.id === d.cls);
  return head('class') + `<div class="pickgrid">${F.classList().map(c => `<button class="card pickcard ${d.cls === c.id ? 'sel' : ''}" data-a="field" data-k="cls" data-v="${c.id}">
  <div class="nm">${esc(c.name)}</div><div class="meta">d${c.hd} \u00b7 ${c.primary.slice(0, 2).map(a => a.toUpperCase()).join(', ')}${c.caster ? ' \u00b7 casts' : ''}</div><div class="d"><span class="tag m">${esc(c.subclass)}</span></div></button>`).join('')}</div>
  ${sel ? `<div class="card"><h2>${esc(sel.name)} 3 \u00b7 ${esc(sel.subclass)}</h2><ul class="list">${F.features3(d.cls).map(f => `<li><span>${esc(f.name)}</span><span class="r">${f.sub ? '<span class="tag m">subclass</span>' : `<span class="tag">level ${f.level}</span>`}</span></li>`).join('')}</ul>
  <div class="note">Saving throws: ${sel.saves.map(a => AB[a]).join(', ')}. Hit die d${sel.hd}.</div></div>` : ''}
  ${groupsFor('class').map(g => group(g, 'rows')).join('')}`; };
V.background = () => { const d = S.draft; const bg = d.background && F.backgroundList().find(b => b.id === d.background);
  return head('background') + `<div class="pickgrid">${F.backgroundList().map(b => `<button class="card pickcard ${d.background === b.id ? 'sel' : ''}" data-a="field" data-k="background" data-v="${b.id}">
  <div class="nm">${esc(b.name)}</div><div class="meta">${b.abilities.map(a => a.toUpperCase()).join(' \u00b7 ')}</div><div class="d"><span class="tag g">${esc(b.feat)}</span>${b.skills.map(s => `<span class="tag">${esc(skillName(s))}</span>`).join('')}</div></button>`).join('')}</div>
  ${bg ? `<div class="card"><h2>Ability bonus (2024 rules)</h2><div class="seg" style="margin-top:9px">${['2-1', '1-1-1'].map(m => `<button data-a="field" data-k="bonusMode" data-v="${m}" style="flex:1"><span class="${d.bonusMode === m ? 'on' : ''}" style="display:block">${m === '2-1' ? '+2 and +1' : '+1 / +1 / +1'}</span></button>`).join('')}</div>
   ${d.bonusMode === '2-1' ? `<div class="lbl">+2 to</div><div class="chips">${bg.abilities.map(a => `<button class="chip ${d.plus2 === a ? 'on' : ''}" data-a="plus2" data-v="${a}">${AB[a]}</button>`).join('')}</div>
   <div class="lbl">+1 to</div><div class="chips">${bg.abilities.filter(a => a !== d.plus2).map(a => `<button class="chip ${d.plus1 === a ? 'on' : ''}" data-a="plus1" data-v="${a}">${AB[a]}</button>`).join('')}</div>` : `<div class="note">+1 each to ${bg.abilities.map(a => AB[a]).join(', ')}.</div>`}
   <div class="note">Origin feat: <b>${esc(bg.feat)}</b>. Skills: ${bg.skills.map(skillName).join(', ')}. Tool: ${esc(F.nice(bg.tool || ''))}.</div></div>` : ''}`; };
V.abilities = () => { const d = S.draft; const pv = engine().pv; const bonus = F.bgBonus(d); const pb = d.method === 'pointbuy'; const cost = F.pointBuyCost({ ...Object.fromEntries(ABILITIES.map(a => [a, 8])), ...d.scores });
  const ready = pv && !pv.pending.includes('abilities');
  return head('abilities') + `<div class="card"><div class="seg">${[['array', 'Standard array'], ['pointbuy', 'Point buy (27)']].map(([m, l]) => `<button data-a="field" data-k="method" data-v="${m}" style="flex:1"><span class="${d.method === m ? 'on' : ''}" style="display:block">${l}</span></button>`).join('')}</div>
  <div class="row" style="margin-top:9px">${pb ? `<span class="budget">${27 - cost} points left</span>` : `<span class="tiny">Use each of 15, 14, 13, 12, 10, 8 once. Tap a value to move it.</span>`}<span class="sp"></span>${d.cls ? `<button class="btn ghost sm" data-a="suggest" style="width:auto">Suggest for ${esc(F.nice(d.cls))}</button>` : ''}</div>
  <div style="margin-top:6px">${ABILITIES.map(a => { const v = d.scores[a]; const fin = ready ? pv.sheet.scores[a] : null; const mod = ready ? pv.sheet.mods[a] : null;
    const ctl = pb ? `<div class="stepper"><button data-a="pb" data-k="${a}" data-v="-1" ${F.canLower(d, a) ? '' : 'disabled'}>\u2212</button><b>${v ?? 8}</b><button data-a="pb" data-k="${a}" data-v="1" ${F.canRaise(d, a) ? '' : 'disabled'}>+</button><span class="c">cost ${F.POINT_BUY[v ?? 8]}</span></div>`
      : `<div class="vals">${F.STANDARD_ARRAY.map(x => { const owner = ABILITIES.find(k => d.scores[k] === x); return `<button class="chip ${v === x ? 'on' : owner ? 'full' : ''}" data-a="arr" data-k="${a}" data-v="${x}">${x}</button>`; }).join('')}</div>`;
    return `<div class="abrow"><div class="k">${a.toUpperCase()}</div>${ctl}<div class="bn">${bonus[a] ? '+' + bonus[a] : ''}</div><div class="fin">${fin ?? '\u2013'}<small>${mod == null ? '' : sgn(mod)}</small></div></div>`; }).join('')}</div>
  <div class="note">Final score and modifier come from the engine and include your ${esc(F.nice(d.background || 'background'))} bonus. Primary for ${esc(F.nice(d.cls || 'your class'))}: ${(F.primaryOf(d.cls) || []).slice(0, 2).map(a => AB[a]).join(', ')}.</div></div>`; };
V.skills = () => { const d = S.draft; const bg = F.backgroundList().find(b => b.id === d.background); const pv = engine().pv;
  const locked = [...(bg?.skills || []), ...(d.species === 'elf' && d.speciesChoices.keen_senses ? [d.speciesChoices.keen_senses] : [])];
  return head('skills') + `<div class="card"><h2>Already yours</h2><div class="chips">${locked.map(s => `<span class="chip lock">${esc(skillName(s))}</span>`).join('')}</div><div class="note">From your background${d.species === 'elf' ? ' and Keen Senses' : ''}.</div></div>`
   + groupsFor('skills').map(g => group(g)).join('')
   + (pv?.sheet ? `<div class="card dark"><h2>Skill bonuses (engine)</h2><div class="two">${[0, 1].map(h => `<ul class="list">${Object.entries(pv.sheet.skills).slice(h * 9, h * 9 + 9).map(([k, s]) => `<li style="border-color:#4a3522;padding:4px 0;font-size:13px">${s.expertise ? '\u25c6' : s.prof ? '\u25cf' : '\u25cb'} ${esc(skillName(k))}<span class="r">${sgn(s.v)}</span></li>`).join('')}</ul>`).join('')}</div><div class="tiny">\u25cf proficient \u00b7 \u25c6 expertise</div></div>` : ''); };
V.spells = () => { const d = S.draft; const gs = groupsFor('spells'); const pv = engine().pv; const sc = pv?.sheet?.spellcasting;
  const top = sc && sc.slots ? `<div class="card dark"><h2>Your magic at level 3</h2><div class="big3">${[['Save DC', sc.dc], ['Attack', sgn(sc.attack)], ['Slots', sc.pact ? `${sc.pact.count}\u00d7L${sc.pact.level}` : sc.slots.join('/') || '\u2013'], ['Ability', sc.ability.toUpperCase()]].map(([k, v]) => `<div><div class="k">${k}</div><div class="v" style="font-size:17px">${v}</div></div>`).join('')}</div>${sc.species ? `<div class="tiny" style="margin-top:6px">Species cantrip: ${sc.species.cantrips.map(id => SRD.spells[id]?.name).join(', ')} (${sc.species.ability.toUpperCase()}).</div>` : ''}</div>` : '';
  if (!gs.length) return head('spells') + top + `<div class="card"><h2>No spells to choose</h2><div class="note">${esc(F.nice(d.cls || 'Your class'))} doesn't choose spells at level 3${d.species === 'aasimar' ? ' (your Aasimar Light cantrip is automatic)' : ''}. Tap Next.</div></div>`;
  return head('spells') + top + gs.map(g => group(g, 'rows')).join(''); };
V.equipment = () => { const d = S.draft; if (!d.cls || !d.background) return head('equipment') + '<div class="card">Pick a class and background first.</div>';
  const co = F.classGearOptions(d.cls), bo = F.backgroundGearOptions(d.background); const spec = (() => { try { return d.gear.cls && d.gear.bg ? F.toSpec(d) : null; } catch { return null; } })();
  const opt = (kind, o, cur) => `<button class="move ${cur === o.key ? 'sel' : ''}" data-a="gear" data-k="${kind}" data-v="${o.key}"><div class="t">Option ${o.key}<small>${esc(o.label)}</small></div><span class="check"></span></button>`;
  const gold = (d.gear.cls && !co.find(o => o.key === d.gear.cls)?.items.length) || d.gear.bg === 'B';
  const purse = spec ? F.purseAfterGear(d) : 0; const stip = spec ? F.stipendFor(purse) : 0;
  let shop = ''; if (gold && spec) { const left = purse; const cat = { weapon: 'Weapons', armor: 'Armor', shield: 'Armor', gear: 'Packs & gear', tool: 'Tools', focus: 'Foci', consumable: 'Supplies', ammo: 'Supplies' };
    const items = F.starterShop(); const groups = {}; for (const it of items) (groups[cat[it.kind] || 'Packs & gear'] = groups[cat[it.kind] || 'Packs & gear'] || []).push(it);
    shop = `<div class="card"><h2>Temple quartermaster<span class="count ok">${gp(left)} left</span></h2>${Object.entries(groups).map(([gname, list]) => { const nb = list.reduce((a, it) => a + (d.gear.bought.find(b => b.id === it.id)?.qty || 0), 0); return `<details class="shopsec" ${S.open?.[gname] ? 'open' : ''} data-sec="${gname}"><summary><span>${gname}</span><span class="tiny">${list.length} items${nb ? ` \u00b7 <b>${nb} bought</b>` : ''}</span></summary><ul class="list shop">${list.map(it => { const q = d.gear.bought.find(b => b.id === it.id)?.qty || 0;
      return `<li><span style="flex:1;min-width:0">${esc(it.name)} <span class="tiny">${gp(it.cost)}</span></span><span class="stepper"><button data-a="buy" data-k="${it.id}" data-v="-1" ${q ? '' : 'disabled'}>\u2212</button><b style="font-size:14px">${q}</b><button data-a="buy" data-k="${it.id}" data-v="1" ${it.cost <= left ? '' : 'disabled'}>+</button></span></li>`; }).join('')}</ul></details>`; }).join('')}<div class="note">SRD prices. You can't buy what you can't afford.</div></div>`; }
  const inv = spec ? stackInv(spec.inventory.filter(i => i.id !== 'keepsake')) : [];
  return head('equipment') + `<div class="card"><h2>${esc(F.nice(d.cls))} kit</h2><div class="opts">${co.map(o => opt('cls', o, d.gear.cls)).join('')}</div></div>
  <div class="card"><h2>${esc(F.nice(d.background))} kit</h2><div class="opts">${bo.map(o => opt('bg', o, d.gear.bg)).join('')}</div></div>${shop}
  ${spec ? `<div class="card dark"><h2>Your pack<span class="count" style="color:var(--gold2)">${gp(spec.coin)}</span></h2><ul class="list">${inv.map(i => { const def = itemDef(i); return `<li style="border-color:#4a3522;padding:5px 0;font-size:13.5px">${esc(def.name)}${(i.qty || 1) > 1 ? ` \u00d7${i.qty}` : ''}${i.pints ? ' (full)' : ''}<span class="r">${i.slot ? `<span class="tag k">${esc({ main: 'in hand', off: 'off hand', armor: 'worn', ranged: 'ranged', neck: 'worn' }[i.slot] || i.slot)}</span>` : ''}</span></li>`; }).join('')}</ul><div class="tiny" style="margin-top:4px">Packs are unpacked so food, water and torches are tracked from night one. Gear is auto-equipped; change it later on the Gear screen.</div><div class="tiny" style="margin-top:4px">${stip ? `Your kit leaves ${gp(purse)}; <b>King Elon’s treasury</b> sends a stipend of ${gp(stip)}, so you start with ${gp(spec.coin)} in hand.` : `You keep ${gp(spec.coin)}; King Elon’s stipend only tops a purse up to 75 gp.`}</div></div>` : ''}`; };
V.keepsake = () => { const d = S.draft; return head('keepsake') + `<div class="card"><h2>What came back with you</h2><input class="input" data-f="keepsake" maxlength="80" placeholder="e.g. a bottle cap from Doug\u2019s crown" value="${esc(d.keepsake)}" style="margin-top:9px">
  <div class="lbl">Ideas</div><div class="chips">${T.KEEPSAKE_IDEAS.map((k, i) => `<button class="chip ${d.keepsake === k ? 'on' : ''}" data-a="keep" data-v="${i}">${esc(k)}</button>`).join('')}</div>
  <div class="note">Lock C5: memories, one keepsake, and the glow. Nothing else carries over. The keepsake weighs nothing, is worth nothing, and has no game effect.</div></div>`; };
V.look = () => { const d = S.draft; const spec = P.portraitSpec(d, engine().pv?.ch); const svg = P.portraitFor(d, engine().pv?.ch); const L = d.look || {};
  const sw = (key, cols, cur) => `<div class="swatches">${cols.map(c => `<button class="sw ${cur === c ? 'on' : ''}" style="background:${c}" data-a="look" data-k="${key}" data-v="${c}" aria-label="${key} ${c}"></button>`).join('')}</div>`;
  const ch = (key, opts, cur) => `<div class="chips">${opts.map(([v, l]) => `<button class="chip ${cur === v ? 'on' : ''}" data-a="look" data-k="${key}" data-v="${v}">${l}</button>`).join('')}</div>`;
  return head('look') + `<div class="card" style="padding:10px"><img class="portrait" alt="portrait" src="${P.svgDataUrl(svg)}"><div class="tiny" style="margin-top:6px">Drawn from your choices and your equipped gear: ${esc(spec.armor)} \u00b7 ${esc(spec.weapon)}${spec.shield ? ' \u00b7 shield' : ''}.</div></div>
  <div class="card"><h2>Features</h2><div class="lbl">Skin</div>${sw('skin', P.PALETTE.skin[spec.species] || P.PALETTE.skin.human, spec.skin)}
  <div class="lbl">Hair</div>${sw('hair', P.PALETTE.hair, spec.hair)}${ch('hairStyle', P.HAIR_STYLES.map(h => [h, F.nice(h)]), spec.hairStyle)}
  <div class="lbl">Beard</div>${ch('beard', P.BEARDS.map(b => [b, F.nice(b)]), spec.beard)}<div class="lbl">Eyes</div>${sw('eyes', P.PALETTE.eyes, spec.eyes)}</div>
  <div class="card"><h2>Heroics</h2><div class="lbl">Cape</div>${sw('cape', P.PALETTE.cape, spec.cape)}<div class="lbl">Glow (cosmetic)</div>${ch('glow', Object.keys(P.PALETTE.glow).map(g => [g, F.nice(g)]), L.glow || (d.species === 'aasimar' ? 'gold' : 'cyan'))}
  <div class="lbl">Emblem</div>${ch('emblem', [['none', 'None'], ['coin', 'Waukeen\u2019s coin'], ['sun', 'Sun'], ['star', 'Star']], spec.emblem)}<div class="lbl">In hand</div>${ch('prop', [['auto', 'Auto'], ['weapon', 'Weapon'], ['ranged', 'Ranged'], ['spell', 'Spell']], L.prop || 'auto')}</div>`; };
V.party = () => { const { pv, ev } = engine(); const d = S.draft; const others = S.heroes.filter(h => h.id !== d.id);
  const me = ev.sheet ? { name: d.name || 'You', roles: F.rolesOf(ev.sheet, ev.ch) } : null; const gaps = F.partyGaps([...others.map(h => ({ name: h.ch.name, roles: h.roles || [] })), ...(me ? [me] : [])]);
  const miss = gaps.filter(g => !g.who.length);
  return head('party') + `<div class="card"><h2>Party gaps</h2><div class="tiny">${others.length ? `Forged so far: ${others.map(h => esc(h.ch.name)).join(', ')}.` : 'You are the first hero through the Forge. Gaps fill in as the others finish.'}</div>
   <div class="gaps">${gaps.map(g => `<div class="gap ${g.who.length ? '' : 'miss'}"><div class="k">${esc(g.label)}</div><div class="w">${g.who.length ? esc(g.who.join(', ')) : 'nobody yet'}</div></div>`).join('')}</div>
   ${miss.length ? `<div class="note"><b>Hint:</b> ${esc(T.ROLE_HINT[miss[0].role])}</div>` : '<div class="note"><b>Covered:</b> every role has someone.</div>'}</div>
   ${ev.ok ? renderSheet(ev.sheet, ev.ch, d, P.portraitFor(d, ev.ch)) : `<div class="card"><h2>Not ready</h2><ul class="list">${[...ev.errors, ...ev.ruleErrors].map(e => `<li class="warn">${esc(e)}</li>`).join('')}</ul></div>`}`; };

// ---------- the full sheet (shared by preview, review, roster) ----------
export function renderSheet(s, ch, d, svg, provisional) {
  const sc = s.spellcasting; const fl = ch.flavor || {}; const sp = id => esc(SRD.spells[id]?.name || F.nice(id));
  const atk = s.attacks.map(a => `<li><div style="min-width:0"><b>${esc(a.name)}</b><div class="meta">${a.melee ? `melee ${a.reach} ft` : `ranged ${esc(a.range || '')}`}${a.mastery ? ` \u00b7 mastery: ${esc(F.nice(a.mastery))}` : ''}${a.proficient ? '' : ' \u00b7 <span class="warn">not proficient</span>'}</div></div><span class="r">${sgn(a.toHit)} \u00b7 ${esc(a.dice === '0d1' ? '' : a.dice)}${a.dmgBonus ? (a.dice === '0d1' ? a.dmgBonus : sgn(a.dmgBonus)) : ''} ${esc((a.type || '').slice(0, 5))}.</span></li>`).join('');
  const res = Object.entries(s.resources).map(([k, r]) => `<li>${esc(F.nice(k))}<span class="r">${r.max > 6 ? `${r.left} / ${r.max}` : Array.from({ length: r.max }, (_, i) => `<span class="pip r ${i < r.left ? 'f' : ''}"></span>`).join('')} <span class="tiny">${r.reset === 'long' ? 'long rest' : r.reset === 'short' ? 'short rest' : ''}</span></span></li>`).join('');
  const inv = stackInv(ch.inventory.filter(i => i.id !== 'keepsake')); const ks = ch.inventory.find(i => i.id === 'keepsake');
  return `${provisional ? `<div class="prov">Live preview. Still to choose: ${esc(provisional.join(', '))} (filled with placeholders).</div>` : ''}
  <div class="card"><div class="sheet-top">${svg && typeof svg === 'object' ? `<span class="av" style="${esc(svg.style)}"></span>` : d ? pEl('av', d, ch, svg) : `<img class="av" src="${P.svgDataUrl(svg)}" alt="">`}<div style="flex:1;min-width:0"><div class="title" style="font-size:19px;margin:0">${esc(s.name)}</div>${fl.pronouns ? `<div class="meta">${esc(fl.pronouns)}</div>` : ''}
   <div class="meta">${esc(s.species)} \u00b7 ${esc(s.className)} ${s.level} (${esc(s.subclass)}) \u00b7 ${esc(s.background)}</div>${ch.player ? `<div class="meta">Player: ${esc(ch.player)}</div>` : ''}<div class="meta" style="margin-top:4px"><b style="color:var(--wine)">XP ${s.xp.cur.toLocaleString()}</b> / ${s.xp.next.toLocaleString()} to level ${s.level + 1}</div></div></div>
   <div class="big3">${[['AC', s.ac.v, s.ac.parts.map(p => p.v).join('+')], ['HP', s.hpMax, `d${s.hitDice.die} \u00d7${s.hitDice.total}`], ['Speed', s.speed.v ?? s.speed, 'ft'], ['Init', sgn(s.initiative.v ?? s.initiative), `prof ${sgn(s.pb)}`]].map(([k, v, x]) => `<div><div class="k">${k}</div><div class="v">${v}</div><div class="s">${esc(x)}</div></div>`).join('')}</div>
   <div class="note" style="background:#2b1c12;color:#f0d58a;border-radius:7px;padding:6px 8px;margin-top:8px">AC ${s.ac.v} = ${s.ac.parts.map(p => `${esc(p.src)} ${p.v}`).join(' + ')} \u00b7 HP ${s.hpMax} = ${s.hpParts.map(p => `${esc(p.src)} ${p.v}`).join(' + ')}</div></div>
  <div class="card"><h2>Abilities & saves</h2><div class="stat6" style="margin-top:9px">${ABILITIES.map(a => `<div class="ab ${s.saves[a].prof ? 'p' : ''}"><div class="k">${a.toUpperCase()}</div><div class="m">${sgn(s.mods[a])}</div><div class="s">${s.scores[a]}</div></div>`).join('')}</div>
   <div class="note">Outlined = save proficiency (${ABILITIES.filter(a => s.saves[a].prof).map(a => `${a.toUpperCase()} ${sgn(s.saves[a].v)}`).join(', ')}). ${esc(ch.method === 'array' ? 'Standard array' : 'Point buy')} + ${esc(s.background)} (${Object.entries(ch.bgBonus).map(([a, v]) => `+${v} ${a.toUpperCase()}`).join(', ')}).</div></div>
  <div class="card"><h2>Skills</h2><div class="two" style="margin-top:4px">${[0, 1].map(h => `<ul class="list">${Object.entries(s.skills).slice(h * 9, h * 9 + 9).map(([k, x]) => `<li style="padding:4px 0;font-size:13px">${x.expertise ? '\u25c6' : x.prof ? '\u25cf' : '\u25cb'} ${esc(skillName(k))}<span class="r">${sgn(x.v)}</span></li>`).join('')}</ul>`).join('')}</div><div class="note">Passive Perception ${s.passivePerception} \u00b7 \u25cf proficient \u00b7 \u25c6 expertise</div></div>
  <div class="card"><h2>Attacks</h2><ul class="list">${atk}</ul>${s.sneakAttack ? `<div class="note">Sneak Attack ${esc(s.sneakAttack)}</div>` : ''}${s.rageDamage ? `<div class="note">Rage damage +${s.rageDamage}</div>` : ''}</div>
  ${sc ? `<div class="card"><h2>Spellcasting</h2><ul class="list"><li>Spell save DC<span class="r">${sc.dc}</span></li><li>Spell attack<span class="r">${sgn(sc.attack)}</span></li>${(sc.slots || []).map((n, i) => `<li>Level ${i + 1} slots<span class="r">${Array.from({ length: n }, () => '<span class="pip f"></span>').join('')}</span></li>`).join('')}${sc.pact ? `<li>Pact slots (L${sc.pact.level})<span class="r">${Array.from({ length: sc.pact.count }, () => '<span class="pip f"></span>').join('')}</span></li>` : ''}</ul>
   ${ch.cantrips.length ? `<div class="note"><b>Cantrips:</b> ${ch.cantrips.map(sp).join(', ')}</div>` : ''}${ch.spellbook.length ? `<div class="note"><b>Spellbook:</b> ${ch.spellbook.map(sp).join(', ')}</div>` : ''}${ch.prepared.length ? `<div class="note"><b>Prepared:</b> ${ch.prepared.map(sp).join(', ')}</div>` : ''}
   ${sc.always?.filter(id => !(sc.species?.spells || []).includes(id)).length ? `<div class="note"><b>Always prepared:</b> ${sc.always.filter(id => !(sc.species?.spells || []).includes(id)).map(sp).join(', ')}</div>` : ''}${sc.magicInitiate ? `<div class="note"><b>Magic Initiate (${esc(F.nice(sc.magicInitiate.list))}, ${sc.magicInitiate.ability.toUpperCase()}, DC ${sc.miDc}):</b> ${sc.magicInitiate.cantrips.map(sp).join(', ')}; ${sp(sc.magicInitiate.spell)} once per long rest</div>` : ''}
   ${sc.species ? `<div class="note"><b>Species magic (${sc.species.ability.toUpperCase()}, DC ${sc.species.dc}):</b> ${[...sc.species.cantrips, ...(sc.species.spells || [])].map(sp).join(', ')}${sc.species.spells?.length ? ' (the spell once per long rest)' : ''}</div>` : ''}${sc.note ? `<div class="note warn">${esc(sc.note)}</div>` : ''}</div>` : ''}
  ${res ? `<div class="card"><h2>Resources</h2><ul class="list">${res}<li>Hit Point Dice (d${s.hitDice.die})<span class="r">${s.hitDice.left} of ${s.hitDice.total}</span></li></ul></div>` : ''}
  <div class="card sheetfeat"><h2>Traits & features</h2><ul class="list">${s.features.map(f => `<li><span>${esc(f.name)}${f.sub ? ' <span class="tag m">subclass</span>' : ''}</span><span class="r"><span class="tag ${f.support === 'engine' ? 'g' : ''}">${f.support === 'engine' ? 'automated' : 'GM'}</span></span></li>`).join('')}
   ${s.feats.map(f => `<li><span>Feat: ${esc(F.nice(f))}</span></li>`).join('')}${ch.choices.fightingStyle ? `<li>Fighting Style: ${esc(F.nice(ch.choices.fightingStyle))}</li>` : ''}${ch.choices.masteries.length ? `<li>Weapon Mastery<span class="r">${ch.choices.masteries.map(F.nice).join(' \u00b7 ')}</span></li>` : ''}
   ${ch.choices.invocations.length ? `<li>Invocations<span class="r" style="white-space:normal;text-align:right">${ch.choices.invocations.map(F.nice).join(', ')}</span></li>` : ''}${ch.choices.metamagic.length ? `<li>Metamagic<span class="r">${ch.choices.metamagic.map(F.nice).join(', ')}</span></li>` : ''}
   ${s.resist.length ? `<li>Resistances<span class="r">${s.resist.map(F.nice).join(', ')}</span></li>` : ''}</ul></div>
  <div class="card"><h2>Gear<span class="count">${gp(s.coin)} \u00b7 ${s.carry.carried}/${s.carry.cap} lb</span></h2><ul class="list">${inv.map(i => `<li style="padding:4px 0;font-size:13.5px">${esc(itemDef(i).name)}${(i.qty || 1) > 1 ? ` \u00d7${i.qty}` : ''}${i.slot ? ' <span class="tag k">equipped</span>' : ''}</li>`).join('')}</ul>
   ${ks ? `<div class="note"><b>Keepsake:</b> ${esc(ks.name)} <span class="tiny">(no stats)</span></div>` : ''}</div>
  <div class="note" style="color:#b89b62;margin:2px 6px 10px">Everyone at the table can see this sheet. It is computed by the engine; nobody types a number in, not even the GM.</div>`;
}

// ---------- dock (live preview + navigation) ----------
function dock() {
  if (S.view !== 'forge') return `<div class="row"><button class="btn gold" data-a="newhero">Forge a new hero</button></div>`;
  const k = stepKey(); const errs = stepErrors(); const pv = engine().pv; let bar = '';
  if (pv?.sheet) { const s = pv.sheet; const best = s.spellcasting?.dc ? `DC ${s.spellcasting.dc}` : sgn(Math.max(...s.attacks.map(a => a.toHit)));
    bar = `<button class="pv" data-a="drawer">${pEl('av', S.draft, pv.ch)}<div class="nums">${[['AC', s.ac.v], ['HP', s.hpMax], ['Init', sgn(s.initiative.v ?? s.initiative)], ['Spd', s.speed.v ?? s.speed], [s.spellcasting?.dc ? 'Spell' : 'Atk', best]].map(([a, b]) => `<div><div class="k">${a}</div><div class="v">${b}</div></div>`).join('')}</div><span class="open">SHEET \u25b8</span></button>`; }
  const last = S.step === STEPS.length - 1;
  return `${bar}${errs.length && k !== 'forge' ? `<div class="needs" style="margin:0 2px 6px"><b>Still needed:</b> ${esc(errs.slice(0, 2).join(' \u00b7 '))}${errs.length > 2 ? ` (+${errs.length - 2})` : ''}</div>` : ''}
  <div class="row">${S.step > 0 ? '<button class="btn ghost" data-a="back" style="flex:0 0 96px;color:var(--gold2);border-color:#8e6a1e">Back</button>' : ''}<button class="btn ${last ? 'gold' : ''}" data-a="${last ? 'save' : 'next'}" ${errs.length ? 'disabled' : ''}>${last ? 'Forge this hero' : S.step === 0 ? 'Enter the Forge' : 'Next'}</button></div>`;
}
function header() {
  const reach = maxReach(); const n = S.heroes.length;
  return `<header class="top"><div class="brand"><div class="logo">Balls or Gapes V<small>Reforged \u00b7 Session 0</small></div><button class="toplink" data-a="${S.view === 'forge' ? 'roster' : 'forge'}">${S.view === 'forge' ? `Party (${n})` : 'Forge \u25b8'}</button></div>
  ${S.view === 'forge' ? `<div class="prog">${STEPS.map((k, i) => `<button class="${i === S.step ? 'on' : i < S.step ? 'done' : i <= reach ? 'can' : ''}" data-a="goto" data-v="${i}" ${i <= reach ? '' : 'disabled'} aria-label="step ${i + 1} ${k}"></button>`).join('')}</div>` : ''}</header>`;
}
const FOOT = `<div class="foot">This work includes material from the System Reference Document 5.2.1 (\u201cSRD 5.2.1\u201d) by Wizards of the Coast LLC, available at https://www.dndbeyond.com/srd, licensed under the Creative Commons Attribution 4.0 International License (https://creativecommons.org/licenses/by/4.0/legalcode). Aasimar is a BoG V house rule, not SRD content. Private game; fiction and satire.</div>`;
function roster() {
  if (S.hero) { const h = S.hero; return `${S.justForged === h.id ? `<div class="card wake"><p class="prose" style="color:#f3e6c8">${esc(T.WAKE)}</p></div>` : ''}<div class="card" style="padding:10px">${pEl('portrait', h.draft, h.ch, h.portraitSvg)}</div>${renderSheet(F.evaluate(h.draft).sheet || {}, h.ch, h.draft, h.portraitSvg)}
    <div class="row" style="margin:6px 0 4px"><button class="btn ghost" data-a="roster" style="color:var(--gold2);border-color:#8e6a1e">All heroes</button>${S.locked ? '' : `<button class="btn ghost" data-a="edit" data-v="${h.id}" style="color:var(--gold2);border-color:#8e6a1e">Reforge</button>`}</div>${S.locked ? '<div class="note" style="color:#b89b62">Sheets are locked: the first adventure has started.</div>' : ''}`; }
  const gaps = F.partyGaps(S.heroes.map(h => ({ name: h.ch.name, roles: h.roles || [] })));
  return `<div class="stephead"><div class="eyebrow">Teslandia \u00b7 the party</div><div class="title">Heroes of the Forge</div></div>
   ${S.heroes.length ? S.heroes.map(h => `<button class="card rosterhero" data-a="hero" data-v="${h.id}">${pEl('av', h.draft, h.ch, h.portraitSvg)}<div style="flex:1;min-width:0"><div class="nm" style="font:700 16px Cinzel,serif">${esc(h.ch.name)}</div><div class="meta">${esc(h.summary)}</div><div class="d" style="margin-top:4px;display:flex;gap:4px;flex-wrap:wrap">${(h.roles || []).map(r => `<span class="tag">${esc(F.ROLES[r])}</span>`).join('')}</div></div></button>`).join('')
     : '<div class="card"><div class="note">Nobody has come through the Forge yet.</div></div>'}
   ${S.heroes.length ? `<div class="card"><h2>Party gaps</h2><div class="gaps">${gaps.map(g => `<div class="gap ${g.who.length ? '' : 'miss'}"><div class="k">${esc(g.label)}</div><div class="w">${g.who.length ? esc(g.who.join(', ')) : 'nobody yet'}</div></div>`).join('')}</div></div>` : ''}`;
}
function render() {
  const app = $('#app'); const keepY = window.scrollY;
  app.innerHTML = header() + `<main>${S.view === 'forge' ? V[stepKey()]() : roster()}</main>` + FOOT + `<div class="dock">${dock()}</div>` + (S.drawer ? drawer() : '');
  window.scrollTo(0, S._top ? 0 : keepY); S._top = false;
  document.body.dataset.step = S.view === 'forge' ? stepKey() : S.view;
}
function drawer() { const pv = engine().pv; if (!pv?.sheet) return ''; return `<div class="drawer" data-a="closebg"><div class="in"><div class="bar"><span class="t">Live sheet</span><button class="btn sm ghost" data-a="closedrawer" style="width:auto;color:var(--gold2);border-color:#8e6a1e">Close</button></div>${renderSheet(pv.sheet, pv.ch, S.draft, P.portraitFor(S.draft, pv.ch), pv.pending.length ? pv.pending : null)}</div></div>`; }
function refreshDock() { const el = document.querySelector('.dock'); if (el) el.innerHTML = dock(); const h = document.querySelector('header.top'); if (h) h.outerHTML = header(); }

// ---------- actions ----------
async function save() {
  const ev = F.evaluate(S.draft); if (!ev.ok) return;
  const svg = P.portraitFor(S.draft, ev.ch); const png = await P.svgToPng(svg, 160);
  const hero = { id: S.draft.id, owner: OWNER, draft: S.draft, spec: F.toSpec(S.draft), ch: ev.ch, portraitSvg: svg, avatarPng: png, roles: F.rolesOf(ev.sheet, ev.ch),
    summary: `${ev.sheet.species} \u00b7 ${ev.sheet.className} 3 (${ev.sheet.subclass}) \u00b7 ${ev.sheet.background}`, savedAt: Date.now() };
  try { await store.putHero(hero); } catch (e) { if (e instanceof LockedError || e.status === 401) { S.locked = true; alert('Sheets are locked: the first adventure has started.'); render(); return; } throw e; }
  await store.putDraft(OWNER, null); S.heroes = await store.listHeroes();
  S.view = 'roster'; S.hero = hero; S.justForged = hero.id; S.draft = F.newDraft(); S.step = 0; S._top = true; render();
}
document.addEventListener('click', e => {
  const b = e.target.closest('[data-a]'); if (!b || b.disabled) return; const a = b.dataset.a, k = b.dataset.k, v = b.dataset.v; let d = S.draft;
  if (a === 'closebg' && e.target !== b) return;
  switch (a) {
    case 'next': if (!stepErrors().length && S.step < STEPS.length - 1) { S.step++; S._top = true; } break;
    case 'back': if (S.step > 0) { S.step--; S._top = true; } break;
    case 'goto': if (+v <= maxReach()) { S.step = +v; S._top = true; } break;
    case 'field': setDraft(F.setField(d, k, d[k] === v && k === 'pronouns' ? '' : v)); break;
    case 'pick': setDraft(F.pick(d, k, v)); break;
    case 'sprules': S.rules = { ...(S.rules || {}), [k + ':' + v]: !S.rules?.[k + ':' + v] }; break;  // note 4: full SRD text under the group
    case 'plus2': d = structuredClone(d); d.plus2 = v; if (d.plus1 === v) d.plus1 = null; setDraft(d); break;
    case 'plus1': d = structuredClone(d); d.plus1 = v; setDraft(d); break;
    case 'arr': setDraft(F.assignArray(d, k, d.scores[k] === +v ? null : +v)); break;
    case 'pb': setDraft(F.bump(d, k, +v)); break;
    case 'suggest': { let x = F.suggestScores(d); if (d.method === 'pointbuy') x = { ...x, method: 'pointbuy' }; setDraft(x); break; }  // 15/14/13/12/10/8 also costs exactly 27 points
    case 'gear': d = structuredClone(d); d.gear[k] = v; d.gear.bought = []; setDraft(d); break;
    case 'buy': { d = structuredClone(d); const it = d.gear.bought.find(x => x.id === k); const left = F.purseAfterGear(d);
      if (+v > 0) { if (itemDef({ id: k }).cost > left) return; if (it) it.qty++; else d.gear.bought.push({ id: k, qty: 1 }); } else if (it) { it.qty--; if (!it.qty) d.gear.bought = d.gear.bought.filter(x => x !== it); }
      setDraft(d); break; }
    case 'keep': d = structuredClone(d); d.keepsake = T.KEEPSAKE_IDEAS[+v]; setDraft(d); break;
    case 'look': d = structuredClone(d); d.look = { ...d.look, [k]: v }; setDraft(d); break;
    case 'drawer': S.drawer = true; break;
    case 'closedrawer': case 'closebg': S.drawer = null; break;
    case 'save': save(); return;
    case 'roster': S.view = 'roster'; S.hero = null; S._top = true; break;
    case 'forge': S.view = 'forge'; S._top = true; break;
    case 'hero': S.hero = S.heroes.find(h => h.id === v); S.justForged = null; S._top = true; break;
    case 'newhero': S.view = 'forge'; S.hero = null; S.draft = F.newDraft(); S.step = 0; S._top = true; break;
    case 'edit': { if (S.locked) return; const h = S.heroes.find(x => x.id === v); S.view = 'forge'; S.hero = null; S.draft = structuredClone(h.draft); S.step = 1; S._top = true; break; }
    default: return;
  }
  render();
});
document.addEventListener('toggle', e => { const sec = e.target.dataset?.sec; if (sec) (S.open = S.open || {})[sec] = e.target.open; }, true);
document.addEventListener('input', e => { const f = e.target.dataset?.f; if (!f) return; const d = structuredClone(S.draft); d[f] = e.target.value; setDraft(d); refreshDock(); });
// P3-4: Google sign-in (emulator only in this pass). Signed out → this card; signed in but not linked → ask the GM.
function signInCard(msg = '', uid = null) {
  document.getElementById('app').innerHTML = `<div class="signin"><div class="card dark" style="margin:28px 14px 12px">
    <div style="font:700 26px/1.1 Cinzel,serif;color:#f0d58a">Balls or Gapes V</div><div class="meta" style="color:#cdb27a;margin-top:4px">Reforged \u00b7 a private table for four</div></div>
   <div class="card" style="margin:0 14px">${uid ? `<h2>Almost in</h2><p class="meta" style="margin:6px 0 10px">You\u2019re signed in as <b>${esc(AUTH.user.email)}</b>, but this Google account isn\u2019t linked to a seat yet. Send the GM this code:</p><div class="code">${esc(uid)}</div>
     <button class="btn ghost" data-a="signout" style="margin-top:12px">Use a different account</button>`
   : `<h2>Sign in</h2><p class="meta" style="margin:6px 0 12px">Use the Google account the GM invited. Your seat, hero and orders follow the account, not the phone.</p>
     ${EMU ? `<div class="note" style="margin:0 0 8px"><b>Test mode (Firebase emulator).</b> No real Google account is used: type any email to stand in for one.</div><input id="emuEmail" type="email" placeholder="you@example.com" style="margin-bottom:10px" autocomplete="off">` : ''}
     <button class="btn gbtn" data-a="google"><span class="g">G</span> Sign in with Google</button>
     ${msg ? `<div class="err" style="margin-top:10px">${esc(msg)}</div>` : ''}`}</div></div>`;
  document.querySelector('[data-a="google"]')?.addEventListener('click', async () => { try { await AUTH.signInWithGoogle({ email: document.getElementById('emuEmail')?.value.trim() }); location.reload(); } catch (e) { signInCard(e.message); } });
  document.querySelector('[data-a="signout"]')?.addEventListener('click', () => { AUTH.signOut(); location.reload(); });
}
async function signedInStore() {
  AUTH = new GoogleAuth({ emulator: EMULATOR }); if (!AUTH.signedIn) { signInCard(); return false; }
  const pid = await AUTH.seat(new RtdbRest({ base: EMULATOR.rtdb, ns: EMULATOR.ns, auth: AUTH.restAuth() })); if (!pid) { signInCard('', AUTH.user.uid); return false; }
  OWNER = pid; store = createStore(location.search, { owner: OWNER, now, restAuth: AUTH.restAuth(), emulatorBase: EMULATOR.rtdb }); return true;
}
(async function boot() {
  if (EMU && !(await signedInStore())) return;
  // Reforge rule (locked Nov 10, 9:21 PM PT): free rebuilds until the first adventure starts, then sheets lock
  const camp = await store.campaign().catch(() => ({})); S.locked = !!camp.adventureStarted;
  if (S.locked || QS.get('view')) { if (camp.adventureStarted) { const T = await import('./table.js'); return T.boot({ store, renderSheet, OWNER, now }); } }
  await PA.ready(); S.heroes = await store.listHeroes(); PA.verify(S.heroes.map(h => { try { return PA.paintingFor(PA.lookOf(h.draft, h.ch)); } catch { return null; } }), () => render()); const saved = await store.getDraft(OWNER);
  if (saved && saved.id) { S.draft = { ...F.newDraft(saved.id), ...saved }; S.step = Math.min(maxReach(), STEPS.length - 1); }
  window.__bog5 = { S, F, render, store };  // test hook
  render();
})();
