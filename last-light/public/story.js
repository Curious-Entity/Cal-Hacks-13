/* The story lives here. Edit dialogue and choice labels without touching the UI.
 * This module has no browser dependencies, so the rules can be tested on their own.
 * An AI director can later write dialogue from this state; keep action rules here.
 */
export const CHAPTERS = ['The photograph', 'A borrowed truth', 'A voice in the static', 'What we carry', 'Before daylight'];

export const SAVE_KEY = 'last-light-journey-v1';
export const CHARACTERS = {
  narrator: { name: 'The journey', role: 'Somewhere between here and home', initial: '✧' },
  mara: { name: 'Mara', role: 'The passenger who almost remembers', initial: 'M' },
  eli: { name: 'Eli', role: 'The conductor with a missing destination', initial: 'E' },
};

export function newGame() {
  return { version: 2, legacy: false, signal: null, anchor: null, stage: 'arrival', ally: null, trust: { mara: 0, eli: 0 }, promised: null,
    radioHeard: false, inventory: ['A one-way ticket'], memories: [], actions: [], ending: null };
}

const choice = (id, label, hint) => ({ id, label, hint });
export function getChoices(state) {
  switch (state.stage) {
    case 'arrival': return [choice('inspect_photo', 'Pick up the photograph', 'Someone left a memory behind.')];
    case 'discovery': return [
      choice('show_mara', 'Show it to Mara', 'Trust the stranger who looks familiar.'),
      choice('show_eli', 'Ask the conductor', 'Eli must know where this train is going.'),
      choice('keep_photo', 'Keep it to yourself', 'Some memories are safer in your pocket.'),
    ];
    case 'conflict': return [
      choice('accept_plan', state.ally ? 'Promise to stop the train' : 'Tell Eli about the photograph', state.ally ? 'Put your trust in someone else.' : 'Let someone in, before it is too late.'),
      choice('refuse_plan', state.ally ? 'Refuse to make a promise' : 'Say you found nothing', state.ally ? 'You still do not know who to believe.' : 'Keep your secret. Keep your distance.'),
    ];
    case 'signal': return [
      choice('tune_signal', 'Tune the radio to the three-note signal', 'Recover the station’s name, and why you chose to forget.'),
      choice('follow_watch', 'Follow Eli’s stopped watch', 'Keep the painful memory closed. Let the conductor guide you.'),
    ];
    case 'vestibule': return [
      choice('share_memory', 'Let Mara hold the photograph with you', state.promised ? 'Make room for one more person in your promise.' : 'Tell the truth, even now. Someone may still meet you halfway.'),
      choice('keep_ticket', 'Hold on to your one-way ticket', 'Prepare to leave on your own terms. Keep your earlier promise, if you made one.'),
    ];
    case 'decision': return [
      choice('stop_train', 'Pull the emergency brake', state.promised ? 'Keep your promise. Face what waits outside.' : 'Leave the train, even if you leave alone.'),
      choice('stay_aboard', 'Let the station pass', 'Stay with the familiar. Whatever it costs.'),
    ];
    default: return [];
  }
}

