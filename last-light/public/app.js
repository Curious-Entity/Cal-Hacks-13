// UI wiring: story.js owns the rules; this file puts the current state on screen.
import { SAVE_KEY, CHARACTERS, newGame, getChoices, takeAction, serializeGame, restoreGame, getView, inspectObject } from './story.js';

import {TRAIN_ART, TRAIN_HOTSPOTS, mountTrainMotion} from './train-scene.js';

const $ = selector => document.querySelector(selector);
let state = newGame();
let storageAvailable = true;
try {
  const saved = localStorage.getItem(SAVE_KEY);
  if (saved) state = restoreGame(saved);
} catch { storageAvailable = false; }


let motionOn = !matchMedia('(prefers-reduced-motion: reduce)').matches;
let labelsOn = true;
const stage = $('#train-stage');
mountTrainMotion(stage);
for (const [id, anchor] of Object.entries(TRAIN_HOTSPOTS)) {
  const button = document.createElement('button');
  button.className = 'hotspot train-hotspot train-hotspot--' + id;
  button.dataset.inspect = id;
  button.style.left = anchor.x + '%'; button.style.top = anchor.y + '%';
  button.style.width = anchor.w + '%'; button.style.height = anchor.h + '%';
  button.setAttribute('aria-label', id === 'photograph' ? 'Inspect the photograph on the table' : id === 'radio' ? 'Inspect the radio' : id === 'brake' ? 'Inspect the red emergency brake' : 'Talk to ' + anchor.label);
  button.title = anchor.detail;
  const caption = document.createElement('span'); caption.className = 'hotspot-caption';
  const dot = document.createElement('i'); dot.setAttribute('aria-hidden', 'true');
  const arrow = document.createElement('span'); arrow.textContent = '+'; arrow.setAttribute('aria-hidden','true');
  caption.append(dot, document.createTextNode(anchor.label), arrow);button.append(caption);
  $('#train-hotspots').append(button);
}
function updateMotion() {
  stage.dataset.motion = motionOn ? 'running' : 'paused';
  $('#motion-button').setAttribute('aria-pressed', String(motionOn));
  $('#motion-button').textContent = state.ending && state.ending !== 'loop' ? 'Train at rest' : motionOn ? 'Motion on' : 'Motion off';
  $('#motion-button').disabled = !!state.ending && state.ending !== 'loop';
}
$('#motion-button').onclick = () => { motionOn = !motionOn; updateMotion(); };
$('#clue-toggle').onclick = () => { labelsOn = !labelsOn; stage.dataset.labels = labelsOn ? 'shown' : 'hidden'; $('#clue-toggle').textContent = labelsOn ? 'Hide labels' : 'Show labels'; $('#clue-toggle').setAttribute('aria-pressed',String(labelsOn)); };
$('#pocket-photo').onclick = () => inspect('photograph');
$('#flip-photo').onclick = () => {
  const back = $('#photo-card').dataset.side !== 'back';
  $('#photo-card').dataset.side = back ? 'back' : 'front';
  $('#photo-front').setAttribute('aria-hidden',String(back));$('#photo-back').setAttribute('aria-hidden',String(!back));
  $('#flip-photo').setAttribute('aria-pressed',String(back));$('#flip-photo').textContent = back ? '↻ Look at the photograph' : '↻ Read the back of the photograph';
};

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
  $('#speaker-avatar').textContent = view.speaker === 'narrator' ? person.initial : '';
  $('#speaker-avatar').setAttribute('aria-hidden', 'true');
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
  const art = reachedPlatform ? TRAIN_ART.platform : TRAIN_ART.carriage;
  if ($('#train-art').getAttribute('src') !== art) $('#train-art').src = art;
  $('#train-art').alt = reachedPlatform ? 'The Westbound Limited has stopped at a quiet mountain platform in golden morning light. An open carriage door glows beside an empty station bench.' : 'Mara sits by the rain-streaked window; Eli holds his stopped watch beside a real wooden radio. A red brake hangs beside the door.';
  const hasPhoto = state.stage !== 'arrival' && state.ending !== 'loop';
  $('#table-cleared').hidden = !hasPhoto || !!reachedPlatform;
  $('[data-inspect="photograph"]').hidden = hasPhoto;
  $('#pocket-photo').hidden = !hasPhoto;
  stage.dataset.stage = state.stage;
  stage.dataset.ending = state.ending || '';
  $('#scene-invitation').textContent = reachedPlatform ? 'Your choices made this arrival possible.' : state.stage === 'arrival' ? 'Start with the photograph on the table.' : state.stage === 'decision' ? 'The red brake is within reach. The choice is yours.' : 'Look closer at the radio, Mara, or Eli.';
  $('#clue-toggle').hidden = !!reachedPlatform;
  updateMotion();
  $('#inventory-content').textContent = state.inventory.join(' · ');
  if (audioContext && audioGain && soundOn) { const stopped = !!state.ending && state.ending !== 'loop'; audioGain.gain.setTargetAtTime(stopped ? 0 : .24,audioContext.currentTime,stopped ? 1.2 : .3); }
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
  if (actionId === 'inspect_photo') inspect('photograph');
  else $('#choices button')?.focus({ preventScroll: true });
}

