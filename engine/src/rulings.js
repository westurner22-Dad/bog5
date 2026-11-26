// BoG V \u00b7 Apply a short GM rulings file to a plan: skill + difficulty (+ optional XP, flags, loot).
// The GM still writes the narration. No save-structure change: this only edits the local plan JSON.
import { setDcCall } from './night.js';

export const DEFAULT_SUCCESS_XP = 25;

export function readRulings(raw) {
  const r = typeof raw === 'string' ? JSON.parse(raw) : { ...raw };
  if (r.night != null && !Number.isFinite(+r.night)) throw new Error('rulings.night must be a number');
  if (!Array.isArray(r.calls)) throw new Error('rulings.calls must be an array');
  for (const c of r.calls) {
    if (!c.pid) throw new Error('each call needs a pid');
    if (!c.word) throw new Error(`${c.pid}: each call needs a difficulty word (Easy, Medium, or Hard)`);
    if (!c.skill) throw new Error(`${c.pid}: each call needs a skill`);
    if (!c.why || String(c.why).trim().length < 4) throw new Error(`${c.pid}: each call needs a short reason`);
  }
  return r;
}

function pushXp(effects, cid, xp, why) {
  const list = Array.isArray(effects) ? effects.slice() : [];
  if (xp && !list.some(x => x.xp && (x.who === 'self' || x.cid === cid || x.cid === 'self'))) list.push({ xp, who: 'self', why: why || 'write-in' });
  return list;
}

export function applyRulings(plan, rulings, { defaultXp = DEFAULT_SUCCESS_XP } = {}) {
  const r = readRulings(rulings);
  if (r.night != null && plan.night != null && +r.night !== +plan.night) throw new Error(`rulings night ${r.night} does not match plan night ${plan.night}`);
  const next = { ...plan, entries: plan.entries.map(e => ({ ...e })) };
  for (const call of r.calls) {
    const e = next.entries.find(x => x.pid === call.pid);
    if (!e) throw new Error(`no plan entry for ${call.pid}`);
    if (e.kind === 'absent') throw new Error(`${call.pid} is absent: no write-in to rule`);
    if (call.skill || call.word) {
      if (!e.check && e.kind !== 'free' && !(e.kind === 'orders' && e.text)) {
        e.check = { skill: call.skill };
      }
      setDcCall(e, call.word, call.why, call.skill);
    }
    if (call.assist) e.assist = call.assist;
    if (call.success) e.success = call.success;
    if (call.failure) e.failure = call.failure;
    const xp = call.xp == null ? defaultXp : call.xp;
    if (e.kind === 'free' || (e.kind === 'orders' && e.check)) {
      const success = { text: e.success?.text || 'It works out, more or less the way it was meant to, and that is a nice feeling.', effects: pushXp(e.success?.effects, e.cid, xp, call.why) };
      if (call.flag) success.effects = [...success.effects, { cid: 'story', flag: call.flag, text: call.flagText || call.flag }];
      e.success = success;
      if (!e.failure) e.failure = { text: 'It doesn\u2019t come off this time, though it was a fine idea and everyone says so.', effects: [] };
    }
  }
  if (Array.isArray(r.awards) && r.awards.length) next.awards = [...(next.awards || []), ...r.awards];
  if (r.lootMode) next.lootMode = r.lootMode;
  if (r.clockHours != null) next.clockHours = r.clockHours;
  return next;
}
