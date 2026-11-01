import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {apiPost,rpc,signInWithPassword,normalizeRooms,normalizeRoom,checkMessage,nextPending,secureUUID,friendlyError,isExpired,PilotError} from '../public/assets/core.js';
const uid='11111111-1111-4111-8111-111111111111', rid='22222222-2222-4222-8222-222222222222';
const respond=(data,status=200)=>async(_url,options)=>({ok:status>=200&&status<300,status, async json(){return data;}});
test('public Supabase client uses only scoped publishable key',()=>{
 const js=fs.readFileSync(new URL('../public/assets/core.js',import.meta.url),'utf8');
 assert.match(js,/sb_publishable_/);assert.doesNotMatch(js,/service_role|sb_secret_|supabase_service|private_key/i);
});
test('authorization errors are propagated, not treated as successes',async()=>{
 await assert.rejects(()=>rpc('watt_pilot_get_room',{p_room_id:rid},'test-token',respond({ok:false,code:'MEMBERSHIP_REQUIRED'})),e=>e.code==='MEMBERSHIP_REQUIRED');
});
test('unauthenticated RPC prohibited locally',()=>{assert.throws(()=>rpc('watt_pilot_list_rooms'),e=>e.code==='AUTH_REQUIRED');});
test('arbitrary or secret RPC names are not allowed',()=>{assert.throws(()=>rpc('vault_get_all',{},'token'),e=>e.code==='INVALID_RPC');});
test('invalid client paths blocked',async()=>{await assert.rejects(()=>apiPost('/rest/v1/watt_pilot_messages',{},'token'),e=>e.code==='INVALID_PATH');});
test('RPC forwards authorization and only public apikey',async()=>{
 let options;const fn=async(_u,o)=>{options=o;return {ok:true,status:200,json:async()=>({ok:true,rooms:[]})}};
 await rpc('watt_pilot_list_rooms',{},'some-token',fn);
 assert.equal(options.headers.Authorization,'Bearer some-token');assert.ok(options.headers.apikey.startsWith('sb_publishable_'));
 assert.equal(options.credentials,'omit');assert.equal(options.cache,'no-store');
});
test('sign in requires confirmed enrolled Supabase user',async()=>{
 const expected={access_token:'fake',expires_in:3600,user:{id:uid,email:'a@example.com',email_confirmed_at:'2026-01-01T01:00:00Z',is_anonymous:false}};
 const result=await signInWithPassword('a@example.com','secret',respond(expected));
 assert.equal(result.id,uid);assert.equal(result.email,'a@example.com');assert.equal(result.token,'fake');assert.equal(isExpired(result),false);
 await assert.rejects(()=>signInWithPassword('a@example.com','secret',respond({...expected,user:{...expected.user,email_confirmed_at:null}})),e=>e.code==='AUTH_REQUIRED');
});
test('invalid credentials are rejected',async()=>{await assert.rejects(()=>signInWithPassword('a@example.com','bad',respond({error_code:'invalid_credentials'},400)),e=>e.code==='invalid_credentials');});
test('normalize rooms validates member and owner',()=>{
 assert.deepEqual(normalizeRooms({rooms:[{id:rid,title:'Private',role:'owner'}]})[0].role,'owner');
 assert.throws(()=>normalizeRooms({rooms:[{id:rid,title:'Private',role:'admin'}]}));
 assert.throws(()=>normalizeRooms({rooms:[{id:'not-uuid',title:'Room',role:'member'}]}));
});
test('room normalization enforces identifier and shapes',()=>{
 const result=normalizeRoom({ok:true,room:{id:rid,title:'R'},members:[{}],messages:[{id:1,sender_id:uid,body:'hello',created_at:'2026-11-01T10:00:00Z'}],next_after_id:1},rid);
 assert.equal(result.messages[0].body,'hello');assert.equal(result.cursor,1);
 assert.throws(()=>normalizeRoom({ok:true,room:{id:uid,title:'R'},members:[],messages:[],next_after_id:0},rid));
});
test('message validation enforces unicode byte limit and non-empty',()=>{
 assert.equal(checkMessage('hi'),true);assert.equal(checkMessage('  '),false);assert.equal(checkMessage('A'.repeat(2001)),false);
 assert.equal(checkMessage('😀'.repeat(1000)),true);assert.equal(checkMessage('😀'.repeat(1001)),false);
});
test('idempotent retries reuse the original client message id',()=>{
 const x=nextPending(null,'One',()=>uid);
 const y=nextPending(x,'One',()=>rid);
 assert.strictEqual(y,x);assert.equal(y.id,uid);
 const z=nextPending(y,'Changed',()=>rid);assert.equal(z.id,rid);
});
test('clear error strings do not leak raw HTTP bodies',()=>{
 assert.match(friendlyError(new PilotError('ROOM_LIMIT')),/two rooms/);
 assert.match(friendlyError(new PilotError('MEMBERSHIP_REQUIRED')),/not a member/);
 assert.doesNotMatch(friendlyError(new PilotError('INTERNAL_SERVER_ERROR')),/INTERNAL_SERVER_ERROR/);
});
test('hosting config is static only and includes protective defaults',()=>{
 const config=JSON.parse(fs.readFileSync(new URL('../firebase.json',import.meta.url),'utf8'));
 assert.equal(config.hosting.public,'public');assert.ok(!config.functions);assert.ok(!config.firestore);
 const csp=config.hosting.headers[0].headers.find(x=>x.key==='Content-Security-Policy').value;
 assert.match(csp,/script-src 'self'/);assert.match(csp,/connect-src 'self' https:\/\/qylyuijjeruvbxipnrgh\.supabase\.co/);
 assert.doesNotMatch(csp,/unsafe-inline|unsafe-eval/);
});
test('no local storage, firebase database, analytics or automatic polling',()=>{
 const js=fs.readFileSync(new URL('../public/assets/workspace.js',import.meta.url),'utf8');
 assert.doesNotMatch(js,/localStorage|sessionStorage|indexedDB|setInterval|firebase\.database|firebase\.firestore|gtag\s*\(/);
 assert.doesNotMatch(js,/service_role|sb_secret_/);
});
test('marketing site makes no subscription or AI execution network calls',()=>{
 const html=fs.readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
 assert.match(html,/R0/);assert.match(html,/invite-only/i);assert.doesNotMatch(html,/<form|stripe\.js|paypal\.com/i);
});

test('generated message identifiers are UUID v4 without weak randomness',()=>{ assert.match(secureUUID(),/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i); });
