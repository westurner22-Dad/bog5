// BoG V · Arc 1 · Adventure 1 "The Forge and the Coin" · opening nights, as data the nightly loop plays.
// Every check is SRD 5.2.1 (skill + DC); the player sees the difficulty word before rolling and the exact DC after.
// Effects are engine events (xp, coin in cp, item, flag, inspiration, damage). King Elon stays offstage (C4).
const party = { who: 'party' };
export const ADVENTURE = { id: 'a1', arc: 1, title: 'The Forge and the Coin', level: 3,
  blurb: 'Wake on Waukeen\u2019s altar, settle the bill, find Mags. Where you go next is up to you.' };

export const NIGHTS = [
  { n: 1, id: 'a1n1', adventure: 'a1', title: 'The Altar Bill', place: 'Temple of Waukeen \u00b7 Teslandia', bg: 'temple', time: 'Dawn',
    prose: [
      'You wake on a slab of warm gold, steaming faintly, wearing your new bodies and very little else. Above you a dome of stained glass shows Waukeen pouring coins into a grateful crowd. Somewhere a choir is singing a hymn about compound interest.',
      'A tall priest in a cassock embroidered with ledger lines clears his throat. This is the **Most Solvent Abbot Tallymere**, and he is holding a scroll that unrolls to the floor and keeps going.',
      'In the gallery, a man in a plain gray coat is watching you very hard while pretending to read a hymnal upside down.',
    ],
    quote: { who: 'Abbot Tallymere', text: '\u201cAltar, use of, by four resurrected persons: four hundred gold. Glow residue, removal of: twenty-five. Emotional damages to Brother Pim, who was mopping when you materialized: fifty. Payment is due on waking. You are awake.\u201d' },
    moves: [
      { id: 'haggle', label: 'Haggle the bill down', tags: ['talk'], check: { skill: 'persuasion', dc: 15 }, hint: 'Charm, guilt, theology: whatever works on an accountant.',
        success: { text: 'Tallymere crosses out the total and writes \u201cone favor, to be named later.\u201d He seems happier with that. Bankers love an open position.', effects: [{ flag: 'temple_favor', flagText: 'the temple of Waukeen owes you, or you owe it; the paperwork is unclear' }, { xp: 25, who: 'self', why: 'talked down a cleric of the coin' }] },
        failure: { text: 'Tallymere nods sympathetically and adds a line item: \u201cHaggling, time spent on.\u201d Each of you pays five gold to make him stop writing.', effects: [{ coin: -500, who: 'party', why: 'the altar bill' }] } },
      { id: 'sigil', label: 'Study the sigil on the altar', tags: ['lore'], check: { skill: 'religion', dc: 10 }, hint: 'The gold under you has a mark that is not Waukeen\u2019s usual coin.',
        success: { text: 'Under Waukeen\u2019s coin is a second mark: a hammer striking a world. The World Maker. The acolytes whisper about a lost relic, the Coin of the World Maker, somewhere in the gray lands.', effects: [{ flag: 'relic_hook', flagText: 'side quest: the Coin of the World Maker' }, { xp: 25, who: 'self', why: 'read the World Maker\u2019s mark' }] },
        failure: { text: 'It\u2019s a coin. On a coin. You decide it means money, which, in this temple, is not wrong.', effects: [] } },
      { id: 'watcher', label: 'Size up the man in the gray coat', tags: ['notice'], check: { skill: 'insight', dc: 15 }, hint: 'Nobody reads a hymnal upside down for fun.',
        success: { text: 'He isn\u2019t a worshipper. He\u2019s counting you, and he leaves the moment he has a number. On his cuff, a tiny ink stamp: a gray circle. Somebody at court is selling to the Committee.', effects: [{ flag: 'spy_hook', flagText: 'side quest: the Agent at Court' }, { xp: 25, who: 'self', why: 'spotted the watcher' }] },
        failure: { text: 'He seems like a very devout man with an unusual reading style. You give him a thumbs up. He gives you one back, and writes something down.', effects: [] } },
      { id: 'slip', label: 'Slip out while he\u2019s reading', tags: ['risky'], check: { skill: 'stealth', dc: 15 }, hint: 'Dine and dash, but for resurrection.',
        success: { text: 'You are out the side door before Tallymere reaches line item forty. You also somehow have a pastry from the offering plate.', effects: [{ item: { id: 'rations', qty: 1 }, why: 'a temple pastry' }, { xp: 25, who: 'self', why: 'escaped the bill' }] },
        failure: { text: 'Brother Pim, still traumatized, catches you by the collar. Tallymere adds \u201cattempted departure\u201d to the bill. Ten gold.', effects: [{ coin: -1000, who: 'self', why: 'attempted departure fee' }] } },
    ],
    freeDc: 15, absentText: 'Still groggy from being reforged, stays on the altar and lets the others do the talking. No roll.',
    after: { effects: [] },
    next: 'Tomorrow: the Leaking Tankard II, where Mags has been waiting a very long time to yell at you.' },

  { n: 2, id: 'a1n2', adventure: 'a1', title: 'Last Orders at the Tankard II', place: 'The Leaking Tankard II \u00b7 the capital', bg: 'tavern', time: 'Evening', shop: 'tankard',
    prose: [
      'The new Tankard is louder, cleaner and leaks in exactly the same places. Splurt is behind the bar. Bucky is under a table. Knuckles is arm-wrestling a man who is losing on purpose.',
      '**Mags** sees you, drops a full tray, hugs all four of you at once and then slaps each of you in turn for dying. Behind the bar is a shelf with nothing on it. She dusts it while she talks.',
      'A notice board by the door is thick with jobs. In the corner, a hooded stranger nurses one drink for a suspiciously long time.',
    ],
    quote: { who: 'Mags', text: '\u201cYou died. In MY tavern. And then you came back looking like THAT? You owe me a tab, an apology and a new floor. Sit down. I\u2019m so happy I could kill you.\u201d' },
    moves: [
      { id: 'mags', label: 'Make it up to Mags', tags: ['talk'], check: { skill: 'persuasion', dc: 10 }, hint: 'Apologize. Grovel. Tip.',
        success: { text: 'Mags cries, then pretends it\u2019s the onions, then gives you the good mug. You feel unreasonably heroic.', effects: [{ inspiration: true, why: 'Mags forgave you (mostly)' }] },
        failure: { text: 'She hugs you and slaps you, in that order, then charges you for the slap. Two gold.', effects: [{ coin: -200, who: 'self', why: 'the slap tax' }] } },
      { id: 'board', label: 'Read the notice board', tags: ['lore'], check: { skill: 'investigation', dc: 10 }, hint: 'Small jobs, quick coin.',
        success: { text: 'Between a lost-goose poster and a guild dispute about who invented the spoon, you find a job that pays five gold up front: escort a refugee\u2019s savings out of the gray. You take the advance.', effects: [{ flag: 'board_jobs', flagText: 'notice-board jobs unlocked' }, { coin: 500, who: 'self', why: 'job advance' }] },
        failure: { text: 'You read the goose poster four times. The goose is still missing.', effects: [{ flag: 'board_jobs', flagText: 'notice-board jobs unlocked' }] } },
      { id: 'stranger', label: 'Watch the hooded stranger', tags: ['notice'], check: { skill: 'perception', dc: 15 }, hint: 'One drink. Two hours. No.',
        success: { text: 'Under the hood: the gray coat from the temple. He passes a folded form to someone outside the window, and the form is stamped with the Committee\u2019s circle. Something is about to happen.', effects: [{ flag: 'spy_seen', flagText: 'the watcher is a Committee courier' }, { xp: 25, who: 'self', why: 'tailed the watcher' }] },
        failure: { text: 'The stranger catches you staring and raises his glass. You raise yours. It\u2019s empty. Mags charges you for it anyway.', effects: [] } },
      { id: 'shelf', label: 'Ask about Harold\u2019s shelf', tags: ['lore'], check: { skill: 'history', dc: 10 }, hint: 'Something used to sit there.',
        success: { text: 'Mags tells it straight: a Committee requisition squad took Harold\u2019s urn at the border as \u201cshared property.\u201d It\u2019s on a ledger in Thimbleby now, in Commissar Gulpwell\u2019s office. She dusts the shelf every morning anyway.', effects: [{ flag: 'harold_urn', flagText: 'Harold\u2019s urn is in Gulpwell\u2019s office in Thimbleby' }, { xp: 25, who: 'self', why: 'learned where Harold is' }] },
        failure: { text: 'Mags just says \u201cnot tonight, love\u201d and pours you a double. You don\u2019t ask again.', effects: [] } },
    ],
    freeDc: 15, absentText: 'Sits at the bar, lets Mags yell at them, and eats an entire bowl of peanuts. No roll.',
    after: {
      startBattle: { name: 'The Taps Are Shared Property', kind: 'brawl', loot: { coin: 0 }, map: { w: 8, h: 10, terrain: { '0,0': 'wall', '1,0': 'wall', '2,0': 'wall', '3,0': 'wall', '4,0': 'wall', '5,0': 'wall', '6,0': 'wall', '7,0': 'wall', '2,5': 'difficult', '5,5': 'difficult', '2,6': 'difficult', '5,6': 'difficult' } },
        partyPos: [[2, 2], [3, 2], [4, 2], [5, 2]],
        foes: [
          { monster: 'tough', name: 'Requisition Sergeant', pos: [3, 8], boss: true, uid: 'sgt' },
          { monster: 'bandit', name: 'Stamp Clerk 1', pos: [2, 8], uid: 'clerk1' },
          { monster: 'bandit', name: 'Stamp Clerk 2', pos: [4, 8], uid: 'clerk2' },
          { monster: 'bandit', name: 'Stamp Clerk 3', pos: [5, 9], uid: 'clerk3' } ],
        script: [{ round: 2, text: 'Two more clerks shoulder through the door waving Form 27-B (Seizure of Beverages)', add: [
          { monster: 'bandit', name: 'Late Clerk 1', pos: [3, 9], uid: 'clerk4' }, { monster: 'bandit', name: 'Late Clerk 2', pos: [4, 9], uid: 'clerk5' } ] }] } },
    next: 'The door bangs open. \u201cBy order of the Committee, these taps are shared property!\u201d It\u2019s a bar brawl. Brawl orders are due tomorrow by 9:00 PM PT.' },

  { n: 3, id: 'a1n3', adventure: 'a1', title: 'The Taps Are Shared Property', place: 'The Leaking Tankard II \u00b7 the capital', bg: 'tavern', time: 'Night', battle: true,
    prose: [
      'A **Requisition Sergeant** the size of a wardrobe fills the doorway, with three Stamp Clerks behind him holding clipboards like shields. Knuckles cracks his neck. Mags picks up a bottle by the neck.',
      'It\u2019s a **bar brawl**, not a war: chairs, bottles, and a lot of paperwork. Set your brawl orders: where you move, what you do, and a standing order for when things go wrong. Up to three rounds play tonight. The brawl stops early if an ally goes down or new enemies arrive.',
    ],
    quote: { who: 'Requisition Sergeant', text: '\u201cNobody move! This is a peaceful, voluntary confiscation.\u201d' },
    moves: [], freeDc: 15, absentText: 'Fights on their preset stance.',
    after: { effects: [] },
    next: 'The bar brawl goes on. Orders for the next rounds are due tomorrow by 9:00 PM PT.' },

  { n: 4, id: 'a1n4', adventure: 'a1', title: 'The Taps Are Shared Property (cont.)', place: 'The Leaking Tankard II \u00b7 the capital', bg: 'tavern', time: 'Night', battle: true,
    prose: ['The brawl picks up exactly where it stopped: same blood, same spilled ale, same paperwork.'],
    moves: [], freeDc: 15, absentText: 'Fights on their preset stance.', after: { effects: [] }, next: 'Then: what the squad was really after, and the road to the Border March, where the first real battle waits.' },

  // Nights 5+ are GM-authored as needed; canned Arc 1 content ended at Night 4.
  { n: 5, id: 'a1n5', adventure: 'a1', title: 'The Taps Are Shared Property (cont.)', place: 'The Leaking Tankard II \u00b7 the capital', bg: 'tavern', time: 'Night', battle: true,
    prose: [
      'The brawl is still the same spilled-ale, Form 27-B affair. Before anyone takes a new order, the table pays out the hero turns Night 4 had already locked — the ones the engine skipped when the late clerks arrived.',
      'Yäest\u2019s Hideous Laughter ended: Stamp Clerk 3 had already made one of the Wisdom saves, so the spell dropped. The clerk stays prone until they stand, but the laughter is gone. Yäest then put Heat Metal on that nearest clerk. The 2d8 came up 6 and 5, but the clerk\u2019s Constitution save was 14 + 1 = 15 versus DC 12, and they took no fire. Gorlock\u2019s scimitar found Stamp Clerk 1: a Champion critical on a 19 (19 + 5 = 24 versus AC 12), Savage Attacker kept 11, 14 slashing, and the clerk dropped. Biggus walked the length of the bar to reach Gorlock; Clerk 3 took a disadvantaged opportunity swing on the way (3 / 18, 3 + 3 = 6 versus AC 19, a miss). Healing Hands put 7 hit points back on Gorlock (2d4: 3 and 4; 15 to 22). Boobington, leather off, attacked the nearest clerk with Poison Spray and missed (9 / 2 with disadvantage, 2 + 4 = 6 versus AC 12).',
      'The late clerks are still in the doorway. The Requisition Sergeant is up next. Set brawl orders: where you move, what you do, and a standing order for when things go wrong.',
    ],
    quote: { who: 'Requisition Sergeant', text: '\u201cYou can fill out the incident report after I confiscate the taps.\u201d' },
    moves: [], freeDc: 15, absentText: 'Fights on their preset stance.', after: { effects: [] },
    next: 'The brawl continues. The GM will author the next night when these orders resolve.' },
];
export const night = n => NIGHTS.find(x => x.n === n);
