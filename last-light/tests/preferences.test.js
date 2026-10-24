import test from 'node:test';
import assert from 'node:assert/strict';
import { handleAPI } from '../backend/adventure.js';
import { illustrationPrompt } from '../backend/images.js';
import { providerFixture } from './fixtures.js';

const setup = {
  premise:'A gardener follows a constellation map hidden in the last forest.',
  tone:'custom', customMood:'Bittersweet, gently funny, and hopeful.',
  artStyle:'custom', customArtStyle:'Gouache on rough paper, indigo shadows and warm amber light.',
};
const request = (path,body) => new Request('https://adventure.test/api/story/'+path,{
  method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body),
});

test('custom preferences carry through the opening, later scenes, and illustration prompt',async()=>{
  const env={GEMINI_API_KEY:'test-preferences-'+crypto.randomUUID()};
  const counter={calls:0,prompts:[]};const provider=providerFixture(counter);
  const opening=await handleAPI(request('start',{setup,requestId:crypto.randomUUID()}),env,provider);
  assert.equal(opening.status,200);const journey=await opening.json();
  assert.deepEqual(counter.prompts[0].creativeDirection,{mood:setup.customMood,artDirection:setup.customArtStyle});
  const next=await handleAPI(request('choose',{token:journey.token,choiceId:'trust_partner'}),env,provider);
  assert.equal(next.status,200);const second=await next.json();
  assert.equal(counter.prompts[1].creativeDirection.mood,setup.customMood);
  assert.equal(counter.prompts[1].creativeDirection.artDirection,setup.customArtStyle);
  assert.ok(illustrationPrompt(second.state).includes(setup.customMood));
  assert.ok(illustrationPrompt(second.state).includes(setup.customArtStyle));
});

test('blank or oversized custom preferences are rejected before any provider call',async()=>{
  let calls=0;const provider=()=>{calls++;throw new Error('Must not call');};
  const invalid=[{customMood:''},{customMood:'   '},{customMood:'x'.repeat(241)},
    {customArtStyle:''},{customArtStyle:'x'.repeat(401)},{customMood:42}];
  for (const change of invalid) {
    const response=await handleAPI(request('start',{setup:{...setup,...change},requestId:crypto.randomUUID()}),{GEMINI_API_KEY:'test-only'},provider);
    assert.equal(response.status,400);
  }
  assert.equal(calls,0);
});
