import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
 GROQ_FREE_MODEL,GROQ_FREE_ENDPOINT,FREE_LIMITS,isExplicitWattRequest,
 makeFreeProviderRequest,parseFreeProviderResponse,freeAccountSelected
} from '../edge/watt-ai-room-worker/free-provider.mjs';

test('R13 free-model selection is fixed, not caller-controlled',()=>{
 assert.equal(GROQ_FREE_MODEL,'openai/gpt-oss-20b');
 assert.equal(GROQ_FREE_ENDPOINT,'https://api.groq.com/openai/v1/chat/completions');
 assert.deepEqual(FREE_LIMITS,{requestsPerMinute:30,requestsPerDay:1000,tokensPerMinute:8000,tokensPerDay:200000});
});
test('R13 sends only explicit @WATT prompts to the AI provider',()=>{
 for(const s of ['normal chat','What is Watt?','@WATTAGE','@WATT\n'.repeat(400)])assert.equal(isExplicitWattRequest(s),false);
 assert.equal(isExplicitWattRequest('@WATT Can you help?'),true);
 assert.equal(isExplicitWattRequest('  @watt, hi'),true);
 assert.throws(()=>makeFreeProviderRequest('ordinary chat'),/EXPLICIT_AI_TRIGGER_REQUIRED/);
});
test('R13 provider request bounds generation and does not send room history or tools',()=>{
 const msg=makeFreeProviderRequest('@WATT Hi there');
 assert.equal(msg.model,GROQ_FREE_MODEL);
 assert.equal(msg.max_completion_tokens,256);
 assert.equal(msg.stream,false);
 assert.equal(msg.include_reasoning,false);
 assert.equal(msg.reasoning_effort,'low');
 assert.equal(msg.messages.length,2);
 assert.deepEqual(msg.messages[1],{role:'user',content:'@WATT Hi there'});
 assert.ok(!('tools' in msg)&&!('history' in msg)&&!('roomId' in msg));
});
test('R13 only accepts completed single-provider output as WATT AI text',()=>{
 assert.equal(parseFreeProviderResponse({choices:[{finish_reason:'stop',message:{content:'Hello!'}}]}),'Hello!');
 for(const output of [
  {choices:[{finish_reason:'length',message:{content:'Partial'}}]},
  {choices:[{finish_reason:'stop',message:{content:''}}]},
  {choices:[{finish_reason:'stop',message:{content:'A'.repeat(2001)}}]},
  {choices:[{finish_reason:'stop',message:{content:[{text:'no'}]}}]},
  {choices:[]}
 ]) assert.equal(parseFreeProviderResponse(output),null);
});
test('R13 requires confirmed free-tier operator configuration and server-only key',()=>{
 const vars={WATT_AI_PROVIDER:'groq_free',WATT_GROQ_FREE_CONFIRMED:'true',WATT_FREE_ONLY:'true',GROQ_API_KEY:'test-not-real'};
 const check=k=>vars[k];
 assert.equal(freeAccountSelected(check),true);
 for(const k of ['WATT_AI_PROVIDER','WATT_GROQ_FREE_CONFIRMED','WATT_FREE_ONLY','GROQ_API_KEY']){
  const orig=vars[k];delete vars[k];assert.equal(freeAccountSelected(check),false);vars[k]=orig;
 }
 vars.WATT_AI_PROVIDER='openai_paid';
 assert.equal(freeAccountSelected(check),false);
});
test('R13 worker remains gated, refuses ordinary human prompts and only sends server-side calls',()=>{
 const src=fs.readFileSync('edge/watt-ai-room-worker/index.ts','utf8');
 const ui=fs.readFileSync('public/workspace/index.html','utf8');
 assert.match(src,/const RELEASE_GATE_OPEN = false/);
 assert.match(src,/isExplicitWattRequest\(msg\.body\)/);
 assert.match(src,/freeAccountSelected/);
 assert.match(src,/GROQ_FREE_ENDPOINT/);
 assert.match(src,/watt_ai_room_status/);
 assert.match(src,/watt_ai_publish_reply/);
 assert.match(src,/member_count!==fresh\.data\?\.consented_count/);
 assert.match(ui,/If activated, an @WATT message is sent to the room's approved AI provider/);
 assert.doesNotMatch(ui,/GROQ_API_KEY|OPENAI_API_KEY/);
 assert.doesNotMatch(src,/^const RELEASE_GATE_OPEN = true/m);
});
