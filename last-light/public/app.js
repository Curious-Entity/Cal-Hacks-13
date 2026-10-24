// UI wiring: story.js owns the rules; this file puts the current state on screen.
import { SAVE_KEY, CHARACTERS, newGame, getChoices, takeAction, serializeGame, restoreGame, getView, inspectObject } from './story.js';

const $ = selector => document.querySelector(selector);
let state = newGame();
let storageAvailable = true;
try {
  const saved = localStorage.getItem(SAVE_KEY);
  if (saved) state = restoreGame(saved);
} catch { storageAvailable = false; }

function save() {
  try { localStorage.setItem(SAVE_KEY, serializeGame(state)); storageAvailable = true; }
  catch { storageAvailable = false; }
}

function textElement(tag, text, className) {
  const element = document.createElement(tag);
  element.textContent = text;
  if (className) element.className = className;
  return element;
}

function render() {
  const view = getView(state);
  $('#chapter-label').textContent = view.label;
  $('#chapter-title').replaceChildren(...view.title.split('\n').flatMap((line, index) => index ? [document.createElement('br'), document.createTextNode(line)] : [document.createTextNode(line)]));
  const person = CHARACTERS[view.speaker];
  $('#speaker-avatar').textContent = person.initial;
  $('#speaker-avatar').dataset.speaker = view.speaker;
  $('#speaker-name').textContent = person.name;
  $('#speaker-role').textContent = person.role;
  const paragraphs = view.paragraphs.map(text => textElement('p', text));
  if (view.endingTitle) paragraphs.unshift(textElement('h2', view.endingTitle, 'ending-title'));
  $('#story-content').replaceChildren(...paragraphs);
  $('#choice-prompt').textContent = state.stage === 'ending' ? 'THERE IS ALWAYS ANOTHER WAY THROUGH' : view.prompt;
  $('#world-status').textContent = view.status;
  $('#location-name').textContent = view.location;
  $('#scene-hint').textContent = view.hint;
  $('#scene-number').textContent = `${String(view.chapter + 1).padStart(2, '0')} / 03`;
  $('.world').dataset.ending = state.ending === 'loop' ? 'loop' : state.ending ? 'home' : '';
  const reachedPlatform = state.ending && state.ending !== 'loop';
  $('.world-art').src = reachedPlatform ? 'platform.svg' : 'carriage.svg';
  $('.world-art').alt = reachedPlatform ? 'A quiet railway platform at sunrise, with mountains, a station clock, and a train disappearing into the distance.' : 'A midnight train carriage, lit by warm lamps, with mountains beyond rain-streaked windows.';
  $('.photo-hotspot').dataset.collected = String(state.stage !== 'arrival' && state.ending !== 'loop');
  $('#inventory-content').textContent = state.inventory.join(' · ');
  $('#memory-count').textContent = state.memories.length;
  $('#memory-notice').hidden = !state.memories.length;
  $('#memory-notice-text').textContent = state.memories.at(-1) || '';
  $('#save-status').replaceChildren(textElement('span', '', 'live-dot'), document.createTextNode(storageAvailable ? 'Progress saved on this browser.' : 'Saving unavailable. Keep this tab open to continue.'));
  document.querySelectorAll('[data-chapter]').forEach(element => {
    const chapter = Number(element.dataset.chapter);
    element.classList.toggle('active', chapter === view.chapter);
    element.classList.toggle('complete', chapter < view.chapter);
    if (chapter === view.chapter) element.setAttribute('aria-current', 'step');
    else element.removeAttribute('aria-current');
  });

  const choices = getChoices(state);
  $('#choices').replaceChildren(...choices.map((item, index) => {
    const button = textElement('button', '', 'choice');
    button.dataset.action = item.id;
    const copy = textElement('span', '', 'choice-copy');
    copy.append(textElement('strong', item.label), textElement('small', item.hint));
    button.append(textElement('span', String(index + 1).padStart(2, '0'), 'choice-number'), copy, textElement('span', '↗', 'choice-arrow'));
    button.addEventListener('click', () => act(item.id));
    return button;
  }));
  if (state.stage === 'ending') {
    const replay = textElement('button', '↺  Try a different path', 'choice');
    replay.addEventListener('click', () => $('#restart-dialog').showModal());
    const journal = textElement('button', '▤  See what this journey remembered', 'choice');
    journal.addEventListener('click', openJournal);
    $('#choices').append(replay, journal);
  }
}

