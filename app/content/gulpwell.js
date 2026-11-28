// BoG V \u00b7 Commissar Gulpwell and Comptroller Tally Brisk. Prep only: not shown until the GM opens the scene.
// Foes are SRD templates with name overlays. From Night 20 on, flattenFoe remaps boss AC to Hard (13) and
// other foes to Medium (10), and drops attack bonuses with AC (floor +0).
export const GULPWELL = {
  monster: 'bandit_captain',
  name: 'Commissar Gulpwell',
  uid: 'gulpwell',
  boss: true,
  pos: [8, 6],
  // Native SRD: AC 15, 52 HP, CR 2, 450 XP, Initiative +3, Multiattack 2, Scimitar +5 1d6+3, Pistol +5 1d10+3.
  // As a Night 20+ boss: AC 13, attacks +3. HP left at 52 so a level-3 party can finish in a night or two.
  maxHp: 52,
  defeatText: 'Gulpwell goes down hard against his own ledger table, and the official ledger slides under a chair.',
};

export const TALLY_BRISK = {
  monster: 'spy',
  name: 'Comptroller Tally Brisk',
  uid: 'tally',
  pos: [10, 5],
  // Native SRD: AC 12, 27 HP, CR 1, 200 XP, Initiative +4, Shortsword +4 1d6+2, Hand Crossbow +4 1d6+2.
  // As a Night 20+ non-boss: AC 10, attacks +2. She is the second threat, not the boss.
  maxHp: 27,
  tactics: { flee: true },
  defeatText: 'Tally Brisk puts her hands up, ink still on her fingers, and sits down very carefully.',
};

export const GULPWELL_FOES = [GULPWELL, TALLY_BRISK];
export const GULPWELL_XP = 450 + 200; // 650, split four ways at victory

export const GULPWELL_FIGHT = {
  name: "Gulpwell's Office",
  kind: 'battle',
  loot: { coin: 8000 }, // 80 gp in the commissar's strongbox; split evenly
  map: { w: 16, h: 12, terrain: { '0,0': 'wall', '15,0': 'wall', '0,11': 'wall', '15,11': 'wall' } },
  partyPos: [[2, 6], [2, 7], [3, 5], [3, 8]],
  foes: [
    { ...GULPWELL },
    { ...TALLY_BRISK },
  ],
};

export const GULPWELL_SCENE = {
  id: 'a1_gulpwell',
  n: null,
  title: "Gulpwell's Office",
  place: 'Thimbleby \u00b7 the counting hall',
  bg: 'city',
  time: 'Afternoon',
  battle: true,
  prose: [
    "The front door is open, the desk is behind them, and they are in Gulpwell\u2019s office. Gorlock\u2019s warcry emptied the hall; Tally Brisk never reached the bell, and no one is coming to help. Boobington came in by a quieter way and is in a place from which he can cover the others. Y\u00e4est is in the room with them, even if the anthem did not carry. Harold\u2019s urn is in the barred cabinet, tagged for the melt.",
    "The office is smaller than the title on the door: a heavy ledger table, the cabinet, a window on the square. Commissar Gulpwell (52 HP, AC 13, attacks +3) is on his feet with a short blade in his hand. Comptroller Tally Brisk (27 HP, AC 10, attacks +2) stands between the party and the cabinet, ink on her fingers; she will try to get out if she is badly hurt. Gorlock has Heroic Inspiration.",
    "Positions: Biggus at 2, 6; Gorlock at 2, 7; Boobington at 3, 5; Y\u00e4est at 3, 8. Gulpwell is at 8, 6. Tally is at 10, 5. Initiative is Y\u00e4est 26, Boobington 22, Tally Brisk 20, Gulpwell 15, Gorlock 14, and Biggus 4. Y\u00e4est is up first. Set battle orders: where you move, what you do, and a standing order for when things go wrong. One round plays tonight, then the table stops for new orders.",
  ],
  quote: { who: 'Commissar Gulpwell', text: '\u201cThat plate is condemned, and you are not on the list.\u201d' },
  moves: [],
  freeDc: 14,
  absentText: 'Fights on their preset stance.',
  after: {
    startBattle: GULPWELL_FIGHT,
    victory: { effects: [{ cid: 'story', flag: 'urn_recovered', text: "Harold's urn is in the party's hands, taken from Gulpwell's cabinet before the melt." }, { cid: 'party', xp: 0, why: 'victory XP comes from the foes' }] },
  },
  next: 'The square, with the urn, and the question of how far official memory reaches.',
};

