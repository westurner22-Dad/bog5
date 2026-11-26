// BoG V · Current Missions, Teslandia guild-hall board stock, and write-in suggestions.
// Derived from content + existing story flags / story.quests. No new save fields.
import { questBoard } from './sidequests.js';

export const SIDE_QUEST_CAP = 2;
export const MAIN_QUEST_ID = 'harold_urn';
// Done only when a future resolve sets this flag. The older harold_urn flag is lore, not "recovered".
export const MAIN_QUEST_DONE = 'urn_recovered';

export const MAIN_QUEST = {
  id: MAIN_QUEST_ID,
  kind: 'main',
  title: "Harold's Urn",
  pitch: "Recover Harold's urn from Commissar Gulpwell's office at the counting hall in Thimbleby before it's melted down. Comptroller Tally Brisk signs every page under him.",
  place: 'Thimbleby \u00b7 the counting hall',
  writeIn: "Scout the counting hall from the square and look for a way at Harold's urn in Gulpwell's office before it is melted down.",
};

// Short 1–2 night jobs for the Teslandia guild board. Authored DCs use the v2 numbers (9/14/19);
// applyDcScale remaps them when a scene is opened (v3: Easy 6 / Medium 11 / Hard 16 from Night 38 on).
export const BOARD_QUESTS = [
  { id: 'late_hours', title: 'Office Hours', nights: 1, place: 'Thimbleby \u00b7 the inn',
    hook: 'A junior clerk will talk about the hall if someone buys the next round.',
    pitch: 'Learn when Gulpwell and Tally Brisk keep office hours, and where condemned plate is kept.',
    skill: 'persuasion', dc: 14, word: 'Medium', reward: '25 XP and a clear read on office hours',
    writeIn: "I'll buy a junior clerk a drink and learn when Gulpwell and Tally Brisk keep office hours, and where the urn is kept.",
    needs: 'guild_hall', scenes: ['q_board_late_hours'] },
  { id: 'melt_day', title: 'The Melt Day', nights: 2, place: 'Thimbleby \u00b7 the hall annex',
    hook: 'Someone in the annex keeps the furnace schedule for condemned plate.',
    pitch: 'Find out when the hall furnace is due to take the condemned plate \u2014 including Harold\'s urn.',
    skill: 'investigation', dc: 14, word: 'Medium', reward: '25 XP and the melt day',
    writeIn: "I'll ask around the annex and find out when the hall furnace is scheduled to melt the condemned plate.",
    needs: 'guild_hall', scenes: ['q_board_melt_day'] },
  { id: 'short_weights', title: 'Short Weights', nights: 1, place: 'Thimbleby \u00b7 the bakehouse',
    hook: 'The baker swears the hall\'s grain weights come up light.',
    pitch: 'Check the hall\'s grain weights against a honest measure and see who has been shorting the sacks.',
    skill: 'investigation', dc: 14, word: 'Medium', reward: '25 XP and 2 gp',
    writeIn: "I'll check the baker's complaint that the counting hall's grain weights come up light.",
    needs: 'guild_hall', scenes: ['q_board_short_weights'] },
  { id: 'hold_marks', title: 'False Hold-Marks', nights: 2, place: 'Thimbleby \u00b7 the inn yard',
    hook: 'Someone is chalking official-looking hold-marks on honest wagons in the yard.',
    pitch: 'Find who is forging the official chalk marks, without walking the party out of town.',
    skill: 'investigation', dc: 14, word: 'Medium', reward: '25 XP and a name',
    writeIn: "I'll look over the chalk hold-marks in the inn yard and find out who has been forging the official hand.",
    needs: 'guild_hall', scenes: ['q_board_hold_marks'] },
  { id: 'pump_rights', title: 'The Pump Dispute', nights: 1, place: 'Thimbleby \u00b7 the square',
    hook: 'Two stalls claim the same hour at the village pump and are about to come to blows.',
    pitch: 'Settle the pump-hour dispute before someone tips a stall into the trough.',
    skill: 'persuasion', dc: 14, word: 'Medium', reward: '25 XP and a quieter square',
    writeIn: "I'll settle the dispute between the two stalls that both claim the same hour at the pump.",
    needs: 'guild_hall', scenes: ['q_board_pump_rights'] },
  { id: 'lame_horse', title: 'A Lame Horse in the Yard', nights: 1, place: 'Thimbleby \u00b7 the inn yard',
    hook: 'A carter\'s horse went lame behind the inn and will not take the afternoon post.',
    pitch: 'See to the lame horse, and earn a favor that still keeps the party in Thimbleby.',
    skill: 'medicine', dc: 14, word: 'Medium', reward: '25 XP and a carter\'s favor',
    writeIn: "I'll see to the lame horse in the inn yard and get it standing if I can.",
    needs: 'guild_hall', scenes: ['q_board_lame_horse'] },
  { id: 'night_stamp', title: 'The Dusk Stamp', nights: 1, place: 'Thimbleby \u00b7 the counting hall',
    hook: 'A traveler needs a counting-hall stamp before the doors close, and the clerks have already gone in.',
    pitch: 'Get a hall stamp for a traveler before dusk, by asking or by slipping in.',
    skill: 'persuasion', dc: 14, word: 'Medium', reward: '25 XP and 1 gp',
    writeIn: "I'll try to get a counting-hall stamp for the traveler who needs one before the doors close at dusk.",
    needs: 'guild_hall', scenes: ['q_board_night_stamp'] },
  { id: 'day_book', title: 'The Walking Day-Book', nights: 2, place: 'Thimbleby \u00b7 the hall annex',
    hook: 'A clerk\'s day-book walked out of the annex and has not walked back.',
    pitch: 'Recover the missing day-book. It may still be in the square, or already in the wrong hands.',
    skill: 'investigation', dc: 14, word: 'Medium', reward: '25 XP and a look at a page',
    writeIn: "I'll look for the clerk's day-book that walked out of the hall annex.",
    needs: 'guild_hall', scenes: ['q_board_day_book'] },
];

