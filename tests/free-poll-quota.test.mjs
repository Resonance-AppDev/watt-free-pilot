import test from 'node:test';
import assert from 'node:assert/strict';
import {quotaDecision,validateReservation} from '../edge/watt-ai-room-worker/free-poll-quota.mjs';
const full={remainingRequestsMinute:2,remainingRequestsDay:20,remainingTokensMinute:1000,remainingTokensDay:5000,remainingGlobalRequestsDay:20,remainingUserRequestsDay:6};
test('quota preflight accepts eligible estimates only',()=>assert.equal(quotaDecision(full,500).allowed,true));
test('every exhausted request bucket denies',()=>{
 for(const key of ['remainingRequestsMinute','remainingRequestsDay','remainingGlobalRequestsDay','remainingUserRequestsDay'])
  assert.equal(quotaDecision({...full,[key]:0},100).allowed,false);
});
test('both token buckets and malformed snapshots deny',()=>{
 for(const key of ['remainingTokensMinute','remainingTokensDay'])assert.equal(quotaDecision({...full,[key]:99},100).allowed,false);
 assert.equal(quotaDecision({...full,remainingRequestsDay:-1},100).allowed,false);
 assert.equal(quotaDecision(full,0).allowed,false);
});
test('requires matching committed reservation before dispatch',()=>{
 const reservation={committed:true,provider:'groq',jobId:'job1',reservationId:'res1'};
 assert.equal(validateReservation(reservation,'groq','job1'),true);
 assert.equal(validateReservation({...reservation,committed:false},'groq','job1'),false);
 assert.equal(validateReservation(reservation,'gemini','job1'),false);
 assert.equal(validateReservation(reservation,'groq','job2'),false);
});
