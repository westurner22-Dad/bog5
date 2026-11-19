// BoG V · Arc 1 · optional side quests (Phase 4). Two hooks planted on nights 1–2 pay off here:
//   relic_hook (night 1, the altar sigil)         → "The Coin of the World Maker" (Waukeen's lost relic)
//   spy_hook / spy_seen (nights 1–2, gray coat)   → "The Agent at Court" (who at court sells to the Committee)
// Each is three scene-nights the GM may slot between main nights (gm quest list / gm open <n> --scene <id>):
// two investigation scenes, then a boss fight (one round per night, same as other brawls).
// Rewards follow ECONOMY.md: XP sized from the SRD 5.2.1 XP budget for a level 3 party of four, coin and one
// uncommon item per quest, plus a lasting perk. Rewards pay out when the boss fight is won.
// Every check is SRD (skill + DC on the fixed scale).
// King Elon stays offstage (C4). Nothing here is required for the main story.
const P = 'party';
export const DYLAN_DEFEAT = 'Dylan Stewart, Director of Subversion, falls, and his last official act is a thoroughly unofficial one: he poops himself, comprehensively, as the light goes out of his eyes. The smell arrives a moment later, which is rude, and then it stays, which is ruder. His Committee coat will not be going back to the laundry.';
export const QUESTS = {
  relic: { id: 'relic', title: 'The Coin of the World Maker', giver: 'Abbot Tallymere (Temple of Waukeen)', needs: ['relic_hook'],
    pitch: 'A lost relic of Waukeen, stamped with a hammer striking a world, somewhere under the gray lands. The temple pays for its return.',
    reward: '150 XP each, 50 gp each, a hoard (band 0-4) and one uncommon item, the temple\u2019s favor',
    showdown: 'relic_showdown', scenes: ['q_relic_1', 'q_relic_2', 'q_relic_3'] },
  spy: { id: 'spy', title: 'The Agent at Court', giver: 'Mags (the Leaking Tankard II)', needs: ['spy_hook', 'spy_seen'], anyOf: true,
    pitch: 'The gray-coated watcher reports to someone at court who sells to the Committee. Find them before the next requisition squad does.',
    reward: '150 XP each, a 75 gp bounty each, Sending Stones, and 10% off at the capital\u2019s guild stalls',
    showdown: 'spy_showdown', scenes: ['q_spy_1', 'q_spy_2', 'q_spy_3'] },
};
export const SCENES = [
  { id: 'q_relic_1', quest: 'relic', adventure: 'a1', title: 'The Undercroft Ledger', place: 'Temple of Waukeen \u00b7 the undercroft', bg: 'temple', time: 'Morning', shop: 'capital',
    prose: ['Abbot Tallymere leads you down to the undercroft, where the temple keeps every receipt it has ever written. Somewhere in here is the last entry that mentions the Coin of the World Maker.',
      'On the way back up you pass the Guildhall Bazaar. Anything in your cart is bought on the way.'],
    quote: { who: 'Abbot Tallymere', text: '\u201cBring it back and the temple will be very grateful. Gratitude is billed separately.\u201d' },
    moves: [
      { id: 'ledger', label: 'Search the old ledgers', tags: ['lore'], check: { skill: 'investigation', dc: 14 }, hint: 'Find the last place anyone wrote the Coin down.',
        success: { text: 'A water-stained entry from before the gray: \u201cCoin, World Maker, one. Lodged at the Counting-House of Lower Fenwick for safekeeping.\u201d Lower Fenwick is under the gray now.', effects: [{ flag: 'relic_map', flagText: 'the Coin was lodged at the Counting-House of Lower Fenwick' }, { xp: 25, who: 'self', why: 'found the entry' }] },
        failure: { text: 'You find four hundred receipts for candles. One of them is for you.', effects: [{ coin: -100, who: 'self', why: 'candle receipt, overdue' }] } },
      { id: 'pray', label: 'Pray at the old shrine', tags: ['faith'], check: { skill: 'religion', dc: 14 }, hint: 'Waukeen listens to people who pay attention.',
        success: { text: 'The shrine is warm. You hear a coin spin and land face up.', effects: [{ inspiration: true, why: 'Waukeen\u2019s nod' }] },
        failure: { text: 'You hear a coin spin and land on its edge. That is not an answer.', effects: [] } },
      { id: 'supplies', label: 'Ask the temple for supplies', tags: ['talk'], check: { skill: 'persuasion', dc: 9 }, hint: 'Pilgrims get a discount. You are pilgrims now.',
        success: { text: 'Brother Pim, still not over it, hands you a potion and a waterskin of holy water and asks you to never materialize near his mop again.', effects: [{ item: { id: 'potion_of_healing' }, why: 'temple stores' }, { item: { id: 'holy_water' }, why: 'temple stores' }] },
        failure: { text: 'Pim hands you an invoice for asking.', effects: [] } },
    ],
    freeDc: 14, absentText: 'Reads receipts in a corner and mutters about compound interest. No roll.',
    after: { rest: 'short', effects: [{ quest: { id: 'relic', status: 'started', title: 'The Coin of the World Maker' } }] },
    next: 'Next: the road into the gray, and the Counting-House of Lower Fenwick.' },
  { id: 'q_relic_2', quest: 'relic', adventure: 'a1', title: 'The Counting-House of Lower Fenwick', place: 'The gray lands \u00b7 Lower Fenwick', bg: 'underground', time: 'Dusk',
    prose: ['Lower Fenwick is a town-shaped smudge of gray. The Counting-House still stands, because banks always do. Its vault door is shut, and something behind it is still counting.',
      'Whatever you find in the vault will have to wait: if the Counting Thing wakes, there will be a fight first.'],
    moves: [
      { id: 'lock', label: 'Open the vault door', tags: ['risky'], check: { skill: 'sleight_of_hand', dc: 14 }, hint: 'Old lock, old trap, new hands.',
        success: { text: 'The tumblers fall like a choir. The door opens without a sound, which is the most suspicious thing a bank has ever done.', effects: [{ xp: 25, who: 'self', why: 'cracked the vault' }] },
        failure: { text: 'The lock bites. A needle, rusted and very rude.', effects: [{ damage: '1d6', type: 'piercing', why: 'vault needle' }] } },
      { id: 'count', label: 'Out-count the counting thing', tags: ['lore'], check: { skill: 'arcana', dc: 14 }, hint: 'An old ward that tallies intruders. Make it lose count.',
        success: { text: 'You give it a sum it can\u2019t finish. It is still working on it when the vault starts to stand up anyway.', effects: [{ xp: 25, who: 'self', why: 'broke the ward' }] },
        failure: { text: 'It counts you. It counts you again. You feel very slightly taxed.', effects: [{ coin: -500, who: 'self', why: 'taxed by a ward' }] } },
      { id: 'search', label: 'Search the deposit boxes', tags: ['notice'], check: { skill: 'perception', dc: 9 }, hint: 'The Coin is here somewhere. So is everything else.',
        success: { text: 'Box 1, row W: a plain coin with a hammer striking a world. It is warm. Then the room starts counting out loud.', effects: [{ flag: 'relic_found', flagText: 'you have the Coin of the World Maker' }] },
        failure: { text: 'You find the Coin anyway, eventually, in the last box you check. Of course. Then the room starts counting out loud.', effects: [{ flag: 'relic_found', flagText: 'you have the Coin of the World Maker' }] } },
    ],
    freeDc: 14, absentText: 'Keeps watch at the door of the Counting-House. No roll.',
    after: { effects: [
      { quest: { id: 'relic', status: 'started', title: 'The Coin of the World Maker' } },
      { flag: 'relic_showdown', flagText: 'the Counting Thing is waking in the vault' } ],
      startBattle: { name: 'The Counting Thing', kind: 'battle', loot: { coin: 0 },
        map: { w: 8, h: 10, terrain: { '0,0': 'wall', '1,0': 'wall', '2,0': 'wall', '3,0': 'wall', '4,0': 'wall', '5,0': 'wall', '6,0': 'wall', '7,0': 'wall', '2,5': 'difficult', '5,5': 'difficult' } },
        partyPos: [[2, 2], [3, 2], [4, 2], [5, 2]],
        foes: [
          { monster: 'animated_armor', name: 'The Counting Thing', pos: [4, 7], boss: true, uid: 'counting',
            defeatText: 'The Counting Thing falls, coins spilling out of it in a messy, unfinished sum.' },
          { monster: 'animated_flying_sword', name: 'Counting Blade 1', pos: [2, 6], uid: 'blade1' },
          { monster: 'animated_flying_sword', name: 'Counting Blade 2', pos: [6, 6], uid: 'blade2' } ] } },
    next: 'The vault is not finished with you. The Counting Thing has started counting out loud. Battle orders are due tomorrow by 9:00 PM PT.' },
  { id: 'q_relic_3', quest: 'relic', adventure: 'a1', title: 'The Counting Thing', place: 'The Counting-House of Lower Fenwick \u00b7 the vault', bg: 'underground', time: 'Night', battle: true,
    prose: [
      'The vault stands up. Coins and ledgers knit themselves into a suit of armor that has been counting since before the gray, and two blades lift off the deposit boxes to help it finish the sum.',
      'It is a **boss fight**, one round tonight, then new orders. Set where you move, what you do, and a standing order for when things go wrong.',
    ],
    quote: { who: 'The Counting Thing', text: '\u201cOne, two, three\u2014intruders. Beginning audit.\u201d' },
    moves: [], freeDc: 14, absentText: 'Fights on their preset stance.',
    after: { victory: { rest: 'short', effects: [
      { quest: { id: 'relic', status: 'done', title: 'The Coin of the World Maker' } },
      { xp: 150, why: 'returned the Coin of the World Maker' },
      { coin: 5000, who: P, why: 'Tallymere\u2019s finder\u2019s fee' },
      { flag: 'temple_favor', flagText: 'the temple of Waukeen owes you a real favor now' },
      { loot: { hoard: '0-4', items: [{ id: 'cloak_of_protection', unid: true }] }, why: 'the vault of Lower Fenwick' } ] } },
    next: 'Back to the main road. The temple will remember this, in writing.' },

  { id: 'q_spy_1', quest: 'spy', adventure: 'a1', title: 'The Courier\u2019s Route', place: 'Teslandia \u00b7 the capital', bg: 'city', time: 'Afternoon', shop: 'capital',
    prose: ['Mags has a name for the gray coat: **Fenn**, a courier who drinks one drink very slowly. Tonight he leaves the Tankard with a folded form. You follow.',
      'The route runs past the Guildhall Bazaar. Anything in your cart is bought on the way.'],
    quote: { who: 'Mags', text: '\u201cHe leaves at dusk. Try not to let him see you seeing him.\u201d' },
    moves: [
      { id: 'tail', label: 'Tail the courier', tags: ['risky'], check: { skill: 'stealth', dc: 14 }, hint: 'Stay two stalls behind.',
        success: { text: 'Fenn hands the form to a palace footman at the servants\u2019 gate. The footman wears the badge of the Office of Tariffs.', effects: [{ flag: 'spy_office', flagText: 'the leak runs through the Office of Tariffs' }, { xp: 25, who: 'self', why: 'tailed the courier' }] },
        failure: { text: 'Fenn spots you, buys a pastry, and waits for you to leave first. You both stand there for a long time.', effects: [] } },
      { id: 'pick', label: 'Lift the folded form', tags: ['risky'], check: { skill: 'sleight_of_hand', dc: 14 }, hint: 'A light touch in a crowd.',
        success: { text: 'The form is a list of the capital\u2019s grain stores, stamped with the Committee\u2019s gray circle. Someone at court signed it.', effects: [{ flag: 'spy_form', flagText: 'you hold a signed grain-store list' }, { xp: 25, who: 'self', why: 'lifted the form' }] },
        failure: { text: 'You lift his handkerchief instead. It is very clean.', effects: [] } },
      { id: 'ask', label: 'Ask around the stalls', tags: ['talk'], check: { skill: 'insight', dc: 9 }, hint: 'Merchants notice who buys and who just watches.',
        success: { text: 'A pepper seller says the gray coat has been paid in palace silver for weeks.', effects: [{ xp: 25, who: 'self', why: 'asked the right stall' }] },
        failure: { text: 'Everyone sells you pepper.', effects: [{ coin: -100, who: 'self', why: 'pepper' }] } },
    ],
    freeDc: 14, absentText: 'Shops the bazaar and keeps an eye out. No roll.',
    after: { effects: [{ quest: { id: 'spy', status: 'started', title: 'The Agent at Court' } }] },
    next: 'Next: the Office of Tariffs, and whoever signs its forms.' },
  { id: 'q_spy_2', quest: 'spy', adventure: 'a1', title: 'The Office of Tariffs', place: 'The palace \u00b7 the Office of Tariffs', bg: 'city', time: 'Evening',
    prose: ['The Office of Tariffs is three rooms of stamps. Its deputy, **Undersecretary Quill**, is very polite and very nervous, and keeps a second set of seals in a drawer.',
      'The King\u2019s Steward has said that whoever proves the leak earns the Crown\u2019s thanks. The King himself is busy with the border. If you push this far, someone nastier than Quill may come through the door.'],
    moves: [
      { id: 'press', label: 'Question the Undersecretary', tags: ['talk'], check: { skill: 'intimidation', dc: 14 }, hint: 'Polite pressure, then less polite pressure.',
        success: { text: 'Quill folds in under a minute and names his handler: **Dylan Stewart, Director of Subversion**, the Committee\u2019s man behind the gray. Then there are boots in the corridor.', effects: [{ flag: 'spy_handler', flagText: 'the leak\u2019s handler is Dylan Stewart, Director of Subversion' }, { xp: 25, who: 'self', why: 'broke the Undersecretary' }] },
        failure: { text: 'Quill offers you tea, a form to complain about him, and nothing else. Then there are boots in the corridor anyway.', effects: [] } },
      { id: 'drawer', label: 'Search the drawer', tags: ['notice'], check: { skill: 'investigation', dc: 14 }, hint: 'Nobody needs two sets of seals.',
        success: { text: 'A second seal with the gray circle cut into its back. That is the proof. The office door opens before you can put it back quietly.', effects: [{ flag: 'spy_proof', flagText: 'you hold the Committee seal' }, { xp: 25, who: 'self', why: 'found the seal' }] },
        failure: { text: 'Stamps. More stamps. A stamp that says STAMP. Then the office door opens.', effects: [] } },
      { id: 'steward', label: 'Bring it to the Steward', tags: ['talk'], check: { skill: 'persuasion', dc: 9 }, hint: 'Make the case cleanly.',
        success: { text: 'You almost make it to the Steward. The Crown will have to thank you after the man in the doorway has been dealt with.', effects: [{ flag: 'spy_steward', flagText: 'the Steward is ready to hear the case once the office is clear' }] },
        failure: { text: 'The corridor is suddenly very full, and the Steward will have to wait.', effects: [] } },
    ],
    freeDc: 14, absentText: 'Waits outside the Office of Tariffs and counts stamps through the window. No roll.',
    after: { effects: [
      { quest: { id: 'spy', status: 'started', title: 'The Agent at Court' } },
      { flag: 'spy_showdown', flagText: 'Dylan Stewart has arrived to clean up the Office of Tariffs' } ],
      startBattle: { name: 'The Director of Subversion', kind: 'battle', loot: { coin: 0 },
        map: { w: 8, h: 10, terrain: { '0,0': 'wall', '1,0': 'wall', '2,0': 'wall', '3,0': 'wall', '4,0': 'wall', '5,0': 'wall', '6,0': 'wall', '7,0': 'wall', '1,5': 'difficult', '6,5': 'difficult' } },
        partyPos: [[2, 2], [3, 2], [4, 2], [5, 2]],
        foes: [
          { monster: 'bandit_captain', name: 'Dylan Stewart, Director of Subversion', pos: [4, 7], boss: true, uid: 'dylan', defeatText: DYLAN_DEFEAT },
          { monster: 'guard', name: 'Office Guard 1', pos: [2, 6], uid: 'guard1' },
          { monster: 'guard', name: 'Office Guard 2', pos: [6, 6], uid: 'guard2' },
          { monster: 'guard', name: 'Office Guard 3', pos: [4, 8], uid: 'guard3' } ] } },
    next: 'The office door is no longer a door so much as a problem. Dylan Stewart, Director of Subversion, has arrived with guards. Battle orders are due tomorrow by 9:00 PM PT.' },
  { id: 'q_spy_3', quest: 'spy', adventure: 'a1', title: 'The Director of Subversion', place: 'The palace \u00b7 the Office of Tariffs', bg: 'city', time: 'Night', battle: true,
    prose: [
      '**Dylan Stewart, Director of Subversion**, fills the office doorway as if he had always been meant to. He is the Committee\u2019s man behind Quill, and he has brought three office guards who look like they file people as readily as forms.',
      'It is a **boss fight**, one round tonight, then new orders. If he falls, the official record of his death is the engine line, and the GM must include it in the narration.',
    ],
    quote: { who: 'Dylan Stewart', text: '\u201cUndersecretary Quill has been overworked. I am here to close the file.\u201d' },
    moves: [], freeDc: 14, absentText: 'Fights on their preset stance.',
    after: { victory: { rest: 'short', effects: [
      { quest: { id: 'spy', status: 'done', title: 'The Agent at Court' } },
      { xp: 150, why: 'exposed the leak at court' },
      { coin: 7500, who: P, why: 'the Steward\u2019s bounty' },
      { flag: 'guild_discount', flagText: 'the guild stalls give you 10% off in the capital' },
      { loot: { items: [{ id: 'sending_stones' }] }, why: 'a gift from the Steward' } ] } },
    next: 'Back to the main road, with friends at court.' },
];
// which side quests the party can take, from story flags and quest status
export function questBoard(story = {}) {
  const f = story.flags || {}; const q = story.quests || {};
  return Object.values(QUESTS).map(Q => { const has = Q.anyOf ? Q.needs.some(k => f[k]) : Q.needs.every(k => f[k]); const st = q[Q.id]?.status || (has ? 'available' : 'locked');
    const nextScene = st === 'done' ? null : st === 'started' ? (Q.showdown && f[Q.showdown] && Q.scenes[2] ? Q.scenes[2] : Q.scenes[1]) : Q.scenes[0]; return { ...Q, status: st, nextScene }; });
}
export const sceneById = id => SCENES.find(s => s.id === id);
