import test from 'node:test';
import assert from 'node:assert/strict';
import {handleAPI} from '../backend/api.js';
import {validateBlueprint,validateBeat} from '../backend/world.js';
import {worldFixture,worldBeatFixture,worldProviderFixture} from './world-fixtures.js';
const setup={premise:'A young gardener explores a forest station where trees remember lost signals.',tone:'custom',customMood:'Hopeful and quietly mysterious.',artStyle:'custom',customArtStyle:'Soft low-poly forms, indigo shadows, warm amber light.'};
const env=()=>({GEMINI_API_KEY:'test-world-'+crypto.randomUUID()});
const request=(path,payload)=>new Request('https://world.test/api/world/'+path,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)});
async function start(environment,provider=worldProviderFixture()){const response=await handleAPI(request('start',{setup,requestId:crypto.randomUUID()}),environment,provider);assert.equal(response.status,200);return response.json();}

test('a premise builds a bounded world; landmark actions advance one beat while preserving its map',async()=>{
 const environment=env(),counter={calls:0,prompts:[]},provider=worldProviderFixture(counter);let journey=await start(environment,provider);const initial=journey.state.world;
 assert.equal(counter.calls,1);assert.equal(journey.state.mode,'world');assert.equal(journey.state.setup.illustrations,false);assert.deepEqual(initial.landmarks.map(p=>[p.x,p.z]),[[-14,-14],[14,-14],[14,14],[-14,14]]);
 assert.equal(counter.prompts[0].creativeDirection.mood,setup.customMood);
 for(let stage=2;stage<=5;stage++){const response=await handleAPI(request('act',{token:journey.token,landmarkId:'signal_console'}),environment,provider);assert.equal(response.status,200);journey=await response.json();assert.equal(journey.state.sceneIndex,stage);assert.deepEqual(journey.state.world,initial);assert.equal(journey.state.history.length,stage-1);}
 assert.equal(counter.calls,5);assert.equal(journey.state.beat.isEnding,true);assert.equal(journey.state.beat.actions.length,0);
 assert.equal((await handleAPI(request('act',{token:journey.token,landmarkId:'signal_console'}),environment,provider)).status,400);assert.equal(counter.calls,5);
});

test('inspecting landmarks saves clues without an AI call and carries player knowledge into the next action',async()=>{
 const environment=env(),counter={calls:0,prompts:[]},provider=worldProviderFixture(counter);const journey=await start(environment,provider);
 const inspected=await (await handleAPI(request('inspect',{token:journey.token,landmarkId:'signal_console'}),environment,provider)).json();assert.equal(counter.calls,1);assert.equal(inspected.state.sceneIndex,1);assert.equal(inspected.state.discoveries.length,1);
 const again=await (await handleAPI(request('inspect',{token:inspected.token,landmarkId:'signal_console'}),environment,provider)).json();assert.equal(again.token,inspected.token);assert.equal(again.state.discoveries.length,1);
 const response=await handleAPI(request('act',{token:inspected.token,landmarkId:'memory_well'}),environment,provider);assert.equal(response.status,200);assert.equal(counter.calls,2);assert.match(counter.prompts[1].establishedFacts.join(' '),/below the archive/);assert.equal(counter.prompts[1].selectedAction.landmarkId,'memory_well');
});

test('world retries reuse responses, while invalid actions, tokens, and cross-origin requests never call a model',async()=>{
 const environment=env(),counter={calls:0,prompts:[]},provider=worldProviderFixture(counter);const body={setup,requestId:crypto.randomUUID()};const responses=await Promise.all([handleAPI(request('start',body),environment,provider),handleAPI(request('start',body),environment,provider)]);const journeys=await Promise.all(responses.map(p=>p.json()));assert.equal(counter.calls,1);assert.equal(journeys[0].token,journeys[1].token);
 assert.equal((await handleAPI(request('act',{token:journeys[0].token,landmarkId:'invented'}),environment,provider)).status,400);
 assert.equal((await handleAPI(request('act',{token:'tampered.signature',landmarkId:'signal_console'}),environment,provider)).status,409);
 const cross=new Request('https://world.test/api/world/start',{method:'POST',headers:{'content-type':'application/json',origin:'https://other.test'},body:JSON.stringify(body)});assert.equal((await handleAPI(cross,environment,provider)).status,403);assert.equal(counter.calls,1);
 const action={token:journeys[0].token,landmarkId:'signal_console'};await Promise.all([handleAPI(request('act',action),environment,provider),handleAPI(request('act',action),environment,provider)]);assert.equal(counter.calls,2);
 const image=new Request('https://world.test/api/story/image',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({token:journeys[0].token})});assert.equal((await handleAPI(image,environment,provider)).status,400);assert.equal(counter.calls,2);
});

test('malformed world plans and state updates cannot introduce unsupported meshes or change landmark IDs',()=>{
 const raw=worldFixture(),world=validateBlueprint(raw),beat=worldBeatFixture(1,world);
 assert.throws(()=>validateBlueprint({...raw,landmarks:[{...raw.landmarks[0],kind:'javascript'},...raw.landmarks.slice(1)]}));
 assert.throws(()=>validateBlueprint({...raw,palette:{...raw.palette,sky:'url(evil)'}}));
 assert.throws(()=>validateBlueprint({...raw,landmarks:[raw.landmarks[0],raw.landmarks[0],...raw.landmarks.slice(2)]}));
 assert.throws(()=>validateBeat({...beat,landmarkStates:[{...beat.landmarkStates[0],landmarkId:'other'},...beat.landmarkStates.slice(1)]},world,1));
 assert.throws(()=>validateBeat({...beat,characters:[{...beat.characters[0],id:'new_actor'}]},world,1));
});
