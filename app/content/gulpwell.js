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
    "Round 3 is next. Set battle orders: where you move, what you do, and a standing order for when things go wrong. One round plays tonight, then the table stops for new orders.",
  ],
  quote: { who: 'Commissar Gulpwell', text: '\u201cThat plate is still condemned, and you are not on the list.\u201d' },
  moves: [],
  freeDc: 14,
  absentText: 'Fights on their preset stance.',
  after: { victory: GULPWELL_VICTORY },
  next: "The fight in Gulpwell\u2019s office goes on. Orders for the next round are due after this one resolves.",
};

export const GULPWELL_SCENES = [GULPWELL_SCENE, GULPWELL_R2_SCENE, GULPWELL_R3_SCENE];

export function gulpwellStartBattle(partyPos) {
  return { ...GULPWELL_FIGHT, partyPos: partyPos || GULPWELL_FIGHT.partyPos };
}