export function takeAction(previous, actionId) {
  const legal = getChoices(previous).some(item => item.id === actionId);
  if (actionId === 'listen_radio' ? previous.radioHeard || previous.stage === 'ending' : !legal) {
    throw new Error('That action is not available in this scene.');
  }
  const state = structuredClone(previous);
  state.actions.push(actionId);
  const remember = text => state.memories.push(text);
  switch (actionId) {
    case 'listen_radio':
      state.radioHeard = true;
      remember('You listened to the radio: “Last stop before daylight. Pull the brake if you wish to remember.”');
      break;
    case 'inspect_photo':
      state.stage = 'discovery'; state.inventory.push('A photograph of you, Mara, and Eli');
      remember('You found a photograph of three people at a sunlit station. One of them is you.');
      break;
    case 'show_mara': case 'show_eli':
      state.ally = actionId === 'show_mara' ? 'mara' : 'eli';
      state.trust[state.ally] = 1; state.stage = 'conflict';
      remember(`You showed ${CHARACTERS[state.ally].name} the photograph. They remember that you trusted them first.`);
      break;
    case 'keep_photo':
      state.stage = 'conflict'; remember('You kept the photograph secret. Neither stranger knows what you found.');
      break;
    case 'accept_plan':
      if (!state.ally) {
        state.ally = 'eli'; state.trust.eli = 1;
        remember('You finally showed Eli the photograph. He offered to leave the train with you.');
      } else {
        state.trust[state.ally] = 2;
        remember(`You promised ${CHARACTERS[state.ally].name} you would stop the train. They are counting on you.`);
      }
      state.promised = true; state.stage = state.legacy ? 'decision' : 'signal';
      break;
    case 'refuse_plan':
      state.promised = false; state.stage = state.legacy ? 'decision' : 'signal';
      if (state.ally) {
        state.trust[state.ally] = 0;
        remember(`You refused ${CHARACTERS[state.ally].name}'s plan. They pulled away, unsure they could trust you.`);
      } else { remember('You told Eli you found nothing. He turned toward the door, keeping his distance.'); }
      break;
    case 'tune_signal':
      state.signal = 'radio'; state.stage = 'vestibule';
      state.inventory.push('The name of the station: Bellwether');
      remember('You tuned the three-note signal. Bellwether is real. You remembered leaving home after a goodbye you could not bear.');
      break;
    case 'follow_watch':
      state.signal = 'watch'; state.stage = 'vestibule';
      remember('You followed Eli’s stopped watch. He remembered the dim platform after the tunnel; you chose to find home before reopening the past.');
      break;
    case 'share_memory':
      state.anchor = 'shared';
      if (!state.promised) {
        state.ally = 'mara'; state.promised = true; state.trust.mara = 1;
        remember('At the carriage door, you admitted you were afraid. Mara accepted your late promise to leave together.');
      } else {
        state.trust.mara = Math.max(1, state.trust.mara);
        remember(state.ally === 'eli' ? 'You made space for Mara in your promise to Eli. All three faces in the photograph have someone waiting for them.' : 'You and Mara held the photograph together. Her brother is gone; the love in that memory is not.');
      }
      state.stage = 'decision';
      break;
    case 'keep_ticket':
      state.anchor = 'ticket'; state.stage = 'decision';
      remember(state.promised ? `You kept your ticket close. Your promise to ${CHARACTERS[state.ally].name} still stands.` : 'You folded the ticket into your palm. You will face the platform alone, without promising what you cannot give.');
      break;
    case 'stop_train':
      state.stage = 'ending'; state.ending = state.ally && state.promised ? 'together' : 'alone';
      remember(state.ending === 'together' ? `You kept your promise. ${state.anchor === 'shared' && state.ally === 'eli' ? 'You, Mara, and Eli' : 'You and ' + CHARACTERS[state.ally].name} stepped off the train together.` : 'You pulled the brake and stepped into daylight alone. The photograph is still in your pocket.');
      break;
    case 'stay_aboard':
      state.stage = 'ending'; state.ending = 'loop';
      if (state.ally && state.promised) { state.trust[state.ally] = 0; remember(`You broke your promise to ${CHARACTERS[state.ally].name}. The station slipped away.`); }
      remember('You stayed aboard. The radio returned to 03:17. The photograph found its way back to the table.');
      state.inventory = ['A one-way ticket'];
      break;
  }
  return state;
}

