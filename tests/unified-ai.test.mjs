import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {rpc} from '../public/assets/core.js';
import {asksWattAI,canRequestAI,normalizeAiStatus,normalizeAiMessages,mergeUnifiedMessages,requestRoomAiReply,CONSENT_VERSION} from '../public/assets/unified-ai.js';

const room='22222222-2222-4222-8222-222222222222';
const other='33333333-3333-4333-8333-333333333333';
const user='11111111-1111-4111-8111-111111111111';
const stamp='2026-11-01T12:48:00Z';
const ready={enabled:true,my_consent:true,member_count:2,consented_count:2,ready:true,is_owner:false};

test('WATT AI only triggers explicit @WATT in the same human composer',()=>{
 assert.ok(asksWattAI('@WATT can you help?'));
 assert.ok(asksWattAI('  @watt, summarize this'));
 assert.equal(asksWattAI('hello everyone'),false);
 assert.equal(asksWattAI('what a wattage'),false);
});
test('all-member consent and backend readiness required before worker requests',()=>{
 assert.equal(CONSENT_VERSION,'watt-ai-room-v1');
 assert.equal(canRequestAI(normalizeAiStatus(ready)),true);
 assert.equal(canRequestAI(normalizeAiStatus({...ready,ready:false})),false);
 assert.equal(canRequestAI(normalizeAiStatus({...ready,consented_count:1})),false);
 assert.equal(canRequestAI(normalizeAiStatus({...ready,my_consent:false})),false);
 assert.equal(canRequestAI(normalizeAiStatus({...ready,enabled:false})),false);
 assert.throws(()=>normalizeAiStatus({...ready,member_count:7}),/INVALID_RESPONSE/);
});
test('AI room reads and consent actions require signed-in session and exact whitelist',()=>{
 assert.throws(()=>rpc('watt_ai_get_room_messages',{p_room_id:room}),e=>e.code==='AUTH_REQUIRED');
 assert.throws(()=>rpc('watt_ai_claim_reply_job',{p_job_id:1},'test-token'),e=>e.code==='INVALID_RPC');
 assert.throws(()=>rpc('watt_ai_publish_reply',{p_job_id:1,p_body:'wrong'},'test-token'),e=>e.code==='INVALID_RPC');
});
test('AI messages are strictly room-scoped and attributed to WATT AI',()=>{
 const data=normalizeAiMessages({messages:[{id:1,room_id:room,sender_type:'ai',
  body:'I can help.',created_at:'2026-11-01T12:49:00Z'}]},room);
 assert.equal(data[0].sender_name,'WATT AI');
 assert.equal(data[0].kind,'ai');
 assert.throws(()=>normalizeAiMessages({messages:[{id:1,room_id:other,sender_type:'ai',
  body:'Unauthorized',created_at:stamp}]},room),/INVALID_RESPONSE/);
 assert.throws(()=>normalizeAiMessages({messages:[{id:1,room_id:room,sender_type:'human',
  body:'Pretender',created_at:stamp}]},room),/INVALID_RESPONSE/);
});
test('mixed transcript remains one conversation sorted chronologically',()=>{
 const human=[{id:2,room_id:room,sender_id:user,sender_name:'Pilot',body:'@WATT help',created_at:stamp}];
 const ai=normalizeAiMessages({messages:[{id:2,room_id:room,sender_type:'ai',body:'Hello!',created_at:'2026-11-01T12:48:02Z'}]},room);
 const mix=mergeUnifiedMessages(human,ai);
 assert.deepEqual(mix.map(x=>x.kind),['human','ai']);
 assert.equal(mix[0].id,mix[1].id); // distinct tables share ID but not identity
});
test('worker invocation is private and never contacts OpenAI directly in browser',async()=>{
 let options,url,calls=0;
 const transport=async(u,o)=>{calls++;url=u;options=o;return {ok:true,status:200,json:async()=>({ok:true,shared:true,aiMessageId:7})}};
 const got=await requestRoomAiReply('member-token',room,2,transport);
 assert.equal(got.aiMessageId,7);assert.equal(calls,1);
 assert.ok(url.endsWith('/functions/v1/watt-ai-room-worker'));
 assert.deepEqual(JSON.parse(options.body),{roomId:room,triggerMessageId:'2'});
 assert.equal(options.credentials,'omit');assert.equal(options.cache,'no-store');
 assert.equal(options.headers.Authorization,'Bearer member-token');
 assert.ok(options.headers.apikey.startsWith('sb_publishable_'));
 assert.equal(options.headers['Content-Type'],'application/json');
});
test('missing bearer, invalid identifiers and failed worker never publish false success',async()=>{
 let n=0;const transport=async()=>{
  n++;return {ok:false,status:403,json:async()=>({ok:false,code:'ROOM_CONSENT_INCOMPLETE'})};
 };
 await assert.rejects(()=>requestRoomAiReply('',room,2,transport),e=>e.code==='BAD_INPUT');
 await assert.rejects(()=>requestRoomAiReply('token',other,'0',transport),e=>e.code==='BAD_INPUT');
 assert.equal(n,0);
 await assert.rejects(()=>requestRoomAiReply('token',room,2,transport),e=>e.code==='ROOM_CONSENT_INCOMPLETE');
 assert.equal(n,1);
});
test('unified UI uses DOM text content and never stores keys or tokens',()=>{
 const ws=fs.readFileSync('public/assets/workspace.js','utf8');
 const html=fs.readFileSync('public/workspace/index.html','utf8');
 const cli=fs.readFileSync('public/assets/unified-ai.js','utf8');
 assert.match(ws,/text\.textContent=msg\.body/);
 assert.match(ws,/await requestRoomAiReply\(/);
 assert.match(ws,/await rpc\('watt_ai_set_member_consent'/);
 assert.match(ws,/await rpc\('watt_ai_set_room_enabled'/);
 assert.match(html,/id="ai-controls"/);
 assert.match(html,/id="ask-watt"/);
 assert.doesNotMatch(ws+cli,/localStorage|sessionStorage|indexedDB|OPENAI_API_KEY|api\.openai\.com|sb_secret_|service_role/);
});

test('backend staging build cannot call OpenAI or publish replies',()=>{
 const worker=fs.readFileSync('edge/watt-ai-room-worker/index.ts','utf8');
 const preview=fs.readFileSync('03-Preview-Unified-AI.sh','utf8');
 assert.match(worker,/const RELEASE_GATE_OPEN = false/);
 assert.match(worker,/watt-ai-room-worker/);
 assert.match(worker,/PILOT_ORIGIN/);
 assert.match(worker,/watt-r12-unified-ai-/);
 assert.match(worker,/watt_ai_room_status/);
 assert.match(worker,/watt_ai_publish_reply/);
 assert.match(preview,/CHANNEL='watt-r12-unified-ai-review'/);
 assert.match(preview,/hosting:channel:list --project/);
 assert.match(preview,/--no-authorized-domains/);
 assert.match(preview,/--expires 7d/);
 assert.doesNotMatch(preview,/^firebase deploy\s/m);
 assert.doesNotMatch(preview,/^firebase hosting:clone\s/m);
});
