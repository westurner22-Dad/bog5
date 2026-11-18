// BoG V · Arc 1 · optional side quests (Phase 4). Two hooks planted on nights 1–2 pay off here:
//   relic_hook (night 1, the altar sigil)         → "The Coin of the World Maker" (Waukeen's lost relic)
//   spy_hook / spy_seen (nights 1–2, gray coat)   → "The Agent at Court" (who at court sells to the Committee)
// Each is two scene-nights the GM may slot between main nights (gm quest list / gm open <n> --scene <id>).
// Rewards follow ECONOMY.md: XP sized from the SRD 5.2.1 XP budget for a level 3 party of four, coin and one
// uncommon item per quest, plus a lasting perk. Every check is SRD (skill + DC on the fixed scale).
// King Elon stays offstage (C4). Nothing here is required for the main story.
const P = 'party';
export const QUESTS = {
  relic: { id: 'relic', title: 'The Coin of the World Maker', giver: 'Abbot Tallymere (Temple of Waukeen)', needs: ['relic_hook'],
    pitch: 'A lost relic of Waukeen, stamped with a hammer striking a world, somewhere under the gray lands. The temple pays for its return.',
    reward: '150 XP each, 50 gp each, a hoard (band 0-4) and one uncommon item, the temple\u2019s favor', scenes: ['q_relic_1', 'q_relic_2'] },
  spy: { id: 'spy', title: 'The Agent at Court', giver: 'Mags (the Leaking Tankard II)', needs: ['spy_hook', 'spy_seen'], anyOf: true,
    pitch: 'The gray-coated watcher reports to someone at court who sells to the Committee. Find them before the next requisition squad does.',
    reward: '150 XP each, a 75 gp bounty each, Sending Stones, and 10% off at the capital\u2019s guild stalls', scenes: ['q_spy_1', 'q_spy_2'] },
};
export const SCENES = [
  { id: 'q_relic_1', quest: 'relic', adventure: 'a1', title: 'The Undercroft Ledger', place: 'Temple of Waukeen \u00b7 the undercroft', bg: 'temple', time: 'Morning', shop: 'capital',
    prose: ['Abbot Tallymere leads you down to the undercroft, where the temple keeps every receipt it has ever written. Somewhere in here is the last entry that mentions the Coin of the World Maker.',
      'On the way back up you pass the Guildhall Bazaar. Anything in your cart is bought on the way.'],
    quote: { who: 'Abbot Tallymere', text: '\u201cBring it back and the temple will be very grateful. Gratitude is billed separately.\u201d' },
    moves: [
      { id: 'ledger', label: 'Search the old ledgers', tags: ['lore'], check: { skill: 'investigation', dc: 15 }, hint: 'Find the last place anyone wrote the Coin down.',
        success: { text: 'A water-stained entry from before the gray: \u201cCoin, World Maker, one. Lodged at the Counting-House of Lower Fenwick for safekeeping.\u201d Lower Fenwick is under the gray now.', effects: [{ flag: 'relic_map', flagText: 'the Coin was lodged at the Counting-House of Lower Fenwick' }, { xp: 25, who: 'self', why: 'found the entry' }] },
        failure: { text: 'You find four hundred receipts for candles. One of them is for you.', effects: [{ coin: -100, who: 'self', why: 'candle receipt, overdue' }] } },
      { id: 'pray', label: 'Pray at the old shrine', tags: ['faith'], check: { skill: 'religion', dc: 15 }, hint: 'Waukeen listens to people who pay attention.',
        success: { text: 'The shrine is warm. You hear a coin spin and land face up.', effects: [{ inspiration: true, why: 'Waukeen\u2019s nod' }] },
        failure: { text: 'You hear a coin spin and land on its edge. That is not an answer.', effects: [] } },
      { id: 'supplies', label: 'Ask the temple for supplies', tags: ['talk'], check: { skill: 'persuasion', dc: 10 }, hint: 'Pilgrims get a discount. You are pilgrims now.',
        success: { text: 'Brother Pim, still not over it, hands you a potion and a waterskin of holy water and asks you to never materialize near his mop again.', effects: [{ item: { id: 'potion_of_healing' }, why: 'temple stores' }, { item: { id: 'holy_water' }, why: 'temple stores' }] },
        failure: { text: 'Pim hands you an invoice for asking.', effects: [] } },
    ],
    freeDc: 15, absentText: 'Reads receipts in a corner and mutters about compound interest. No roll.',
    after: { rest: 'short', effects: [{ quest: { id: 'relic', status: 'started', title: 'The Coin of the World Maker' } }] },
    next: 'Next: the road into the gray, and the Counting-House of Lower Fenwick.' },
  { id: 'q_relic_2', quest: 'relic', adventure: 'a1', title: 'The Counting-House of Lower Fenwick', place: 'The gray lands \u00b7 Lower Fenwick', bg: 'underground', time: 'Dusk',
    prose: ['Lower Fenwick is a town-shaped smudge of gray. The Counting-House still stands, because banks always do. Its vault door is shut, and something behind it is still counting.',
      'Whatever you find in the vault is split by Need / Greed tomorrow (or goes to the party stash, if the party chose that).'],
    moves: [
      { id: 'lock', label: 'Open the vault door', tags: ['risky'], check: { skill: 'sleight_of_hand', dc: 15 }, hint: 'Old lock, old trap, new hands.',
        success: { text: 'The tumblers fall like a choir. The door opens without a sound, which is the most suspicious thing a bank has ever done.', effects: [{ xp: 25, who: 'self', why: 'cracked the vault' }] },
        failure: { text: 'The lock bites. A needle, rusted and very rude.', effects: [{ damage: '1d6', type: 'piercing', why: 'vault needle' }] } },
      { id: 'count', label: 'Out-count the counting thing', tags: ['lore'], check: { skill: 'arcana', dc: 15 }, hint: 'An old ward that tallies intruders. Make it lose count.',
        success: { text: 'You give it a sum it can\u2019t finish. It is still working on it when you leave.', effects: [{ xp: 25, who: 'self', why: 'broke the ward' }] },
        failure: { text: 'It counts you. It counts you again. You feel very slightly taxed.', effects: [{ coin: -500, who: 'self', why: 'taxed by a ward' }] } },
      { id: 'search', label: 'Search the deposit boxes', tags: ['notice'], check: { skill: 'perception', dc: 10 }, hint: 'The Coin is here somewhere. So is everything else.',
        success: { text: 'Box 1, row W: a plain coin with a hammer striking a world. It is warm.', effects: [{ flag: 'relic_found', flagText: 'you have the Coin of the World Maker' }] },
        failure: { text: 'You find the Coin anyway, eventually, in the last box you check. Of course.', effects: [{ flag: 'relic_found', flagText: 'you have the Coin of the World Maker' }] } },
    ],
    freeDc: 15, absentText: 'Keeps watch at the door of the Counting-House. No roll.',
    after: { rest: 'short', effects: [
      { quest: { id: 'relic', status: 'done', title: 'The Coin of the World Maker' } },
      { xp: 150, why: 'returned the Coin of the World Maker' },
      { coin: 5000, who: P, why: 'Tallymere\u2019s finder\u2019s fee' },
      { flag: 'temple_favor', flagText: 'the temple of Waukeen owes you a real favor now' },
      { loot: { hoard: '0-4', items: [{ id: 'cloak_of_protection', unid: true }] }, why: 'the vault of Lower Fenwick' } ] },
    next: 'Back to the main road. The temple will remember this, in writing.' },

  { id: 'q_spy_1', quest: 'spy', adventure: 'a1', title: 'The Courier\u2019s Route', place: 'Teslandia \u00b7 the capital', bg: 'city', time: 'Afternoon', shop: 'capital',
    prose: ['Mags has a name for the gray coat: **Fenn**, a courier who drinks one drink very slowly. Tonight he leaves the Tankard with a folded form. You follow.',
      'The route runs past the Guildhall Bazaar. Anything in your cart is bought on the way.'],
    moves: [
      { id: 'tail', label: 'Tail the courier', tags: ['risky'], check: { skill: 'stealth', dc: 15 }, hint: 'Stay two stalls behind.',
        success: { text: 'Fenn hands the form to a palace footman at the servants\u2019 gate. The footman wears the badge of the Office of Tariffs.', effects: [{ flag: 'spy_office', flagText: 'the leak runs through the Office of Tariffs' }, { xp: 25, who: 'self', why: 'tailed the courier' }] },
        failure: { text: 'Fenn spots you, buys a pastry, and waits for you to leave first. You both stand there for a long time.', effects: [] } },
      { id: 'pick', label: 'Lift the folded form', tags: ['risky'], check: { skill: 'sleight_of_hand', dc: 15 }, hint: 'A light touch in a crowd.',
        success: { text: 'The form is a list of the capital\u2019s grain stores, stamped with the Committee\u2019s gray circle. Someone at court signed it.', effects: [{ flag: 'spy_form', flagText: 'you hold a signed grain-store list' }, { xp: 25, who: 'self', why: 'lifted the form' }] },
        failure: { text: 'You lift his handkerchief instead. It is very clean.', effects: [] } },
      { id: 'ask', label: 'Ask around the stalls', tags: ['talk'], check: { skill: 'insight', dc: 10 }, hint: 'Merchants notice who buys and who just watches.',
        success: { text: 'A pepper seller says the gray coat has been paid in palace silver for weeks.', effects: [{ xp: 25, who: 'self', why: 'asked the right stall' }] },
        failure: { text: 'Everyone sells you pepper.', effects: [{ coin: -100, who: 'self', why: 'pepper' }] } },
    ],
    freeDc: 15, absentText: 'Shops the bazaar and keeps an eye out. No roll.',
    after: { effects: [{ quest: { id: 'spy', status: 'started', title: 'The Agent at Court' } }] },
    next: 'Next: the Office of Tariffs, and whoever signs its forms.' },
  { id: 'q_spy_2', quest: 'spy', adventure: 'a1', title: 'The Office of Tariffs', place: 'The palace \u00b7 the Office of Tariffs', bg: 'city', time: 'Evening',
    prose: ['The Office of Tariffs is three rooms of stamps. Its deputy, **Undersecretary Quill**, is very polite and very nervous, and keeps a second set of seals in a drawer.',
      'The King\u2019s Steward has said that whoever proves the leak earns the Crown\u2019s thanks. The King himself is busy with the border.'],
    moves: [
      { id: 'press', label: 'Question the Undersecretary', tags: ['talk'], check: { skill: 'intimidation', dc: 15 }, hint: 'Polite pressure, then less polite pressure.',
        success: { text: 'Quill folds in under a minute and names his handler: a Committee \u201ctrade attach\u00e9\u201d in the gray.', effects: [{ flag: 'spy_handler', flagText: 'the leak\u2019s handler is a Committee trade attach\u00e9' }, { xp: 25, who: 'self', why: 'broke the Undersecretary' }] },
        failure: { text: 'Quill offers you tea, a form to complain about him, and nothing else.', effects: [] } },
      { id: 'drawer', label: 'Search the drawer', tags: ['notice'], check: { skill: 'investigation', dc: 15 }, hint: 'Nobody needs two sets of seals.',
        success: { text: 'A second seal with the gray circle cut into its back. That is the proof.', effects: [{ flag: 'spy_proof', flagText: 'you hold the Committee seal' }, { xp: 25, who: 'self', why: 'found the seal' }] },
        failure: { text: 'Stamps. More stamps. A stamp that says STAMP.', effects: [] } },
      { id: 'steward', label: 'Bring it to the Steward', tags: ['talk'], check: { skill: 'persuasion', dc: 10 }, hint: 'Make the case cleanly.',
        success: { text: 'The Steward reads it twice, says \u201cthe Crown thanks you,\u201d and means it.', effects: [{ inspiration: true, why: 'the Crown\u2019s thanks' }] },
        failure: { text: 'The Steward reads it once and asks you to fill in Form 9 in triplicate. He believes you, though.', effects: [] } },
    ],
    freeDc: 15, absentText: 'Waits outside the Office of Tariffs and counts stamps through the window. No roll.',
    after: { effects: [
      { quest: { id: 'spy', status: 'done', title: 'The Agent at Court' } },
      { xp: 150, why: 'exposed the leak at court' },
      { coin: 7500, who: P, why: 'the Steward\u2019s bounty' },
      { flag: 'guild_discount', flagText: 'the guild stalls give you 10% off in the capital' },
      { loot: { items: [{ id: 'sending_stones' }] }, why: 'a gift from the Steward' } ] },
    next: 'Back to the main road, with friends at court.' },
];
// which side quests the party can take, from story flags and quest status
export function questBoard(story = {}) {
  const f = story.flags || {}; const q = story.quests || {};
  return Object.values(QUESTS).map(Q => { const has = Q.anyOf ? Q.needs.some(k => f[k]) : Q.needs.every(k => f[k]); const st = q[Q.id]?.status || (has ? 'available' : 'locked');
    const nextScene = st === 'done' ? null : st === 'started' ? Q.scenes[1] : Q.scenes[0]; return { ...Q, status: st, nextScene }; });
}
export const sceneById = id => SCENES.find(s => s.id === id);
