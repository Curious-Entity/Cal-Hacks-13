import { sceneArt } from './scene-art.js';
import { objectIcon, objectPositions } from './scene-objects.js';

const $ = selector => document.querySelector(selector);
const SAVE = 'last-light-generated-v2';
const DRAFT = 'last-light-setup-v2';
let journey = null;
let pending = null;
let busy = false;
let inspecting = false;
let inspectedObjectId = null;
let imageRun = 0;
let config = null;
let storageAvailable = true;
const imageInFlight = new Set();

function element(tag, text, className) {
  const node = document.createElement(tag); node.textContent = text;
  if (className) node.className = className;
  return node;
}
function save() {
  try { localStorage.setItem(SAVE, JSON.stringify({ journey, pending })); storageAvailable = true; }
  catch { storageAvailable = false; }
}
function readSetup() {
  return { premise: $('#premise').value.trim(), protagonist: $('#protagonist').value.trim(), details: $('#story-details').value.trim(), tone: $('#tone').value, artStyle: $('#art-style').value, illustrations: $('#ai-illustrations').checked, illustrationMode:$('#image-frequency').value };
}
function fillSetup(setup) {
  if (!setup || typeof setup !== 'object') return;
  for (const [key, selector] of Object.entries({ premise:'#premise', protagonist:'#protagonist', details:'#story-details', tone:'#tone', artStyle:'#art-style' })) if (typeof setup[key] === 'string') $(selector).value = setup[key];
  if (setup.details) $('.story-details').open = true;
}
function isSavedJourney(value) {
  const state = value?.state;
  const scene = state?.scene;
  return typeof value?.token === 'string' && value.token.length < 65000 && state?.version === 2 && typeof state.id === 'string' &&
    typeof state.title === 'string' && typeof state.setup?.tone === 'string' && Number.isInteger(state.sceneIndex) && state.sceneIndex >= 1 && state.sceneIndex <= 5 &&
    typeof scene?.chapterTitle === 'string' && typeof scene.location === 'string' && typeof scene.imagePrompt === 'string' &&
    Array.isArray(scene.narration) && scene.narration.every(p=>typeof p==='string') &&
    Array.isArray(scene.choices) && scene.choices.every(c=>typeof c?.id==='string' && typeof c.label==='string' && typeof c.hint==='string') &&
    Array.isArray(state.characters) && state.characters.every(c=>typeof c?.name==='string' && typeof c.relationship==='string') &&
    Array.isArray(state.history) && state.history.every(item=>typeof item?.title==='string' && typeof item.decision==='string') &&
    Array.isArray(state.facts) && state.facts.every(f=>typeof f==='string');
}
try {
  fillSetup(JSON.parse(localStorage.getItem(DRAFT)));
  const saved = JSON.parse(localStorage.getItem(SAVE));
  if (isSavedJourney(saved?.journey)) journey = saved.journey;
  if (saved?.pending && ['start','choose'].includes(saved.pending.type) && saved.pending.payload && typeof saved.pending.payload === 'object') pending = saved.pending;
} catch { /* A malformed save should never prevent a new adventure. */ }

async function refreshConfig() {
  try {
    const response = await fetch('/api/config', { cache:'no-store' });
    if (!response.ok) throw new Error('No app server');
    config = await response.json();
    $('#connection-status').textContent = config.configured ? '✧ The storyteller is ready for your idea.' : 'Live generation is not connected yet. Add the project’s Gemini key, or explore the train demo.';
    $('#connection-status').classList.toggle('ready', config.configured);
    $('#ai-illustrations').disabled = !config.illustrations;
    if (!config.illustrations) $('#ai-illustrations').checked = false;
    $('#image-frequency-field').hidden = !$('#ai-illustrations').checked;
    $('#image-access-note').textContent = config.illustrations ? `${config.imageProvider === 'openai' ? 'OpenAI · low quality.' : 'AI illustration.'} Paint only when you ask, or once per scene. Saved images are reused.` : 'Atmospheric scenes are included. Connect an image provider to paint additional illustrations.';
  } catch {
    config = null;
    $('#connection-status').textContent = 'The story server is unavailable. Start the app with python3 last-light/run.py, then use the URL it prints.';
    $('#image-access-note').textContent = 'Atmospheric vector scenes are included with every adventure.';
  }
}

