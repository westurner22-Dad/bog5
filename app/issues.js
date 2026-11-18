// BoG V · Phase 4 · the issue log. Anyone at the table files an issue (bug / rules / UI / story) from any screen;
// the GM triages each into 2–3 options with one recommendation; only Wes (the host seat) picks; nothing is built
// until he has. Stored at bog5/issues/{id}. Rules (firebase/bog5.rules.json) enforce: file as yourself, status
// "filed", no options or decision; the decision is written by the host seat once, while options are up; triage,
// build and release are GM-tool (service account) writes.
export const CATS = { bug: 'Bug', rules: 'Rules', ui: 'UI', story: 'Story' };
export const FLOW = ['filed', 'options', 'decided', 'built', 'released']; // plus 'rejected' and 'ruled' (rules answers)
export const STATUS_TXT = { filed: 'Filed', options: 'Needs Wes', decided: 'Wes picked', built: 'Built', released: 'Released', rejected: 'Rejected', ruled: 'Ruled' };
export const PICKS = ['A', 'B', 'C', 'other', 'reject'];
export const bucket = i => ['options'].includes(i.status) ? 'needs' : ['released', 'rejected', 'ruled'].includes(i.status) ? 'done' : 'open';
export function newIssue({ by, cat, text, ctx = null, now = Date.now(), rand = Math.random }) {
  const t = String(text || '').trim(); if (!CATS[cat]) throw new Error('pick a category'); if (t.length < 3) throw new Error('say what happened (a few words is fine)'); if (t.length > 2000) throw new Error('keep it under 2,000 characters');
  const id = 'i' + now.toString(36) + Math.floor(rand() * 1296).toString(36).padStart(2, '0');
  const out = { id, by, cat, text: t, status: 'filed', at: now }; if (ctx) { const s = JSON.stringify(ctx); out.ctx = s.length < 20000 ? s : s.slice(0, 19990); } return out;
}
// GM triage: 2–3 options, exactly one recommended, each with a one-line reason
export function checkOptions(opts) {
  const errs = []; if (!Array.isArray(opts) || opts.length < 2 || opts.length > 3) errs.push('2 or 3 options');
  else { if (opts.filter(o => o.rec).length !== 1) errs.push('exactly one recommended option');
    opts.forEach((o, i) => { if (o.key !== 'ABC'[i]) errs.push(`option ${i + 1} must be key ${'ABC'[i]}`); if (!o.text || o.text.length < 4) errs.push(`option ${o.key}: say what it does`); if (!o.why || o.why.length < 4) errs.push(`option ${o.key}: one-line reason`); }); }
  return errs;
}
// starting points per category; the GM edits them for the real issue (gm triage <id> --file opts.json)
export function templateOptions(issue) {
  const T = {
    bug: [{ key: 'A', text: 'Fix it as reported and add a regression test', why: 'Cheapest correct fix; the test keeps it fixed.', rec: true },
      { key: 'B', text: 'Fix it, then replay and correct any past night it touched', why: 'Only worth it if a published result was wrong.' },
      { key: 'C', text: 'Leave it, and note it as a known quirk', why: 'Only if it never changes an outcome.' }],
    rules: [{ key: 'A', text: 'Follow SRD 5.2.1 exactly and fix the engine to match', why: 'SRD is the locked source (no homebrew beyond the Aasimar rule).', rec: true },
      { key: 'B', text: 'Keep the current behavior and document it as a table ruling', why: 'Only if the SRD is silent or ambiguous.' }],
    ui: [{ key: 'A', text: 'Small fix: copy, spacing or tap size on this screen only', why: 'Fast, no risk to other screens.', rec: true },
      { key: 'B', text: 'Rework the component everywhere it appears', why: 'Better if the same problem shows up on other tabs.' },
      { key: 'C', text: 'Leave it for the art and polish pass', why: 'If it is cosmetic and the pass is close.' }],
    story: [{ key: 'A', text: 'Fix the text in place (typo, name, continuity)', why: 'Keeps canon straight without changing outcomes.', rec: true },
      { key: 'B', text: 'Address it in the next night\u2019s narration instead', why: 'Better when a fix would rewrite a published night.' }],
  };
  return structuredClone(T[issue.cat] || T.bug);
}
// players' view of a stored issue (options are stored as a JSON string so one RTDB write can't half-apply)
export function readIssue(v) {
  if (!v) return null; const i = { ...v }; if (typeof i.options === 'string') try { i.options = JSON.parse(i.options); } catch { i.options = []; }
  if (typeof i.ctx === 'string') try { i.ctx = JSON.parse(i.ctx); } catch { /* keep raw */ } if (typeof i.ruling === 'string') try { i.ruling = JSON.parse(i.ruling); } catch {}
  if (i.status === 'options' && i.decision) i.status = i.decision.pick === 'reject' ? 'rejected' : 'decided'; // Wes picked; the GM tool records it on its next pass
  return i;
}
export const canDecide = (issue, pid, campaign) => issue.status === 'options' && !issue.decision && pid === campaign?.host;
export const canBuild = issue => issue.status === 'decided' && issue.decision && issue.decision.pick !== 'reject';
