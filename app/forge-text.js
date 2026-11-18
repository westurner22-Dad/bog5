// BoG V · Session 0 narration for the Forge. Built on Wes's locked canon (phase0/LOCKS.md, SETTING.md).
// Tone: BoG comedy, adult humor welcome. Soros is never the joke. King Elon stays offstage (C4).
// Voice (Phase 5 note 1, Wes Nov 13 2026): Merchant Crab-style cozy narration; see phase0/VOICE.md.
export const INTRO = [
  { k: 'You died.', t: 'Not a trick, and not a coma, though it would have been nicer if it were. The mace, the arrow, the slab, the wand: Soros took all four of you, one after another, in the hollow that used to be the Leaking Tankard, and he did not even look up from what he was doing.' },
  { k: 'You climbed.', t: 'Your souls fell a long way down into the cultivator realm, and then, because there was nothing else to do, you climbed. Breakthrough by breakthrough you fought your way up it, until at the very top you threw down Comrade Ruin, the World Breaker. For one long, golden moment you were gods, and it felt every bit as wonderful as it sounds. Someone may have cried a little. Nobody is saying who, and everyone is being very kind about it.' },
  { k: 'You chose to come back.', t: 'The World Maker, who builds worlds out of honest effort, fair trade and the quiet dignity of owning your own stuff, set down the hammer and offered you a choice: stay divine, or go home and stop Soros before the Great Sharing swallows everything. You chose home. It was the first heroic thing you did in this story, and you did it without even thinking twice.' },
  { k: 'Now: the Forge.', t: 'Gods, it turns out, are expensive, and mortal bodies are rather small. Between your spent divinity and the World Maker\u2019s craft there is enough to reforge one body each, but only to level 3, so pick the shape with care. You are going to live in it, bleed in it, and now and then fart in it during a stealth check, and you will want it to feel like home.' },
];
export const WAKE = 'The Forge goes quiet, the way a workshop does when the last hammer is set down. You open new eyes on cool marble that smells of incense and coin polish: the altar of Waukeen, in Teslandia, the last free kingdom. A kindly priest is already at your elbow, writing you a very reasonable invoice for the use of the altar.';
export const STEP = {
  forge: { eyebrow: 'Session 0 · The Forge', title: 'The World Maker\u2019s Forge' },
  name: { eyebrow: 'Step 2 of 12', title: 'Your name', say: '\u201cEvery soul needs a handle,\u201d says the World Maker, sleeves rolled to the elbow, the anvil glowing a comfortable orange behind him. \u201cMake it one you can shout across a battlefield. Or, failing that, one Mags will happily put on a tab.\u201d' },
  species: { eyebrow: 'Step 3 of 12', title: 'Choose your shape', say: 'The soul chooses the shape, the way a cat chooses the sunny spot on the floor. Anyone who came back a little brighter than they left is an Aasimar.' },
  class: { eyebrow: 'Step 4 of 12', title: 'Choose your calling', say: 'Three levels of power is the most the Forge can pour into a mortal frame without it spilling over the sides. Your subclass comes along with it, already stamped and ready.' },
  background: { eyebrow: 'Step 5 of 12', title: 'Who you were raised as', say: 'In the new life you have a past, too: whatever patient work trained these hands before the World Maker reached into them. It shapes your scores, your skills and your first feat.' },
  abilities: { eyebrow: 'Step 6 of 12', title: 'Ability scores', say: 'The World Maker hammers out the six measures of a body, one ringing stroke at a time. Pick the standard array or spend 27 points; your background adds its bonus on top.' },
  skills: { eyebrow: 'Step 7 of 12', title: 'Skills', say: 'These are the things your hands and head already know, the way you know the way home in the dark. Your background\u2019s skills are locked in; choose the rest.' },
  spells: { eyebrow: 'Step 8 of 12', title: 'Spells', say: 'This is the magic you carry out of the Forge, tucked in your pocket like a warm stone. Cantrips are yours forever; prepared spells can be changed after a long rest. Each one says what it does, and the full rules are a tap away.' },
  equipment: { eyebrow: 'Step 9 of 12', title: 'Starting equipment', say: 'Waukeen\u2019s temple keeps a vault for heroes, smelling pleasantly of oiled leather. Take a kit, or take the gold and shop (she will notice if you take both). Whatever you are left holding, King Elon\u2019s treasury sends a stipend that tops your purse up to 75 gp, so nobody walks onto the road poor.' },
  keepsake: { eyebrow: 'Step 10 of 12', title: 'Your keepsake', say: 'One small thing survived the death and the long climb with you. It has no stats, and it is not magic, and it matters anyway, the way small things do.' },
  look: { eyebrow: 'Step 11 of 12', title: 'Your look', say: 'Everyone comes out of the Forge looking a little epic. That is not vanity; that is the glow, and it shows most when you choose courage.' },
  party: { eyebrow: 'Step 12 of 12', title: 'Your party, and your sheet', say: 'The Forge shows you who will be standing beside you on the road, and, gently, what the four of you are still missing.' },
};
export const KEEPSAKE_IDEAS = ['a bottle cap from Doug\u2019s crown', 'a scrap of the Golden Contract', 'a chipped Leaking Tankard mug', 'a blue speaking-stone that no longer speaks', 'a ration token you refused to spend', 'a lock of Harold\u2019s urn ribbon'];
export const ROLE_HINT = {
  frontline: 'Nobody is built to stand in front. A Fighter, Paladin or Barbarian (or a Protector Cleric) keeps the squishy ones alive.',
  healer: 'No healing. A Cleric, Druid, Bard or Paladin, or Magic Initiate (Cleric) from the Acolyte background, fixes that.',
  blaster: 'Little spell damage. A Wizard, Sorcerer or Warlock hits crowds; a Druid or Cleric can too.',
  skills: 'No locks-and-traps expert. A Rogue (Expertise) or a Bard or Ranger covers it.',
  face: 'No talker. Someone with high Charisma and Persuasion or Deception will save you a lot of fights in Teslandia.',
  scout: 'Weak at range and on watch. A Ranger, Rogue with a bow, or anyone with good Perception helps.',
};
