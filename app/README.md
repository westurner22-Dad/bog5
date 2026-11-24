# BoG V · The app (Phase 5: solo playtest · Phase 4: gear, loot, quests, issues · Phase 3: the nightly table · Phase 2: the Forge)

A static phone web app (390x844 first), no build step. Every number comes from the rules engine in `../engine`
(SRD 5.2.1 and 2024 rules, plus the approved Aasimar house rule). **Nothing here writes to live Firebase**: the
live target is hard-blocked in code (see `../firebase/README.md` for the go-live plan and sign-off list).

## Phase 5 · Solo playtest (Wes only, nothing online)

### Start it (one command)
Needs only Node 20+ (no npm install). From the repo folder:
```
node app/playtest.mjs            # you are seat p1 (Brother Ledgerton, pre-forged); p2-p4 are bots
node app/playtest.mjs --forge    # forge your own hero for p1 first, then play
node app/playtest.mjs --lan      # also serve on this computer's Wi-Fi address so your phone can play (same Wi-Fi)
```
It starts the local dev server (127.0.0.1:8770, the real bog5 rules enforced), sets up the test save, seats the bots and
prints the link to open (`http://127.0.0.1:8770/app/index.html?store=dev&player=p1`, plus a phone link with `--lan`).
Then, each night: play in the browser (a move or free text, Gear/Spells, level-up or rest choices, Ask the GM) and press
**Lock**. The bots have already locked, so the night **resolves by itself** a few seconds after you lock, and the page shows
the results on reload. Pressing Enter in the terminal resolves early (missing seats play their absentee stance); `q` quits.
After the last night the app stays up so you can read the Chronicle; Enter or Ctrl-C stops it. Nothing leaves the machine.
Other options: `--emulator` (Firebase emulators + the Google sign-in card; needs `tools-local/`), `--auto` (p1 is a bot too:
a 10-second smoke test), `--port 8771`, `--nights 6` (safety cap). GM log: `app/gm/work/playtest-dev.log`.

### Playtest notes built (Wes's sign-off, Nov 13 2026 · `phase5/PLAYTEST_NOTES.md`)
- **Narration voice** (note 1): all prose in `content/testadv.js`, Session 0 in `forge-text.js`, the `gm draft` skeleton and
  the engine's default texts are in the cozy Merchant Crab-style voice; the guide for future nights is `../phase0/VOICE.md`.
- **Teammates live** (note 3): "Your party tonight" on the Table (and under battle orders) shows each teammate's pick or
  orders and their party line while the night is open, refreshed in place every 8 s. Rules: party seats may read each
  other's `nights/{n}/actions/{pid}` only while that night's scene is `open` (rules matrix, dev + emulator).
- **Spell descriptions** (note 4): a one-line summary under every spell (Spells tab, Forge, level-up) and "Full rules" for
  the SRD 5.2.1 text (`spell-info.js`, data `../engine/srd/data/spelltext.js` from `engine/tools/build_spell_text.mjs`).
- **75 gp start** (note 6): King Elon's stipend tops every hero up to 75 gp after Forge gear (`STIPEND_CP` in
  `../engine/src/forge.js`); the Forge gear step says so. Screens: `python3 app/test/p5_notes_shots.py` → `shots/p5-notes/`.

### The test adventure: "The Toll at Grudge Bridge" (`content/testadv.js`, `gm init --adventure test`)
1. **The Mother of Grudges** (dusk, the frontier bridge stall is open): talk/scout moves, shop, Ask the GM. The bridge
   fight starts at the end of the night.
