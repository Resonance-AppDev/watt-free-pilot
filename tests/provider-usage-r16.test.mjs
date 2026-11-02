import test from 'node:test';
import assert from 'node:assert/strict';
import {extractProviderUsage,readProviderRateLimit} from '../edge/watt-ai-room-worker/provider-usage-r16.mjs';

test('extracts Gemini token usage',()=>{
 assert.deepEqual(extractProviderUsage('gemini',{usageMetadata:{promptTokenCount:12,candidatesTokenCount:7}}),{inputTokens:12,outputTokens:7});
});
test('extracts Groq and OpenRouter token usage',()=>{
 const payload={usage:{prompt_tokens:21,completion_tokens:9}};
 assert.deepEqual(extractProviderUsage('groq',payload),{inputTokens:21,outputTokens:9});
 assert.deepEqual(extractProviderUsage('openrouter',payload),{inputTokens:21,outputTokens:9});
});
test('rejects unsupported providers, missing fields and unsafe token counts',()=>{
 assert.equal(extractProviderUsage('openai',{usage:{prompt_tokens:1,completion_tokens:1}}),null);
 assert.equal(extractProviderUsage('groq',{usage:{prompt_tokens:1}}),null);
 assert.equal(extractProviderUsage('groq',{usage:{prompt_tokens:-1,completion_tokens:1}}),null);
 assert.equal(extractProviderUsage('groq',{usage:{prompt_tokens:1_000_001,completion_tokens:1}}),null);
 assert.equal(extractProviderUsage('groq',null),null);
});
test('reads only observed numeric request limits for supported headers',()=>{
 const headers={get(name){return name==='x-ratelimit-remaining-requests'?'42':null;}};
 assert.deepEqual(readProviderRateLimit('groq',headers),{remainingRequests:42,sourceHeader:'x-ratelimit-remaining-requests'});
 assert.deepEqual(readProviderRateLimit('openrouter',headers),{remainingRequests:42,sourceHeader:'x-ratelimit-remaining-requests'});
 assert.equal(readProviderRateLimit('gemini',headers),null);
 assert.equal(readProviderRateLimit('groq',{get(){return '-1';}}),null);
 assert.equal(readProviderRateLimit('openai',headers),null);
});
