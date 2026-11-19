// Safe defaults for a player's nightly draft (move / free text / I say).
// Saved actions can omit say, text, or sayMode (e.g. a cart-only extras save, or a shallow copy of T.mine).
export const DRAFT_DEFAULTS = { kind: null, moveId: null, text: '', say: '', sayMode: 'say' };

export function normalizeDraft(d) {
  const x = { ...DRAFT_DEFAULTS, ...(d || {}) };
  if (x.kind === undefined) x.kind = null;
  if (x.moveId === undefined) x.moveId = null;
  x.text = x.text == null ? '' : String(x.text);
  x.say = x.say == null ? '' : String(x.say);
  x.sayMode = x.sayMode || 'say';
  return x;
}

// Fields written by saveDraft (caller may add extras: cart, loot, rest, …). Does not throw if say/text are missing.
export function draftAction(d, locked) {
  d = normalizeDraft(d);
  return { kind: d.kind, moveId: d.kind === 'move' ? d.moveId : null, text: d.kind === 'free' ? (d.text || '').trim() : '', say: (d.say || '').trim(), sayMode: d.sayMode, locked };
}