function sceneTxt(q, part = 1) {
  const dc = q.dc;
  const last = part === q.nights || q.nights === 1;
  const id = q.scenes[part - 1] || (q.scenes[0] + '_2');
  return {
    id, quest: q.id, board: true, adventure: 'a1', title: last && q.nights > 1 ? q.title + ' (finish)' : q.title, place: q.place, bg: /inn/.test(q.place) ? 'tavern' : 'city', time: 'Afternoon',
    prose: [
      part === 1 ? (q.hook + ' ' + q.pitch) : ('The job is still open: ' + q.pitch),
      'This is a short guild-board job. Stay in Thimbleby. The main quest still stands: Harold\'s urn is in Gulpwell\'s office at the counting hall, pending melt-down.',
    ],
    quote: { who: 'A guild notice', text: `\u201c${q.title}. ${q.nights === 1 ? 'A day\'s work.' : 'A day or two, no more.'} Pay on proof.\u201d` },
    moves: [
      { id: 'job', label: q.writeIn, check: { skill: q.skill, dc }, success: { text: last ? 'The job comes off, more or less the way a short job should.' : 'You get a solid start on the job. One more short night should finish it.', effects: [{ xp: 25, who: 'self', why: 'guild-board job' }] }, failure: { text: 'It does not come off today, though the notice is still on the board tomorrow.', effects: [] } },
    ],
    freeDc: dc, absentText: 'Stays with the party and keeps an eye on the square.',
    after: { effects: [{ quest: { id: q.id, status: last ? 'done' : 'started', title: q.title } }] },
    next: last ? 'Back to the counting hall, and Harold\'s urn.' : 'One more short night should finish this, then back to the hall.',
  };
}
function allBoardScenes() {
  const out = [];
  for (const q of BOARD_QUESTS) {
    const scenes = q.scenes.slice();
    if (q.nights > 1 && scenes.length < 2) scenes.push(scenes[0] + '_2');
    q.scenes = scenes;
    for (let part = 1; part <= q.nights; part++) out.push(sceneTxt(q, part));
  }
  return out;
}
export const BOARD_SCENES = allBoardScenes();

export const TOWN_LOOT = {
  fenwick: { shop: 'fenwick', typical: 'Common village stock; two potions of healing; no uncommon magic.', coinHint: 'A light purse if a job pays in town, 1\u20132 gp each.' },
  tollford: { shop: 'tollford', typical: 'Post-town stock, a cure-wounds scroll, two potions of healing; no uncommon magic.', coinHint: 'A clerk\'s purse or a post-bag spill, 2\u20134 gp each.' },
};

export function inSettlement(scene = {}) {
  const p = `${scene.place || ''} ${scene.shop || ''} ${scene.bg || ''}`.toLowerCase();
  return !!(scene.shop || /thimbleby|capital|tankard|guild|city|town|hamlet|fenwick|tollford|square|inn|bazaar/.test(p));
}

// The Teslandia mission board is only at the capital guild hall, never in Thimbleby or "any town".
// Gate on the scene's place/title (or a content-only scene.guildHall flag). shop: 'capital' is the
// Guildhall Bazaar and is not enough. Nothing is written to the save.
export function atGuildHall(scene = {}) {
  if (scene && scene.guildHall === true) {
    return !/thimbleby/i.test(`${scene.place || ''} ${scene.title || ''}`);
  }
  const p = `${scene.place || ''} ${scene.title || ''}`.toLowerCase();
  if (!p || /thimbleby/.test(p) || /bazaar/.test(p)) return false;
  return /guild\s*hall|guildhall/.test(p);
}

export function mainQuestStatus(story = {}) {
  const f = story.flags || {};
  return f[MAIN_QUEST_DONE] ? 'done' : 'started';
}

export function startedSideCount(story = {}) {
  const longform = questBoard(story).filter(q => q.status === 'started').length;
  const q = story.quests || {};
  const board = BOARD_QUESTS.filter(b => q[b.id]?.status === 'started').length;
  return longform + board;
}

