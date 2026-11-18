# SRD 5.2.1 attribution

This work includes material from the System Reference Document 5.2.1 ("SRD 5.2.1") by Wizards of the Coast LLC, available at https://www.dndbeyond.com/srd. The SRD 5.2.1 is licensed under the Creative Commons Attribution 4.0 International License, available at https://creativecommons.org/licenses/by/4.0/legalcode.

## Provenance of the files in this folder
- `source/*.md` — SRD 5.2.1 converted to Markdown, copied unchanged from the GitHub repository **azemoning/omni-5e** (`data/raw/5.2.1/`). That repository's code is MIT; the SRD text is CC-BY-4.0 as above.
- `data/*.json` and `data/srd.js` — generated from `source/` by `tools/build_srd_data.mjs` and `tools/emit_srd_module.mjs` (`npm run build:data`). Tables are parsed mechanically; spell damage/save/heal dice are extracted automatically and corrected by hand in `src/rules/spellEffects.js` where needed.
- `data/spelltext.js` — the full rules text of every SRD spell (paragraphs kept), generated from `source/spells.md` by `tools/build_spell_text.mjs` (also part of `npm run build:data`). Its one-line summaries come from `spell-summaries.js`: plain-English restatements of the SRD text written for BoG V (every cantrip and level 1-3 spell); spells without one use the SRD's own first sentence. The app shows the full text one tap below each summary.
- Nothing outside SRD 5.2.1 is included. Campaign flavor (Waukeen, "Aasimar" as a cosmetic label, the Longsword of Massive Girth name) lives in `samples/` and `src/rules/items.js` RESKINS and never changes SRD mechanics.
