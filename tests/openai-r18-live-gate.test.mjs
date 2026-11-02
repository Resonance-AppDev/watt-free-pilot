import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const worker=fs.readFileSync('edge/watt-ai-room-worker/index.ts','utf8');
const consent=fs.readFileSync('edge/watt-ai-room-worker/provider-consent.mjs','utf8');
const adapter=fs.readFileSync('edge/watt-ai-room-worker/openai-execution-r17.mjs','utf8');
const doc=fs.readFileSync('docs/R18-LIVE-OPENAI-SCHEMA-CONTRACT.md','utf8');

test('live source remains fail-closed and does not silently wire the candidate adapter',()=>{
 assert.match(worker,/RELEASE_GATE_OPEN\s*=\s*false/);
 assert.doesNotMatch(worker,/openai-execution-r17/);
 assert.match(worker,/watt_ai_room_status/);
});
test('existing live provider consent is not OpenAI consent',()=>{
 assert.match(consent,/groq.*gemini.*openrouter/s);
 assert.doesNotMatch(consent,/openai/);
 assert.match(doc,/watt-openai-api-2026-v1/);
 assert.match(doc,/legacy OpenAI-era consent is not proof/);
});
test('R17 adapter requires independent consent, billing, release and committed reservation',()=>{
 assert.match(adapter,/OPENAI_CONSENT_VERSION/);
 assert.match(adapter,/allRoomMembersConsented!==true/);
 assert.match(adapter,/billingApproved!==true/);
 assert.match(adapter,/releaseApproved!==true/);
 assert.match(adapter,/reservation\?\.committed===true/);
});
test('R18 contract blocks live activation pending DB gates and review',()=>{
 for(const phrase of ['watt_ai_set_provider_consent','watt_ai_room_status','atomic','POPIA','release gate remains closed'])assert.ok(doc.toLowerCase().includes(phrase.toLowerCase()),phrase);
});
