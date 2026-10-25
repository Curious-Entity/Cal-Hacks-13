import test from 'node:test';
import assert from 'node:assert/strict';
import { newGame, getChoices, takeAction, serializeGame, restoreGame, getView, inspectObject } from '../public/story.js';

test('all paths reach an ending with consistent replayable memory', () => {
  let endings = new Set(); let paths = 0;
  function walk(state) {
    assert.deepEqual(restoreGame(serializeGame(state)), state);
    assert.ok(getView(state));
    if (state.stage === 'ending') {
      paths++; endings.add(state.ending);
      if (state.ending === 'together') { assert.ok(state.ally); assert.equal(state.promised, true); }
      if (state.ending === 'loop') assert.deepEqual(state.inventory, ['A one-way ticket']);
      return;
    }
    for (const action of getChoices(state)) walk(takeAction(state, action.id));
  }
  walk(newGame());
  assert.equal(paths, 12);
  assert.deepEqual([...endings].sort(), ['alone', 'loop', 'together']);
});

test('the radio adds one persistent memory without advancing the scene', () => {
  const state = takeAction(newGame(), 'listen_radio');
  assert.equal(state.stage, 'arrival');
  assert.equal(state.memories.length, 1);
  assert.deepEqual(restoreGame(serializeGame(state)), state);
  assert.throws(() => takeAction(state, 'listen_radio'));
});

test('a broken promise is remembered and affects the relationship', () => {
  const state = ['inspect_photo', 'show_mara', 'accept_plan', 'stay_aboard'].reduce(takeAction, newGame());
  assert.equal(state.trust.mara, 0);
  assert.match(state.memories.join(' '), /broke your promise to Mara/);
  assert.match(getView(state).paragraphs.join(' '), /Mara lets their hand fall/);
});

test('illegal moves and invalid saved games are rejected', () => {
  assert.throws(() => takeAction(newGame(), 'stop_train'));
  assert.throws(() => restoreGame('{"version":1,"actions":["stay_aboard"]}'));
  assert.throws(() => restoreGame('{"version":2,"actions":[]}'));
});

// Contextual scene controls must obey the same story rules as the choice panel.
test('painted character and brake inspections expose actions only at the correct stage', () => {
  const arrival = newGame();
  assert.equal(inspectObject(arrival, 'brake').action, null);
  assert.equal(inspectObject(arrival, 'mara').action, null);
  const discovery = takeAction(arrival, 'inspect_photo');
  assert.equal(inspectObject(discovery, 'mara').action, 'show_mara');
  assert.equal(inspectObject(discovery, 'eli').action, 'show_eli');
  const decision = ['show_mara', 'accept_plan'].reduce(takeAction, discovery);
  assert.equal(inspectObject(decision, 'mara').action, null);
  const brake = inspectObject(decision, 'brake');
  assert.equal(brake.action, 'stop_train');
  assert.equal(takeAction(decision, brake.action).ending, 'together');
});