// Replay is also the source of chapter history: revisiting never rewinds the save.
export function serializeGame(state) { return JSON.stringify({ version: 2, actions: state.actions, ...(state.legacy ? { legacy: true } : {}) }); }
export function restoreGame(raw) {
  const saved = JSON.parse(raw);
  if (![1, 2].includes(saved?.version) || !Array.isArray(saved.actions) || saved.actions.length > 12 || saved.actions.some(action => typeof action !== 'string')) throw new Error('Unsupported save');
  // Completed three-chapter saves retain their real choices and ending. Unfinished
  // older journeys naturally enter the new chapters after the promise scene.
  const completed = saved.actions.some(action => action === 'stop_train' || action === 'stay_aboard');
  const legacy = (saved.version === 1 || saved.legacy === true) && completed;
  if (legacy && saved.actions.some(action => ['tune_signal', 'follow_watch', 'share_memory', 'keep_ticket'].includes(action))) throw new Error('Invalid legacy journey');
  const initial = newGame(); initial.legacy = legacy;
  return saved.actions.reduce((state, action) => takeAction(state, action), initial);
}
export function getChapterHistory(state) {
  const snapshots = new Map();
  const decisions = new Map();
  let cursor = newGame(); cursor.legacy = state.legacy;
  snapshots.set(getView(cursor).chapter, cursor);
  for (const action of state.actions) {
    const chapter = getView(cursor).chapter;
    const label = getChoices(cursor).find(item => item.id === action)?.label || 'Listened to the carriage radio';
    decisions.set(chapter, [...(decisions.get(chapter) || []), label]);
    cursor = takeAction(cursor, action);
    snapshots.set(getView(cursor).chapter, cursor);
  }
  return [...snapshots].map(([chapter, snapshot]) => ({ chapter, title: CHAPTERS[chapter], decisions: decisions.get(chapter) || [], state: structuredClone(snapshot) }));
}