function setBusy(value) {
  busy = value;
  $('#begin-button').disabled = value;
  $('#begin-button span').textContent = value ? 'Writing your opening scene…' : 'Begin my adventure';
  $('#new-adventure').disabled = value || inspecting;
  $('#resume-button').disabled = value;
  $('#turn-loading').hidden = !value;
  $('.generated-panel').setAttribute('aria-busy', String(value));
  document.querySelectorAll('#generated-choices button, #scene-objects button').forEach(button => { button.disabled = value || inspecting; });
  $('#retry-turn').disabled = value;
}
function updateInspectionControls() {
  document.querySelectorAll('#generated-choices button, #scene-objects button').forEach(button=>{button.disabled=busy || inspecting;});
  $('#new-adventure').disabled=busy || inspecting;
  $('#retry-turn').disabled=busy || inspecting;
  $('#retry-inspection').disabled=inspecting;
}
function showError(message, inSetup = false) {
  const node = $(inSetup ? '#setup-error' : '#turn-error'); node.textContent = message; node.hidden = false;
}

async function post(path, payload, timeout = 125000) {
  let response;
  try { response = await fetch(path, { method:'POST', headers:{ 'content-type':'application/json' }, body:JSON.stringify(payload), signal:AbortSignal.timeout(timeout) }); }
  catch { throw new Error('The connection was interrupted. Your last scene is safe. Retry when you are ready.'); }
  let data;
  try { data = await response.json(); }
  catch { throw new Error('The story server could not be reached. Use the app server from python3 last-light/run.py.'); }
  if (!response.ok) throw new Error(data.error || 'This scene could not be completed. Please retry.');
  return data;
}

async function runRequest(request) {
  if (busy || inspecting) return;
  const inSetup = request.type === 'start';
  pending = request; save();
  $('#setup-error').hidden = true; $('#turn-error').hidden = true; $('#retry-turn').hidden = true;
  setBusy(true);
  try {
    const next = await post(`/api/story/${request.type}`, request.payload);
    if (!isSavedJourney(next)) throw new Error('The new scene could not be read. Please retry.');
    journey = next; pending = null; save();
    renderStory(); showStory();
    await loadVisual(journey.state.setup.illustrationMode === 'automatic');
    $('#generated-choices button')?.focus({ preventScroll:true });
  } catch (error) {
    showError(error.message, inSetup);
    if (!inSetup) $('#retry-turn').hidden = false;
  } finally { setBusy(false); }
}

function showStory() {
  $('#setup-screen').hidden = true; $('#adventure-screen').hidden = false;
  $('#adventure-journal').hidden = false; $('#new-adventure').hidden = false;
  $('.sample-link').hidden = true;
}
function showSetup() {
  imageRun++;
  $('#setup-screen').hidden = false; $('#adventure-screen').hidden = true;
  $('#adventure-journal').hidden = true; $('#new-adventure').hidden = true;
  $('.sample-link').hidden = false;
  $('#resume-button').hidden = !journey;
  $('#setup-error').hidden = true;
  $('#premise').focus({ preventScroll:true });
  refreshConfig();
}

