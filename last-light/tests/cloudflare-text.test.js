import test from 'node:test';
import assert from 'node:assert/strict';
import { handleAPI, signJourney, verifyJourney, validateSetup } from '../backend/adventure.js';
import { textConfiguration, CLOUDFLARE_TEXT_MODEL } from '../backend/text.js';
import { sceneFixture, providerFixture } from './fixtures.js';

const environment = () => ({CLOUDFLARE_ACCOUNT_ID:'a'.repeat(32),CLOUDFLARE_API_TOKEN:'test-cloudflare-'+crypto.randomUUID(),IMAGE_PROVIDER:'cloudflare',ENABLE_IMAGE_GENERATION:'true'});
const setup = {premise:'A detective explores an underwater city with an octopus partner.',illustrations:true,tone:'mysterious',artStyle:'watercolor'};
const request = (action, body) => new Request('https://adventure.test/api/story/'+action,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
const start = (env, fetcher, changes = {}, requestId = crypto.randomUUID()) => handleAPI(request('start',{setup:{...setup,...changes},requestId}),env,fetcher);

function chineseScene(index, selected) {
  const scene = sceneFixture(index,selected);
  return {...scene,storyTitle:'遗忘之城',chapterTitle:`第${index}幕：失落的清晨`,location:'玻璃观测站',
    narration:['你在海底观测站读到一封亲笔信。城市的灯光渐渐熄灭。','你的章鱼搭档提出一个计划，你的选择会改变城市的未来。'],
    choices:scene.choices.map(choice=>({...choice,label:choice.id==='trust_partner'?'信任搭档':'独自追寻回声',hint:'你的行动会影响接下来的故事。'})),
    characters:scene.characters.map(person=>({...person,name:'小欧',description:'你的章鱼搭档',relationship:'记得你此前的选择'})),
    memorySummary:`侦探已完成第${index}幕。`,newFacts:[`城市揭示了第${index}条线索。`],
    objects:scene.objects.map(item=>({...item,label:item.id==='sealed_letter'?'密封的信':'短波收音机',description:'物品上有细小的盐粒。',clue:'失落的记忆藏在观测站下方。'}))};
}
function cloudflareFixture(env, records = [], shape = 'chat') {
  return async (url, options) => {
    assert.equal(options.headers.Authorization, 'Bearer '+env.CLOUDFLARE_API_TOKEN);
    assert.equal(options.headers['x-goog-api-key'],undefined);
    if (url.endsWith('/@cf/black-forest-labs/flux-2-klein-4b')) {
      assert.ok(options.body instanceof FormData);
      return Response.json({success:true,result:{image:'aGVsbG8='}});
    }
    assert.equal(url,`https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/ai/run/${env.CLOUDFLARE_TEXT_MODEL || CLOUDFLARE_TEXT_MODEL}`);
    const body = JSON.parse(options.body);
    assert.equal(body.response_format.type,'json_schema');
    assert.equal(body.stream,false);assert.equal(body.max_tokens,5500);
    assert.ok(body.response_format.json_schema.properties.objects);
    assert.ok(!options.body.includes(env.CLOUDFLARE_API_TOKEN));
    const prompt = JSON.parse(body.messages[1].content);
    records.push({body,prompt});
    const scene = prompt.storyLanguage === 'zh-CN' ? chineseScene(prompt.currentSceneNumber,prompt.chosenAction) : sceneFixture(prompt.currentSceneNumber,prompt.chosenAction);
    assert.match(body.messages[0].content, prompt.storyLanguage === 'zh-CN' ? /Simplified Chinese/ : /in English/);
    return Response.json({success:true,result:shape === 'object' ? {response:scene} : shape === 'string' ? {response:JSON.stringify(scene)} : {choices:[{finish_reason:'stop',message:{content:JSON.stringify(scene)}}]}});
  };
}

test('Cloudflare-only configuration needs no Gemini key and exposes no credentials',async()=>{
  const env=environment();
  const response=await handleAPI(new Request('https://adventure.test/api/config'),env);
  const config=await response.json();
  assert.equal(config.configured,true);assert.equal(config.textProvider,'cloudflare');assert.equal(config.illustrations,true);
  assert.equal(config.textModel,CLOUDFLARE_TEXT_MODEL);assert.deepEqual(config.storyLanguages,['en','zh-CN']);
  assert.ok(!JSON.stringify(config).includes(env.CLOUDFLARE_API_TOKEN));assert.ok(!JSON.stringify(config).includes(env.CLOUDFLARE_ACCOUNT_ID));
  assert.equal(textConfiguration({...env,GEMINI_API_KEY:'test'}).provider,'gemini');
  assert.equal(textConfiguration({...env,GEMINI_API_KEY:'test',TEXT_PROVIDER:'cloudflare'}).provider,'cloudflare');
  assert.equal(textConfiguration({...env,TEXT_PROVIDER:'gemini'}).configured,false);
  assert.equal(textConfiguration({GOOGLE_API_KEY:'test'}).provider,'gemini');
});

test('Cloudflare runs all five scenes in either language, preserving clues, cast, memory, and images',async()=>{
  for (const language of ['en','zh-CN']) {
    const env=environment(), records=[];
    const provider=cloudflareFixture(env,records);
    let response=await start(env,provider,{language});assert.equal(response.status,200);
    let journey=await response.json();
    assert.equal(journey.state.setup.language,language);
    const originalCast=journey.state.characters;
    const inspected=await handleAPI(request('inspect',{token:journey.token,objectId:'sealed_letter'}),env,provider);
    assert.equal(inspected.status,200);journey=await inspected.json();assert.equal(records.length,1);
    const clue=journey.state.discoveries[0].clue;
    for(let index=2;index<=5;index++) {
      const prior=journey;
      // A client cannot replace the language saved in its signed journey.
      response=await handleAPI(request('choose',{token:journey.token,choiceId:'trust_partner',language:language==='en'?'zh-CN':'en'}),env,provider);
      assert.equal(response.status,200);journey=await response.json();
      assert.equal(journey.state.sceneIndex,index);assert.equal(journey.state.history.length,index-1);
      assert.equal(journey.state.setup.language,language);assert.equal(records.at(-1).prompt.storyLanguage,language);
      assert.equal(records.at(-1).prompt.establishedMemory,prior.state.summary);
      assert.ok(records.at(-1).prompt.establishedFacts.includes(clue));
      assert.equal(records.at(-1).prompt.objectsExamined[0].clue,clue);
      assert.deepEqual(journey.state.characters.map(c=>c.id),originalCast.map(c=>c.id));
      assert.equal(journey.state.characters[0].appearance,originalCast[0].appearance);
      assert.equal(journey.state.scene.isEnding,index===5);
    }
    assert.equal(records.length,5);assert.deepEqual(journey.state.scene.choices,[]);
    assert.equal((await verifyJourney(journey.token,env)).sceneIndex,5);
    const image=await handleAPI(request('image',{token:journey.token}),env,provider);
    assert.equal(image.status,200);assert.equal((await image.json()).provider,'cloudflare');
    assert.ok(!JSON.stringify(journey).includes(env.CLOUDFLARE_API_TOKEN));
  }
});

test('Cloudflare supports structured object, JSON string, and chat-completion envelopes',async()=>{
  for (const shape of ['object','string','chat']) {
    const env=environment();const response=await start(env,cloudflareFixture(env,[],shape));
    assert.equal(response.status,200);
  }
});

test('bad or truncated Cloudflare output cannot corrupt a signed journey',async()=>{
  const env=environment();const journey=await (await start(env,cloudflareFixture(env))).json();
  const malformed=[
    {success:true,result:{response:'not JSON'}},
    {success:true,result:{response:{...sceneFixture(2),characters:[{...sceneFixture(2).characters[0],id:'replacement'}]}}},
    {success:true,result:{response:{...sceneFixture(2),isEnding:true}}},
    {success:true,result:{choices:[{finish_reason:'length',message:{content:'{}'}}]}},
    {success:true,result:{response:[]}},
  ];
  for(const output of malformed) {
    const response=await handleAPI(request('choose',{token:journey.token,choiceId:'trust_partner'}),env,async()=>Response.json(output));
    assert.equal(response.status,502);assert.equal((await verifyJourney(journey.token,env)).sceneIndex,1);
  }
  const retry=await handleAPI(request('choose',{token:journey.token,choiceId:'trust_partner'}),env,cloudflareFixture(env));
  assert.equal(retry.status,200);
});

test('Cloudflare errors are retryable and never return upstream details or tokens',async()=>{
  const env=environment();const journey=await (await start(env,cloudflareFixture(env))).json();
  for(const [status,internal,code] of [[429,3036,'CLOUDFLARE_TEXT_LIMIT'],[429,3040,'RATE_LIMITED'],[403,10000,'CLOUDFLARE_ACCESS'],[401,0,'CLOUDFLARE_ACCESS'],[404,0,'MODEL_UNAVAILABLE'],[400,0,'CLOUDFLARE_TEXT_REQUEST'],[500,0,'PROVIDER_ERROR'],[200,10000,'CLOUDFLARE_ACCESS']]) {
    const response=await handleAPI(request('choose',{token:journey.token,choiceId:'trust_partner'}),env,async()=>Response.json({success:false,errors:[{code:internal,message:env.CLOUDFLARE_API_TOKEN}]},{status}));
    const error=await response.json();assert.equal(error.code,code);assert.ok(!JSON.stringify(error).includes(env.CLOUDFLARE_API_TOKEN));
  }
  const timedOut=await start(env,async()=>{throw new Error(env.CLOUDFLARE_API_TOKEN);});
  assert.equal((await timedOut.json()).code,'PROVIDER_TIMEOUT');
  const unreadable=await start(env,async()=>new Response('upstream-private-data'));
  assert.equal((await unreadable.json()).code,'INVALID_MODEL_RESPONSE');
});

test('invalid providers, credentials, models, and languages fail without a provider call',async()=>{
  let calls=0;const fetcher=async()=>{calls++;throw Error('must not call');};
  for(const change of [{CLOUDFLARE_API_TOKEN:''},{CLOUDFLARE_ACCOUNT_ID:''},{CLOUDFLARE_ACCOUNT_ID:'../../other'},{TEXT_PROVIDER:'unknown'},{TEXT_PROVIDER:'gemini'},{CLOUDFLARE_TEXT_MODEL:'https://other.test'}]) {
    const response=await start({...environment(),...change},fetcher);assert.equal(response.status,503);
  }
  for(const language of ['fr','',{}]) {
    const response=await start(environment(),fetcher,{language});assert.equal(response.status,400);
  }
  assert.equal(validateSetup(setup).language,'en');assert.equal(validateSetup({...setup,language:null}).language,'en');assert.equal(calls,0);
});

test('deduplication is isolated by text model and signing secret, and stable secrets survive provider changes',async()=>{
  const env=environment(),records=[],requestId=crypto.randomUUID();
  env.STORY_SESSION_SECRET='test-stable-signing-secret';
  const provider=cloudflareFixture(env,records);
  const first=await Promise.all([start(env,provider,{},requestId),start(env,provider,{},requestId)]);
  const journeys=await Promise.all(first.map(r=>r.json()));
  assert.equal(records.length,1);assert.equal(journeys[0].token,journeys[1].token);
  const changed={...env,CLOUDFLARE_TEXT_MODEL:'@cf/meta/llama-3.3-70b-instruct-fp8-fast'};
  assert.equal((await start(changed,cloudflareFixture(changed,records),{},requestId)).status,200);assert.equal(records.length,2);
  const switched={...env,TEXT_PROVIDER:'gemini',GEMINI_API_KEY:'test-gemini'};
  assert.equal((await verifyJourney(journeys[0].token,switched)).sceneIndex,1);
  const next=await handleAPI(request('choose',{token:journeys[0].token,choiceId:'trust_partner'}),switched,providerFixture());assert.equal(next.status,200);
  const newSecret={...env,STORY_SESSION_SECRET:'test-other-secret'};
  const other=await start(newSecret,cloudflareFixture(newSecret,records),{},requestId);
  assert.equal(other.status,200);assert.equal(records.length,3);
  await assert.rejects(()=>verifyJourney(journeys[0].token,newSecret));
});

test('Gemini also receives the selected language; legacy saves default to English',async()=>{
  const env={GEMINI_API_KEY:'test-only-'+crypto.randomUUID()};const records=[];
  const provider=async(url,options)=>{
    const body=JSON.parse(options.body);records.push(body);
    return providerFixture()(url,options);
  };
  const response=await start(env,provider,{language:'zh-CN',illustrations:false});assert.equal(response.status,200);
  const journey=await response.json();assert.match(records[0].systemInstruction.parts[0].text,/Simplified Chinese/);
  const legacy=structuredClone(journey.state);delete legacy.setup.language;
  const token=await signJourney(legacy,env);
  const next=await handleAPI(request('choose',{token,choiceId:'trust_partner'}),env,provider);assert.equal(next.status,200);
  assert.match(records[1].systemInstruction.parts[0].text,/in English/);
  assert.equal(JSON.parse(records[1].contents[0].parts[0].text).storyLanguage,'en');
});
