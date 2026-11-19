// BoG V · Phase 5 test adventure "The Toll at Grudge Bridge" (3 nights, a test save for Wes's solo playtest).
// Arc 1 canon: the Border March between Teslandia and Thimbleby, Commissar Gulpwell's Great Ledger, the Mother of
// Grudges' bridge stall. Exercises a shop (night 1), a fight + a short rest on victory (night 2), a level-up and an
// interruptible long rest (night 3). Play it on its own save: gm init --adventure test.
export const ADVENTURE = { id: 't1', arc: 1, title: 'The Toll at Grudge Bridge', level: 3, test: true,
  blurb: 'A three-night test run on the Border March: shop, fight, rest, level up. Not canon for the friends\u2019 game.' };
const RIVER = Object.fromEntries([0, 1, 2, 5, 6, 7].flatMap(x => [[`${x},4`, 'wall'], [`${x},5`, 'wall']]));
export const NIGHTS = [
  { n: 1, id: 't1n1', adventure: 't1', title: 'The Mother of Grudges', place: 'Grudge Bridge \u00b7 the Border March', bg: 'forest', time: 'Dusk', shop: 'frontier',
    prose: [  // Wes-approved sample (Nov 13 2026), verbatim: the target voice for every night (phase0/VOICE.md)
      'The road out of Teslandia wandered the way good roads do, in no particular hurry, until it reached a river the color of weak tea and simply stopped, as if it had decided it had done enough for one day. The only way across was **Grudge Bridge**, an old stone thing worn soft in the middle by a few hundred years of carts. On the near bank, under a patched tarp hung with saucepans that clinked whenever the breeze felt chatty, the **Mother of Grudges** was minding the last honest stall before the gray. She had a kettle on. She always had a kettle on, partly for the tea and partly because nothing makes a customer feel welcome like steam.',
      'Across the water, someone had put up a tollhouse overnight, which was rude, and had painted it the exact gray of a form you have lost, which was ruder. Its banner read **THIS BRIDGE IS SHARED PROPERTY. TOLL: EVERYTHING.** A line of refugees waited on your side of the river with their savings sewn into their coat linings, and they were trying very hard not to look at it.',
      'Thimbleby was a day\u2019s walk past that tollhouse. Commissar Gulpwell\u2019s seal was stamped on every plank, and the Mother of Grudges, pouring you a cup without being asked, said she had a few things to say about that.',
    ],
    quote: { who: 'the Mother of Grudges', text: '\u201cCoin, yes, dear. Ration tokens, never, not while I\u2019ve breath in me. And I\u2019ll knock a copper off for every grudge you bring me against that tollhouse, so do think hard.\u201d' },
    moves: [
      { id: 'grudge', label: 'Bring the Mother a grudge', tags: ['talk'], check: { skill: 'persuasion', dc: 9 }, hint: 'She collects them. Tell her a good one about Gulpwell.',
        success: { text: 'She laughs until one of the saucepans lets go of the tarp and rolls off toward the river, and while you are both watching it go she presses a warm little potion into your hand. \u201cOn the house, love. Use it on the bridge, not on me.\u201d', effects: [{ item: { id: 'potion_of_healing' }, why: 'a grudge well told' }, { xp: 25, who: 'self', why: 'won over the Mother of Grudges' }] },
        failure: { text: 'She has heard that one, it turns out, and from a better teller. She tells you a fresh grudge of her own, which is mostly about you, and charges you a gold for the privilege with the sweetest smile on the March.', effects: [{ coin: -100, who: 'self', why: 'a grudge fee' }] } },
      { id: 'scout', label: 'Scout the tollhouse', tags: ['notice'], check: { skill: 'perception', dc: 14 }, hint: 'Count the clerks. Find the sergeant.',
        success: { text: 'From a comfortable spot behind the saucepans you count two Toll Clerks with clipboards, one Toll Sergeant with a stamp the size of a Sunday ham, and, halfway across, a loose plank that you tuck away in your memory the way you would tuck a coin into your boot.', effects: [{ flag: 'toll_scouted', flagText: 'you know the tollhouse\u2019s numbers' }, { xp: 25, who: 'self', why: 'scouted the tollhouse' }] },
        failure: { text: 'A clerk catches you looking and stamps a form in your general direction with great ceremony. You have no idea what it means, which, you suspect, is exactly what it is for.', effects: [] } },
      { id: 'refugees', label: 'Help the refugees in line', tags: ['risky'], check: { skill: 'medicine', dc: 9 }, hint: 'Feet, fevers, and a goat with opinions.',
        success: { text: 'You spend a gentle hour bandaging blistered feet and talking a goat down from its opinions. Afterward a grandmother from Thimbleby pats your hand and, over a shared heel of bread, tells you that Gulpwell keeps the Great Ledger in a vault under the counting hall.', effects: [{ flag: 'ledger_vault', flagText: 'the Great Ledger is under Thimbleby\u2019s counting hall' }, { xp: 25, who: 'self', why: 'cared for the refugees' }] },
        failure: { text: 'The goat has the better of the argument, as goats usually do, and you spend the rest of the evening smelling faintly of goat. It is, at least, an honest smell, and the children think it is the funniest thing they have seen all week.', effects: [] } },
      { id: 'ledger', label: 'Read the toll notice', tags: ['lore'], check: { skill: 'investigation', dc: 14 }, hint: 'Gray paperwork always has a loophole.',
        success: { text: 'Somewhere around page thirty, with the light going gold, you find it: clause 9, subsection \u201cc\u201d, which waives the toll for anyone who has already died. Technically, every one of you has. You fold the notice up very neatly and decide to mention this, loudly and with feeling, just before you hit someone.', effects: [{ inspiration: true, why: 'found clause 9(c)' }] },
        failure: { text: 'The notice runs to forty pages, and every one of them, in a lovely careful hand, says \u201csee previous page.\u201d You admire the penmanship, at least.', effects: [] } },
    ],
    freeDc: 14, absentText: 'Browses the Mother\u2019s stall for a pleasant hour, admires every saucepan, and buys nothing, which she notices. No roll.',
    after: { startBattle: { name: 'The Toll of the Great Ledger', map: { w: 8, h: 10, water: true, terrain: { ...RIVER, '3,7': 'difficult', '4,7': 'difficult' }, legend: { floor: 'bank / bridge', difficult: 'loose planks (difficult)', wall: 'river (no footing)' } },
      partyPos: [[2, 1], [3, 1], [4, 1], [5, 1]],
      foes: [{ monster: 'tough', name: 'Toll Sergeant', pos: [4, 8], boss: true, uid: 'tsgt' }, { monster: 'bandit', name: 'Toll Clerk 1', pos: [3, 7], uid: 'tc1' }, { monster: 'bandit', name: 'Toll Clerk 2', pos: [4, 6], uid: 'tc2' }],
      loot: { coin: 2400 } } },
    next: 'As the kettle comes to the boil, the Toll Sergeant steps out onto the bridge and lifts his stamp like a man who has been waiting all day for this. Battle orders are due tomorrow by 9:00 PM PT.' },
  { n: 2, id: 't1n2', adventure: 't1', title: 'The Toll of the Great Ledger', place: 'Grudge Bridge \u00b7 the Border March', bg: 'forest', time: 'Night', battle: true,
    prose: [
      'The **Toll Sergeant** planted himself in the middle of the bridge with a stamp in one fist and a club in the other, and the look of a man who had never once been told no in writing. Two **Toll Clerks** flanked him, holding their clipboards up like shields. Below, the river hurried past far too fast to swim, and the bridge, for all its centuries, was only two squares wide.',
      'This was going to be a real fight, because under all that paperwork the clerks had crossbows. Set your orders for this round; the fight stops after one round, or earlier if an ally goes down. If you win, there is time for a **short rest** on the warm stones of the bridge before night falls, so decide now how many Hit Point Dice you would spend.',
    ],
    quote: { who: 'Toll Sergeant', text: '\u201cHalt! Everything you own is now everyone\u2019s, and as it happens, I am everyone.\u201d' },
    moves: [], freeDc: 14, absentText: 'Fights on their preset stance, steady and unhurried, the way they would have wanted.',
    after: { victory: { effects: [{ xp: 1800, why: 'Grudge Bridge reopened' }], rest: 'short' } },
    next: 'Grudge Bridge is open again, and the first refugee cart rattles across it before the dust has even settled. Tomorrow you camp underneath it, and you have earned a level. Choose your level-up by 9:00 PM PT.' },
  { n: 3, id: 't1n3', adventure: 't1', title: 'Camp under Grudge Bridge', place: 'Under Grudge Bridge \u00b7 the Border March', bg: 'forest', time: 'Night',
    prose: [
      'You made camp under the bridge, in the dry hollow beneath the first arch where the refugees couldn\u2019t see you being tired. The stones still held a little of the day\u2019s warmth. Somewhere above, the Mother of Grudges called down that rations were still for sale, and that she did not, would not, and had never once done credit. The river talked to itself all evening, and the tollhouse strongbox sat by the fire, still locked, looking pleased with itself.',
      'Tonight is a **long rest**: a ration each from your pack, water from the river, and every slot back by morning. If you reached a new level, **level up** now on the Hero tab. Somebody really ought to keep watch, though, because a Committee Ledger Inspector was seen on the far bank at dusk, and he has a mule.',
    ],
    quote: { who: 'the Mother of Grudges', text: '\u201cGo on, sleep. I\u2019ll hold a grudge for you till morning, and keep it warm.\u201d' },
    moves: [
      { id: 'watch', label: 'Keep watch', tags: ['notice'], check: { skill: 'perception', dc: 14 }, hint: 'If nobody watches, the Inspector gets into camp.',
        success: { text: 'Around the third hour a lantern comes bobbing down the bank, and when it arrives you are already standing there, wrapped in a blanket, quite awake. The Inspector looks at you, then at his mule, then at you again, and the two of them leave the way they came, at a speed that does the mule credit.', effects: [{ xp: 25, who: 'self', why: 'kept the watch' }] },
        failure: { text: 'You watch the river very hard for a long while, and the river, being older and better at this, wins. Your chin finds your chest. Somewhere out in the dark, something with hooves is coming.', effects: [] } },
      { id: 'strongbox', label: 'Crack the toll strongbox', tags: ['risky'], check: { skill: 'sleight_of_hand', dc: 14 }, hint: 'Thieves\u2019 tools help. So does a rock.',
        success: { text: 'The lid comes up with a satisfied little click. Inside are the tolls taken from the refugees, each in its own small bag with a name on the label, written very neatly. You carry them back down the line one by one, and the grandmother from Thimbleby will not hear a word of argument: you keep one, and that is that.', effects: [{ coin: 1500, who: 'self', why: 'a grateful refugee' }, { xp: 25, who: 'self', why: 'returned the tolls' }] },
        failure: { text: 'The lock bites back with a spring-loaded snap. Your finger will be fine by morning. Your dignity has gone off down the river, and you watch it bob away with a certain fondness.', effects: [{ damage: '1', why: 'a spring-loaded lock' }] } },
      { id: 'stories', label: 'Tell the old stories by the fire', tags: ['talk'], check: { skill: 'performance', dc: 9 }, hint: 'The Tankard, the hollow, the climb, the World Breaker.',
        success: { text: 'The refugees laugh in all the right places and go very quiet at the hollow, and the fire pops as if it is listening too. By the end, three of them want to come to Thimbleby with you. You tell them, kindly, to wait for the second verse.', effects: [{ inspiration: true, why: 'a story that landed' }] },
        failure: { text: 'You get the World Breaker\u2019s name wrong twice, and a small child in the front row corrects you both times, very patiently. Everyone agrees it is still a good night, and the child has a second helping.', effects: [] } },
      { id: 'pray', label: 'Pray to Waukeen for the road', tags: ['lore'], check: { skill: 'religion', dc: 9 }, hint: 'She likes a receipt.',
        success: { text: 'A coin lying on the riverbank turns warm under your hand, warm as a cup of tea, and stays that way. Waukeen is listening, and, being Waukeen, she is keeping a tab.', effects: [{ flag: 'waukeen_road', flagText: 'Waukeen\u2019s blessing on the road to Thimbleby' }] },
        failure: { text: 'The coin stays just a coin, cool and quiet in your palm. It is, you decide, still a very nice coin, and you keep it anyway.', effects: [] } },
    ],
    freeDc: 14, absentText: 'Sleeps like the dead, which, to be fair, they have some experience of, and wakes up in a lovely mood. No roll.',
    after: { effects: [{ xp: 100, why: 'the test adventure, survived' }],
      rest: { kind: 'long', water: 'river', resume: true, interrupt: { atHour: 3, by: 'exertion', unlessMove: 'watch', text: 'the Ledger Inspector\u2019s mule comes trotting through camp, leaves with everyone\u2019s bedrolls, and takes a long, cold hour of coaxing to catch', risk: 'If nobody succeeds on Keep watch, the long rest is interrupted (it can resume, one hour longer).' } } },
    next: 'In the morning the mist lifts off the river, and Thimbleby\u2019s gray towers are a day\u2019s walk ahead. That is the end of the test adventure: tell the GM what broke.' },
];
