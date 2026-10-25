import test from 'node:test';
import assert from 'node:assert/strict';
import {handleAPI} from '../backend/api.js';
import {validateBlueprint} from '../backend/world.js';
import {worldFixture,worldProviderFixture} from './world-fixtures.js';
import {initialCampaign,advanceCampaign,availableActions,campaignBeat} from '../public/world-rules.js';
const setup={premise:'A young gardener explores a forest station where trees remember lost signals.',tone:'custom',customMood:'Hopeful and quietly mysterious.',artStyle:'custom',customArtStyle:'Rich painted textures, indigo shadows, warm amber light.'};
const env=()=>({GEMINI_API_KEY:'test-world-'+crypto.randomUUID()});
const request=(path,payload)=>new Request('https://world.test/api/world/'+path,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)});
async function start(environment,provider=worldProviderFixture()){const response=await handleAPI(request('start',{setup,requestId:crypto.randomUUID()}),environment,provider);assert.equal(response.status,200);return response.json();}
const world=validateBlueprint(worldFixture());
const play=(ids,c=initialCampaign())=>ids.reduce((c,id)=>advanceCampaign(world,c,id),c);
const main=['rescue_ally','stabilize_source','retrieve_records','repair_machinery','decode_signal','raise_bridge','open_vault','retrieve_relic','activate_relay','open_sanctum','study_consequence'];
test('a longer campaign unlocks physical routes, inventory, three different endings, and no post-ending actions',()=>{
 let c=play(main);assert.equal(c.turn,11);assert.ok(c.flags.includes('route_open'));assert.ok(c.inventory.includes('relic'));assert.equal(campaignBeat(world,c).act,4);
 assert.equal(play(['restore_world'],c).ending,'restore');assert.equal(play(['escape_world'],c).ending,'escape');
 assert.ok(!availableActions(world,c).some(a=>a.id==='bind_pact'));c=play(['make_promise','bind_pact'],c);assert.equal(c.turn,13);assert.equal(c.ending,'pact');assert.equal(availableActions(world,c).length,0);assert.throws(()=>advanceCampaign(world,c,'escape_world'));
});
test('order matters: delaying rescue loses the early route, but late rescue is possible without a softlock',()=>{
 const c=play(['stabilize_source','retrieve_records','scavenge_tools']);assert.ok(c.flags.includes('ally_lost'));assert.ok(!availableActions(world,c).some(a=>a.id==='rescue_ally'));
 const late=play(['trace_missing','repair_machinery','decode_signal','raise_bridge','activate_relay','send_rescue_signal','open_vault','retrieve_relic','open_sanctum','study_consequence','make_promise'],c);
 assert.ok(late.flags.includes('ally_rescued_late'));assert.equal(late.trust,2);assert.ok(!availableActions(world,late).some(a=>a.id==='bind_pact'));assert.equal(play(['restore_world'],late).ending,'restore');
 const safe=play(['rescue_ally','stabilize_source','retrieve_records']);assert.ok(safe.flags.includes('ally_rescued'));assert.equal(safe.trust,2);assert.ok(!safe.flags.includes('ally_lost'));
});
test('risky power ruptures the source; repair changes its visuals but never erases the decision',()=>{
 let c=play(['rescue_ally','draw_power','retrieve_records','repair_machinery','decode_signal','repair_source']);assert.ok(!c.flags.includes('source_broken'));assert.ok(c.flags.includes('power_drawn'));assert.equal(campaignBeat(world,c).landmarkStates.find(s=>s.landmarkId==='source').status,'restored');
 c=play(['raise_bridge','open_vault','retrieve_relic','activate_relay','open_sanctum','study_consequence','make_promise'],c);assert.ok(!availableActions(world,c).some(a=>a.id==='bind_pact'));assert.equal(play(['escape_world'],c).ending,'escape');
 assert.throws(()=>play(['open_vault']));assert.throws(()=>play(['stabilize_source','stabilize_source']));
});
test('API actions are immediate, signed, idempotent and require no AI call; narration cannot change mechanics',async()=>{
 const environment=env(),counter={calls:0,prompts:[]},provider=worldProviderFixture(counter);let j=await start(environment,provider);const initial=j.state.world;assert.equal(initial.landmarks.length,8);assert.equal(counter.calls,1);assert.equal(counter.prompts[0].creativeDirection.mood,setup.customMood);
 const payload={token:j.token,landmarkId:'ally',actionId:'rescue_ally'};const copies=await Promise.all([handleAPI(request('act',payload),environment,provider),handleAPI(request('act',payload),environment,provider)]);const [a,b]=await Promise.all(copies.map(r=>r.json()));assert.equal(a.token,b.token);j=a;assert.equal(j.state.campaign.turn,1);assert.equal(counter.calls,1);assert.deepEqual(j.state.world,initial);
 const n=await (await handleAPI(request('narrate',{token:j.token}),environment,provider)).json();assert.equal(n.turn,1);assert.equal(n.worldId,j.state.id);assert.ok(!n.token);assert.equal(counter.calls,2);assert.deepEqual(counter.prompts[1].campaign,j.state.campaign);
 const inspected=await (await handleAPI(request('inspect',{token:j.token,landmarkId:'archive'}),environment,provider)).json();assert.equal(inspected.state.discoveries.length,1);assert.equal(inspected.state.campaign.turn,1);assert.equal(counter.calls,2);
 assert.equal((await handleAPI(request('act',{token:inspected.token,landmarkId:'vault',actionId:'open_vault'}),environment,provider)).status,400);assert.equal((await handleAPI(request('act',{token:'tampered.signature',landmarkId:'ally',actionId:'rescue_ally'}),environment,provider)).status,409);
 const cross=new Request('https://world.test/api/world/start',{method:'POST',headers:{'content-type':'application/json',origin:'https://other.test'},body:JSON.stringify({setup,requestId:crypto.randomUUID()})});assert.equal((await handleAPI(cross,environment,provider)).status,403);assert.equal(counter.calls,2);
});
test('narration failure leaves the signed mechanical result playable through a complete campaign',async()=>{
 const environment=env();let j=await start(environment);for(const id of [...main,'make_promise','bind_pact']){const a=j.state.beat.actions.find(a=>a.id===id);const response=await handleAPI(request('act',{token:j.token,landmarkId:a.landmarkId,actionId:id}),environment,()=>{throw Error('Must not call AI');});assert.equal(response.status,200);j=await response.json();}assert.equal(j.state.campaign.ending,'pact');const n=await handleAPI(request('narrate',{token:j.token}),environment,async()=>new Response('',{status:429}));assert.equal(n.status,429);assert.equal(j.state.campaign.ending,'pact');
});
test('blueprint validation prevents duplicate roles, unsupported assets, missing names and unsafe colors',()=>{
 const raw=worldFixture();assert.throws(()=>validateBlueprint({...raw,landmarks:raw.landmarks.map((p,i)=>i? p:{...p,kind:'javascript'})}));assert.throws(()=>validateBlueprint({...raw,palette:{...raw.palette,sky:'url(evil)'}}));assert.throws(()=>validateBlueprint({...raw,landmarks:[raw.landmarks[0],raw.landmarks[0],...raw.landmarks.slice(2)]}));assert.throws(()=>validateBlueprint({...raw,actionNames:{}}));
});
