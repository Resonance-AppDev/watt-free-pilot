import test from 'node:test';
import assert from 'node:assert/strict';
import {executeFreeProvider} from '../edge/watt-ai-room-worker/provider-execution.mjs';
const base={verifiedFreeTier:true,releaseApproved:true,provider:'groq',model:'llama-3.1-8b-instant',prompt:'Hello',credential:'test-key',jobId:'job-1',reservation:{committed:true,provider:'groq',jobId:'job-1',reservationId:'r-1'}};
test('refuses missing or mismatched committed reservations without calling provider',async()=>{
 let called=0;const fetchImpl=async()=>{called++;throw Error('unexpected');};
 for(const reservation of [null,{...base.reservation,committed:false},{...base.reservation,provider:'gemini'},{...base.reservation,jobId:'other'}]){
  await assert.rejects(executeFreeProvider({...base,reservation,fetchImpl}),/DISPATCH_NOT_AUTHORIZED/);
 }
 assert.equal(called,0);
});
test('Groq request is bounded and returns provider text',async()=>{
 const result=await executeFreeProvider({...base,fetchImpl:async(url,init)=>{
  assert.equal(url,'https://api.groq.com/openai/v1/chat/completions');
  assert.equal(init.headers.authorization,'Bearer test-key');
  assert.equal(JSON.parse(init.body).model,base.model);
  return {ok:true,text:async()=>JSON.stringify({choices:[{message:{content:'Hello from Groq'}}]})};
 }});
 assert.deepEqual(result,{ok:true,provider:'groq',model:base.model,text:'Hello from Groq'});
});
test('Gemini uses API key header and extracts content parts',async()=>{
 const result=await executeFreeProvider({...base,provider:'gemini',model:'gemini-2.0-flash',reservation:{...base.reservation,provider:'gemini'},fetchImpl:async(url,init)=>{
  assert.match(url,/generativelanguage\.googleapis\.com/);
  assert.equal(init.headers['x-goog-api-key'],'test-key');
  return {ok:true,text:async()=>JSON.stringify({candidates:[{content:{parts:[{text:'Gemini reply'}]}}]})};
 }});
 assert.equal(result.text,'Gemini reply');
});
test('OpenRouter returns a rate-limit code without retrying',async()=>{
 let calls=0;
 const result=await executeFreeProvider({...base,provider:'openrouter',model:'test/free',reservation:{...base.reservation,provider:'openrouter'},fetchImpl:async()=>{calls++;return {ok:false,status:429};}});
 assert.equal(result.code,'UPSTREAM_RATE_LIMIT');assert.equal(calls,1);
});
test('rejects unsafe model names and oversized prompts',async()=>{
 await assert.rejects(executeFreeProvider({...base,model:'bad?key=secret'}),/DISPATCH_NOT_AUTHORIZED/);
 await assert.rejects(executeFreeProvider({...base,prompt:'a'.repeat(2001)}),/DISPATCH_NOT_AUTHORIZED/);
});
test('refuses unverified free tier or closed release without network activity',async()=>{
 let calls=0;
 const fetchImpl=async()=>{calls++;throw Error('must not call upstream');};
 for(const patch of [{verifiedFreeTier:false},{releaseApproved:false},{verifiedFreeTier:undefined},{releaseApproved:undefined}]){
  await assert.rejects(executeFreeProvider({...base,...patch,fetchImpl}),/DISPATCH_NOT_AUTHORIZED/);
 }
 assert.equal(calls,0);
});
test('aborts oversized streaming responses before reading the entire payload',async()=>{
 let reads=0,cancelled=false;
 const result=await executeFreeProvider({...base,fetchImpl:async()=>({ok:true,body:{getReader:()=>({read:async()=>{reads++;return {done:false,value:new Uint8Array(40000)};},cancel:async()=>{cancelled=true;},releaseLock:()=>{}})}})});
 assert.equal(result.code,'UPSTREAM_TOO_LARGE');
 assert.equal(reads,2);
 assert.equal(cancelled,true);
});
