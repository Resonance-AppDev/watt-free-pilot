import test from 'node:test';
import assert from 'node:assert/strict';
import {providerConsentVersion,allMembersApproved,eligibleConsentedProviders} from '../edge/watt-ai-room-worker/provider-poll-consent.mjs';
const members=[{user_id:'a'},{user_id:'b'}];
const consent=(user_id,provider,allowed=true)=>({user_id,provider,consent_version:providerConsentVersion(provider),allowed});
test('requires each current room member to approve each provider separately',()=>{
 const approvals=[consent('a','groq'),consent('b','groq'),consent('a','gemini')];
 assert.deepEqual(eligibleConsentedProviders(members,approvals),['groq']);
 assert.equal(allMembersApproved(members,approvals,'gemini'),false);
});
test('legacy blanket consent never authorizes third-party disclosure',()=>{
 const legacy=members.map(m=>({user_id:m.user_id,consent_version:'watt-ai-room-v1',allowed:true}));
 assert.deepEqual(eligibleConsentedProviders(members,legacy),[]);
});
test('withdrawal and new members immediately fail closed',()=>{
 const approvals=[consent('a','openrouter'),consent('b','openrouter',false)];
 assert.equal(allMembersApproved(members,approvals,'openrouter'),false);
 assert.equal(allMembersApproved([...members,{user_id:'c'}],[consent('a','groq'),consent('b','groq')],'groq'),false);
});
test('empty or duplicate member lists and unknown providers are rejected',()=>{
 assert.equal(allMembersApproved([],[], 'groq'),false);
 assert.equal(allMembersApproved([members[0],members[0]],[consent('a','groq')],'groq'),false);
 assert.throws(()=>providerConsentVersion('openai'),/INVALID_PROVIDER/);
 assert.equal(allMembersApproved(members,[{...consent('a','groq'),provider:'gemini'},consent('b','groq')],'groq'),false);
});