export function boardQuestStatus(q, story = {}, scene = {}) {
  const st = story.quests?.[q.id]?.status;
  if (st) return st;
  const open = (q.needs === 'guild_hall' || q.needs === 'settlement') ? atGuildHall(scene) : (q.needs || []).every(k => story.flags?.[k]);
  return open ? 'available' : 'locked';
}

export function listedBoardQuests(story = {}, scene = {}) {
  return BOARD_QUESTS.map(q => ({ ...q, kind: 'side', status: boardQuestStatus(q, story, scene) }));
}

export function currentMissions(story = {}, scene = {}) {
  const main = { ...MAIN_QUEST, status: mainQuestStatus(story) };
  const longform = questBoard(story).filter(q => q.status === 'started' || q.status === 'available').map(q => ({
    id: q.id, kind: 'side', title: q.title, pitch: q.pitch, reward: q.reward, status: q.status,
    writeIn: `We take the job: ${q.title}.`,
  }));
  const board = listedBoardQuests(story, scene);
  const sides = [...longform, ...board.filter(q => q.status === 'started' || q.status === 'available')];
  const started = sides.filter(q => q.status === 'started');
  const available = board.filter(q => q.status === 'available');
  const cap = SIDE_QUEST_CAP;
  return { main, active: started, available: atGuildHall(scene) ? available : [], cap, atCap: started.length >= cap, startedCount: started.length, showBoard: atGuildHall(scene) };
}

export function ideaById(id, story = {}, scene = {}) {
  return suggestedIdeas(story, scene).find(x => x.id === id) || listedBoardQuests(story, scene).find(x => x.id === id) || null;
}

export function suggestedIdeas(story = {}, scene = {}) {
  const m = currentMissions(story, scene);
  const out = [];
  const moves = Array.isArray(scene?.moves) ? scene.moves : [];
  if (m.main.status !== 'done' && moves.length) {
    for (const mv of moves.slice(0, 3)) {
      out.push({ id: 'move:' + mv.id, kind: 'idea', missionId: MAIN_QUEST_ID, mission: 'Main quest', label: mv.label, hint: mv.hint || m.main.pitch, text: mv.label });
    }
  }
  if (!out.length && m.main.status !== 'done') {
    out.push({ id: 'main', kind: 'idea', missionId: MAIN_QUEST_ID, mission: 'Main quest', label: m.main.writeIn, hint: m.main.pitch, text: m.main.writeIn });
  }
  for (const q of m.active) {
    if (out.length >= 3) break;
    const text = q.writeIn || `We keep at the job: ${q.title}.`;
    out.push({ id: 'side:' + q.id, kind: 'idea', missionId: q.id, mission: q.title, label: text, hint: q.pitch, text });
  }
  return out.slice(0, 3);
}

export function pickWriteIn(id, story = {}, scene = {}) {
  const idea = ideaById(id, story, scene);
  if (idea?.text) return idea.text;
  if (idea?.writeIn) return idea.writeIn;
  return '';
}

const SKILL_NAME = { athletics: 'Athletics', acrobatics: 'Acrobatics', sleight_of_hand: 'Sleight of Hand', stealth: 'Stealth', arcana: 'Arcana', history: 'History', investigation: 'Investigation', nature: 'Nature', religion: 'Religion', animal_handling: 'Animal Handling', insight: 'Insight', medicine: 'Medicine', perception: 'Perception', survival: 'Survival', deception: 'Deception', intimidation: 'Intimidation', performance: 'Performance', persuasion: 'Persuasion' };

export function skillName(skill) {
  const s = String(skill || '').trim();
  if (!s) return '';
  return SKILL_NAME[s] || s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

// Recap line: "Stealth \u00b7 Medium (DC 11)"
export function ruledCheckLine(entry) {
  const c = entry?.check; if (!c) return null;
  const skill = skillName(c.skill || c.label);
  const word = entry.dcCall?.word || c.word;
  const dc = entry.dcCall?.dc ?? c.dc;
  if (!skill || word == null || dc == null) return null;
  return `${skill} \u00b7 ${word} (DC ${dc})`;
}

export function recapScope(result = {}) {
  const entries = result.entries || [];
  const battle = result.battle;
  const bigBattle = !!(battle && (battle.started || battle.round || battle.status || battle.cleared));
  const nat = entries.some(e => e.check && (e.check.nat === 20 || e.check.nat === 1));
  const namedBoss = /gulpwell|tally brisk|dylan|counting thing|director of subversion/i.test(`${battle?.name || ''} ${result.title || ''}`);
  if (bigBattle || namedBoss || nat) return 'full';
  return 'short';
}

export function isBossFight(result = {}, scene = {}) {
  if (scene?.battle && (scene.after?.startBattle?.foes || []).some(f => f.boss)) return true;
  const name = `${result?.battle?.name || ''} ${scene?.title || ''} ${result?.title || ''}`;
  return /gulpwell|director of subversion|counting thing/i.test(name) || !!(result?.battle && (result.battle.boss || result.battle.hasBoss));
}