export const GULPWELL_VICTORY = {
  effects: [
    { cid: 'story', flag: 'urn_recovered', text: "Harold's urn is in the party's hands, taken from Gulpwell's cabinet before the melt." },
    { cid: 'party', xp: 0, why: 'victory XP comes from the foes' },
  ],
};

export const GULPWELL_R2_SCENE = {
  id: 'a1_gulpwell_2',
  n: null,
  title: "Gulpwell's Office (cont.)",
  place: 'Thimbleby \u00b7 the counting hall',
  bg: 'city',
  time: 'Afternoon',
  battle: true,
  prose: [
    "Round 1 is down, and the fight in Gulpwell\u2019s office is still on. Y\u00e4est asked Harold\u2019s urn the best way to free him; his Religion was a 3 plus 1 plus 1, a 4 against DC 11, and the cabinet gave him nothing he could use. The urn is still in the barred cabinet, tagged for the melt. Boobington put a Fire Bolt into Gulpwell, a 15 plus 4, a 19 against AC 13, 5 fire. Tally Brisk came in to 7, 4 and missed Y\u00e4est with the Hand Crossbow, a 1 plus 2, a 3 against AC 14. Gulpwell came in to 5, 6 and fired the pistol twice at Y\u00e4est: a 10 plus 3, a 13 against AC 14, a miss, then an 18 plus 3, a 21 against AC 14, 11 piercing. Y\u00e4est is at 10 of 21 HP. Gorlock closed to 4, 5 and hit Gulpwell with the scimitar, an 18 plus 5, a 23 against AC 13, 6 slashing. Gulpwell is at 41 of 52 HP. Biggus moved to 4, 7 and cast Bless on himself, Gorlock, and Boobington. Y\u00e4est is not in that blessing. Tally has not fled, and she is still at 27 of 27 HP. The hall is still empty; no one is coming to help.",
    "Positions: Biggus at 4, 7, unhurt, AC 19. Gorlock at 4, 5, unhurt, AC 15, Heroic Inspiration still in hand. Boobington at 3, 5, unhurt, AC 14. Y\u00e4est at 3, 8, at 10 of 21 HP, AC 14. Gulpwell (41 HP, AC 13, attacks +3) is at 5, 6. Tally Brisk (27 HP, AC 10, attacks +2) is at 7, 4; she will try to get out if she is badly hurt. Bless is up on Biggus, Gorlock, and Boobington. Initiative is unchanged: Y\u00e4est 26, Boobington 22, Tally Brisk 20, Gulpwell 15, Gorlock 14, and Biggus 4. Y\u00e4est is up first.",
    "Round 2 is next. Set battle orders: where you move, what you do, and a standing order for when things go wrong. One round plays tonight, then the table stops for new orders.",
  ],
  quote: { who: 'Commissar Gulpwell', text: '\u201cThat plate is still condemned, and you are not on the list.\u201d' },
  moves: [],
  freeDc: 14,
  absentText: 'Fights on their preset stance.',
  after: { victory: GULPWELL_VICTORY },
  next: "The fight in Gulpwell\u2019s office goes on. Orders for the next round are due after this one resolves.",
};

