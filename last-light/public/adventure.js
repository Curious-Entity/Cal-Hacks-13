import { examples, localizeExampleValue } from './examples.js';
import { initLanguage, t, getLanguage } from './i18n.js';
import {PREPARED_EXAMPLES,matchesPreparedExample} from './prepared-examples.js';
import { sceneArt } from './scene-art.js';
import { objectIcon, objectPositions } from './scene-objects.js';

const $ = selector => document.querySelector(selector);
initLanguage();
const SAVE = 'last-light-generated-v2';
const DRAFT = 'last-light-setup-v2';
const exampleFields = { premise:'#premise', protagonist:'#protagonist', details:'#story-details', customMood:'#custom-mood', customArtStyle:'#custom-art-style' };
let selectedExample = null;
let exampleLoadController = null;
let journey = null;
let pending = null;
let busy = false;
let inspecting = false;
let inspectedObjectId = null;
let imageRun = 0;
let config = null;
let storyConnection = 'unchecked';
let imagePreferencesSaved = false;
let storageAvailable = true;
const imageInFlight = new Set();

function element(tag, text, className) {
  const node = document.createElement(tag); node.textContent = text;
  if (className) node.className = className;
  return node;
}
function storyElement(tag, text) {
  const node = element(tag, text); node.dataset.storyContent = ''; return node;
}
function save() {
  try { localStorage.setItem(SAVE, JSON.stringify({ journey, pending })); storageAvailable = true; }
  catch { storageAvailable = false; }
}
function readSetup() {
  return { language:getLanguage(), experience:$('#experience').value,premise: $('#premise').value.trim(), protagonist: $('#protagonist').value.trim(), details: $('#story-details').value.trim(), tone: $('#tone').value, artStyle: $('#art-style').value, customMood:$('#custom-mood').value.trim(), customArtStyle:$('#custom-art-style').value.trim(), illustrations: $('#experience').value==='illustrated' && $('#ai-illustrations').checked, illustrationMode:$('#image-frequency').value };
}
function saveDraft() {
  const draft = {...readSetup(),preparedExample:selectedExample?.id||null};
  // Keep exact typed text in drafts; only API submissions trim whitespace.
  for (const [field, selector] of Object.entries(exampleFields)) draft[field] = $(selector).value;
  try { localStorage.setItem(DRAFT, JSON.stringify(draft)); } catch { /* In-memory fallback. */ }
}
function updatePreferenceFields() {
  for (const [select,field,input] of [['#tone','#custom-mood-field','#custom-mood'],['#art-style','#custom-art-field','#custom-art-style']]) {
    const custom=$(select).value==='custom';
    $(field).hidden=!custom;$(input).disabled=!custom;$(input).required=custom;
  }
}
function fillSetup(setup) {
  if (!setup || typeof setup !== 'object') return;
  for (const [key, selector] of Object.entries({ premise:'#premise', protagonist:'#protagonist', details:'#story-details', tone:'#tone', artStyle:'#art-style', customMood:'#custom-mood', customArtStyle:'#custom-art-style',experience:'#experience' })) if (typeof setup[key] === 'string') $(selector).value = localizeExampleValue(key, setup[key], getLanguage());
  if (typeof setup.illustrations==='boolean') { $('#ai-illustrations').checked=setup.illustrations;imagePreferencesSaved=true; }
  if (['on-demand','automatic'].includes(setup.illustrationMode)) $('#image-frequency').value=setup.illustrationMode;
  updatePreferenceFields();
  if (setup.details) $('.story-details').open = true;
  if(selectedExample&&!matchesPreparedExample(readSetup(),selectedExample))selectedExample=null;
  if(setup.preparedExample&&PREPARED_EXAMPLES[setup.preparedExample]&&matchesPreparedExample(readSetup(),PREPARED_EXAMPLES[setup.preparedExample]))selectedExample=PREPARED_EXAMPLES[setup.preparedExample];
  updateExampleControls();
}
function updateExampleControls(){
  const selected=selectedExample;
  $('#prepared-example-note').hidden=!selected;
  $('#prepared-example-title').textContent=selected?'Prepared example · '+selected.title:'';
  if(!busy)$('#begin-button span').textContent=selected?'Open example adventure':'Generate my adventure';
  document.querySelectorAll('[data-prepared-example]').forEach(button=>{button.setAttribute('aria-pressed',String(button.dataset.preparedExample===selected?.id));button.disabled=busy;});
}
async function openPreparedExample(example){
  setBusy(true);$('#setup-error').hidden=true;
  const controller=new AbortController();exampleLoadController=controller;
  $('#example-loading-art').src=example.image;$('#example-loading-title').textContent='Opening '+example.title;
  $('#example-loading-progress').value=0;$('#example-loading-percent').textContent='0%';
  $('#example-loading-status').textContent=example.id==='train'?'Loading the prepared illustrations and story.':'Loading the prepared world and its interactions.';
  $('#example-loading').showModal();let completed=0;
  try{
    await Promise.all(example.assets.map(async path=>{
      const response=await fetch(path,{signal:controller.signal,cache:'force-cache'});
      if(!response.ok)throw new Error('Some of the example could not load. Please try again.');
      const blob=await response.blob();
      if(/\.(jpg|png|webp)$/.test(path)&&typeof createImageBitmap==='function'){const bitmap=await createImageBitmap(blob);bitmap.close();}
      if(controller.signal.aborted)return;
      completed++;$('#example-loading-progress').value=completed/example.assets.length;$('#example-loading-percent').textContent=Math.round(completed/example.assets.length*100)+'%';
    }));
    if(controller.signal.aborted)return;
    sessionStorage.removeItem(example.saveKey);
    location.assign(example.target);
  }catch(error){if(!controller.signal.aborted)showError(error.message||'The example could not open. Please try again.',true);}
  finally{controller.abort();exampleLoadController=null;$('#example-loading').close();setBusy(false);updateExampleControls();}
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

function renderConnectionStatus() {
  const node=$('#connection-status');
  node.classList.toggle('ready',Boolean(config?.configured && storyConnection==='verified'));
  node.classList.toggle('failed',Boolean(config?.configured && storyConnection==='failed'));
  if (!config?.configured) node.textContent='Live generation is not configured. Connect Cloudflare Workers AI or Gemini, or explore the train demo.';
  else if (storyConnection==='verified') node.textContent='✧ Your storyteller is connected.';
  else if (storyConnection==='checking') node.textContent='Checking the story connection and writing your scene…';
  else if (storyConnection==='failed') node.textContent='The last story request failed. Check the error message before retrying.';
  else node.textContent=config.textProvider === 'cloudflare' ? 'Cloudflare Workers AI is configured. Its connection will be checked when you begin.' : 'Gemini is configured. Its connection will be checked when you begin.';
}
async function refreshConfig() {
  try {
    const response = await fetch('/api/config', { cache:'no-store' });
    if (!response.ok) throw new Error('No app server');
    const nextConfig = await response.json();
    if (config && (config.textProvider !== nextConfig.textProvider || config.textModel !== nextConfig.textModel)) storyConnection='unchecked';
    config = nextConfig;
    renderConnectionStatus();
    $('#ai-illustrations').disabled = !config.illustrations;
    if (!config.illustrations) $('#ai-illustrations').checked = false;
    else if (config.imageProvider==='cloudflare' && !imagePreferencesSaved) {
      $('#ai-illustrations').checked=true;$('#image-frequency').value='automatic';
    }
    $('#image-frequency-field').hidden = !$('#ai-illustrations').checked;
    $('#image-access-note').textContent = config.illustrations ? `${config.imageProvider === 'cloudflare' ? 'Cloudflare · daily free allowance.' : config.imageProvider === 'openai' ? 'OpenAI · low quality.' : 'AI illustration.'} Paint only when you ask, or once per scene. Saved images are reused.` : 'Atmospheric scenes are included. Connect an image provider to paint additional illustrations.';
    updateExperience();
  } catch {
    config = null;
    $('#connection-status').classList.remove('ready');$('#connection-status').classList.add('failed');
    $('#connection-status').textContent = 'The story server is unavailable. Start the app with python3 last-light/run.py, then use the URL it prints.';
    $('#image-access-note').textContent = 'Atmospheric vector scenes are included with every adventure.';
  }
}

function setBusy(value) {
  busy = value;
  $('#begin-button').disabled = value;
  $('#begin-button span').textContent = value ? selectedExample?'Opening example adventure…':'Writing your opening scene…' : selectedExample?'Open example adventure':'Generate my adventure';
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
  if (!response.ok) {const error=new Error(data.error || 'This scene could not be completed. Please retry.');error.code=data.code;throw error;}
  return data;
}

async function runRequest(request) {
  if (busy || inspecting) return;
  const inSetup = request.type === 'start';
  pending = request; save();
  $('#setup-error').hidden = true; $('#turn-error').hidden = true; $('#retry-turn').hidden = true;
  storyConnection='checking';renderConnectionStatus();
  setBusy(true);
  try {
    const next = await post(`/api/story/${request.type}`, request.payload);
    if (!isSavedJourney(next)) throw new Error('The new scene could not be read. Please retry.');
    storyConnection='verified';renderConnectionStatus();
    journey = next; pending = null; save();
    renderStory(); showStory();
    await loadVisual(journey.state.setup.illustrationMode === 'automatic');
    $('#generated-choices button')?.focus({ preventScroll:true });
  } catch (error) {
    storyConnection='failed';renderConnectionStatus();
    showError(error.message, inSetup);
    if (!inSetup) $('#retry-turn').hidden = false;
  } finally { setBusy(false); }
}

function showStory() {
  $('#setup-screen').hidden = true; $('#adventure-screen').hidden = false;
  $('#adventure-journal').hidden = false; $('#new-adventure').hidden = false;
  document.querySelectorAll('.sample-link').forEach(link=>link.hidden=true);
}
function showSetup() {
  imageRun++;
  $('#setup-screen').hidden = false; $('#adventure-screen').hidden = true;
  $('#adventure-journal').hidden = true; $('#new-adventure').hidden = true;
  document.querySelectorAll('.sample-link').forEach(link=>link.hidden=false);
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
  const mood=state.setup.tone==='custom' ? state.setup.customMood : state.setup.tone;
  $('#visual-mood').textContent = mood.toUpperCase();$('#visual-mood').title=mood;
  $('#visual-type').textContent = 'ATMOSPHERIC SCENE';
  // This function emits only our fixed SVG templates and validated hex colors.
  $('#atmospheric-art').innerHTML = sceneArt(scene.visual, state.id + scene.chapterTitle);
  $('#generated-art').hidden = true; $('#generated-art').removeAttribute('src');
  $('#image-error').hidden = true; $('#image-progress').hidden = true;
  $('#illustrate-scene').hidden = !state.setup.illustrations;
  renderObjects();
  $('#generated-scene-caption').textContent = scene.isEnding ? 'An ending shaped by what you chose.' : 'Your next choice writes the next page.';
  $('#generated-choice-prompt').textContent = scene.isEnding ? 'EVERY ENDING HOLDS ANOTHER BEGINNING' : 'WHAT WILL YOU DO?';
  $('#decision-echo').dataset.storyContent='';
  $('#decision-echo').hidden = !state.history.length;
  $('#decision-echo').textContent = state.history.length ? t('✧ You chose: {0}',state.history.at(-1).decision) : '';
  $('#generated-choices').replaceChildren(...scene.choices.map((choice, index) => {
    const button = element('button','','choice'); button.type = 'button'; button.dataset.choiceId = choice.id;
    const copy = element('span','','choice-copy'); copy.append(storyElement('strong',choice.label),storyElement('small',choice.hint));
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
    button.dataset.storyAttribute = '';
    button.style.left=positions[index][0]+'%';button.style.top=positions[index][1]+'%';
    const found=(state.discoveries || []).some(d=>d.scene===state.sceneIndex && d.id===item.id);
    button.dataset.inspected=String(found);button.setAttribute('aria-label',t('Inspect {0}{1}',item.label,found ? t(', already in your journal') : ''));
    const sprite=element('span','','object-sprite');sprite.innerHTML=objectIcon(item.icon);
    const caption=element('span','','hotspot-caption');caption.append(element('i',''),storyElement('span',item.label),element('span',found?'✓':'+','object-seen'));
    button.append(sprite,caption);button.addEventListener('click',()=>inspectObject(item.id));return button;
  }));
}

async function inspectObject(objectId) {
  if (busy || inspecting || !journey) return;
  const state=journey.state;const item=(state.scene.objects || []).find(object=>object.id===objectId);
  if (!item) return;
  inspectedObjectId=objectId;
  $('#object-title').textContent=item.label;$('#object-description').textContent=item.description;$('#object-clue').textContent=item.clue;
  $('#object-scene-label').textContent=t('A CLOSER LOOK · {0}',state.scene.location);$('#object-scene-label').dataset.storyContent='';
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
    if (marker) {marker.dataset.inspected='true';marker.querySelector('.object-seen').textContent='✓';marker.setAttribute('aria-label',t('Inspect {0}, already in your journal',item.label));}
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
  $('#generated-decisions').replaceChildren(...(state.history.length ? state.history.map(item=>`${item.title}: ${item.decision}`) : [t('Your first decision is still ahead.')]).map(text=>element('li',text)));
  $('#generated-discoveries').replaceChildren(...((state.discoveries || []).length ? state.discoveries.map(item=>`${item.label}: ${item.clue}`) : [t('Look closer at the objects in your scene to discover more.')]).map(text=>element('li',text)));
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
  $('#generated-art').dataset.storyAttribute = '';
  $('#generated-art').src = data;
  $('#generated-art').alt = t('Illustration of {0}: {1}',state.scene.location,state.scene.imagePrompt);
  $('#generated-art').hidden = false; $('#visual-type').textContent = 'AI SCENE ILLUSTRATION';
  $('#illustrate-scene').hidden=true;
}
async function imageReference(dataUrl, maximumDimension = 768) {
  if (!validImage(dataUrl)) return null;
  try {
    const image = new Image(); image.src = dataUrl; await image.decode();
    const canvas = document.createElement('canvas'); const scale = Math.min(1,maximumDimension/Math.max(image.width,image.height));
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
  const reference = config?.imageReferences && state.sceneIndex > 1 ? await imageReference(await imageStore(`${state.id}:1`),config.imageReferenceMaxDimension || 768) : null;
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
  if(selectedExample){if(matchesPreparedExample(readSetup(),selectedExample)){await openPreparedExample(selectedExample);return;}selectedExample=null;updateExampleControls();}
  await refreshConfig();
  if (!config?.configured) { showError(config ? 'The text provider is not configured. Add Cloudflare Workers AI or Gemini credentials on the server; the train demo is available now.' : 'Start the app server with python3 last-light/run.py, then open the URL it prints.',true); return; }
  const setup = readSetup();
  if(setup.experience==='world') {
    try{sessionStorage.setItem('last-light-world-request',JSON.stringify({setup,requestId:crypto.randomUUID()}));location.assign('/world.html?new=1');}catch{showError('Browser storage is unavailable. Enable storage for this site to create and save your world.',true);}
    return;
  }
  const requestId = pending?.type === 'start' && JSON.stringify(pending.payload.setup) === JSON.stringify(setup) ? pending.payload.requestId : crypto.randomUUID();
  runRequest({ type:'start',payload:{ setup,requestId } });
});
$('#setup-form').addEventListener('input',event=>{ selectedExample=null;updateExampleControls();if (['ai-illustrations','image-frequency'].includes(event.target.id)) imagePreferencesSaved=true;saveDraft(); });
$('#ai-illustrations').addEventListener('change',()=>{$('#image-frequency-field').hidden=!$('#ai-illustrations').checked;});
$('#tone').addEventListener('change',updatePreferenceFields);
$('#art-style').addEventListener('change',updatePreferenceFields);
function updateExperience(){const world=$('#experience').value==='world';$('.image-option').hidden=world;$('#image-frequency-field').hidden=world||!$('#ai-illustrations').checked;$('#experience-help').textContent=world?'Jump for power cells, escort companions, solve floor puzzles, and shape the world through play.':'Read one scene at a time, inspect objects, and decide what happens next.';}
$('#experience').addEventListener('change',updateExperience);
document.querySelectorAll('[data-example]').forEach(button=>button.addEventListener('click',()=>{
  selectedExample=null;fillSetup(examples[button.dataset.example][getLanguage()]);updateExampleControls();
  $('#premise').focus(); saveDraft();
}));
document.querySelectorAll('[data-prepared-example]').forEach(button=>button.addEventListener('click',()=>{
  if(busy)return;selectedExample=PREPARED_EXAMPLES[button.dataset.preparedExample];
  fillSetup(selectedExample.setup);updateExperience();updateExampleControls();$('#image-frequency-field').hidden=selectedExample.setup.experience!=='illustrated';
  try{localStorage.setItem(DRAFT,JSON.stringify({...readSetup(),preparedExample:selectedExample.id}));}catch{}
  $('#setup-form').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'});$('#premise').focus({preventScroll:true});
}));
$('#use-live-generation').onclick=()=>{selectedExample=null;updateExampleControls();try{localStorage.setItem(DRAFT,JSON.stringify(readSetup()));}catch{}};
$('#cancel-example-loading').onclick=()=>exampleLoadController?.abort();
$('#example-loading').addEventListener('cancel',event=>{event.preventDefault();exampleLoadController?.abort();});
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
  fillSetup(pending.payload.setup); showError('Your opening scene did not finish. Choose “Generate my adventure” to retry the same request.',true);
}
refreshConfig();

