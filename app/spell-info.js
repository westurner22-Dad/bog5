// BoG V · Phase 5 note 4: what a spell does, wherever spells are picked or listed (Spells tab, Forge, level-up).
// A one-line plain summary under the name, and a tap for the full SRD 5.2.1 rules text (engine/srd/data/spelltext.js,
// CC-BY-4.0; the SRD attribution line already sits at the foot of every screen). Uses only existing Tavern Ledger styles.
import TEXT from '../engine/srd/data/spelltext.js';
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// SRD markdown: _italic_ and **bold**
const md = s => esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/(^|[\s(\u2014])_(.+?)_(?=[\s.,;:)\u2014]|$)/g, '$1<i>$2</i>');
export const summary = id => TEXT[id]?.summary || '';
export const has = id => !!TEXT[id];
// the one-liner, as a small line under a spell name
export const summaryLine = id => TEXT[id] ? `<div class="tiny" style="margin-top:2px">${esc(TEXT[id].summary)}</div>` : '';
// the toggle: attr is the click wiring of the host screen (data-t="toggle" data-v="sp:id" on the table, data-a=... in the Forge)
export const rulesLink = (attr, open) => `<button class="reportlink" ${attr} style="display:inline-block;margin:3px 0 0;font-size:11.5px;color:var(--wine)">${open ? 'Hide rules \u25b4' : 'Full rules \u25be'}</button>`;
// the full SRD text block
export function rulesBlock(id) { const s = TEXT[id]; if (!s) return '';
  const row = (k, v) => `<b>${k}:</b> ${esc(v)}`;
  return `<div class="note" style="margin-top:6px;border-top:1px dashed var(--line);padding-top:6px"><div><i>${esc(s.header)}</i></div>
   <div>${[row('Casting Time', s.castingTime), row('Range', s.range), row('Components', s.components), row('Duration', s.duration)].join('<br>')}</div>
   ${s.body.map(p => `<div style="margin-top:5px">${md(p)}</div>`).join('')}${s.higher ? `<div style="margin-top:5px">${md(s.higher)}</div>` : ''}
   <div class="tiny" style="margin-top:5px;opacity:.8">SRD 5.2.1 \u00b7 CC-BY-4.0</div></div>`; }