function inspect(target) {
  if (target === 'photograph' && state.stage === 'arrival') { act('inspect_photo'); return; }
  if (target === 'radio' && !state.radioHeard && state.stage !== 'ending') act('listen_radio');
  const item = inspectObject(state, target);
  $('#inspect-dialog').dataset.target = target;
  $('#photo-viewer').hidden = target !== 'photograph';
  $('#inspect-media').hidden = target === 'photograph';
  $('#inspect-media').dataset.subject = target;
  $('#inspect-media').setAttribute('role', 'img');
  $('#inspect-media').setAttribute('aria-label', target === 'radio' ? 'The carved wooden radio and its illuminated tuning dial, seen close up.' : target === 'brake' ? 'The red emergency brake beside the carriage door.' : target === 'mara' ? 'Mara, with auburn hair, a green coat and a mustard scarf.' : 'Eli, an older conductor with a silver beard and navy cap.');
  if (target === 'photograph') {
    $('#photo-card').dataset.side = 'front';
    $('#photo-front').setAttribute('aria-hidden','false');$('#photo-back').setAttribute('aria-hidden','true');
    $('#flip-photo').setAttribute('aria-pressed','false');$('#flip-photo').textContent = '↻ Read the back of the photograph';
  }
  $('#inspect-label').textContent = item.label;
  $('#inspect-title').textContent = item.title;
  const paragraphs = target === 'photograph' ? ['Mara. Eli. You. Three people who once knew how to smile together. Turn it over: someone left a message for the next time you forgot.'] : item.paragraphs;
  $('#inspect-content').replaceChildren(...paragraphs.map(text => textElement('p', text)));
  if (target === 'radio') playRadioCue();
  const actionButton = $('#inspect-action');
  actionButton.hidden = !item.action;
  actionButton.classList.toggle('danger-action', target === 'brake');
  actionButton.textContent = item.actionLabel || '';
  actionButton.onclick = item.action ? () => { $('#inspect-dialog').close(); act(item.action); } : null;
  if (!$('#inspect-dialog').open) $('#inspect-dialog').showModal();
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
let railBuffer;
function playRailClick(when) {
  const source = audioContext.createBufferSource(); source.buffer = railBuffer;
  const gain = audioContext.createGain(); gain.gain.setValueAtTime(.08,when); gain.gain.exponentialRampToValueAtTime(.001,when+.07);
  source.connect(gain);gain.connect(audioGain);source.start(when);source.stop(when+.08);
}
function playRadioCue() {
  if (!soundOn || !audioContext) return;
  const now=audioContext.currentTime;
  for (const [i,frequency] of [392,330,261].entries()) {
    const oscillator=audioContext.createOscillator(),gain=audioContext.createGain();oscillator.type='sine';oscillator.frequency.value=frequency;
    gain.gain.setValueAtTime(.001,now+i*.2);gain.gain.exponentialRampToValueAtTime(.07,now+i*.2+.02);gain.gain.exponentialRampToValueAtTime(.001,now+i*.2+.16);
    oscillator.connect(gain);gain.connect(audioGain);oscillator.start(now+i*.2);oscillator.stop(now+i*.2+.18);
  }
}
const wheelTimer=setInterval(()=>{
  if (!soundOn || !audioContext || document.hidden || (state.ending && state.ending !== 'loop')) return;
  const now=audioContext.currentTime+.01;playRailClick(now);playRailClick(now+.14);
},650);
addEventListener('pagehide',event=>{if(event.persisted)audioContext?.suspend();else{clearInterval(wheelTimer);audioContext?.close();}});
addEventListener('pageshow',event=>{if(event.persisted&&soundOn)audioContext?.resume();});
document.addEventListener('visibilitychange',()=>{if(audioContext){if(document.hidden)audioContext.suspend();else if(soundOn)audioContext.resume();}});

$('#sound-button').addEventListener('click', async () => {
  try {
    if (!audioContext) {
      const Audio = window.AudioContext || window.webkitAudioContext;
      if (!Audio) throw new Error('Audio unsupported');
      audioContext = new Audio();
      audioGain = audioContext.createGain(); audioGain.gain.value = 0; audioGain.connect(audioContext.destination);
      railBuffer = audioContext.createBuffer(1, Math.ceil(audioContext.sampleRate*.08), audioContext.sampleRate);
      const railSamples=railBuffer.getChannelData(0);for(let i=0;i<railSamples.length;i++)railSamples[i]=(Math.random()*2-1)*Math.exp(-i/railSamples.length*5);
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
