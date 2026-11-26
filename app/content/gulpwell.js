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
  defeatText: 'Gulpwell goes down hard against his own ledger table, and the official stamp rolls under a chair.',
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
    "The office at the back of the counting hall is smaller than the title on the door. A heavy ledger table, a barred cabinet, and a window that looks onto the square. Commissar Gulpwell is on his feet with the official stamp in one hand and a short blade in the other. Comptroller Tally Brisk stands between the party and the cabinet, ink on her fingers, already reaching for the bell.",
    "Harold's urn is in that cabinet, tagged for the melt. There is no more talking this into place. Set battle orders: where you move, what you do, and a standing order for when things go wrong. One round plays tonight, then the table stops for new orders.",
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

export function gulpwellStartBattle(partyPos) {
  return { ...GULPWELL_FIGHT, partyPos: partyPos || GULPWELL_FIGHT.partyPos };
}
