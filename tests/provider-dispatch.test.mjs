import test from 'node:test';import assert from 'node:assert/strict';
import {prepareProviderDispatch} from '../edge/watt-ai-room-worker/provider-dispatch.mjs';
const provider={id:'groq',model:'free-model',verifiedFreeTier:true,enabled:true,credentialConfigured:true,releaseApproved:true};
const status={member_count:2,providers:['groq','gemini','openrouter'].map(provider=>({provider,approved_members:2,my_consent:true}))};
const quota={remainingRequestsMinute:4,remainingRequestsDay:20,remainingTokensMinute:1000,remainingTokensDay:1000};
const reservation={committed:true,provider:'groq',jobId:'job1',reservationId:'reserve1'};
const dispatch=(s=status,q={groq:quota},r={groq:reservation})=>prepareProviderDispatch([provider],s,q,r,'job1',200);
test('requires every prerequisite',()=>{
 assert.deepEqual(dispatch(),[{id:'groq',model:'free-model'}]);
 assert.deepEqual(dispatch({...status,member_count:3}),[]);
 assert.deepEqual(dispatch(status,{},{}),[]);
 assert.deepEqual(dispatch(status,{groq:{...quota,remainingTokensMinute:199}}),[]);
 assert.deepEqual(dispatch(status,{groq:quota},{groq:{...reservation,committed:false}}),[]);
 assert.deepEqual(dispatch(status,{groq:quota},{groq:{...reservation,jobId:'other'}}),[]);
});
test('fails closed on provider tier or release mismatch',()=>{
 assert.deepEqual(prepareProviderDispatch([{...provider,verifiedFreeTier:false}],status,{groq:quota},{groq:reservation},'job1',200),[]);
 assert.throws(()=>prepareProviderDispatch([],status,{},{} ,'',200),/INVALID_DISPATCH/);
});
