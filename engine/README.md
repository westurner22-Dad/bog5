# BoG V rules engine (Phase 1, headless)

A standalone JavaScript (ES module, no dependencies) rules engine for **Balls or Gapes V**: D&D 2024 rules using **SRD 5.2.1 content only**. It has no UI. Every change is an event in an append-only log, and the character sheets are rebuilt from that log.

```
npm test               # node:test unit tests
npm run sim            # Monte-Carlo checks → sim/REPORT.md (scale: node sim/run_sims.js 1)
npm run build:data     # re-parse srd/source/*.md → srd/data/*.json + srd/data/srd.js
node tools/export_samples.mjs   # samples/SHEETS.md + samples/sheets/*.json
```

## Layout
| Path | What |
|---|---|
| `src/game.js` | `Game`: state, the transaction/event log, `rebuild(log)`, nightly seed commit/reveal |
| `src/dice.js`, `src/sha256.js` | xoshiro128** seeded from SHA-256; `commit(seed)` before the night opens, `verifyCommit` after the seed is revealed; dice state serializes to JSON |
| `src/character.js` | `createCharacter(spec)` validates the build; `deriveSheet(ch)` gives every number with an itemized `parts` list |
| `src/combat.js` | initiative, movement (5-ft grid), attacks, damage, spells, concentration, death saves, battle orders, stances, stop triggers, pause/resume |
| `src/actions.js` | shop, equip, attune, potions, scrolls, spellbook copying, preparing spells, rests, supplies, travel/torches, XP/level-up, ability checks with difficulty words, death/resurrection/Kenny |
| `src/rules/*` | classes (parsed SRD tables + feature support map), species/backgrounds/feats, items/magic items, spell effect models, conditions |
| `src/monsters.js` | SRD monsters and animals → combatants |
| `src/builder.js` | `quickBuild(cls, level)`: a legal default build for any class and level (tests, sims, party-gap hint) |
| `samples/` | four **example** level-3 heroes used as test fixtures and in the mockups (not player characters; every player builds new), `MAPPING.md`, `SHEETS.md` |
| `HOUSE_RULES.md` | the only non-SRD rules: the Aasimar species (approved Nov 10) |
| `srd/` | SRD source, generated data, `ATTRIBUTION.md` |

## Core API (short)
```js
import { Game, actions as A, startEncounter, resolveBattle, pauseAtCutoff, rebuild } from './src/index.js';
const g = new Game();                 // or new Game({ state, log }) to load
g.openNight(12, secretSeed);          // publishes sha256 commit in the log
A.addCharacter(g, spec);              // validated SRD 5.2.1 build
startEncounter(g, { name, map: { w, h, terrain: { '4,5': 'difficult', '6,6': 'wall' } }, party: [{ cid, pos }], foes: [{ monster: 'ogre', pos, boss: true }], script: [{ round: 3, add: [...] }] });
resolveBattle(g, orders);             // 1 round (or the rest of a mid-round resume), stops early on a trigger → status 'awaiting_orders'
pauseAtCutoff(g);                     // 9 PM PT: status 'paused'; the whole battle is in g.state
g.revealNight(12, secretSeed);        // anyone can re-verify every roll
rebuild(g.log, g.initial)             // deep-equals g.state
```
**Orders** per hero: `{ thisRound: { move: [x,y] | 'hold', bonus: {...}, action: {...} }, standing: [{ if: { ally_down: true } | { self_below: 0.3 } | 'always', then: {...} }], smite: { when: 'crit'|'always'|'boss'|'never' }, reactions: { opportunity, shield, uncanny_dodge, deflect }, sacredWeapon, stunningStrike, actionSurge, reckless, stance, absent }`.
- Actions: `attack` (target `nearest|weakest|strongest|boss|<uid>`, `ranged`, `melee`, `weapon`), `cast` (spell, level, target(s)), `dodge`, `dash`, `disengage`, `help`, `stabilize`, `potion`, `lay_on_hands`, `preserve_life`.
- Bonus actions: `cast` (bonus-action spells), `potion`, `rage`, `second_wind`, `cunning`, `steady_aim`, `bardic_inspiration`, `innate_sorcery`, `flurry`, `patient_defense`.
- Heroes without orders use their stance: Cautious (the default), Support or Aggressive. A stance never spends a resource.

**Stop triggers:** `ally_down`, `new_enemy`, `order_impossible`. **Notices (logged to `encounter.notices`, the batch keeps going; locked Nov 10):** `boss_phase` (boss bloodied), `concentration_broken`. Pass `{ notices: [] }` to `resolveBattle` for the old behavior. The battle also stops after 1 round (`round_limit`; a mid-round resume finishes that round and stops at the round boundary), on `victory` or on `defeat`. A stop happens at the end of the turn that caused it.

