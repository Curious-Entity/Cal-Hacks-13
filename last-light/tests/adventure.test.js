import test from 'node:test';
import assert from 'node:assert/strict';
import { handleAPI, validateScene, verifyJourney } from '../backend/adventure.js';
import { providerFixture, sceneFixture } from './fixtures.js';

const setup = { premise:'I am a detective in an underwater city where everyone has forgotten yesterday.', details:'My partner is an octopus. No combat.', protagonist:'A detective',tone:'mysterious',artStyle:'illustrated',illustrations:false };
const environment = () => ({ GEMINI_API_KEY:'unit-test-only-'+crypto.randomUUID() });
const request = (path, body) => new Request('https://adventure.test'+path,{method:'POST',headers:{'content-type':'application/json',origin:'https://adventure.test'},body:JSON.stringify(body)});

test('a premise creates only one scene, then each selected choice generates one next scene',async()=>{
  const env=environment(); const counter={calls:0,prompts:[]}; const provider=providerFixture(counter);
  let response=await handleAPI(request('/api/story/start',{setup,requestId:crypto.randomUUID()}),env,provider);
  assert.equal(response.status,200); let journey=await response.json();
  assert.equal(journey.state.sceneIndex,1); assert.equal(counter.calls,1);
  assert.equal(counter.prompts[0].userSetup.premise,setup.premise);
  assert.equal(counter.prompts[0].userSetup.details,setup.details);
  for(let index=2;index<=5;index++) {
    const prior=journey;
    response=await handleAPI(request('/api/story/choose',{token:journey.token,choiceId:'trust_partner'}),env,provider);
    assert.equal(response.status,200); journey=await response.json();
    assert.equal(journey.state.sceneIndex,index); assert.equal(journey.state.history.length,index-1);
    assert.equal(counter.calls,index); assert.equal(counter.prompts.at(-1).chosenAction.id,'trust_partner');
    assert.equal(counter.prompts.at(-1).establishedMemory,prior.state.summary);
    assert.equal(journey.state.characters[0].appearance,prior.state.characters[0].appearance);
  }
  assert.equal(journey.state.scene.isEnding,true); assert.deepEqual(journey.state.scene.choices,[]);
  response=await handleAPI(request('/api/story/choose',{token:journey.token,choiceId:'trust_partner'}),env,provider);
  assert.equal(response.status,400); assert.equal(counter.calls,5);
});

test('duplicate concurrent starts and turns reuse the same response',async()=>{
  const env=environment(); const counter={calls:0,prompts:[]}; const provider=providerFixture(counter);
  const body={setup,requestId:crypto.randomUUID()};
  const first=await Promise.all([handleAPI(request('/api/story/start',body),env,provider),handleAPI(request('/api/story/start',body),env,provider)]);
  const journeys=await Promise.all(first.map(res=>res.json()));
  assert.equal(counter.calls,1); assert.equal(journeys[0].token,journeys[1].token);
  const turn={token:journeys[0].token,choiceId:'follow_echo'};
  await Promise.all([handleAPI(request('/api/story/choose',turn),env,provider),handleAPI(request('/api/story/choose',turn),env,provider)]);
  assert.equal(counter.calls,2);
});

test('tampered journeys and unavailable choices never call the provider',async()=>{
  const env=environment(); let calls=0; const provider=async()=>{calls++;throw new Error('Must not call');};
  let response=await handleAPI(request('/api/story/choose',{token:'tampered.invalid',choiceId:'anything'}),env,provider);
  assert.equal(response.status,409); assert.equal(calls,0);
  const start=await handleAPI(request('/api/story/start',{setup,requestId:crypto.randomUUID()}),env,providerFixture());
  const journey=await start.json();
  response=await handleAPI(request('/api/story/choose',{token:journey.token,choiceId:'invented-choice'}),env,provider);
  assert.equal(response.status,400); assert.equal(calls,0);
  await assert.rejects(()=>verifyJourney(journey.token,environment()));
});

test('missing keys, bad origins, and invalid premises fail clearly before generation',async()=>{
  const noKey=await handleAPI(request('/api/story/start',{setup,requestId:'test-request'}),{});
  assert.equal(noKey.status,503); assert.equal((await noKey.json()).code,'NOT_CONFIGURED');
  const badSetup=await handleAPI(request('/api/story/start',{setup:{...setup,premise:'hi'},requestId:'test-request'}),environment());
  assert.equal(badSetup.status,400);
  const wrongOrigin=new Request('https://adventure.test/api/story/start',{method:'POST',headers:{'content-type':'application/json',origin:'https://other.test'},body:'{}'});
  assert.equal((await handleAPI(wrongOrigin,environment())).status,403);
});

test('provider rate limits preserve the original journey and allow an explicit retry',async()=>{
  const env=environment(); const start=await handleAPI(request('/api/story/start',{setup,requestId:crypto.randomUUID()}),env,providerFixture());
  const journey=await start.json(); const body={token:journey.token,choiceId:'follow_echo'};
  const limited=await handleAPI(request('/api/story/choose',body),env,async()=>new Response('',{status:429}));
  assert.equal(limited.status,429); assert.equal((await limited.json()).code,'RATE_LIMITED');
  assert.equal((await verifyJourney(journey.token,env)).sceneIndex,1);
  const retry=await handleAPI(request('/api/story/choose',body),env,providerFixture());
  assert.equal(retry.status,200); assert.equal((await retry.json()).state.sceneIndex,2);
});

test('bad model responses are rejected and cannot introduce a new cast or invalid colors',()=>{
  const scene=sceneFixture();
  assert.throws(()=>validateScene({...scene,choices:[scene.choices[0],scene.choices[0]]},1));
  assert.throws(()=>validateScene({...scene,visual:{...scene.visual,sky:'url(evil)'}},1));
  assert.throws(()=>validateScene({...scene,isEnding:true},1));
  assert.throws(()=>validateScene({...scene,characters:[{...scene.characters[0],id:'new-person'}]},2,{title:'Original',characters:scene.characters}));
});

test('illustrations are opt-in, separate from text, and cached for a scene',async()=>{
  const env=environment(); const start=await handleAPI(request('/api/story/start',{setup,requestId:crypto.randomUUID()}),env,providerFixture());
  const journey=await start.json();
  const disabled=await handleAPI(request('/api/story/image',{token:journey.token}),env);
  assert.equal(disabled.status,403);
  env.ENABLE_IMAGE_GENERATION='true';
  const enabledStart=await handleAPI(request('/api/story/start',{setup:{...setup,illustrations:true},requestId:crypto.randomUUID()}),env,providerFixture());
  const enabled=await enabledStart.json(); let calls=0;
  const imageProvider=async()=>{calls++;return Response.json({candidates:[{content:{parts:[{inlineData:{mimeType:'image/png',data:'aGVsbG8='}}]}}]});};
  for(let i=0;i<2;i++) {
    const response=await handleAPI(request('/api/story/image',{token:enabled.token}),env,imageProvider);
    assert.equal(response.status,200); assert.match((await response.json()).dataUrl,/^data:image\/png;base64,/);
  }
  assert.equal(calls,1);
});