function renderStory() {
  const state = journey.state; const scene = state.scene;
  $('#adventure-chapter').textContent = scene.isEnding ? 'YOUR ADVENTURE · COMPLETE' : `SCENE ${String(state.sceneIndex).padStart(2,'0')} OF 05 · ${['THE BEGINNING','THE COMPLICATION','THE DISCOVERY','THE TURNING POINT','THE ENDING'][state.sceneIndex-1]}`;
  $('#adventure-title').textContent = scene.chapterTitle;
  $('#adventure-story-title').textContent = state.title;
  $('#generated-narration').replaceChildren(...scene.narration.map(p => element('p',p)));
  $('#generated-location').textContent = scene.location;
  $('#generated-scene-number').textContent = `${String(state.sceneIndex).padStart(2,'0')} / 05`;
  $('#visual-mood').textContent = state.setup.tone.toUpperCase();
  $('#visual-type').textContent = 'ATMOSPHERIC SCENE';
  // This function emits only our fixed SVG templates and validated hex colors.
  $('#atmospheric-art').innerHTML = sceneArt(scene.visual, state.id + scene.chapterTitle);
  $('#generated-art').hidden = true; $('#generated-art').removeAttribute('src');
  $('#image-error').hidden = true; $('#image-progress').hidden = true;
  $('#illustrate-scene').hidden = !state.setup.illustrations;
  renderObjects();
  $('#generated-scene-caption').textContent = scene.isEnding ? 'An ending shaped by what you chose.' : 'Your next choice writes the next page.';
  $('#generated-choice-prompt').textContent = scene.isEnding ? 'EVERY ENDING HOLDS ANOTHER BEGINNING' : 'WHAT WILL YOU DO?';
  $('#decision-echo').hidden = !state.history.length;
  $('#decision-echo').textContent = state.history.length ? `✧ You chose: ${state.history.at(-1).decision}` : '';
  $('#generated-choices').replaceChildren(...scene.choices.map((choice, index) => {
    const button = element('button','','choice'); button.type = 'button'; button.dataset.choiceId = choice.id;
    const copy = element('span','','choice-copy'); copy.append(element('strong',choice.label),element('small',choice.hint));
    button.append(element('span',String(index+1).padStart(2,'0'),'choice-number'),copy,element('span','↗','choice-arrow'));
    button.addEventListener('click', () => runRequest({ type:'choose', payload:{ token:journey.token, choiceId:choice.id } }));
    return button;
  }));
  if (scene.isEnding) {
    const button = element('button','Imagine another adventure ↗','choice');
    button.addEventListener('click', () => $('#new-adventure-dialog').showModal()); $('#generated-choices').append(button);
  }
  $('#generated-save-status').textContent = storageAvailable ? '✧ Your journey is saved in this browser.' : 'Saving is unavailable. Keep this tab open to continue.';
  $('#cast-summary').textContent = state.characters.map(c=>c.name).join(' · ');
  $('#journey-status').textContent = `${state.history.length} decisions · ${(state.discoveries || []).length} discoveries`;
  $('#generated-progress').replaceChildren(...['Beginning','Complication','Discovery','Climax','Ending'].map((label,index)=>{
    const li = element('li',''); li.className = index+1 === state.sceneIndex ? 'active' : index+1 < state.sceneIndex ? 'complete' : '';
    if (index+1 === state.sceneIndex) li.setAttribute('aria-current','step');
    li.append(element('span',String(index+1).padStart(2,'0')),element('span',label,'generated-progress-label')); return li;
  }));
}

function renderObjects() {
  const state=journey.state;
  const objects=state.scene.objects || [];
  const positions=objectPositions(objects.length);
  $('#explore-hint').hidden=!objects.length;
  $('#scene-objects').replaceChildren(...objects.map((item,index)=>{
    const button=element('button','','hotspot generated-object');button.type='button';button.dataset.objectId=item.id;
    button.style.left=positions[index][0]+'%';button.style.top=positions[index][1]+'%';
    const found=(state.discoveries || []).some(d=>d.scene===state.sceneIndex && d.id===item.id);
    button.dataset.inspected=String(found);button.setAttribute('aria-label',`Inspect ${item.label}${found ? ', already in your journal' : ''}`);
    const sprite=element('span','','object-sprite');sprite.innerHTML=objectIcon(item.icon);
    const caption=element('span','','hotspot-caption');caption.append(element('i',''),document.createTextNode(item.label),element('span',found?'✓':'+','object-seen'));
    button.append(sprite,caption);button.addEventListener('click',()=>inspectObject(item.id));return button;
  }));
}

