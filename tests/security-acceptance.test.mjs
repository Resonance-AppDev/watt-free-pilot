import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {apiPost,rpc,signInWithPassword,normalizeRoom,normalizeRooms,friendlyError,PilotError} from '../public/assets/core.js';

const owner='11111111-1111-4111-8111-111111111111';
const room='22222222-2222-4222-8222-222222222222';
const unrelated='33333333-3333-4333-8333-333333333333';
const reply=(data,status=200)=>async()=>({ok:status>=200&&status<300,status,json:async()=>data});

test('R10 mock: denied nonmember read propagates denial without any room data',async()=>{
 const transport=reply({ok:false,code:'MEMBERSHIP_REQUIRED'},403);
 await assert.rejects(()=>rpc('watt_pilot_get_room',{p_room_id:unrelated},'test-session',transport),
   err=>err instanceof PilotError&&err.code==='MEMBERSHIP_REQUIRED'&&err.status===403);
});
test('R10 mock: denied nonmember send cannot be treated as delivered',async()=>{
 await assert.rejects(()=>rpc('watt_pilot_send_message',
  {p_room_id:unrelated,p_client_message_id:owner,p_body:'test fixture'},'test-session',
  reply({ok:false,code:'MEMBERSHIP_REQUIRED'},403)),err=>err.code==='MEMBERSHIP_REQUIRED');
});
test('R10 client: missing session token never calls transport',()=>{
 let calls=0;const transport=()=>{calls++;throw Error('should not call network');};
 assert.throws(()=>rpc('watt_pilot_get_room',{p_room_id:room},'',transport),err=>err.code==='AUTH_REQUIRED');
 assert.equal(calls,0);
});
test('R10 client: privileged or unrelated RPC names are rejected before transport',()=>{
 for(const method of ['watt_pilot_delete_room','watt_pilot_set_room_enabled','watt_ai_get_room_messages','pg_read_file']){
  let calls=0;
  assert.throws(()=>rpc(method,{},'test-session',()=>{calls++;}),err=>err.code==='INVALID_RPC');
  assert.equal(calls,0);
 }
});
test('R10 browser: public authorization uses no cookies and never sends JWT on login',async()=>{
 let seen=null;const transport=async(url,opts)=>{
  seen={url,opts};return {ok:true,status:200,json:async()=>({
   access_token:'test-token',expires_in:3600,
   user:{id:owner,email:'fixture@example.invalid',email_confirmed_at:'2026-01-01T00:00:00Z',is_anonymous:false}
  })};
 };
 const session=await signInWithPassword('fixture@example.invalid','fixture-password',transport);
 assert.ok(session.token);
 assert.equal(seen.opts.credentials,'omit');
 assert.equal(seen.opts.headers.Authorization,undefined);
 assert.equal(seen.opts.referrerPolicy,'no-referrer');
 assert.equal(seen.opts.cache,'no-store');
});
test('R10 client: anonymous authenticated users and unconfirmed accounts cannot sign in',async()=>{
 const user={id:owner,email:'fixture@example.invalid',email_confirmed_at:'2026-01-01T00:00:00Z',is_anonymous:true};
 const data={access_token:'test-token',expires_in:3600,user};
 await assert.rejects(()=>signInWithPassword(user.email,'fixture-password',reply(data)),err=>err.code==='AUTH_REQUIRED');
 await assert.rejects(()=>signInWithPassword(user.email,'fixture-password',reply({...data,user:{...user,is_anonymous:false,email_confirmed_at:null}})),err=>err.code==='AUTH_REQUIRED');
});
test('R10 client: hostile response cannot substitute a different room',()=>{
 const foreign={ok:true,room:{id:unrelated,title:'Unrelated'},members:[],messages:[],next_after_id:0};
 assert.throws(()=>normalizeRoom(foreign,room),err=>err.code==='INVALID_RESPONSE');
 const malformed={ok:true,room:{id:room,title:'Known'},members:[],messages:[{id:1,sender_id:'invalid',body:'fake'}],next_after_id:1};
 assert.throws(()=>normalizeRoom(malformed,room),err=>err.code==='INVALID_RESPONSE');
});
test('R10 client: unauthorized room roles and oversized data are rejected',()=>{
 assert.throws(()=>normalizeRooms({rooms:[{id:room,title:'Fixture',role:'admin'}]}),err=>err.code==='INVALID_RESPONSE');
 assert.throws(()=>normalizeRoom({ok:true,room:{id:room},members:Array(7).fill({}),messages:[],next_after_id:0},room),err=>err.code==='INVALID_RESPONSE');
});
test('R10 client: forbidden response errors never render arbitrary server bodies',async()=>{
 await assert.rejects(()=>apiPost('/rest/v1/rpc/watt_pilot_get_room',{},'test-session',reply({error:'private-internal-detail'},403)),err=>{
  assert.equal(err.code,'REQUEST_FAILED');return true;
 });
 assert.doesNotMatch(friendlyError(new PilotError('private-internal-detail',500)),/private-internal-detail/);
});
test('R10 UI: displayed message bodies use text nodes, not HTML evaluation',()=>{
 const src=fs.readFileSync(new URL('../public/assets/workspace.js',import.meta.url),'utf8');
 assert.match(src,/text\.textContent=msg\.body/);
 assert.doesNotMatch(src,/\.innerHTML\s*=/);
 assert.match(src,/if\(state\.session!==s\|\|state\.activeRoomId!==id\|\|request!==state\.roomEpoch\)return/);
});
test('R10 deployment: new preview only, strict CSP and no legacy routing loops',()=>{
 const cfg=JSON.parse(fs.readFileSync(new URL('../firebase.json',import.meta.url),'utf8'));
 assert.ok(!('redirects' in cfg.hosting)&&!('trailingSlash' in cfg.hosting));
 assert.equal(cfg.hosting.public,'public');
 assert.ok(!('rewrites' in cfg.hosting)&&!('functions' in cfg.hosting));
 const csp=cfg.hosting.headers.find(h=>h.source==='**').headers.find(h=>h.key==='Content-Security-Policy').value;
 assert.match(csp,/default-src 'none'/);
 assert.match(csp,/frame-ancestors 'none'/);
 assert.doesNotMatch(csp,/unsafe-eval|unsafe-inline/);
});
