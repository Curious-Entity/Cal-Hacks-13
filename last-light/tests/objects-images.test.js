import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {handleAPI,validateScene} from '../backend/adventure.js';
import {generateOpenAIImage,imageConfiguration} from '../backend/images.js';
import {providerFixture,sceneFixture} from './fixtures.js';

const setup={premise:'A detective investigates an underwater city where everyone forgot yesterday.',details:'An octopus partner and a missing letter.',protagonist:'A detective',tone:'mysterious',artStyle:'illustrated',illustrations:true,illustrationMode:'on-demand'};
const env=()=>({GEMINI_API_KEY:'test-gemini-'+crypto.randomUUID(),OPENAI_API_KEY:'test-openai-'+crypto.randomUUID(),ENABLE_IMAGE_GENERATION:'true',IMAGE_PROVIDER:'openai'});
const request=(path,body)=>new Request('https://adventure.test'+path,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
async function opening(environment,provider=providerFixture()) {
  const response=await handleAPI(request('/api/story/start',{setup,requestId:crypto.randomUUID()}),environment,provider);
  assert.equal(response.status,200);return response.json();
}

test('object inspections reveal and save clues without a model call or advancing the story',async()=>{
  const environment=env();const counter={calls:0,prompts:[]};const provider=providerFixture(counter);
  const journey=await opening(environment,provider);
  const first=await handleAPI(request('/api/story/inspect',{token:journey.token,objectId:'sealed_letter'}),environment,provider);
  assert.equal(first.status,200);const inspected=await first.json();
  assert.equal(counter.calls,1);assert.equal(inspected.state.sceneIndex,1);
  assert.equal(inspected.state.discoveries.length,1);assert.match(inspected.state.facts.join(' '),/stored beneath the observatory/);
  const duplicate=await handleAPI(request('/api/story/inspect',{token:inspected.token,objectId:'sealed_letter'}),environment,provider);
  const repeated=await duplicate.json();assert.equal(repeated.state.discoveries.length,1);assert.equal(repeated.token,inspected.token);
  const next=await handleAPI(request('/api/story/choose',{token:inspected.token,choiceId:'trust_partner'}),environment,provider);
  assert.equal(next.status,200);assert.equal(counter.calls,2);
  assert.equal(counter.prompts.at(-1).objectsExamined[0].id,'sealed_letter');
  assert.match(counter.prompts.at(-1).establishedFacts.join(' '),/stored beneath the observatory/);
});

test('unknown scene objects and tampered inspection tokens are rejected',async()=>{
  const environment=env();const journey=await opening(environment);
  const unknown=await handleAPI(request('/api/story/inspect',{token:journey.token,objectId:'invented_key'}),environment);
  assert.equal(unknown.status,400);
  const tampered=await handleAPI(request('/api/story/inspect',{token:'invalid.signature',objectId:'sealed_letter'}),environment);
  assert.equal(tampered.status,409);
});

test('OpenAI images use one low-quality square image and skip reference input by default',async()=>{
  const environment=env();const journey=await opening(environment);let calls=0;
  const provider=async(url,options)=>{
    calls++;assert.equal(url,'https://api.openai.com/v1/images/generations');
    assert.equal(options.headers.Authorization,`Bearer ${environment.OPENAI_API_KEY}`);
    const body=JSON.parse(options.body);
    assert.equal(body.n,1);assert.equal(body.quality,'low');assert.equal(body.size,'1024x1024');assert.equal(body.output_format,'jpeg');
    assert.equal(body.model,'gpt-image-2.5-flare');assert.equal(body.image,undefined);
    return Response.json({data:[{b64_json:'aGVsbG8='}],output_format:'jpeg'});
  };
  const image=await generateOpenAIImage(journey.state,environment,{mimeType:'image/png',data:'aGVsbG8='},provider);
  assert.match(image.dataUrl,/^data:image\/jpeg;base64,/);assert.equal(calls,1);
});

test('inspecting an object does not trigger another image-generation charge',async()=>{
  const environment=env();let images=0;const journey=await opening(environment);
  const provider=async()=>{images++;return Response.json({data:[{b64_json:'aGVsbG8='}],output_format:'jpeg'});};
  const first=await handleAPI(request('/api/story/image',{token:journey.token}),environment,provider);assert.equal(first.status,200);
  const inspection=await handleAPI(request('/api/story/inspect',{token:journey.token,objectId:'shortwave_radio'}),environment);
  const next=await inspection.json();
  const again=await handleAPI(request('/api/story/image',{token:next.token}),environment,provider);assert.equal(again.status,200);assert.equal(images,1);
});

test('OpenAI quota errors preserve the story and do not expose upstream details',async()=>{
  const environment=env();const journey=await opening(environment);
  for (const error of [{code:'insufficient_quota'},{code:'credit_balance_exhausted',type:'insufficient_quota'}]) {
    const result=await handleAPI(request('/api/story/image',{token:journey.token}),environment,async()=>Response.json({error:{...error,message:'Sensitive upstream details'}},{status:429}));
    assert.equal(result.status,429);const body=await result.json();assert.equal(body.code,'IMAGE_QUOTA');assert.doesNotMatch(body.error,/Sensitive upstream details/);
  }
  assert.equal(journey.state.sceneIndex,1);
});

test('object schemas reject duplicate IDs, unsupported icons, and oversized descriptions',()=>{
  const scene=sceneFixture();
  assert.throws(()=>validateScene({...scene,objects:[scene.objects[0],scene.objects[0]]},1));
  assert.throws(()=>validateScene({...scene,objects:[{...scene.objects[0],icon:'<script>'},scene.objects[1]]},1));
  assert.throws(()=>validateScene({...scene,objects:[{...scene.objects[0],description:'x'.repeat(651)},scene.objects[1]]},1));
});

test('image configuration does not advertise a provider without its key',()=>{
  assert.equal(imageConfiguration({GEMINI_API_KEY:'test',IMAGE_PROVIDER:'openai',ENABLE_IMAGE_GENERATION:'true'}).enabled,false);
  assert.equal(imageConfiguration(env()).enabled,true);assert.equal(imageConfiguration(env()).references,false);
});

test('the tracked environment template contains no credential values',async()=>{
  const source=await readFile(new URL('../.env.example',import.meta.url),'utf8');
  const assigned=source.split(/\r?\n/).some(line=>/^\s*(GEMINI_API_KEY|GOOGLE_API_KEY|OPENAI_API_KEY|STORY_SESSION_SECRET)\s*=\s*\S/.test(line));
  assert.ok(!assigned,'Remove credential values from .env.example; keep them only in the ignored .env file.');
});
