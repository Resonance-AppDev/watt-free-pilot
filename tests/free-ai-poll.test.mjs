import test from 'node:test';
import assert from 'node:assert/strict';
import {selectFreeCandidates,formatFreePoll} from '../edge/watt-ai-room-worker/free-poll.mjs';
const eligible=id=>({id,model:'verified-free-model',verifiedFreeTier:true,providerConsent:true,allRoomMembersConsented:true,enabled:true,credentialConfigured:true,remainingRequests:2,remainingTokens:100,releaseApproved:true});
test('top three are stable, distinct, provider labeled',()=>{
 const out=selectFreeCandidates([eligible('openrouter'),eligible('gemini'),eligible('groq'),eligible('groq')]);
 assert.deepEqual(out.map(x=>x.id),['groq','gemini','openrouter']);
 assert.equal(formatFreePoll(out.map(x=>({provider:x.id,model:x.model,text:'answer'}))).responses.length,3);
});
test('fail closed on consent, quota, credentials and release gate',()=>{
 for(const field of ['verifiedFreeTier','providerConsent','allRoomMembersConsented','enabled','credentialConfigured','releaseApproved']){
  assert.deepEqual(selectFreeCandidates([{...eligible('groq'),[field]:false}]),[]);
 }
 for(const field of ['remainingRequests','remainingTokens'])assert.deepEqual(selectFreeCandidates([{...eligible('groq'),[field]:0}]),[]);
});
test('never fabricate three results or duplicate one provider',()=>{
 const result=formatFreePoll([{provider:'groq',model:'m',text:'one'},{provider:'groq',model:'m',text:'duplicate'}]);
 assert.equal(result.responses.length,1);assert.equal(result.partial,true);
});
test('reject unsafe poll size',()=>assert.throws(()=>selectFreeCandidates([],{maxResponses:4}),/INVALID_POLL_CONFIG/));

test('eligible duplicate is not hidden by earlier ineligible record',()=>{
 const bad={...eligible('groq'),providerConsent:false};
 assert.deepEqual(selectFreeCandidates([bad,eligible('groq')]),[{id:'groq',model:'verified-free-model'}]);
});