async function inspectObject(objectId) {
  if (busy || inspecting || !journey) return;
  const state=journey.state;const item=(state.scene.objects || []).find(object=>object.id===objectId);
  if (!item) return;
  inspectedObjectId=objectId;
  $('#object-title').textContent=item.label;$('#object-description').textContent=item.description;$('#object-clue').textContent=item.clue;
  $('#object-scene-label').textContent=`A CLOSER LOOK · ${state.scene.location}`;
  $('#object-dialog-icon').innerHTML=objectIcon(item.icon);
  $('#retry-inspection').hidden=true;
  if (!$('#object-dialog').open) $('#object-dialog').showModal();
  if ((state.discoveries || []).some(d=>d.scene===state.sceneIndex && d.id===item.id)) {$('#object-memory-status').textContent='✓ This discovery is in your journal.';return;}
  $('#object-memory-status').textContent='Remembering this discovery…';
  inspecting=true;updateInspectionControls();
  try {
    const next=await post('/api/story/inspect',{token:journey.token,objectId},15000);
    if (!isSavedJourney(next)) throw new Error('This discovery could not be saved.');
    journey=next;
    // A retried turn must carry any clues discovered after its earlier failure.
    if (pending?.type==='choose') pending.payload.token=journey.token;
    save();
    const marker=[...document.querySelectorAll('[data-object-id]')].find(button=>button.dataset.objectId===objectId);
    if (marker) {marker.dataset.inspected='true';marker.querySelector('.object-seen').textContent='✓';marker.setAttribute('aria-label',`Inspect ${item.label}, already in your journal`);}
    $('#journey-status').textContent=`${journey.state.history.length} decisions · ${journey.state.discoveries.length} discoveries`;
    $('#object-memory-status').textContent='✓ Discovery saved. The next scene will remember what you found.';
  } catch(error) {$('#object-memory-status').textContent=error.message;$('#retry-inspection').hidden=false;}
  finally {inspecting=false;updateInspectionControls();}
}

function openJournal() {
  if (!journey) return;
  const state = journey.state;
  $('#generated-relationships').replaceChildren(...state.characters.map(person=>{
    const node = element('div','','relationship'); node.append(element('strong',person.name),element('span',person.relationship)); return node;
  }));
  $('#generated-decisions').replaceChildren(...(state.history.length ? state.history.map(item=>`${item.title}: ${item.decision}`) : ['Your first decision is still ahead.']).map(text=>element('li',text)));
  $('#generated-discoveries').replaceChildren(...((state.discoveries || []).length ? state.discoveries.map(item=>`${item.label}: ${item.clue}`) : ['Look closer at the objects in your scene to discover more.']).map(text=>element('li',text)));
  $('#generated-facts').replaceChildren(...state.facts.map(text=>element('li',text)));
  $('#adventure-journal-dialog').showModal();
}

let database;
function imageDB() {
  if (!database) database = new Promise((resolve,reject)=>{
    const req = indexedDB.open('last-light-illustrations',1);
    req.onupgradeneeded = () => req.result.createObjectStore('images');
    req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error);
  });
  return database;
}
async function imageStore(key, value) {
  try {
    const db = await imageDB();
    return await new Promise((resolve,reject)=>{
      const transaction = db.transaction('images',value===undefined?'readonly':'readwrite');
      const request = value===undefined ? transaction.objectStore('images').get(key) : transaction.objectStore('images').put(value,key);
      request.onerror = () => reject(request.error);
      transaction.oncomplete = () => resolve(request.result);
      transaction.onerror = () => reject(transaction.error);
    });
  } catch { return null; }
}
const validImage = data => typeof data === 'string' && /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+=*$/.test(data);
function displayImage(data, state) {
  if (!validImage(data)) return;
  $('#generated-art').src = data;
  $('#generated-art').alt = `Illustration of ${state.scene.location}: ${state.scene.imagePrompt}`;
  $('#generated-art').hidden = false; $('#visual-type').textContent = 'AI SCENE ILLUSTRATION';
  $('#illustrate-scene').hidden=true;
}
async function imageReference(dataUrl) {
  if (!validImage(dataUrl)) return null;
  try {
    const image = new Image(); image.src = dataUrl; await image.decode();
    const canvas = document.createElement('canvas'); const scale = Math.min(1,768/image.width);
    canvas.width = Math.round(image.width*scale); canvas.height = Math.round(image.height*scale);
    canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);
    return { mimeType:'image/jpeg',data:canvas.toDataURL('image/jpeg',.75).split(',')[1] };
  } catch { return null; }
}
async function loadVisual(generateIfMissing = false) {
  if (!journey?.state.setup.illustrations) return;
  const current = journey; const state = current.state; const key = `${state.id}:${state.sceneIndex}`;
  if (imageInFlight.has(key)) return;
  const run = ++imageRun;
  const cached = await imageStore(key);
  if (run !== imageRun) return;
  if (validImage(cached)) { displayImage(cached,state); return; }
  if (!generateIfMissing) {
    $('#illustrate-scene').hidden=false;return;
  }
  imageInFlight.add(key); $('#image-progress').hidden = false; $('#image-error').hidden = true;$('#illustrate-scene').hidden=true;
  const reference = config?.imageReferences && state.sceneIndex > 1 ? await imageReference(await imageStore(`${state.id}:1`)) : null;
  // Image generation runs separately; choices remain available while it paints.
  post('/api/story/image',{ token:current.token, ...(reference ? {reference} : {}) }).then(async result=>{
    if (!validImage(result.dataUrl)) throw new Error('The illustration could not be displayed.');
    await imageStore(key,result.dataUrl);
    if (run === imageRun) displayImage(result.dataUrl,state);
  }).catch(error=>{
    if (run === imageRun) { $('#image-error-text').textContent = error.message; $('#image-error').hidden = false; }
  }).finally(()=>{ imageInFlight.delete(key); if (run === imageRun) $('#image-progress').hidden = true; });
}

