import test from 'node:test';import assert from 'node:assert/strict';
import {consentReadyForProvider,attachConsentToCandidates} from '../edge/watt-ai-room-worker/consent-readiness.mjs';
const full={member_count:2,providers:['groq','gemini','openrouter'].map(provider=>({provider,approved_members:2,my_consent:true}))};
test('all current members and current caller must consent',()=>{
 assert.equal(consentReadyForProvider(full,'groq'),true);
 assert.equal(consentReadyForProvider({...full,providers:full.providers.map(p=>p.provider==='groq'?{...p,approved_members:1}:p)},'groq'),false);
 assert.equal(consentReadyForProvider({...full,providers:full.providers.map(p=>p.provider==='groq'?{...p,my_consent:false}:p)},'groq'),false);
});
test('malformed, incomplete or duplicated roster status fails closed',()=>{
 for(const status of [null,{}, {...full,member_count:0},{...full,providers:full.providers.slice(1)},
 {...full,providers:[full.providers[0],full.providers[0],full.providers[2]]},
 {...full,providers:full.providers.map(p=>({...p,approved_members:3}))}])
  assert.equal(consentReadyForProvider(status,'groq'),false);
 assert.equal(consentReadyForProvider(full,'unknown'),false);
});
test('selection input cannot promote provider consent without database readiness',()=>{
 const items=attachConsentToCandidates([{id:'groq',providerConsent:true,allRoomMembersConsented:true}],{...full,member_count:3});
 assert.equal(items[0].providerConsent,false);assert.equal(items[0].allRoomMembersConsented,false);
});