export const GULPWELL_R3_SCENE = {
  id: 'a1_gulpwell_3',
  n: null,
  title: "Gulpwell's Office (cont.)",
  place: 'Thimbleby \u00b7 the counting hall',
  bg: 'city',
  time: 'Afternoon',
  battle: true,
  prose: [
    "Round 2 is down, and the fight in Gulpwell\u2019s office is still on. Y\u00e4est stepped in to 2, 5 and cast Aid on himself; a level 2 slot is spent, and he went from 10 to 15 of 26 HP. Boobington stayed at 3, 5 and put an Ice Knife into Tally Brisk, a 19 plus 6, a 25 against AC 10, 2 piercing, with Bless on the roll. Tally came in to 6, 5 and missed Biggus with the Hand Crossbow, a 5 plus 2, a 7 against AC 19. Gulpwell stayed at 5, 6 and cut twice at Biggus with the scimitar: a 7 plus 3, a 10 against AC 19, a miss, then a 10 plus 3, a 13 against AC 19, a miss. Bless holds. Gorlock stayed at 4, 5 and hit Gulpwell with the scimitar, a 16 plus 8, a 24 against AC 13, 5 slashing, with Bless on the roll. Biggus stayed at 4, 7, kept Bless up, and hit Gulpwell with the longsword, a 10 plus 8, an 18 against AC 13, 9 slashing and 8 radiant from a Divine Smite; the free smite is spent. Gulpwell is at 19 of 52 HP, bloodied and sapped. Tally has not fled, and she is at 25 of 27 HP. The urn is still in the barred cabinet, tagged for the melt. The hall is still empty; no one is coming to help.",
    "Positions: Biggus at 4, 7, unhurt, AC 19. Gorlock at 4, 5, unhurt, AC 15, Heroic Inspiration still in hand. Boobington at 3, 5, unhurt, AC 14. Y\u00e4est at 2, 5, at 15 of 26 HP, AC 14, Aid still on him. Gulpwell (19 HP, AC 13, attacks +3) is at 5, 6, bloodied and sapped. Tally Brisk (25 HP, AC 10, attacks +2) is at 6, 5; she will try to get out if she is badly hurt. Bless is still up on Biggus, Gorlock, and Boobington, with 9 rounds left. Y\u00e4est is not in that blessing. Initiative is unchanged: Y\u00e4est 26, Boobington 22, Tally Brisk 20, Gulpwell 15, Gorlock 14, and Biggus 4. Y\u00e4est is up first.",
    "At the start of round 3, before anyone acts, Comptroller Tally Brisk makes the Dexterity saving throw she was owed from Boobington’s Ice Knife in round 2: hit or miss, the shard explodes, and she was the only one within 5 feet. The DC is Boobington’s spell save DC, 12. On a failure she takes 2d6 cold; on a success, nothing. The roll is made when the table is locked, and the result is at the top of the recap.",
    "Round 3 is next. Set battle orders: where you move, what you do, and a standing order for when things go wrong. One round plays tonight, then the table stops for new orders.",
  ],
  quote: { who: 'Commissar Gulpwell', text: '\u201cThat plate is still condemned, and you are not on the list.\u201d' },
  moves: [],
  freeDc: 14,
  absentText: 'Fights on their preset stance.',
  after: { victory: GULPWELL_VICTORY },
  next: "The fight in Gulpwell\u2019s office goes on. Orders for the next round are due after this one resolves.",
};

export const GULPWELL_R4_SCENE = {
  id: 'a1_gulpwell_4',
  n: null,
  title: "Gulpwell's Office (cont.)",
  place: 'Thimbleby \u00b7 the counting hall',
  bg: 'city',
  time: 'Afternoon',
  battle: true,
  prose: [
    "Round 3 is down, and the fight in Gulpwell\u2019s office is still on. At the start of the round, Boobington\u2019s Ice Knife from round 2 burst around Tally Brisk; her Dexterity save was an 18 plus 2, a 20 against DC 12, and she took 0 cold. Y\u00e4est held at 2, 5. His Bardic Inspiration, aimed at the most hurt person on his side, did not take, because that person was himself. He cast True Strike at Gulpwell and sent a dart at long range, at a disadvantage: a 1 and a 7, the 1 plus 4, a 5 against AC 13, a miss. Boobington let Innate Sorcery rise and cast Magic Missile, two darts on Tally and one on Gulpwell: 5 force and 3 force into Tally, 5 force into Gulpwell. Tally missed Biggus with the Hand Crossbow, a 12 plus 2, a 14 against AC 19. Gulpwell cut twice at Biggus, the first swing sapped, a 2 and an 8, the 2 plus 3, a 5 against AC 19, a miss, then a 1 plus 3, a 4 against AC 19, a miss. Gorlock hit Gulpwell with a critical, a 19 plus 9, a 28 against AC 13, 9 slashing, with Bless on the roll. Biggus hit Gulpwell with a natural 20, plus 7, a 27 against AC 13, a critical hit, 13 slashing and 8 radiant from a Divine Smite; a level 1 slot is spent. Gulpwell is down, at 0 of 52 HP. Tally has not fled, and she is at 17 of 27 HP. The urn is still in the barred cabinet, tagged for the melt. The hall is still empty; no one is coming to help.",
    "Positions: Biggus at 4, 7, unhurt, AC 19. Gorlock at 4, 5, unhurt, AC 15, Heroic Inspiration still in hand. Boobington at 3, 5, unhurt, AC 14, Innate Sorcery still on him. Y\u00e4est at 2, 5, at 15 of 26 HP, AC 14, Aid still on him. Gulpwell is down at 5, 6, at 0 of 52 HP. Tally Brisk (17 HP, AC 10, attacks +2) is at 6, 5; she will try to get out if she is badly hurt. Bless is still up on Biggus, Gorlock, and Boobington, with 8 rounds left. Y\u00e4est is not in that blessing. Initiative is unchanged: Y\u00e4est 26, Boobington 22, Tally Brisk 20, Gulpwell 15, Gorlock 14, and Biggus 4. Y\u00e4est is up first.",
    "Round 4 is next. Set battle orders: where you move, what you do, and a standing order for when things go wrong. One round plays tonight, then the table stops for new orders.",
  ],
  quote: { who: 'Commissar Gulpwell', text: '\u201cThat plate is still condemned, and you are not on the list.\u201d' },
  moves: [],
  freeDc: 14,
  absentText: 'Fights on their preset stance.',
  after: { victory: GULPWELL_VICTORY },
  next: "The fight in Gulpwell\u2019s office goes on. Orders for the next round are due after this one resolves.",
};