$('#setup-form').addEventListener('submit',async event=>{
  event.preventDefault(); if (busy) return;
  await refreshConfig();
  if (!config?.configured) { showError(config ? 'The project’s Gemini connection is not configured yet. Add its API key to begin; the train demo is available now.' : 'Start the app server with python3 last-light/run.py, then open the URL it prints.',true); return; }
  const setup = readSetup();
  const requestId = pending?.type === 'start' && JSON.stringify(pending.payload.setup) === JSON.stringify(setup) ? pending.payload.requestId : crypto.randomUUID();
  runRequest({ type:'start',payload:{ setup,requestId } });
});
$('#setup-form').addEventListener('input',()=>{ try { localStorage.setItem(DRAFT,JSON.stringify(readSetup())); } catch {} });
$('#ai-illustrations').addEventListener('change',()=>{$('#image-frequency-field').hidden=!$('#ai-illustrations').checked;});
const examples = {
  ocean: { premise:'I’m a detective in an underwater city where everyone has forgotten yesterday. A letter arrives in my own handwriting, warning me not to trust the sunrise.', protagonist:'A rookie detective who can hear echoes of lost memories', details:'My partner is a nervous octopus. The city runs on bottled sunlight. Make the mystery hopeful, with no combat.' },
  space: { premise:'I’m the last gardener on a spaceship carrying Earth’s final forest. One morning, the trees start growing star maps—and the ship changes course on its own.', protagonist:'A young botanist who has never seen a real sunrise', details:'My only companion is a maintenance robot that secretly writes poetry. Our choices should affect the forest and our friendship.' },
  forest: { premise:'I’ve inherited a tiny tea shop at the edge of an enchanted forest. My first customer is a dragon who has lost the ability to breathe fire, and the moon has gone missing.', protagonist:'An apprentice tea maker with a very opinionated cat', details:'A cozy adventure about helping strangers. Magic comes from small acts of kindness. No violence or horror.' },
};
document.querySelectorAll('[data-example]').forEach(button=>button.addEventListener('click',()=>{
  fillSetup(examples[button.dataset.example]);
  $('#premise').focus(); try { localStorage.setItem(DRAFT,JSON.stringify(readSetup())); } catch {}
}));
$('#new-adventure').addEventListener('click',()=>$('#new-adventure-dialog').showModal());
$('#cancel-new').addEventListener('click',()=>$('#new-adventure-dialog').close());
$('#confirm-new').addEventListener('click',()=>{ $('#new-adventure-dialog').close(); showSetup(); });
$('#resume-button').addEventListener('click',()=>{ if (journey) { renderStory(); showStory(); loadVisual(); } });
$('#adventure-journal').addEventListener('click',openJournal);
$('#retry-turn').addEventListener('click',()=>{ if (pending) runRequest(pending); });
$('#retry-image').addEventListener('click',()=>loadVisual(true));
$('#illustrate-scene').addEventListener('click',()=>loadVisual(true));
$('#retry-inspection').addEventListener('click',()=>inspectObject(inspectedObjectId));

$('#setup-illustration').innerHTML = sceneArt({ setting:'mountain',sky:'#153943',accent:'#c8dcab',foreground:'#0d252c',timeOfDay:'night' },'the-first-world');
if (journey) {
  renderStory(); showStory(); loadVisual();
  if (pending?.type === 'choose') { showError('Your last request did not finish. Retry it when you are ready.'); $('#retry-turn').hidden = false; }
} else if (pending?.type === 'start') {
  fillSetup(pending.payload.setup); showError('Your opening scene did not finish. Choose “Begin my adventure” to retry the same request.',true);
}
refreshConfig();
