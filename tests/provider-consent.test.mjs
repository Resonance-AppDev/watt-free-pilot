import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {GROQ_CONSENT_VERSION,allMembersApprovedForGroq} from '../edge/watt-ai-room-worker/provider-consent.mjs';

const one='11111111-1111-4111-8111-111111111111',two='22222222-2222-4222-8222-222222222222';
const members=[{user_id:one},{user_id:two}];
const consent=(user_id,consent_version=GROQ_CONSENT_VERSION,allowed=true)=>({user_id,consent_version,allowed});
test('R14 legacy v1/OpenAI consent cannot authorize Groq processor',()=>{
 assert.equal(allMembersApprovedForGroq(members,[consent(one,'watt-ai-room-v1'),consent(two,'watt-ai-room-v1')],2),false);
 assert.equal(allMembersApprovedForGroq(members,[consent(one),consent(two,'watt-ai-room-v1')],2),false);
});
test('R14 all current members must explicitly consent to the same Groq processing scope',()=>{
 assert.equal(allMembersApprovedForGroq(members,[consent(one),consent(two)],2),true);
 assert.equal(allMembersApprovedForGroq(members,[consent(one)],2),false);
 assert.equal(allMembersApprovedForGroq(members,[consent(one),consent(two,false)],2),false);
 assert.equal(allMembersApprovedForGroq(members,[consent(one),consent(two,undefined,false)],2),false);
});
test('R14 consent validation rejects unrelated or repeated user ids and stale membership counts',()=>{
 assert.equal(allMembersApprovedForGroq(members,[consent(one),consent(one)],2),false);
 assert.equal(allMembersApprovedForGroq(members,[consent(one),consent('33333333-3333-4333-8333-333333333333')],2),false);
 assert.equal(allMembersApprovedForGroq(members,[consent(one),consent(two)],1),false);
 assert.equal(allMembersApprovedForGroq(members,[consent(one),consent(two)],7),false);
 assert.equal(allMembersApprovedForGroq([{user_id:one},{user_id:one}],[consent(one)],2),false);
});
test('R14 worker has three server consent checks and no live provider activation',()=>{
 const src=fs.readFileSync('edge/watt-ai-room-worker/index.ts','utf8');
 assert.match(src,/const RELEASE_GATE_OPEN = false;/);
 assert.ok(src.includes('GROQ_CONSENT_VERSION')||src.includes('allMembersApprovedForGroq'));
 assert.ok((src.match(/groqConsentForAll\(roomId,key/g)||[]).length>=3);
 assert.match(src,/PROVIDER_CONSENT_REQUIRED/);
 assert.match(src,/PROVIDER_CONSENT_CHANGED/);
 assert.match(src,/freeAccountSelected/);
 assert.doesNotMatch(src,/const RELEASE_GATE_OPEN = true;/);
});

test('R14 review worker origin matches actual R12 preview and rejects other sites',()=>{
 const src=fs.readFileSync('edge/watt-ai-room-worker/index.ts','utf8');
 assert.match(src,/watt-r12-unified-ai-review-/);
 const pattern=/^https:\/\/watt-36912--watt-r12-unified-ai-review-[a-z0-9]+\.web\.app$/;
 assert.equal(pattern.test('https://watt-36912--watt-r12-unified-ai-review-imn2zctx.web.app'),true);
 assert.equal(pattern.test('https://watt-36912.web.app'),false);
 assert.equal(pattern.test('https://watt-36912--watt-r13-unified-ai-review-abc.web.app'),false);
 assert.equal(pattern.test('https://attacker-watt-36912--watt-r12-unified-ai-review-imn2zctx.web.app'),false);
});