// Night 53 (after the office fight ended on Night 52): slip out of the hall and out of Thimbleby with the urn. Skill night, short recap.
// Outline: notes-arc-outline-n47.md. The urn_recovered flag was already set by GULPWELL_VICTORY. Do not route through Fenwick/Tollford; no next main-quest hook here.
export const GULPWELL_SLIPOUT_SCENE = {
  id: 'a1_slipout',
  n: null,
  title: 'Out of Thimbleby',
  place: 'Thimbleby \u00b7 the counting hall',
  bg: 'city',
  time: 'Afternoon',
  shop: 'thimbleby',
  prose: [
    'Gulpwell is down on his own ledger table, and they have him tied. Tally Brisk is sitting very carefully with her ink-stained hands where everyone can see them, and she has not reached for a weapon since she put them up. The barred cabinet is open. Harold\u2019s urn \u2014 brass, one, contents: Harold \u2014 is in the party\u2019s hands, and nobody is going to melt it today. Y\u00e4est\u2019s Suggestion has nothing left to hold: Tally was burned out of it before it could take, and the spell lapses as they leave the office.',
    'The hall outside is still empty from Gorlock\u2019s warcry, which will not last. Teslandia commandos are already in Thimbleby for the two of them. They will take the tied Commissar and the surrendered Comptroller off the party\u2019s hands, and get them out of the counting hall by a road that is not the party\u2019s. Sooner or later a clerk comes back for a pen.',
    'The horses Y\u00e4est secured are still stabled near the hall. The work now is to get out of the counting hall and out of Thimbleby with the urn before the afternoon bell and anyone with a form arrives. The Pump Stall is still open on the square if anyone needs a few things for the road.',
  ],
  quote: { who: 'Tally Brisk, hands flat on the desk', text: '\u201cThe door sticks. Lift it a little. I would hate for anyone to hear you leave.\u201d' },
  moves: [
    { id: 'urnout', label: 'Carry the urn out of the hall without standing in a clerk\u2019s question', tags: ['risky'], check: { skill: 'deception', dc: 14 }, hint: 'A brass urn under a coat, a calm walk, and the look of a person with a form. The hall is quiet now, but not for long.',
      success: { text: 'You walk the urn out the way you would walk a stack of ledgers: unhurried, a little bored, and slightly in the way. The few clerks who have drifted back look at your coat and their own work, in that order, and the delivery door lets you out into the side yard.', effects: [{ flag: 'urn_carried_out', flagText: 'the party carried Harold\u2019s urn out of the counting hall by the delivery door without a clerk\u2019s question' }, { xp: 25, who: 'self', why: 'carried the urn out of the hall quietly' }] },
      failure: { text: 'A clerk, back for a pen, looks at the coat, then at the shape under it, and then very carefully at nothing. You get out through the side yard on a fast walk and a slow breath, and the clerk\u2019s eyes are on your back the whole way.', effects: [] } },
    { id: 'horses', label: 'Get the getaway horses out of the stable and loaded', tags: ['talk'], check: { skill: 'animal_handling', dc: 14 }, hint: 'Y\u00e4est\u2019s horses are stabled near the hall, rested and ready. Four riders, one urn, and a stableboy who would like to see a form.',
      success: { text: 'The horses are rested and glad to go, the stableboy gets the coin Y\u00e4est left for exactly this, and the urn rides in the saddlebag of the steadiest one. Nobody on the lane takes a second look at four riders leaving town in no hurry.', effects: [{ flag: 'horses_loaded', flagText: 'the party got the getaway horses out of the stable and loaded, the urn in a saddlebag' }, { xp: 25, who: 'self', why: 'got the getaway horses out and loaded' }] },
      failure: { text: 'The horses balk at the smell of powder smoke that came out of the hall with you, and the stableboy wants to know why everyone is in such a hurry. It costs a few minutes and a few coins, but the horses come.', effects: [] } },
    { id: 'gate', label: 'Take the road out of Thimbleby before word gets around', tags: ['notice'], check: { skill: 'stealth', dc: 14 }, hint: 'The square is busy, the road gate has a clerk on it, and the afternoon bell is coming. A quiet way out is the best way out.',
      success: { text: 'You take the lane behind the stables, cross the square at the one moment it is full of carts, and ride out at a walk. The gate clerk is busy with a toll and a farmer, and the road opens in front of you with no one calling after you.', effects: [{ flag: 'out_of_thimbleby', flagText: 'the party left Thimbleby by the road gate before word of the counting hall got around' }, { xp: 25, who: 'self', why: 'got out of Thimbleby before word got around' }] },
      failure: { text: 'The gate clerk looks up, looks at the horses, and writes something down. You are out of town, but you will want to ride a little faster than you meant to.', effects: [] } },
  ],
  freeDc: 14,
  absentText: 'Rides with the party and keeps his head down. No roll.',
  after: { effects: [] },
  next: 'They are out of the counting hall with Harold\u2019s urn and the horses. The road home to Teslandia\u2019s capital is next.',
};

