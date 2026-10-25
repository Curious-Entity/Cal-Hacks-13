import { createWorldRenderer } from './world-engine.js';
const $ = selector => document.querySelector(selector);
const SAVE = 'last-light-world-v3', REQUEST = 'last-light-world-request';
let journey = null, engine = null, position = null, pending = null, busy = false, selectedId = null, missions = {}, presentation = null, lastSave = 0, noticeTimer, narrating = false, narrationQueued = false, queued = null;
const node = (tag, text) => { const n = document.createElement(tag); n.textContent = text; return n; };
function validJourney(value) { const s = value?.state; return typeof value?.token === 'string' && value.token.length < 160000 && s?.version === 3 && s.mode === 'world' && s.world?.playMode === 'active' && s.world.layout?.version === 1 && s.world.landmarks?.length === 8 && Array.isArray(s.beat?.actions) && Array.isArray(s.beat.narration) && Number.isInteger(s.campaign?.turn); }
try {
    const stored = JSON.parse(localStorage.getItem(SAVE));
    if (validJourney(stored?.journey)) {
        ({ journey, position, pending, missions = {}, presentation = null } = stored);
    }
}
catch { }
function save() { if (!journey)
    return; try {
    missions = engine?.missions() || missions;
    localStorage.setItem(SAVE, JSON.stringify({ journey, position, pending, missions, presentation }));
    $('#world-save-status').textContent = 'Your world, position, and unfinished objectives are saved here.';
}
catch {
    $('#world-save-status').textContent = 'Browser saving is unavailable. Keep this tab open.';
} }
async function post(path, payload) { let response; try {
    response = await fetch('/api/world/' + path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload), signal: AbortSignal.timeout(100000) });
}
catch {
    throw Error('Connection interrupted. Your progress is saved; retry when ready.');
} const data = await response.json().catch(() => ({})); if (!response.ok)
    throw Error(data.error || 'The world could not be reached.'); if (path !== 'narrate' && !validJourney(data))
    throw Error('This world uses earlier gameplay rules. Start a new world for playable missions.'); return data; }
function notice(text, persistent = false) { clearTimeout(noticeTimer); $('#world-notice').textContent = text; $('#world-notice').hidden = false; if (!persistent)
    noticeTimer = setTimeout(() => $('#world-notice').hidden = true, 4500); }
function error(text) { $('#world-error span').textContent = text; $('#world-error').hidden = false; $('#retry-world').hidden = !pending; }
function setBusy(value) { busy = value; $('#inspect-landmark').disabled = value || !engine?.nearby(); $('#retry-world').disabled = value; if (!value && queued && !pending) {
    const next = queued;
    queued = null;
    queueMicrotask(() => commit(next));
} }
function closeLandmark() { selectedId = null; $('#landmark-card').hidden = true; engine?.focus(); }
function renderStory() { const s = journey.state, prose = presentation?.worldId === s.id && presentation.turn === s.campaign.turn ? presentation.narration : s.beat.narration; $('#world-narration').replaceChildren(...prose.map(p => node('p', p))); }
async function narrate() { if (narrating) {
    narrationQueued = true;
    return;
} if (!journey?.state.campaign.turn)
    return; narrating = true; narrationQueued = false; const snapshot = journey; $('#narration-status').textContent = 'Writing what happened… Keep playing.'; try {
    const p = await post('narrate', { token: snapshot.token });
    if (p.worldId === journey.state.id && p.turn === journey.state.campaign.turn && p.narration?.every(v => typeof v === 'string')) {
        presentation = p;
        renderStory();
        save();
        $('#narration-status').textContent = '';
    }
}
catch {
    $('#narration-status').textContent = 'Your mission succeeded. Showing its outcome while AI narration is unavailable.';
}
finally {
    narrating = false;
    if (narrationQueued)
        narrate();
} }
function renderLandmark() { if (!selectedId)
    return; const s = journey.state, p = s.world.landmarks.find(p => p.id === selectedId), status = s.beat.landmarkStates.find(v => v.landmarkId === p.id); $('#landmark-kind').textContent = 'FIELD NOTES · ' + status.status.toUpperCase(); $('#landmark-title').textContent = p.name; $('#landmark-description').textContent = p.description; $('#landmark-clue').textContent = p.clue; $('#landmark-change').textContent = 'Play the objective in the scene. These notes do not perform an action.'; $('#landmark-memory').textContent = s.discoveries.some(v => v.id === p.id) ? '✓ Recorded in your journal.' : 'Remembering this clue…'; $('#landmark-card').hidden = false; }