export function getView(state) {
  const ally = state.ally ? CHARACTERS[state.ally].name : 'Eli';
  const base = { chapter: 0, label: 'CHAPTER 01 · THE PHOTOGRAPH', title: 'Everyone has a past.\nYours is on this train.',
    speaker: 'narrator', prompt: 'WHAT WILL YOU DO?', status: 'SOMEWHERE BEFORE DAYLIGHT', location: 'The observation car',
    hint: 'Look closer. Some things are waiting to be found.', paragraphs: [], endingTitle: null };
  switch (state.stage) {
    case 'arrival': return { ...base, prompt: 'EVERY STORY STARTS WITH A SMALL CHOICE', paragraphs: [
      'You wake to the rhythm of wheels on tracks. Outside, the mountains are unfamiliar. So is the ticket in your hand.',
      'Across the aisle, a woman watches the window. A conductor checks a watch that has stopped.',
      'On the table: a photograph, turned face down. Its edges are worn, as though you have held it a thousand times.',
    ] };
    case 'discovery': return { ...base, title: 'Three faces.\nOne impossible memory.', paragraphs: [
      'Three people stand on a sunlit platform. The woman by the window. The conductor. You.',
      'On the back, in your own handwriting: “If we forget again, find each other.”',
      'Mara catches you looking. Eli pauses in the doorway. You can show the photograph to one of them—or keep it hidden.',
    ] };
    case 'conflict': return { ...base, chapter: 1, label: 'CHAPTER 02 · A BORROWED TRUTH', title: 'A stranger, until\nyou choose otherwise.', speaker: state.ally || 'eli', hint: 'Trust changes what people are willing to tell you.', paragraphs:
      state.ally === 'mara' ? [
        '“That is my brother’s station,” Mara whispers. “I boarded this train to forget losing him. I think we all came here to forget something.”',
        'She turns the photograph over. “You trusted me with this. So here is the truth: the train never arrives. It only takes another memory.”',
        '“There is one stop left. Promise me you will pull the brake when you see the platform.”',
      ] : state.ally === 'eli' ? [
        'Eli closes his fingers around the stopped watch. “I was a passenger once. Every time I stayed aboard, I forgot why I wanted to leave.”',
        '“You showed me the photograph. You could have hidden it. That tells me you are still looking for a way home.”',
        '“One station remains. Promise you will stop the train. This time, I would like to leave with someone.”',
      ] : [
        'Eli glances at your closed hand. “People find things on this train. Things they once wanted to forget.”',
        'Through the window, a distant station light appears. His voice softens. “You can get off there. But it helps to have someone who remembers you.”',
        '“Did you find something you want to tell me about?”',
      ] };
    case 'signal': return { ...base, chapter: 2, label: 'CHAPTER 03 · A VOICE IN THE STATIC', title: 'Somewhere in the noise,\na way home.', location: 'The radio compartment', status: 'BEFORE THE MOUNTAIN TUNNEL · 03:24 AM', speaker: 'eli', hint: 'The radio dial, the route chart, and a watch that refuses to move.', paragraphs: [
      'Eli unlocks the little compartment beyond the observation car. On his desk, a route chart curls beneath a brass lamp. Every station has been crossed out except one.',
      state.radioHeard ? 'You recognize the three descending notes beneath the announcement. They were never background noise. They are a signal.' : 'The radio hums three descending notes. For an instant, through the static, someone says your name.',
      state.promised ? `Your promise to ${ally} brought you this far. Now the train wants to know how much of the past you are willing to take home.` : '“You do not owe me a promise,” Eli says. “But I can still show you the way.”',
      'His watch reads 03:17. “The platform after the tunnel has only two lamps. We can follow this, or you can turn the dial and hear what we left behind.”',
    ] };
    case 'vestibule': return { ...base, chapter: 3, label: 'CHAPTER 04 · WHAT WE CARRY', title: 'A door between\nthen and now.', location: 'The last carriage door', status: 'BEYOND THE TUNNEL · 03:29 AM', speaker: 'mara', hint: 'A ticket on the shelf. Mara at the door. Dawn beyond the glass.', paragraphs: [
      state.signal === 'radio' ? 'Bellwether. The name arrives with the end of the tunnel. You remember a hospital corridor, a final goodbye, and buying a ticket because going home felt impossible. The train did not steal the memory. You asked it to.' : 'You leave the dial untouched. Eli leads you through the tunnel by counting the seconds his watch has forgotten. For once, you do not have to understand the whole journey to take the next step.',
      'Mara waits in the vestibule. “My brother is not at that station,” she says. “I know that now. I think I was afraid that remembering him would mean losing him again.”',
      state.promised && state.ally === 'eli' ? 'Eli waits in the connecting corridor, ready to keep your promise. Mara looks at the photograph in your hand. There is still room to invite her into it.' : state.promised ? 'You promised Mara an escape. Here, beside the door, it feels less like saving someone and more like agreeing to be frightened together.' : 'You refused to promise anything in the observation car. Mara has not forgotten. “You can still tell me the truth,” she says. “Even if the truth is that you are scared.”',
      'You set your ticket on the narrow shelf. The photograph is warm in your pocket. You cannot keep the train from taking things. You can choose what to hold on to.',
    ] };
    case 'decision': return { ...base, chapter: 4, label: 'CHAPTER 05 · BEFORE DAYLIGHT', title: 'The next stop\nis a choice.', speaker: state.promised ? state.ally : 'narrator', status: 'THE LAST PLATFORM IS APPROACHING', hint: 'The emergency brake is within reach.', paragraphs: [
      ...(!state.legacy ? ['Back in the observation car, the lamps flicker. The familiar seats seem smaller now. You are no longer the person who woke here.'] : []),
      state.signal === 'radio' ? '“Bellwether,” the radio says. You know that name now. You know what waits there, and why it matters.' : state.signal === 'watch' ? 'Eli’s stopped watch ticks once. Beyond the dim platform, a narrow path climbs toward the waking village. He found the way he promised you.' : state.radioHeard ? 'The radio repeats the warning you heard earlier: “Last stop before daylight.” This time, you understand.' : 'The radio crackles: “Last stop before daylight. Passengers wishing to remember must leave now.”',
      state.promised ? `“You said we would do this,” ${ally} says. Their voice barely rises above the wheels. “I remember.”` : state.ally ? `${ally} falls silent. After you refused their plan, the distance between you feels wider than the aisle.` : 'Mara looks out of the window. Eli waits silently by the door. You kept your secret, and now the choice is yours alone.',
      ...(state.anchor === 'shared' ? [state.ally === 'eli' ? 'Mara has joined you and Eli. Three faces in an old photograph, choosing to become three people on a platform again.' : 'Mara still holds the edge of the photograph. You will not have to remember everything alone.'] : []),
      'Beyond the glass, a platform emerges from the mist. The brake hangs beside the door. The train begins to pick up speed.',
    ] };
    case 'ending': {
      const shared = state.ending === 'together'; const loop = state.ending === 'loop';
      return { ...base, chapter: 4, label: 'YOUR JOURNEY · COMPLETE', title: loop ? 'Some journeys\nbegin again.' : 'Daylight was\nworth remembering.',
        status: loop ? '03:17 AM · AGAIN' : 'THE WESTBOUND LIMITED · ARRIVED', location: loop ? 'The observation car, again' : 'The last platform',
        hint: loop ? 'A photograph waits on the table.' : 'The sky is beginning to change.',
        endingTitle: shared ? 'The way home, together.' : loop ? 'The comfort of forgetting.' : 'A platform of your own.',
        paragraphs: shared ? [
          state.anchor === 'shared' && state.ally === 'eli' ? 'The brakes scream. Then, silence. Eli steps down first. You and Mara follow. This time, every face in the photograph has made it into the morning.' : `The brakes scream. Then, silence. ${ally} steps onto the platform beside you. Neither of you lets go of the photograph.`,
          `“You trusted me when I was a stranger,” ${ally} says. “And when it mattered, you kept your word.”`,
          ...(state.signal === 'radio' ? ['You can name the goodbye you were running from. Bellwether is not a cure for grief. It is a place to begin living with it.'] : state.signal === 'watch' ? ['Eli’s watch begins to move. You have not opened every painful memory. You have reached a place where you can, when you are ready.'] : []),
          'The past still hurts. But there is someone here who remembers it with you. For the first time, that feels like enough.',
        ] : loop ? [
          'The platform slips into darkness. The wheels settle into a familiar rhythm.',
          state.promised ? `${ally} lets their hand fall. A moment later, you cannot remember why they look so sad.` : 'Whatever waited outside cannot hurt you here. Soon, you cannot remember what it was.',
          'You wake to the rhythm of wheels on tracks. On the table: a photograph, turned face down.',
        ] : [
          'You pull the brake. The door opens onto cold air and the first pale line of morning.',
          'No one follows. You kept your distance, and the others kept theirs. But the photograph is still in your pocket.',
          ...(state.signal === 'radio' ? ['Bellwether. You say it aloud. The name and the goodbye belong to you again.'] : []),
          'You do not remember everything yet. You have decided you want to. Today, that is enough.',
        ] };
    }
  }
}