// Night 54 plan (not opened): the road home. One quick night, no detour towns, no Fenwick/Tollford. Short recap.
export const GULPWELL_ROAD_SCENE = {
  id: 'a1_roadhome',
  n: null,
  title: 'The Road Home',
  place: 'The road to Teslandia\u2019s capital',
  bg: 'forest',
  time: 'Dusk',
  prose: [
    'Thimbleby is behind them. Harold\u2019s urn rides in a saddlebag, the getaway horses have the road, and Teslandia commandos have the rest: Commissar Gulpwell, still tied, and Comptroller Tally Brisk, who went with them without a fight. The commandos took a different road. What becomes of those two is not tonight\u2019s work.',
    'The capital is ahead, and there is no good reason to turn aside. No Fenwick, no Tollford, no second town. A straight ride home, and then Harold goes back to Mags.',
  ],
  quote: { who: 'a carter going the other way, already bored of them', text: '\u201cIf you\u2019re for the capital, keep on. There is nothing worth a detour between here and the gates.\u201d' },
  moves: [
    { id: 'pace', label: 'Set a pace the getaway horses can hold all the way home', tags: ['talk'], check: { skill: 'animal_handling', dc: 14 }, hint: 'The horses were fresh when you left the hall. A steady pace will get you to the capital; a hard one may not.',
      success: { text: 'The horses settle into a pace they can keep. The road unreels, the urn stays in the bag, and by the time the capital\u2019s lights show you have not had to walk.', effects: [{ flag: 'road_pace_held', flagText: 'the party held a steady pace on the road home, and the getaway horses lasted the ride' }, { xp: 25, who: 'self', why: 'set a pace the horses could hold all the way home' }] },
      failure: { text: 'You push too hard, or not hard enough, and the horses are sour by the last miles. You still reach the capital. You just arrive later, and stiffer, than you meant to.', effects: [] } },
    { id: 'hidden', label: 'Keep Harold\u2019s urn out of other travelers\u2019 sight', tags: ['risky'], check: { skill: 'stealth', dc: 14 }, hint: 'The road has carters and a few riders. A brass urn in a saddlebag will not draw a look if the bag looks like any other bag.',
      success: { text: 'The bag looks like feed. Other travelers nod, or do not, and nobody asks what you are carrying home.', effects: [{ flag: 'urn_hidden_on_road', flagText: 'the party kept Harold\u2019s urn out of other travelers\u2019 sight on the road home' }, { xp: 25, who: 'self', why: 'kept the urn out of sight on the road' }] },
      failure: { text: 'A carter glances at the bag twice, then shrugs and goes on. You get a little more careful after that, and you reach the gates without a question you have to answer.', effects: [] } },
    { id: 'watch', label: 'Watch the road behind for word from Thimbleby', tags: ['notice'], check: { skill: 'perception', dc: 14 }, hint: 'If anyone rode out after you, or if a rumor is traveling faster than a horse, the road behind will say so.',
      success: { text: 'The road behind stays ordinary: dust, a cart, a dog. No rider from the counting hall, and no shout that has your names in it. The commandos\u2019 road is not this one.', effects: [{ flag: 'road_clear_behind', flagText: 'the party watched the road home and saw no pursuit out of Thimbleby' }, { xp: 25, who: 'self', why: 'watched the road behind and found it clear' }] },
      failure: { text: 'Every dust-cloud looks like a rider until it is a cart. You reach the capital a little more tired for the looking, and still no one has called your names on this road.', effects: [] } },
  ],
  freeDc: 14,
  absentText: 'Rides with the party and keeps his head down. No roll.',
  after: { effects: [] },
  next: 'The capital is in front of them, and Harold is still in the saddlebag. Homecoming at the Leaking Tankard II is next.',
};

