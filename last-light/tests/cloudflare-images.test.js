import test from 'node:test';
import assert from 'node:assert/strict';
import {generateCloudflareImage,imageConfiguration} from '../backend/images.js';
import {handleAPI} from '../backend/adventure.js';
import {providerFixture} from './fixtures.js';

const environment=()=>({GEMINI_API_KEY:'test-gemini-'+crypto.randomUUID(),CLOUDFLARE_API_TOKEN:'test-cloudflare-'+crypto.randomUUID(),CLOUDFLARE_ACCOUNT_ID:'a'.repeat(32),IMAGE_PROVIDER:'cloudflare',ENABLE_IMAGE_GENERATION:'true'});
const setup={premise:'A detective explores a city beneath the ocean with an octopus partner.',tone:'custom',customMood:'Hopeful and quietly mysterious.',artStyle:'custom',customArtStyle:'Gouache, amber light and indigo shadows.',illustrations:true};
const request=(path,body)=>new Request('https://adventure.test/api/story/'+path,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
async function opening(env){const response=await handleAPI(request('start',{setup,requestId:crypto.randomUUID()}),env,providerFixture());assert.equal(response.status,200);return response.json();}

test('Cloudflare requires its own token and Account ID and never falls back to paid images',()=>{
  const env=environment();const config=imageConfiguration(env);
  assert.equal(config.enabled,true);assert.equal(config.references,true);assert.equal(config.referenceMaxDimension,480);
  assert.equal(config.model,'@cf/black-forest-labs/flux-2-klein-4b');
  assert.equal(imageConfiguration({...env,CLOUDFLARE_API_TOKEN:'',OPENAI_API_KEY:'test-openai'}).enabled,false);
  assert.equal(imageConfiguration({...env,CLOUDFLARE_ACCOUNT_ID:''}).enabled,false);
  assert.equal(imageConfiguration({...env,ENABLE_IMAGE_GENERATION:'false'}).enabled,false);
});

test('Cloudflare uses multipart, fixed model, stable seed, and binary image references',async()=>{
  const env=environment();const journey=await opening(env);const seeds=[];
  const provider=async(url,options)=>{
    assert.equal(url,'https://api.cloudflare.com/client/v4/accounts/'+env.CLOUDFLARE_ACCOUNT_ID+'/ai/run/@cf/black-forest-labs/flux-2-klein-4b');
    assert.equal(options.headers.Authorization,'Bearer '+env.CLOUDFLARE_API_TOKEN);
    assert.equal(options.headers['content-type'],undefined);assert.ok(options.body instanceof FormData);
    assert.equal(options.body.get('width'),'1024');assert.equal(options.body.get('height'),'768');
    assert.ok(options.body.get('prompt').includes(setup.customArtStyle));
    assert.ok(options.body.get('prompt').includes('input image 0'));
    assert.equal(options.body.get('input_image_0').type,'image/jpeg');seeds.push(options.body.get('seed'));
    return Response.json({success:true,result:{image:'/9j/aGVsbG8='}});
  };
  for(const state of [journey.state,{...journey.state,sceneIndex:2}]) {
    const image=await generateCloudflareImage(state,env,{mimeType:'image/jpeg',data:'aGVsbG8='},provider);
    assert.equal(image.provider,'cloudflare');assert.match(image.dataUrl,/^data:image\/jpeg;base64,/);
  }
  assert.equal(seeds[0],seeds[1]);
});

test('Cloudflare scene cache survives object inspections without generating another image',async()=>{
  const env=environment();const journey=await opening(env);let calls=0;
  const provider=async()=>{calls++;return Response.json({success:true,result:{image:'/9j/aGVsbG8='}});};
  const image=await handleAPI(request('image',{token:journey.token}),env,provider);assert.equal(image.status,200);
  const inspected=await (await handleAPI(request('inspect',{token:journey.token,objectId:'sealed_letter'}),env)).json();
  const again=await handleAPI(request('image',{token:inspected.token}),env,provider);assert.equal(again.status,200);assert.equal(calls,1);
});

test('Cloudflare quota, access, and capacity failures are clear and hide upstream details',async()=>{
  const env=environment();const journey=await opening(env);
  for(const [status,internal,code] of [[429,3036,'CLOUDFLARE_LIMIT'],[429,3040,'IMAGE_RATE_LIMITED'],[403,10000,'CLOUDFLARE_ACCESS'],[403,5035,'CLOUDFLARE_PLAN']]) {
    const response=await handleAPI(request('image',{token:journey.token}),env,async()=>Response.json({success:false,errors:[{code:internal,message:'private-upstream-details'}]},{status}));
    const error=await response.json();assert.equal(error.code,code);assert.doesNotMatch(error.error,/private-upstream-details/);
  }
});

test('bad account IDs and malformed reference data never call Cloudflare',async()=>{
  const env=environment();const journey=await opening(env);let calls=0;
  const provider=()=>{calls++;throw new Error('Must not call');};
  await assert.rejects(()=>generateCloudflareImage(journey.state,{...env,CLOUDFLARE_ACCOUNT_ID:'../other-account'},null,provider));
  await assert.rejects(()=>generateCloudflareImage(journey.state,env,{mimeType:'image/svg+xml',data:'aGVsbG8='},provider));
  assert.equal(calls,0);
});
