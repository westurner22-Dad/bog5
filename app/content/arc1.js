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
      { id: 'haggle', label: 'Haggle the bill down', tags: ['talk'], check: { skill: 'persuasion', dc: 14 }, hint: 'Charm, guilt, theology: whatever works on an accountant.',
        success: { text: 'Tallymere crosses out the total and writes \u201cone favor, to be named later.\u201d He seems happier with that. Bankers love an open position.', effects: [{ flag: 'temple_favor', flagText: 'the temple of Waukeen owes you, or you owe it; the paperwork is unclear' }, { xp: 25, who: 'self', why: 'talked down a cleric of the coin' }] },
        failure: { text: 'Tallymere nods sympathetically and adds a line item: \u201cHaggling, time spent on.\u201d Each of you pays five gold to make him stop writing.', effects: [{ coin: -500, who: 'party', why: 'the altar bill' }] } },
      { id: 'sigil', label: 'Study the sigil on the altar', tags: ['lore'], check: { skill: 'religion', dc: 9 }, hint: 'The gold under you has a mark that is not Waukeen\u2019s usual coin.',
        success: { text: 'Under Waukeen\u2019s coin is a second mark: a hammer striking a world. The World Maker. The acolytes whisper about a lost relic, the Coin of the World Maker, somewhere in the gray lands.', effects: [{ flag: 'relic_hook', flagText: 'side quest: the Coin of the World Maker' }, { xp: 25, who: 'self', why: 'read the World Maker\u2019s mark' }] },
        failure: { text: 'It\u2019s a coin. On a coin. You decide it means money, which, in this temple, is not wrong.', effects: [] } },
      { id: 'watcher', label: 'Size up the man in the gray coat', tags: ['notice'], check: { skill: 'insight', dc: 14 }, hint: 'Nobody reads a hymnal upside down for fun.',
        success: { text: 'He isn\u2019t a worshipper. He\u2019s counting you, and he leaves the moment he has a number. On his cuff, a tiny ink stamp: a gray circle. Somebody at court is selling to the Committee.', effects: [{ flag: 'spy_hook', flagText: 'side quest: the Agent at Court' }, { xp: 25, who: 'self', why: 'spotted the watcher' }] },
        failure: { text: 'He seems like a very devout man with an unusual reading style. You give him a thumbs up. He gives you one back, and writes something down.', effects: [] } },
      { id: 'slip', label: 'Slip out while he\u2019s reading', tags: ['risky'], check: { skill: 'stealth', dc: 14 }, hint: 'Dine and dash, but for resurrection.',
        success: { text: 'You are out the side door before Tallymere reaches line item forty. You also somehow have a pastry from the offering plate.', effects: [{ item: { id: 'rations', qty: 1 }, why: 'a temple pastry' }, { xp: 25, who: 'self', why: 'escaped the bill' }] },
        failure: { text: 'Brother Pim, still traumatized, catches you by the collar. Tallymere adds \u201cattempted departure\u201d to the bill. Ten gold.', effects: [{ coin: -1000, who: 'self', why: 'attempted departure fee' }] } },
    ],
    freeDc: 14, absentText: 'Still groggy from being reforged, stays on the altar and lets the others do the talking. No roll.',
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
      { id: 'mags', label: 'Make it up to Mags', tags: ['talk'], check: { skill: 'persuasion', dc: 9 }, hint: 'Apologize. Grovel. Tip.',
        success: { text: 'Mags cries, then pretends it\u2019s the onions, then gives you the good mug. You feel unreasonably heroic.', effects: [{ inspiration: true, why: 'Mags forgave you (mostly)' }] },
        failure: { text: 'She hugs you and slaps you, in that order, then charges you for the slap. Two gold.', effects: [{ coin: -200, who: 'self', why: 'the slap tax' }] } },
      { id: 'board', label: 'Read the notice board', tags: ['lore'], check: { skill: 'investigation', dc: 9 }, hint: 'Small jobs, quick coin.',
        success: { text: 'Between a lost-goose poster and a guild dispute about who invented the spoon, you find a job that pays five gold up front: escort a refugee\u2019s savings out of the gray. You take the advance.', effects: [{ flag: 'board_jobs', flagText: 'notice-board jobs unlocked' }, { coin: 500, who: 'self', why: 'job advance' }] },
        failure: { text: 'You read the goose poster four times. The goose is still missing.', effects: [{ flag: 'board_jobs', flagText: 'notice-board jobs unlocked' }] } },
      { id: 'stranger', label: 'Watch the hooded stranger', tags: ['notice'], check: { skill: 'perception', dc: 14 }, hint: 'One drink. Two hours. No.',
        success: { text: 'Under the hood: the gray coat from the temple. He passes a folded form to someone outside the window, and the form is stamped with the Committee\u2019s circle. Something is about to happen.', effects: [{ flag: 'spy_seen', flagText: 'the watcher is a Committee courier' }, { xp: 25, who: 'self', why: 'tailed the watcher' }] },
        failure: { text: 'The stranger catches you staring and raises his glass. You raise yours. It\u2019s empty. Mags charges you for it anyway.', effects: [] } },
      { id: 'shelf', label: 'Ask about Harold\u2019s shelf', tags: ['lore'], check: { skill: 'history', dc: 9 }, hint: 'Something used to sit there.',
        success: { text: 'Mags tells it straight: a Committee requisition squad took Harold\u2019s urn at the border as \u201cshared property.\u201d It\u2019s on a ledger in Thimbleby now, in Commissar Gulpwell\u2019s office. She dusts the shelf every morning anyway.', effects: [{ flag: 'harold_urn', flagText: 'Harold\u2019s urn is in Gulpwell\u2019s office in Thimbleby' }, { xp: 25, who: 'self', why: 'learned where Harold is' }] },
        failure: { text: 'Mags just says \u201cnot tonight, love\u201d and pours you a double. You don\u2019t ask again.', effects: [] } },
    ],
    freeDc: 14, absentText: 'Sits at the bar, lets Mags yell at them, and eats an entire bowl of peanuts. No roll.',
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
      'It\u2019s a **bar brawl**, not a war: chairs, bottles, and a lot of paperwork. Set your brawl orders: where you move, what you do, and a standing order for when things go wrong. One round plays tonight, then the table stops for new orders. The brawl stops early if an ally goes down or new enemies arrive.',
    ],
    quote: { who: 'Requisition Sergeant', text: '\u201cNobody move! This is a peaceful, voluntary confiscation.\u201d' },
    moves: [], freeDc: 14, absentText: 'Fights on their preset stance.',
    after: { effects: [] },
    next: 'The bar brawl goes on. Orders for the next rounds are due tomorrow by 9:00 PM PT.' },

  { n: 4, id: 'a1n4', adventure: 'a1', title: 'The Taps Are Shared Property (cont.)', place: 'The Leaking Tankard II \u00b7 the capital', bg: 'tavern', time: 'Night', battle: true,
    prose: ['The brawl picks up exactly where it stopped: same blood, same spilled ale, same paperwork.'],
    moves: [], freeDc: 14, absentText: 'Fights on their preset stance.', after: { effects: [] }, next: 'Then: what the squad was really after, and the road to the Border March, where the first real battle waits.' },

  // Nights 5+ are GM-authored as needed; canned Arc 1 content ended at Night 4.
  { n: 5, id: 'a1n5', adventure: 'a1', title: 'The Taps Are Shared Property (cont.)', place: 'The Leaking Tankard II \u00b7 the capital', bg: 'tavern', time: 'Night', battle: true,
    prose: [
      'The brawl is still the same spilled-ale, Form 27-B affair. Before anyone takes a new order, the table pays out the hero turns Night 4 had already locked — the ones the engine skipped when the late clerks arrived.',
      'Yäest\u2019s Hideous Laughter ended: Stamp Clerk 3 had already made one of the Wisdom saves, so the spell dropped. The clerk stays prone until they stand, but the laughter is gone. Yäest then put Heat Metal on that nearest clerk. The 2d8 came up 6 and 5, but the clerk\u2019s Constitution save was 14 + 1 = 15 versus DC 12, and they took no fire. Gorlock\u2019s scimitar found Stamp Clerk 1: a Champion critical on a 19 (19 + 5 = 24 versus AC 12), Savage Attacker kept 11, 14 slashing, and the clerk dropped. Biggus walked the length of the bar to reach Gorlock; Clerk 3 took a disadvantaged opportunity swing on the way (3 / 18, 3 + 3 = 6 versus AC 19, a miss). Healing Hands put 7 hit points back on Gorlock (2d4: 3 and 4; 15 to 22). Boobington, leather off, attacked the nearest clerk with Poison Spray and missed (9 / 2 with disadvantage, 2 + 4 = 6 versus AC 12).',
      'The late clerks are still in the doorway. The Requisition Sergeant is up next. Set brawl orders: where you move, what you do, and a standing order for when things go wrong.',
    ],
    quote: { who: 'Requisition Sergeant', text: '\u201cYou can fill out the incident report after I confiscate the taps.\u201d' },
    moves: [], freeDc: 14, absentText: 'Fights on their preset stance.', after: { effects: [] },
    next: 'The brawl continues. The GM will author the next night when these orders resolve.' },
  { n: 6, id: 'a1n6', adventure: 'a1', title: 'Form 27-B, Page Two', place: 'The Leaking Tankard II \u00b7 the capital', bg: 'tavern', time: 'Night', shop: 'tankard',
    prose: [
      'The Requisition Sergeant is face-down in the spilled ale, and five clerks are piled around him like a dropped filing cabinet. Boobington\u2019s last Fire Bolt is still smoking on the sergeant\u2019s backside. Gorlock is standing on 1 HP and pure spite, and nobody has the heart to tell him to sit down.',
      '**Mags** steps over a clerk, retrieves her bottle, and surveys the damage: four tables, eleven chairs, one window, and the dignity of the Committee. Knuckles is stacking the unconscious clerks by height. Splurt is already charging them for the floor space.',
      'Something is off, though. That was a lot of muscle for a few kegs. The sergeant\u2019s satchel is bulging with paperwork, and Stamp Clerk 2 is groaning under a table, very much awake and very much hoping nobody notices.',
    ],
    quote: { who: 'Mags', text: '\u201cRight. Somebody explain to me why the Committee sent six men to steal BEER. And somebody pick up that clerk before Bucky eats his paperwork.\u201d' },
    moves: [
      { id: 'satchel', label: 'Search the sergeant\u2019s satchel', tags: ['lore'], check: { skill: 'investigation', dc: 9 }, hint: 'Paperwork never lies. It just bores you to death first.',
        success: { text: 'Under three copies of Form 27-B is a real order, stamped twice: \u201cLocate and requisition FOUR REFORGED PERSONS, last seen at the Temple of Waukeen. Taps optional.\u201d The squad wasn\u2019t here for the beer. It was here for you.', effects: [{ flag: 'squad_orders', flagText: 'the Committee squad was sent for the four of you, not the taps' }, { xp: 25, who: 'self', why: 'found the real requisition order' }] },
        failure: { text: 'You find forty-one blank forms, a half-eaten sandwich, and a paper cut that will haunt you for days.', effects: [] } },
      { id: 'clerk', label: 'Lean on the clerk under the table', tags: ['talk', 'risky'], check: { skill: 'intimidation', dc: 14 }, hint: 'He\u2019s already scared. Make it official.',
        success: { text: 'The clerk folds faster than a tax return. The squad reports to **Commissar Gulpwell** in Thimbleby, past the Border March, and he hands over his own stamped travel pass to make you go away. It is, technically, a voluntary donation.', effects: [{ flag: 'border_pass', flagText: 'a stamped Committee travel pass for the Border March' }, { xp: 25, who: 'self', why: 'broke the clerk' }] },
        failure: { text: 'You loom. The clerk wets himself, faints, and tells you nothing. Mags charges you a gold for the mop.', effects: [{ coin: -100, who: 'self', why: 'the mop fee' }] } },
      { id: 'cleanup', label: 'Help Mags put the Tankard back together', tags: ['work'], check: { skill: 'athletics', dc: 9 }, hint: 'Lift tables. Lift clerks. Lift spirits.',
        success: { text: 'You haul the bar upright, toss the clerks into the alley in alphabetical order, and Mags slips you three gold \u201cfor the labor, not the attitude.\u201d', effects: [{ coin: 300, who: 'self', why: 'Mags paid for the cleanup' }] },
        failure: { text: 'You lift the last good table, and the last good table becomes two bad tables. Two gold, says Mags, and she is not smiling.', effects: [{ coin: -200, who: 'self', why: 'broke the last good table' }] } },
      { id: 'ledger', label: 'Read the requisition ledger', tags: ['lore'], check: { skill: 'history', dc: 14 }, hint: 'Somewhere in here is a list of everything they\u2019ve stolen.',
        success: { text: 'Page nine, line twelve: \u201cURN, BRASS, ONE (1), CONTENTS: HAROLD. Held at Thimbleby pending melt-down.\u201d Pending melt-down. You show Mags, and she stops dusting.', effects: [{ flag: 'harold_urn', flagText: 'Harold\u2019s urn is in Gulpwell\u2019s office in Thimbleby' }, { flag: 'urn_deadline', flagText: 'the Committee plans to melt Harold\u2019s urn' }, { xp: 25, who: 'self', why: 'found Harold in the ledger' }] },
        failure: { text: 'The ledger is in Committee shorthand. You learn that someone, somewhere, requisitioned a goose. Possibly the goose.', effects: [] } },
    ],
    freeDc: 14, absentText: 'Sits on an unconscious clerk, drinks whatever survived the brawl, and lets the others handle it. No roll.',
    after: { rest: { kind: 'long', food: 'inn', water: 'inn' }, effects: [] },
    next: 'In the morning, a side quest: the Agent at Court, if you will have it, or the road to the Border March.' },

  // Night 20 (opened as a1n7): after the Agent at Court side quest. GM-authored Nov 19 2026.
  { n: 7, id: 'a1n7', adventure: 'a1', title: 'Back to the Main Road', place: 'The capital \u00b7 the palace steps', bg: 'city', time: 'Night', shop: 'capital',
    prose: [
      'The Office of Tariffs is behind you, and it will be a while before anyone wants to work in it. Dylan Stewart is on the floor with his clipboard, and the Steward has already paid the bounty: seventy-five gold each, a pair of Sending Stones waiting to be divided, and ten percent off at the capital\u2019s guild stalls. Wes ruled that Gorlock could be raised, and the rest healed, free and at full health, with no lingering penalties. All four of you are on your feet again.',
      'Outside, the palace steps smell of wet stone and a little of what you left behind. The city is still awake. The main road heads toward the Border March, which is what the morning after the bar brawl had offered in the first place, once the Agent at Court was done.',
      'On the way you pass the Guildhall Bazaar. The stalls know your faces now, and the discount is real. Anything in your cart is bought on the way. The Sending Stones are still waiting for Need or Greed, if you have not settled them yet.',
    ],
    quote: { who: 'the Steward', text: '\u201cThe file is closed. The road is open. I would not linger on the steps; the laundry will have questions, and I would prefer not to answer them.\u201d' },
    moves: [
      { id: 'steward', label: 'Thank the Steward properly', tags: ['talk'], check: { skill: 'persuasion', dc: 9 }, hint: 'He already paid you. Manners still count.',
        success: { text: 'The Steward actually smiles, which looks like it hurts a little. He says the court will remember who cleared the office, and he has a courier ready if you ever need one.', effects: [{ inspiration: true, why: 'the Steward\u2019s good opinion' }] },
        failure: { text: 'You thank him three times, then a fourth, and he gently steers you toward the stairs before a fifth can happen.', effects: [] } },
      { id: 'clipboard', label: 'Look at Dylan\u2019s clipboard before you go', tags: ['lore'], check: { skill: 'investigation', dc: 9 }, hint: 'It is still in his hand. He does not need it now.',
        success: { text: 'Under a grease stain is the Writ of Fireball Approval, finally marked APPROVED, end of day, in a hand that gets shakier toward the bottom. Question forty-seven is blank. You keep it anyway.', effects: [{ xp: 25, who: 'self', why: 'found the approved writ' }] },
        failure: { text: 'You pick up the clipboard. You put the clipboard down. Some documents do not deserve a second reading.', effects: [] } },
      { id: 'road', label: 'Ask around about the road to the Border March', tags: ['lore'], check: { skill: 'survival', dc: 14 }, hint: 'Teamsters gossip. Guard sergeants gossip louder.',
        success: { text: 'A caravan master on the steps says the Border March is busy with Committee wagons, and Thimbleby is charging a \u201cvoluntary inspection fee\u201d at the gate. The road itself is open, if you do not mind being counted.', effects: [{ xp: 25, who: 'self', why: 'got a true report of the road' }] },
        failure: { text: 'You get three directions to the Border March and two of them are the same alley. You will find it in the morning, the way everyone does.', effects: [] } },
    ],
    freeDc: 14, absentText: 'Waits on the palace steps, breathes the night air, and lets the others do the talking. No roll.',
    after: { effects: [] },
    next: 'The road to the Border March is open.' },
];
export const night = n => NIGHTS.find(x => x.n === n);
