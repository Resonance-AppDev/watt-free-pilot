import test from 'node:test';
import assert from 'node:assert/strict';
import {parseProviderAnswer,buildProviderPrompt} from '../edge/watt-ai-room-worker/free-poll-adapters.mjs';
test('Gemini STOP with text parts',()=>assert.equal(parseProviderAnswer('gemini',{candidates:[{finishReason:'STOP',content:{parts:[{text:'Hello '},{text:'world'}]}}]}),'Hello world'));
test('Groq and OpenRouter require completed text',()=>{
 for(const provider of ['groq','openrouter']){
  assert.equal(parseProviderAnswer(provider,{choices:[{finish_reason:'stop',message:{content:' Answer '}}]}),'Answer');
  assert.equal(parseProviderAnswer(provider,{choices:[{finish_reason:'length',message:{content:'partial'}}]}),null);
 }
});
test('reject safety blocks, malformed and oversized outputs',()=>{
 assert.equal(parseProviderAnswer('gemini',{candidates:[{finishReason:'SAFETY',content:{parts:[{text:'no'}]}}]}),null);
 assert.equal(parseProviderAnswer('gemini',{candidates:[{finishReason:'STOP',content:{parts:[{inlineData:{}}]}}]}),null);
 assert.equal(parseProviderAnswer('groq',{choices:[{finish_reason:'stop',message:{content:'x'.repeat(2001)}}]}),null);
 assert.equal(parseProviderAnswer('unknown',{}),null);
});
test('prompt is bounded and does not embed room history',()=>{
 assert.equal(buildProviderPrompt(' hello ').user,'hello');
 assert.throws(()=>buildProviderPrompt('x'.repeat(2001)),/INVALID_AI_PROMPT/);
});
