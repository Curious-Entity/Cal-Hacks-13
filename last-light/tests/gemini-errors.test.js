import test from 'node:test';
import assert from 'node:assert/strict';
import {handleAPI} from '../backend/adventure.js';

const setup={premise:'An apprentice gardener follows a mysterious map hidden in a forest.'};

test('Gemini errors distinguish rejected keys, project access, and bad requests without leaking upstream content',async()=>{
  const cases=[
    [401,{status:'UNAUTHENTICATED'},'GEMINI_AUTH'],
    [400,{details:[{reason:'API_KEY_INVALID'}]},'GEMINI_AUTH'],
    [400,{details:[{reason:'API_KEY_EXPIRED'}]},'GEMINI_AUTH'],
    [403,{message:'Your API key was reported as leaked.'},'GEMINI_KEY_BLOCKED'],
    [403,{status:'PERMISSION_DENIED'},'GEMINI_ACCESS'],
    [400,{status:'INVALID_ARGUMENT'},'GEMINI_REQUEST'],
    [400,{status:'FAILED_PRECONDITION'},'GEMINI_PROJECT_SETUP'],
    [402,{},'GEMINI_CREDITS'],
  ];
  for(const [status,error,code] of cases) {
    const request=new Request('https://adventure.test/api/story/start',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({setup,requestId:crypto.randomUUID()})});
    const upstream={...error,message:(error.message||'')+' private-upstream-detail',metadata:{key:'secret-test-marker'}};
    const response=await handleAPI(request,{GEMINI_API_KEY:'test-only-'+crypto.randomUUID()},async()=>Response.json({error:upstream},{status}));
    assert.equal(response.status,502);const body=await response.json();assert.equal(body.code,code);
    assert.doesNotMatch(body.error,/private-upstream-detail|secret-test-marker/);
  }
});