function localizeExampleFields() {
  let changed = false;
  for (const [field, selector] of Object.entries(exampleFields)) {
    const input = $(selector);
    const value = localizeExampleValue(field, input.value, getLanguage());
    if (value !== input.value) { input.value = value; input.setCustomValidity(''); changed = true; }
  }
  if (changed) saveDraft();
}
window.addEventListener('languagechange', () => {
  localizeExampleFields();
  if (config) renderConnectionStatus();
  if (!journey) return;
  const state = journey.state;
  if (state.history.length) $('#decision-echo').textContent = t('✧ You chose: {0}', state.history.at(-1).decision);
  if ($('#adventure-journal-dialog').open) openJournal();
  const item = state.scene.objects?.find(item => item.id === inspectedObjectId);
  if (item) $('#object-scene-label').textContent = t('A CLOSER LOOK · {0}',state.scene.location);
  renderObjects(); updateInspectionControls();
  if (!$('#generated-art').hidden) $('#generated-art').alt = t('Illustration of {0}: {1}',state.scene.location,state.scene.imagePrompt);
});
updateExperience();
try{$('#resume-world').hidden=!JSON.parse(localStorage.getItem('last-light-world-v3'))?.journey?.token;}catch{}
if(new URL(location.href).searchParams.has('create'))showSetup();