## Rules coverage
- **Character math:** standard array or point buy (validated); background +2/+1 or +1/+1/+1; Origin feats; skills, expertise and Jack of All Trades; saves; AC from every source, itemized (armor and its DEX cap, shield, +X armor/shield, Defense, rings/cloaks when attuned, Unarmored Defense, Draconic Resilience, Mage Armor, Shield of Faith, the Shield spell); carrying capacity (over capacity → speed 5); heavy-armor STR requirement; Exhaustion.
- **Classes:** all 12 SRD classes at levels 1–20 (tables parsed from the SRD), with the SRD subclass for each. Levels 1–8 features: 101 automated, 30 tracked (uses on the sheet, effect applied by a GM ruling), 13 narrative only. See `FEATURE_SUPPORT` in `src/rules/classes.js`.
- **Origins:** all 9 SRD species with lineage/legacy spells and resistances; the 4 SRD backgrounds.
- **Spells:** all 339 SRD spells load with level, class list and concentration. 110 have automated effects (41 hand-written, 69 auto-extracted). The other 229 spend the slot, track concentration and log "GM adjudicates". Upcasting and cantrip scaling are handled. The 2024 rule of one spell slot per turn is enforced. Spellbook copying and Spell Scrolls follow the SRD.
- **Items:** 38 weapons with properties and Weapon Mastery (Graze, Push, Sap, Slow, Topple and Vex automated; Cleave and Nick GM); 13 armors; gear; +X weapons/armor/shields with 2024 rarity values; attunement max 3; potions of healing (all four), Potion of Resistance, Holy Water, Alchemist's Fire (listed); Spell Scroll values and DCs; ammunition spent, with half recovered after a fight.
- **Supplies:** rations (1 per day), water (1 gallon = 8 pints per day; a waterskin holds 4 pints), malnutrition (DC 10 CON save; automatic Exhaustion from day 5), dehydration (under half a day's water → +1 Exhaustion, which stays until a full day's water), torches (1 hour each). Encumbrance applies only when over capacity.
- **Combat:** initiative, advantage/disadvantage from conditions and effects, crits (Champion 19–20, automatic crits vs paralyzed/unconscious within 5 ft), resistance/vulnerability/immunity, temporary HP, concentration (DC max(10, ½ damage), capped at 30), death saves (nat 1 = 2 failures, nat 20 = 1 HP, damage at 0 HP = 1 failure or 2 on a crit, massive damage), opportunity attacks, Multiattack, reach/range, cover not modeled.

## Known gaps (Phase 1)
- **Monster special actions are not automated:** breath weapons, spellcasting, legendary/lair actions, and on-hit conditions (for example, a ghoul's paralysis). The engine runs weapon attacks, Multiattack and extra on-hit damage, and flags the rest for the GM.
- 229 spells are GM-adjudicated (see the coverage above). Area spells pick enemies within 5 ft of the target; there is no friendly fire, templates or cover.
- Features beyond level 8 are mostly "tracked". Metamagic, Wild Shape, Cunning Strike and Invocations other than Agonizing Blast are tracked only.
- The Circle of the Land spell list uses one land type (arid). Ring of Resistance uses one resistance choice per character.
- Aasimar is a house rule (`HOUSE_RULES.md`). No Half-Elf or Half-Orc species, no Artificer, and one subclass per class (SRD limits).

## Attribution
See `srd/ATTRIBUTION.md`. This work includes material from the System Reference Document 5.2.1 ("SRD 5.2.1") by Wizards of the Coast LLC, available at https://www.dndbeyond.com/srd. The SRD 5.2.1 is licensed under the Creative Commons Attribution 4.0 International License, available at https://creativecommons.org/licenses/by/4.0/legalcode.

## Phase 4 · shops, loot, identification
- `src/shop.js`: SRD prices, three location shops with stock limits (`SHOPS`), the sheet-delta preview for every row
  (`preview`, `shopView`), buy/sell (half; gems and art full; keepsakes never), and `applyCart` (the player's saved cart,
  applied by the nightly batch; never throws, each line reports ok/why). Guild discount flag from the spy quest.
- `src/loot.js`: engine-owned treasure tables by CR (purses, hoards by band, magic by rarity; SRD items and values only),
  `addLoot` (coin split evenly, remainder to the party fund; items to Need/Greed or the party stash; gems/art cashed at
  the next shop), `divideLoot` (Need > Greed > Pass, d20 ties, Need only if usable), party-split claims.
- `src/rules/items.js`: every single-rarity SRD magic item (priced by rarity), gems/art, costly spell components,
  unidentified items (`unid`), `sellValue`. `src/actions.js`: attunement (identified, max 3, no duplicates), short-rest
  focus (identify or attune one item), `castIdentify` (pearl, ritual). `src/combat.js`: costly components checked/consumed.
- `src/night.js`: carts, loot division, battle-victory purses, GM awards (`plan.awards`), loot mode, short rests, quest
  effects; the fixed free-text DC scale (`FREE_DC` is v3: Easy 6 / Medium 11 / Hard 16 from Night 38; `DC_SCALE` v2 keeps Easy 9 / Medium 14 / Hard 19 for nights 8–37, and v1 keeps Easy 10 / Medium 15 / Hard 20 for nights 1–7; `setDcCall`, `checkDcCalls`, `applyDcScale`).
- `sim/economy.mjs` → `ECONOMY.md` (gold at levels 3–5). Tests: `test/phase4.test.js`.