2. **The Toll of the Great Ledger** (battle orders, one round a night; a stop trigger can carry it to the next night).
   Victory: 1,800 XP (everyone reaches level 4 at 2,700) and a **short rest** (spend Hit Point Dice on the card). After a won
   fight the engine tends the fallen (death saves, Medicine DC 10 or a Healer's Kit, then 1 HP after 1d4 hours, SRD).
3. **Camp under Grudge Bridge**: **level up** (Hero tab ribbon), then a **long rest** that the Toll Inspector interrupts
   unless someone succeeds on *Keep watch* (interrupted: +1 hour and resume, SRD). Rations are eaten; water is the river.

### What's new on the phone
- **Painted portraits** (`portrait-art.js`, `assets/portraits/` 12 painted busts + `assets/gear/` 16 overlays): the painting
  is keyed by the hero's look; armor, shield, weapon and magic glow are drawn live from the engine inventory. If a look has no
  painting (e.g. a newly forged hero) or the file fails to load, the procedural SVG portrait shows instead (offline-safe).
  `gm portraits` lists heroes without a painting and prints the exact prompt; `node app/tools/portraits.mjs add <key> <img>`
  adds one. Contact sheet: `tools/portrait-lab.html`.
- **Level-up screen** (Hero ribbon "Level N is ready"): SRD 5.2.1 per class, levels 3→4→5 tested for all 12 classes; HP is
  the fixed average (P2-2); ASI or feat, new cantrips/spells/spellbook entries, masteries, invocations; "Suggested picks".
  Picks are saved with tonight's action and applied first in the GM batch (`gm levelups` checks them).
- **Spells tab** (mockup 05): save DC, attack, slots, concentration; Prepared / Cantrips / Class list / Scrolls; cast between
  scenes, prepare after a long rest, wizards copy into the spellbook.
- **Rests in regular scenes**: a short-rest card (Hit Point Dice, identify/attune focus) and a long-rest card with its risk.
- **Ask the GM** (Table tab): players ask as themselves (`bog5/asks`), everyone reads; the GM answers with words only
  (`gm asks`, `gm answer <id> --text "..." [--srd "section"]`). Anything that changes a sheet still goes through the engine.
- **GM dry run**: any `gm` command with `--dry-run` prints every database path/value and work file it would write and
  writes nothing.

### Phase 5 tests
- `cd engine && npm test` (adds `test/phase5.test.js`: level-up 3→5 all classes, refusals, rests and interruptions,
  prepare rules, level-up at 0 HP, tending the fallen).
- `node --test app/test/phase5.test.mjs` (playtest --auto end to end, --dry-run writes nothing, Ask the GM rules, portraits).
- `python3 app/test/phase5_sim.py`: 390x844 phone run of the whole test adventure; shots in `shots/phase5/`, best six in
  `shots/phase5-best/`.

## Phase 4 · Gear, loot, side quests, issue log

Six tabs: **Table · Hero · Gear · Party · Chronicle · Issues**. A "Report an issue with this screen" link sits under every view.
Players never edit their sheet. Everything they choose between scenes (cart, Need/Greed, short-rest focus) is saved with
tonight's action and applied by the GM's batch as engine events, so it shows up in "Sheet changes" and replays from the log.

### Gear tab (`gear.js`, mockup 04)
- **Paperdoll**: Head/Neck/Cloak/Armor | figure with AC | Main/Off/Ranged/Hands; Ring/Ring/Belt/Feet. Tags: the AC
  breakdown, Stealth disadvantage, Attuned n / 3, and over-capacity **only when exceeded**. Tap a slot to unequip (cart).
- **Pack**: food, water, torches, ammo, potions, components (with their spell), magic, unidentified items, keepsake
  ("no stats · never sold"). Buttons: Equip, Drink, Sell (at a shop), Study on rest / Attune on rest (when the scene ends
  in a short rest), Identify (if you can cast it and carry the pearl). Packs, tools and clothes fold under "Other gear".
- **Shop** (only on nights with `shop`): tabs For you / Armor / Weapons / Potions / Magic / Supplies. Every row shows what it
  does to **your** sheet (AC a → b, attack line a → b, STR requirement, training, attunement, food days, ammo), the SRD price,
  and Buy or "short N gp". Stock and limits by location (`engine/src/shop.js`): Bucky's at the Tankard II, the Guildhall Bazaar
  (capital, the only uncommon magic), the frontier bridge stall. Sell at half; gems and art at full value; rare = quest-only.
- **Cart**: each line with price, the coin after, AC change, and any line that would fail with why (engine preview on a copy
  of the public state). Applied by the batch before any fight.
- **Loot to divide** (also on the Table tab): Need / Greed / Pass per item; Need is greyed out when you couldn't use it
  (an unidentified longsword is still visibly a longsword). No pick = Greed. Party-split mode shows the stash with Claim.

### Side quests (`content/sidequests.js`)
"The Coin of the World Maker" (relic_hook, night 1) and "The Agent at Court" (spy_hook / spy_seen, nights 1–2): two
scene-nights each, slotted by the GM (`gm quests`, `gm open <n> --scene q_relic_1`). Rewards: 150 XP each, coin, one
uncommon item through Need/Greed, and a perk (temple favor; 10% off at the capital's guild stalls).

### Issue log (`issues.js`, mockup 08)
Report form (Bug / Rules / UI / Story, "attach this screen + game state") → `bog5/issues/{id}`. The GM triages into 2–3
options with one recommendation (`gm triage <id> [--file opts.json]`) or answers a rules question with an SRD reference
(`gm rule`). **Wes's queue** (host seat only) shows Pick ★ / other options / Other… / Reject. `gm build` refuses until Wes
has picked; then `gm release`. Everyone sees the log and the flow strip (Filed → Options → Wes picks → Built → Released).

### Sign-in (P3-4)
`?store=emulator` shows the Google sign-in card (Auth emulator), then "Almost in" with the uid until `gm link <uid> <pid>`.
`?store=live` uses the hosted Google provider (Firebase JS SDK). After sign-in, an unlinked account sees "Almost in" with the uid;
a linked seat opens the Forge (live RTDB; hero/draft writes are allowed until the adventure starts).
A visit with no `?store=` is still the local Forge (localStorage).

### Phase 4 GM commands
`call` · `award <n> --hoard 0-4 | --coin <cp> | --items a,b?,c --why` (`?` = unidentified) · `lootmode <n> needgreed|party`
· `link/unlink` · `quests` · `issues [--all]` · `issue` · `triage` · `rule` · `build` · `release`. Run `node app/gm/gm.mjs` for help.

### Phase 4 tests
- `cd engine && npm test`: **118** (13 new in `test/phase4.test.js`: prices, stock, deltas, attunement, identification,
  components, treasure tables, Need/Greed, party split, DC scale, a shop night, battle-victory purses).
- `node --test app/test/phase4.test.mjs`: 6 (side quests play and pay out, quest gating, issue validation/flow, bar-brawl wording).
- `node --test app/test/storage.test.mjs`: 6 (now 55 rules cases on the dev evaluator; BOG5_SA_JSON only).
- `bash app/test/run-emulator.sh`: emulator rules **55/55**, 0 disagreements; Google sign-in **14/14**; the full night with
  `call`, an off-scale DC refused, a GM award; the issue flow with build refused before Wes picks.
- `python3 app/test/table_sim.py`: **37/37** checks (adds the DC call line, GM award, issue report → triage → Wes picks →
  build/release, Need/Greed, Gear/shop/cart, cart applied as sheet events, gems cashed, quests, sign-in card).
  Best Phase 4 shots: `shots/phase4-best/`.
- `cd engine && node sim/economy.mjs 400`: the gold sim (`../engine/ECONOMY.md`).

## Phase 3 · The nightly table

### Run it locally (dev server with the bog5 rules enforced)
```
cd /workspace/bog5
node app/dev-server.mjs --fresh                 # 127.0.0.1:8770; serves app/ + engine/, emulates RTDB REST at /rtdb
node app/gm/gm.mjs init                         # campaign + members p1..p4 (heroes editable)
node app/test/seed_heroes.mjs                   # or let each player use the Forge: ?store=dev&player=p1
node app/gm/gm.mjs open 1 --date 2026-11-11     # imports heroes, LOCKS sheets, publishes scene + seed hash
open "http://127.0.0.1:8770/app/index.html?store=dev&player=p1"     # a player's phone (p1..p4)
node app/gm/gm.mjs status 1                     # who's in; resolve unlocks at 9 PM PT or when all 4 lock
node app/gm/gm.mjs plan 1                       # work/dev/plan-1.json; free text gets a default Medium call
node app/gm/gm.mjs call 1 p3 Hard "why" --skill investigation   # P3-1: Easy 6 / Medium 11 / Hard 16 + reason (nights 8–37 kept 9/14/19; nights 1–7 kept 10/15/20)
node app/gm/gm.mjs resolve 1                    # open dice; scene → closed
node app/gm/gm.mjs draft 1 > n1.txt             # fact-correct skeleton; rewrite it funny
node app/gm/gm.mjs narrate 1 --file n1.txt      # validator: exit 2 + reasons if the prose contradicts the dice
node app/gm/gm.mjs publish 1                    # result + seed reveal + sheet changes; scene → resolved
node app/gm/gm.mjs verify 1                     # seed vs hash, move DCs vs hash, log replay
```
All GM commands take `--target dev|emulator|live` (live refuses) and `--now <ISO>` (simulated clock). The app takes
`?now=<ISO>` the same way. GM secrets (seed, DC salt) live in `app/gm/work/<target>/secrets/` (mode 0600, git-ignored).

### How a night works
1. **Open**: scene, moves (each shows the skill, your modifier and the difficulty word: Easy/Medium/Hard), free text,
   "I say" and Whisper. The scene carries `sha256('bog5-seed:'+seed)` and a hash of the move DCs.
2. **Lock in** before **9:00 PM PT** (DST-aware). Moves can be changed until cutoff. When all four lock, the GM may
   resolve early. Anyone missing is played on their preset stance (**Cautious** by default; Support / Aggressive).
3. **Resolve**: open dice. Every roll shows d20, modifiers, total and the exact DC. The seed is revealed and any
   player can check it against the hash that was posted first.
4. **Narrate** (validated), **publish**: results, play-by-play, narration, sheet changes, new story hooks, recap.
5. **Battles**: battle orders cover one round (this round’s orders apply to that whole round, or the rest of it on a mid-round resume). The batch stops early on an ally
   down or a new enemy; mid-batch notices are only for a phase change or concentration. A battle unfinished at
   cutoff is saved exactly and resumes the next night, finishing that round and stopping at the round boundary.

### Phase 3 files
| File | What it does |
|---|---|
| `../engine/src/night.js` | The night loop: cutoff/DST, table status, Reforge lock, free-text → skill mapping, `planNight`, `resolveNight` (checks, effects, battle batch, seed reveal, sheet diff), `mapView`, `battleSummary`, `validateNarration`, `openNight`, `saveGame`/`loadGame`/`publicGame`. |
| `../engine/src/combat.js` | `describe()` now reads orders in SRD spell names and target names. |
| `content/arc1.js` | Arc 1 opening, "The Forge and the Coin": n1 The Altar Bill (temple), n2 Last Orders at the Tankard II (tavern) → battle "The Taps Are Shared Property" (8x10 map, Requisition Sergeant + clerks, reinforcements in round 2). |
| `table.js` | Player table UI: scene, moves, lock card with timer and seed hash, battle map + orders, resolution, recap, chronicle, party sheets, stance picker, "Sheet locked" card. |
| `app.js` | Boots the table once `campaign.adventureStarted`; hides Reforge and refuses edits after that (P2-3). |
| `storage.js` | Path stores (`MemoryPaths`, `LocalPaths`, `RtdbRest`) + `Bog5Store` on the `bog5/` prefix only. RTDB-safe packing. `RtdbRest` throws `LiveWriteBlocked` before any fetch to a non-local host unless `allowLive: 'wes-signed-off'` **and** (in Node) `BOG5_ALLOW_LIVE=1`. The live target and `?store=live` pass `allowLive` after Wes's sign-off; `BOG5_ALLOW_LIVE` is only in the GM CLI environment. |
| `dev-server.mjs`, `rtdb-rules.mjs` | Local server + an evaluator for the RTDB rules subset we use (checked equal to the real emulator on 34 cases). |
| `gm/gm.mjs` | GM CLI (above). `gm/sa-auth.mjs`: service-account auth from `BOG5_SA_JSON` only (P3-2; never printed; refuses `BOG4_SA_JSON`). Used for `--target live`. |
| `../firebase/bog5.rules.json` | Proposed rules for the `bog5/` subtree only. `../firebase/emulator/` runs them on the official emulator (demo project). |
| `tools/backgrounds.py` | Temple and tavern scene art. |
| `test/` | `storage.test.mjs`, `rules-matrix.mjs`, `run-emulator.sh` (rules matrix + full GM loop on the emulator), `table_sim.py` (3-night, 4-player sim), `sim/narration-n*.txt`. |

### Phase 3 tests
- `cd engine && npm test`: 105 tests (12 in `test/night.test.js`).
- `node --test app/test/storage.test.mjs`: 6 tests (stores, Reforge lock, cutoff, live block, SA auth, rules matrix on dev).
- `bash app/test/run-emulator.sh`: Firebase RTDB emulator (offline, `demo-c-thug`). 34/34 rules cases, 0 disagreements
  with the dev evaluator, then one full night of the GM loop with players writing as themselves.
  Needs `tools-local/` (JRE + firebase-tools; git-ignored).
- `python3 app/test/table_sim.py`: headless Chrome 390x844, 3 nights, 4 players, Pip absent night 1 and in the battle,
  early resolve night 2, battle stops on reinforcements night 3 and resumes night 4. 21 checks, screenshots in
  `shots/table/` (best six kept in `shots/table-best/`).
- `BOG5_URL=http://127.0.0.1:8770/app/index.html python3 app/test/forge_e2e.py`: Phase 2 Forge still passes.

## Phase 2 · The Forge (Session 0) and guided character builder

A static phone web app. No build step. In Phase 2 it made no network calls. Every number is computed by the
rules engine in `../engine` (SRD 5.2.1 and 2024 rules, plus the approved Aasimar house rule).

## Run it
```
cd /workspace/bog5 && python3 -m http.server 8765
open http://localhost:8765/app/index.html            # localStorage (survives reloads)
open http://localhost:8765/app/index.html?store=memory   # in-memory (nothing saved)
```
It has to be served from `/workspace/bog5` because the app imports `../engine/src/*.js` directly as ES modules.

## Files
| File | What it does |
|---|---|
| `index.html` | Shell page (the viewport, the module entry). |
| `app.css` | The locked Tavern Ledger tokens and components (copied from `phase0/mockups/style.css`) plus the builder pieces: chips, swatches, steppers, the dock and the drawer. |
| `app.js` | The 12 steps, the live-preview dock, the full sheet, the party roster and the hero view. It renders whatever `engine/src/forge.js` says is legal. |
| `forge-text.js` | Session 0 narration, built on Wes's locked canon (death, ascension, the choice, the reforging to level 3, waking on Waukeen's altar). |
| `portrait.js` | JS port of the Phase 0 epic portrait generator. It draws from look preferences plus equipped gear (armor texture, weapon, shield, emblem, cosmetic glow), the same picture every time for a given hero, works offline, and falls back to an initials crest. |
| `storage.js` | Rewritten in Phase 3 (see above). `MemoryAdapter` / `LocalStorageAdapter` remain as compatibility names. |
| `fonts/` | Bundled OFL fonts (Cinzel, Cinzel Decorative, Alegreya family), so phones render the locked look offline. |
| `test/forge_e2e.py` | Playwright and headless Chrome at 390x844. It drives 5 heroes through every step, screenshots each one to `shots/`, and checks the saved sheets. |

## Engine pieces added for Phase 2
- `engine/src/forge.js`:
  - Draft model and option lists.
  - `choiceGroups()`: every choice the draft still needs, with only legal options.
  - `pick()` and `prune()`: illegal picks are impossible, and changing an earlier step drops picks that are no longer legal.
  - Point-buy and standard-array helpers.
  - `toSpec()`, `evaluate()` (uses `createCharacter`), and `preview()` (a live sheet with placeholders).
  - Party roles and gaps.
- `engine/src/startingGear.js`:
  - Parses each class's SRD "Choose A or B" equipment text into items.
  - Background packages.
  - Unpacks packs into their contents, stacks items and auto-equips.
  - A starter shop for heroes who take the gold.
- `engine/src/rules/items.js`: adds the tools named by SRD starting equipment, a spellbook, traveler's clothes, and the no-stats **keepsake**.
- `engine/src/character.js`: species magic on the sheet now includes the elf and tiefling lineage cantrips and spells, not just the Aasimar Light.

## Tests
- `cd engine && npm test` runs 93 tests, including 14 builder tests in `test/forge.test.js`:
  - Every class × every species × every background makes a valid level-3 sheet.
  - Point-buy limits.
  - The 2024 background bonus.
  - Aasimar.
  - Spell counts per class.
  - Illegal-pick blocking.
  - Starting equipment.
  - Party gaps and the preview.
- `python3 app/test/forge_e2e.py` runs the browser walkthrough (needs the server above).
