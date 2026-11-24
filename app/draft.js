// Safe defaults for a player's nightly draft (move / free text / I say).
// Saved actions can omit say, text, or sayMode (e.g. a cart-only extras save, or a shallow copy of T.mine).
export const DRAFT_DEFAULTS = { kind: null, moveId: null, text: '', say: '', sayMode: 'say' };
// Short cap shared by the skill-night "something else" box and the battle-orders write-in.
export const FREE_TEXT_MAX = 280;
export function capFreeText(s) { return String(s ?? '').slice(0, FREE_TEXT_MAX); }

export function normalizeDraft(d) {
  const x = { ...DRAFT_DEFAULTS, ...(d || {}) };
  if (x.kind === undefined) x.kind = null;
  if (x.moveId === undefined) x.moveId = null;
  x.text = capFreeText(x.text == null ? '' : String(x.text));
  x.say = x.say == null ? '' : String(x.say);
  x.sayMode = x.sayMode || 'say';
  return x;
}

// Fields written by saveDraft (caller may add extras: cart, loot, rest, …). Does not throw if say/text are missing.
export function draftAction(d, locked) {
  d = normalizeDraft(d);
  return { kind: d.kind, moveId: d.kind === 'move' ? d.moveId : null, text: (d.kind === 'free' || d.kind === 'orders') ? (d.text || '').trim() : '', say: (d.say || '').trim(), sayMode: d.sayMode, locked };
}