// Night 55 plan (not opened): homecoming at the Leaking Tankard II, then the guild hall.
// Wes, Nov 27 2026: Gulpwell's geas is removed; he helps Mags smuggle ale into the grey lands. Tally begins running the guild store.
// Open later with shop: 'capital' so the Teslandia mission board is under the Guildhall Bazaar. STOP: no next main-quest hook.
export const GULPWELL_HOMECOMING_SCENE = {
  id: 'a1_homecoming',
  n: null,
  title: 'Homecoming',
  place: 'Teslandia \u00b7 the capital',
  bg: 'tavern',
  time: 'Evening',
  shop: 'capital',
  prose: [
    'They are back in Teslandia\u2019s capital, and the first door is the one that matters. The Leaking Tankard II still has an empty shelf behind the bar, the one that has been waiting for a brass urn with Harold\u2019s name on it. Mags is there. The work of the last days was always this: put him back.',
    'Teslandia commandos came home a different road, and they brought two people with them. Commissar Gulpwell had a geas on him \u2014 a socialist\u2019s geas, put there by someone who wanted the counting hall run a certain way. It is off him now. What is left is an enthusiastic capitalist, already talking to Mags about a practical problem: her ale, and the grey lands, and how a man who used to stamp condemned plate might help her get a cask where a cask is wanted. Tally Brisk came back with the same escort. She has a knack for logistics and accounting, and she has already been shown the guild store. She is going to run it.',
    'After the shelf, they report in at the guild hall. The Teslandia mission board is up, under the Guildhall Bazaar, for short side jobs when they want them. Tally\u2019s shelves will take some stocking; new goods from her ledgers and from Gulpwell\u2019s arrangement with Mags are a matter for after this night, once the store is truly hers.',
  ],
  quote: { who: 'Mags, one hand on the empty shelf', text: '\u201cThere you are, Harold. I kept your place. Sit down, the lot of you, and tell me the true version.\u201d' },
  moves: [
    { id: 'shelf', label: 'Set Harold\u2019s urn back on the empty shelf and tell Mags how you got him home', tags: ['talk'], check: { skill: 'persuasion', dc: 14 }, hint: 'The shelf has been empty long enough. Mags will want the true version, and she will want him on that shelf before the story gets long.',
      success: { text: 'Harold goes back where he drinks. Mags does not cry, exactly, but the Tankard is quieter for a moment, and then she stands the house and makes you say it again from the beginning, including the parts that do not make you look clever.', effects: [{ flag: 'urn_returned', flagText: 'Harold\u2019s urn is back on the empty shelf behind the bar at the Leaking Tankard II' }, { xp: 25, who: 'self', why: 'returned Harold\u2019s urn to Mags and told her how he got home' }] },
      failure: { text: 'Harold goes on the shelf all the same; that was never in question. The story comes out in the wrong order, and Mags has to ask the same thing twice, but he is home, and she pours anyway.', effects: [{ flag: 'urn_returned', flagText: 'Harold\u2019s urn is back on the empty shelf behind the bar at the Leaking Tankard II' }] } },
    { id: 'geas', label: 'Hear Gulpwell out now that the geas is off him', tags: ['talk'], check: { skill: 'insight', dc: 14 }, hint: 'The man in the counting hall and the man in the Tankard may not be the same man. A careful listen will tell you whether the capitalist talking to Mags about ale is the truth of him.',
      success: { text: 'You can hear the difference. The geas is gone, and what is left is not a speech, it is a man happily arguing margins with Mags over a cask bound for the grey lands. He is, a little alarmingly, good at it.', effects: [{ flag: 'gulpwell_geas_lifted', flagText: 'Gulpwell\u2019s socialist geas is off him; he is an enthusiastic capitalist, helping Mags smuggle her ale into the grey lands' }, { xp: 25, who: 'self', why: 'heard Gulpwell out, geas gone, and believed the man talking to Mags' }] },
      failure: { text: 'He talks fast, and about ale, and you cannot honestly say you have the measure of him yet. Mags seems to. The geas is off; the partnership is already being sketched on the back of a bill.', effects: [{ flag: 'gulpwell_geas_lifted', flagText: 'Gulpwell\u2019s socialist geas is off him; he is an enthusiastic capitalist, helping Mags smuggle her ale into the grey lands' }] } },
    { id: 'report', label: 'Report in at the guild hall and walk Tally\u2019s new shelves', tags: ['notice'], check: { skill: 'investigation', dc: 14 }, hint: 'The guild wants the short version of Thimbleby. Tally is already in the store, counting, and the shelves will tell you what kind of steward she is going to be.',
      success: { text: 'The report is short and it stands. Tally already has the store\u2019s books in a better order than you left them, and she can tell you, without looking, what is short and what will be in next. The Teslandia mission board is on the wall under the Bazaar, for whenever you want a side job.', effects: [{ flag: 'tally_runs_store', flagText: 'Tally Brisk has begun running the Teslandia guild store, and has a knack for logistics and accounting' }, { xp: 25, who: 'self', why: 'reported in at the guild hall and took the measure of Tally\u2019s new store' }] },
      failure: { text: 'The guild takes the report and asks you to come back if you remember a date. Tally, at least, is already at work: ink on her fingers again, and the store\u2019s ledgers open. The board is up.', effects: [{ flag: 'tally_runs_store', flagText: 'Tally Brisk has begun running the Teslandia guild store, and has a knack for logistics and accounting' }] } },
  ],
  freeDc: 14,
  absentText: 'Stands at the bar, lets Mags pour, and lets the others do the talking. No roll.',
  after: { effects: [
    { cid: 'story', flag: 'urn_returned', text: 'Harold\u2019s urn is back on the empty shelf behind the bar at the Leaking Tankard II' },
    { cid: 'story', flag: 'gulpwell_geas_lifted', text: 'Gulpwell\u2019s socialist geas is off him; he is an enthusiastic capitalist, and he is helping Mags smuggle her ale into the grey lands' },
    { cid: 'story', flag: 'tally_runs_store', text: 'Tally Brisk has begun running the Teslandia guild store' },
  ] },
  next: 'Harold is on his shelf, Tally is at the guild store, and the Teslandia mission board is open for side jobs.',
};

export const GULPWELL_SCENES = [GULPWELL_SCENE, GULPWELL_R2_SCENE, GULPWELL_R3_SCENE, GULPWELL_R4_SCENE, GULPWELL_SLIPOUT_SCENE, GULPWELL_ROAD_SCENE, GULPWELL_HOMECOMING_SCENE];


export function gulpwellStartBattle(partyPos) {
  return { ...GULPWELL_FIGHT, partyPos: partyPos || GULPWELL_FIGHT.partyPos };
}