export function inspectObject(state, target) {
  if (target === 'chart') return { title: 'One station left uncrossed.', label: 'ELI’S ROUTE CHART', paragraphs: ['The ink keeps fading from the station names. A line curves through a mountain tunnel to a small platform. Three descending notes are pencilled beside it.', state.signal === 'radio' ? 'Bellwether. You recovered the name the chart could not keep.' : 'Eli taps the dim platform. “We can find it by the watch, even if the name is gone.”'], action: state.stage === 'signal' ? 'follow_watch' : null, actionLabel: 'Follow Eli’s watch ↗' };
  if (target === 'ticket') return { title: 'A ticket is permission to leave.', label: 'ON THE VESTIBULE SHELF', paragraphs: ['One way. No destination. You bought this yourself, though the handwriting seems to belong to someone who had forgotten how to ask for help.', state.promised ? 'Holding it does not break your promise. You can carry your own courage and still leave with someone.' : 'You can keep your distance and still decide to go home.'], action: state.stage === 'vestibule' ? 'keep_ticket' : null, actionLabel: 'Keep the ticket close ↗' };

  if (target === 'brake') return { title: state.stage === 'decision' ? 'One pull. A different future.' : 'The red emergency brake.', label: 'BESIDE THE CARRIAGE DOOR', paragraphs: state.stage === 'decision' ? ['The last platform is appearing beyond the glass. Pulling this handle will stop the train. Whether someone steps off beside you depends on what you promised.'] : state.stage === 'vestibule' ? ['The platform is beginning to slide into view. Eli asks you to wait until its full length is beside the train. There is still one conversation to finish before you decide.'] : ['The red handle is cold and solid. A brass plate asks passengers to wait until a platform is in sight. For now, the mountains pass without a station.'], action: state.stage === 'decision' ? 'stop_train' : null, actionLabel: 'Pull the brake and leave the train ↗' };
  if (target === 'photograph') return { title: state.stage === 'arrival' ? 'A photograph, face down.' : 'Three faces. One impossible memory.', label: 'FOUND ON THE TABLE',
    paragraphs: state.stage === 'arrival' ? ['A faded photograph rests beside an empty cup. Someone has written a message on the back.'] : state.ending === 'loop' ? ['It is back on the table. Three figures on a platform. A message you almost recognize.'] : ['You, Mara, and Eli, on a platform in daylight. On the back: “If we forget again, find each other.”'],
    action: state.stage === 'arrival' ? 'inspect_photo' : null, actionLabel: 'Turn it over ↗' };
  if (target === 'radio' && state.stage === 'signal') return { title: 'Three notes beneath the static.', label: 'THE DISPATCH RADIO', paragraphs: ['A warm amber dial trembles between stations. Three descending notes rise through the hiss. The name of a station almost reaches you.', 'Turning the dial will recover the message, and the memory you boarded this train to forget.'], action: 'tune_signal', actionLabel: 'Tune the three-note signal ↗' };
  if (target === 'radio') return { title: 'A voice through the static.', label: 'THE CARRIAGE RADIO', paragraphs: [state.ending === 'loop' ? '“The time is 03:17. Welcome aboard the Westbound Limited.”' : '“Last stop before daylight. Pull the brake if you wish to remember.”', 'The same words repeat. There is no music. There never was.'], action: null };
  if (target === 'mara' && state.stage === 'vestibule') return { title: 'There is still room for the truth.', label: 'MARA · AT THE CARRIAGE DOOR', paragraphs: ['“I am scared too,” Mara says. “You do not have to promise it will stop hurting. Just that we will get off here.”'], action: 'share_memory', actionLabel: 'Share the photograph with Mara ↗' };
  const person = CHARACTERS[target];
  if (!person || target === 'narrator') throw new Error('Unknown character');
  let text = target === 'mara' ? 'Mara traces a circle on the fogged glass. “Do you ever miss somewhere you cannot name?”' : 'Eli checks his watch. Both hands point to 03:17. “Your ticket says one way. They all do.”';
  if (state.ally === target) text = state.stage === 'ending' ? state.ending === 'together' ? '“We remembered each other. That is a beginning.”' : 'They look at you as if there is something they want to say, but have forgotten the words.' : state.promised === true ? '“You promised. I am ready when you are.”' : state.promised === false ? '“I understand. Some things are difficult to promise a stranger.”' : '“You showed me the photograph first. I will remember that.”';
  return { title: person.name, label: person.role.toUpperCase(), paragraphs: [text], action: state.stage === 'discovery' ? (target === 'mara' ? 'show_mara' : 'show_eli') : null, actionLabel: state.stage === 'discovery' ? `Show ${person.name} the photograph ↗` : null };
}
