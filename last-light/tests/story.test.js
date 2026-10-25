import test from 'node:test';
import assert from 'node:assert/strict';
import { newGame, getChoices, takeAction, serializeGame, restoreGame, getView, inspectObject, getChapterHistory } from '../public/story.js';
const play = actions => actions.reduce(takeAction, newGame());
const opening = ['inspect_photo', 'show_mara', 'accept_plan'];
const passage = ['tune_signal', 'keep_ticket'];

test('all 48 paths visit five chapters and reach a replayable ending', () => {
  const endings = new Set(); let paths = 0;
  function walk(state) {
    assert.deepEqual(restoreGame(serializeGame(state)), state);
    assert.ok(getView(state));
    if (state.stage === 'ending') {
      paths++; endings.add(state.ending);
      assert.deepEqual(getChapterHistory(state).map(item => item.chapter), [0,1,2,3,4]);
      if (state.ending === 'together') { assert.ok(state.ally); assert.equal(state.promised, true); }
      if (state.ending === 'loop') assert.deepEqual(state.inventory, ['A one-way ticket']);
      return;
    }
    for (const action of getChoices(state)) walk(takeAction(state, action.id));
  }
  walk(newGame());
  assert.equal(paths, 48);
  assert.deepEqual([...endings].sort(), ['alone', 'loop', 'together']);
});

test('the radio adds one persistent memory without advancing the scene', () => {
  const state = takeAction(newGame(), 'listen_radio');
  assert.equal(state.stage, 'arrival'); assert.equal(state.memories.length, 1);
  assert.deepEqual(restoreGame(serializeGame(state)), state);
  assert.throws(() => takeAction(state, 'listen_radio'));
});

test('a broken promise is remembered and affects the relationship', () => {
  const state = play([...opening, ...passage, 'stay_aboard']);
  assert.equal(state.trust.mara, 0);
  assert.match(state.memories.join(' '), /broke your promise to Mara/);
  assert.match(getView(state).paragraphs.join(' '), /Mara lets their hand fall/);
});

test('illegal moves and invalid saved games are rejected', () => {
  assert.throws(() => takeAction(newGame(), 'stop_train'));
  assert.throws(() => takeAction(play(opening), 'stop_train'));
  assert.throws(() => restoreGame('{"version":1,"actions":["stay_aboard"]}'));
  assert.throws(() => restoreGame('{"version":3,"actions":[]}'));
  assert.throws(() => restoreGame('{"version":2,"actions":[null]}'));
});

test('painted props expose legal contextual actions in each chapter', () => {
  const arrival = newGame();
  assert.equal(inspectObject(arrival, 'brake').action, null);
  assert.equal(inspectObject(arrival, 'mara').action, null);
  const discovery = takeAction(arrival, 'inspect_photo');
  assert.equal(inspectObject(discovery, 'mara').action, 'show_mara');
  assert.equal(inspectObject(discovery, 'eli').action, 'show_eli');
  const signal = play(opening);
  assert.equal(inspectObject(signal, 'radio').action, 'tune_signal');
  assert.equal(inspectObject(signal, 'chart').action, 'follow_watch');
  const vestibule = takeAction(signal, 'tune_signal');
  assert.equal(inspectObject(vestibule, 'mara').action, 'share_memory');
  assert.equal(inspectObject(vestibule, 'ticket').action, 'keep_ticket');
  assert.equal(inspectObject(vestibule, 'brake').action, null);
  const decision = takeAction(vestibule, 'keep_ticket');
  assert.equal(inspectObject(decision, 'mara').action, null);
  assert.equal(inspectObject(decision, 'brake').action, 'stop_train');
  assert.equal(takeAction(decision, 'stop_train').ending, 'together');
});

test('signal choice changes memory and ending narration', () => {
  const radio = play([...opening, 'tune_signal', 'keep_ticket', 'stop_train']);
  const watch = play([...opening, 'follow_watch', 'keep_ticket', 'stop_train']);
  assert.ok(radio.inventory.includes('The name of the station: Bellwether'));
  assert.ok(!watch.inventory.includes('The name of the station: Bellwether'));
  assert.match(getView(radio).paragraphs.join(' '), /name the goodbye/);
  assert.match(getView(watch).paragraphs.join(' '), /watch begins to move/);
});

test('a late honest choice repairs trust, and inviting Mara can bring all three home', () => {
  const late = play(['inspect_photo', 'keep_photo', 'refuse_plan', 'follow_watch', 'share_memory', 'stop_train']);
  assert.equal(late.ending, 'together'); assert.equal(late.ally, 'mara');
  const alone = play(['inspect_photo', 'keep_photo', 'refuse_plan', 'follow_watch', 'keep_ticket', 'stop_train']);
  assert.equal(alone.ending, 'alone');
  const all = play(['inspect_photo', 'show_eli', 'accept_plan', 'tune_signal', 'share_memory', 'stop_train']);
  assert.match(getView(all).paragraphs.join(' '), /every face in the photograph/);
});

test('chapter history is ordered, records real choices, and cannot mutate the live state', () => {
  const state = play([...opening, 'listen_radio', ...passage]);
  const saved = serializeGame(state); const history = getChapterHistory(state);
  assert.deepEqual(history.map(item=>item.chapter), [0,1,2,3,4]);
  assert.deepEqual(history[0].decisions, ['Pick up the photograph','Show it to Mara']);
  assert.equal(history[1].state.promised, null);
  assert.equal(history[2].state.signal, null);
  assert.equal(history[3].state.signal, 'radio');
  history[0].state.inventory.push('not real'); history[0].state.actions.length = 0;
  assert.equal(serializeGame(state), saved);
  assert.deepEqual(getChapterHistory(restoreGame(saved)), getChapterHistory(state));
});

test('old saves preserve completed endings and unfinished games enter new chapters', () => {
  const unfinished = restoreGame(JSON.stringify({version:1,actions:opening}));
  assert.equal(unfinished.stage,'signal'); assert.equal(unfinished.legacy,false);
  const completed = restoreGame(JSON.stringify({version:1,actions:[...opening,'stop_train']}));
  assert.equal(completed.stage,'ending'); assert.equal(completed.ending,'together');
  assert.equal(completed.legacy,true);
  assert.deepEqual(getChapterHistory(completed).map(item=>item.chapter),[0,1,4]);
  assert.deepEqual(restoreGame(serializeGame(completed)),completed);
});