function render() { const s = journey.state; $('#world-title').textContent = s.world.title; document.title = s.world.title + ' · Unwritten'; $('#world-objective').textContent = s.beat.objective; $('#world-chapter').textContent = s.beat.isEnding ? 'YOUR JOURNEY · COMPLETE' : `ACT ${s.sceneIndex} · ${s.world.layout.variant.toUpperCase()} DISTRICTS`; $('#world-progress').replaceChildren(...Array.from({ length: 4 }, (_, i) => { const n = node('span', ''); n.className = i + 1 < s.sceneIndex ? 'done' : i + 1 === s.sceneIndex ? 'active' : ''; return n; })); $('#world-inventory').textContent = 'PACK · ' + (s.campaign.inventory.map(i => s.world.itemNames?.[i] || i.replaceAll('_', ' ')).join(' · ') || 'empty') + ' | TRUST ' + s.campaign.trust; renderStory(); engine.applyState(s); renderLandmark(); drawMap(); save(); }
function drawMap() { if (!journey)
    return; const canvas = $('#minimap'), ctx = canvas.getContext('2d'), center = 110, scale = 1.8, s = journey.state; ctx.clearRect(0, 0, 220, 220); ctx.strokeStyle = '#abc88f55'; ctx.lineWidth = 2; for (const path of s.world.layout.paths) {
    ctx.beginPath();
    path.forEach((p, i) => i ? ctx.lineTo(center + p.x * scale, center + p.z * scale) : ctx.moveTo(center + p.x * scale, center + p.z * scale));
    ctx.stroke();
} for (const [i, p] of s.world.landmarks.entries()) {
    const x = center + p.x * scale, z = center + p.z * scale;
    ctx.fillStyle = s.beat.actions.some(a => a.landmarkId === p.id) ? '#e0eab3' : '#819e98';
    ctx.beginPath();
    ctx.arc(x, z, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.font = '9px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(String(i + 1), x, z + 13);
} ctx.strokeStyle = '#76dce3'; ctx.beginPath(); ctx.arc(center, center, 7, 0, Math.PI * 2); ctx.stroke(); if (position) {
    ctx.save();
    ctx.translate(center + position.x * scale, center + position.z * scale);
    ctx.rotate(-position.yaw);
    ctx.fillStyle = '#fff3cf';
    ctx.beginPath();
    ctx.moveTo(0, -6);
    ctx.lineTo(-4, 5);
    ctx.lineTo(4, 5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    $('#world-coordinates').textContent = `${Math.round(position.x)} · ${Math.round(position.z)}`;
} }
async function commit(completion, retry = false) { if (busy) {
    queued = completion;
    return;
} if (!journey || pending && !retry)
    return; const action = journey.state.beat.actions.find(a => a.id === completion.actionId); if (!action)
    return; if (!retry)
    pending = { token: journey.token, landmarkId: action.landmarkId, actionId: action.id, challenge: completion.challenge }; save(); setBusy(true); $('#world-error').hidden = true; try {
    journey = await post('act', pending);
    pending = null;
    presentation = null;
    render();
    notice('✧ ' + journey.state.beat.title);
    narrate();
}
catch (e) {
    error(e.message);
    save();
}
finally {
    setBusy(false);
} }
function showWorld() { engine = createWorldRenderer($('#world-view'), journey.state.world, { id: journey.state.id, position, missions, onComplete: completion => commit(completion), onTask: (text, progress) => { $('#mission-task').textContent = text; $('#mission-progress').value = progress || 0; }, onTaskProgress: p => $('#mission-progress').value = p || 0, onNotice: notice, onLock: locked => { $('#camera-lock').textContent = locked ? 'Unlock camera · Shift' : 'Lock camera · Shift'; $('#crosshair').hidden = !locked; }, onVitals: ({ health, stamina }) => { $('#health-meter').value = health; $('#stamina-meter').value = stamina; }, onNearby: p => { if (selectedId && selectedId !== p?.id)
        closeLandmark(); $('#nearby-label').textContent = p?.name || 'Explore the winding paths'; $('#inspect-landmark').disabled = busy || !p; }, onMove: p => { position = p; drawMap(); if (Date.now() - lastSave > 1400) {
        lastSave = Date.now();
        save();
    } } }); for (const id of ['quest-card', 'map-panel', 'world-story', 'world-controls', 'world-interaction', 'mission-panel'])
    $('#' + id).hidden = false; $('#touch-controls').hidden = !matchMedia('(pointer:coarse)').matches; $('#world-journal').disabled = false; $('#world-loading').hidden = true; if (matchMedia('(pointer:coarse)').matches) {
    $('#world-narration').hidden = true;
    $('#world-save-status').hidden = true;
    $('#toggle-story').setAttribute('aria-expanded', 'false');
    $('#toggle-story span').textContent = '+';
} render(); engine.focus(); }
async function inspect(id) { if (busy || !journey)
    return; selectedId = id; engine.unlock(); renderLandmark(); if (journey.state.discoveries.some(p => p.id === id))
    return; setBusy(true); try {
    journey = await post('inspect', { token: journey.token, landmarkId: id });
    if (pending)
        pending.token = journey.token;
    renderLandmark();
    save();
}
catch (e) {
    error(e.message);
}
finally {
    setBusy(false);
} }
function journal() { if (!journey)
    return; const s = journey.state; $('#journal-world-title').textContent = s.world.title; $('#journal-world-description').textContent = s.world.description; $('#world-companions').replaceChildren(...s.world.characters.map(c => node('p', c.name + ' · ' + s.beat.characters.find(p => p.id === c.id)?.relationship))); $('#world-places').replaceChildren(...s.world.landmarks.map((p, i) => node('li', `${i + 1}. ${p.name} — ${p.description}`))); $('#world-decisions').replaceChildren(...(s.history.length ? s.history.map(p => p.decision) : ['Your actions in the scene will write this history.']).map(p => node('li', p))); $('#world-discoveries').replaceChildren(...(s.discoveries.length ? s.discoveries.map(p => p.label + ': ' + p.clue) : ['Look closer at a place with F to learn its history.']).map(p => node('li', p))); engine.unlock(); $('#world-journal-dialog').showModal(); }
let creation;
try {
    creation = JSON.parse(sessionStorage.getItem(REQUEST));
}
catch { }
async function create() { if (busy || !creation?.setup)
    return; setBusy(true); $('#loading-title').textContent = 'Shaping your playable world…'; $('#loading-copy').textContent = 'Finding its districts, paths, characters, and first crisis.'; $('#retry-creation').hidden = true; $('#loading-back').hidden = true; try {
    const next = await post('start', creation);
    engine?.dispose();
    engine = null;
    journey = next;
    position = null;
    pending = null;
    missions = {};
    presentation = null;
    save();
    showWorld();
    sessionStorage.removeItem(REQUEST);
    history.replaceState(null, '', '/world.html');
    notice('Move and jump to play · Blue rings mark safety · F reads clues · No action menu');
}
catch (e) {
    $('#loading-title').textContent = 'Your world is waiting.';
    $('#loading-copy').textContent = e.message;
    $('#retry-creation').hidden = false;
    $('#loading-back').hidden = false;
}
finally {
    setBusy(false);
} }
$('#inspect-landmark').onclick = () => { const p = engine?.nearby(); if (p)
    inspect(p.id); };
$('#close-landmark').onclick = closeLandmark;
$('#camera-lock').onclick = () => engine?.toggleLock();
$('#jump-button').onpointerdown = e => { e.preventDefault(); engine?.jump(); };
$('#world-journal').onclick = journal;
$('#retry-world').onclick = () => pending && commit(pending, true);
$('#dismiss-world-error').onclick = () => $('#world-error').hidden = true;
$('#retry-creation').onclick = create;
$('#toggle-story').onclick = () => { const collapsed = $('#world-narration').hidden; $('#world-narration').hidden = !collapsed; $('#world-save-status').hidden = !collapsed; $('#toggle-story').setAttribute('aria-expanded', String(collapsed)); $('#toggle-story span').textContent = collapsed ? '−' : '+'; };
addEventListener('keydown', e => { if (e.repeat || ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName) || document.querySelector('dialog[open]'))
    return; if (e.code === 'KeyF') {
    e.preventDefault();
    const p = engine?.nearby();
    if (p)
        inspect(p.id);
} if (e.code === 'KeyJ') {
    e.preventDefault();
    journal();
} if (e.code === 'Escape') {
    engine?.unlock();
    closeLandmark();
} });
for (const b of document.querySelectorAll('[data-move]')) {
    b.onpointerdown = e => { e.preventDefault(); b.setPointerCapture(e.pointerId); engine?.setKey(b.dataset.move, true); };
    for (const event of ['pointerup', 'pointercancel', 'lostpointercapture'])
        b.addEventListener(event, () => engine?.setKey(b.dataset.move, false));
}
addEventListener('pagehide', () => { position = engine?.position() || position; save(); engine?.dispose(); });
if (new URL(location.href).searchParams.has('new') && creation?.setup)
    create();
else if (journey) {
    try {
        showWorld();
        if (pending)
            error('Your completed objective is saved. Retry syncing it to continue.');
    }
    catch {
        $('#loading-title').textContent = 'The 3D view could not start.';
        $('#loading-copy').textContent = 'Try a browser with WebGL enabled.';
        $('#loading-back').hidden = false;
    }
}
else {
    $('#loading-title').textContent = 'A world you can play.';
    $('#loading-copy').textContent = 'Start a new world for winding districts, physical puzzles, and companion escorts. Earlier saves remain in this browser.';
    $('#loading-back').hidden = false;
}