function act(actionId) {
  state = takeAction(state, actionId);
  save();
  render();
  // Put keyboard focus on the next action, including after closing an inspection.
  $('#choices button')?.focus({ preventScroll: true });
}

function inspect(target) {
  if (target === 'radio' && !state.radioHeard && state.stage !== 'ending') act('listen_radio');
  const item = inspectObject(state, target);
  $('#inspect-label').textContent = item.label;
  $('#inspect-title').textContent = item.title;
  $('#inspect-content').replaceChildren(...item.paragraphs.map(text => textElement('p', text)));
  const actionButton = $('#inspect-action');
  actionButton.hidden = !item.action;
  actionButton.textContent = item.actionLabel || '';
  actionButton.onclick = item.action ? () => { $('#inspect-dialog').close(); act(item.action); } : null;
  $('#inspect-dialog').showModal();
}

function openJournal() {
  $('#relationships').replaceChildren(...['mara', 'eli'].map(id => {
    const relationship = textElement('div', '', 'relationship');
    const trust = state.trust[id];
    const label = trust === 2 ? 'Counting on you' : trust === 1 ? 'A little trust' : state.ally === id ? 'Keeping their distance' : 'Still a stranger';
    relationship.append(textElement('strong', CHARACTERS[id].name), textElement('span', label));
    return relationship;
  }));
  $('#journal-entries').replaceChildren(...(state.memories.length ? state.memories : ['Your story has not been written yet. Look for the photograph.']).map(text => textElement('li', text)));
  $('#journal-dialog').showModal();
}

document.querySelectorAll('[data-inspect]').forEach(button => button.addEventListener('click', () => inspect(button.dataset.inspect)));
$('#journal-button').addEventListener('click', openJournal);
$('#restart-button').addEventListener('click', () => $('#restart-dialog').showModal());
$('#cancel-restart').addEventListener('click', () => $('#restart-dialog').close());
$('#confirm-restart').addEventListener('click', () => { $('#restart-dialog').close(); state = newGame(); save(); render(); $('#choices button')?.focus({ preventScroll: true }); });

// Ambient sound is synthesized locally: no downloads, trackers, or API calls.
// Browsers require a click before playing audio; the toggle starts muted.
let audioContext;
let audioGain;
let soundOn = false;
$('#sound-button').addEventListener('click', async () => {
  try {
    if (!audioContext) {
      const Audio = window.AudioContext || window.webkitAudioContext;
      if (!Audio) throw new Error('Audio unsupported');
      audioContext = new Audio();
      audioGain = audioContext.createGain(); audioGain.gain.value = 0; audioGain.connect(audioContext.destination);
      const length = audioContext.sampleRate * 4;
      const buffer = audioContext.createBuffer(1, length, audioContext.sampleRate);
      const samples = buffer.getChannelData(0);
      let last = 0;
      for (let i = 0; i < length; i++) { last = (last + Math.random() * .04 - .02) / 1.02; samples[i] = last * 3; }
      const noise = audioContext.createBufferSource(); noise.buffer = buffer; noise.loop = true;
      const filter = audioContext.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 450;
      noise.connect(filter); filter.connect(audioGain); noise.start();
      const rumble = audioContext.createOscillator(); rumble.frequency.value = 48;
      const rumbleGain = audioContext.createGain(); rumbleGain.gain.value = .08;
      rumble.connect(rumbleGain); rumbleGain.connect(audioGain); rumble.start();
    }
    await audioContext.resume();
    soundOn = !soundOn;
    audioGain.gain.setTargetAtTime(soundOn ? .24 : 0, audioContext.currentTime, .3);
    $('#sound-button').setAttribute('aria-pressed', String(soundOn));
    $('#sound-label').textContent = soundOn ? 'Sound on' : 'Sound off';
  } catch { $('#sound-label').textContent = 'Sound unavailable'; }
});

render();
