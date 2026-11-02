import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const sql=readFileSync(new URL('../migrations/r15_remove_ai_job_daily_cap_review.sql',import.meta.url),'utf8');
test('R15 replacement preserves security definer with fixed search path',()=>{
 assert.match(sql,/create or replace function public\.watt_ai_reply_job_budget_guard\(\)/i);
 assert.match(sql,/security definer/i);
 assert.match(sql,/set search_path to ''/i);
});
test('R15 replacement still rejects unauthorized room and consent',()=>{
 for(const phrase of ['JOB_MUST_START_PENDING','ROOM_AI_DISABLED','TRIGGER_ROOM_MISMATCH','ROOM_CONSENT_INCOMPLETE','watt_pilot_members','watt_ai_member_consents','watt_room_ai_settings'])
  assert.ok(sql.includes(phrase),phrase);
 assert.match(sql,/consent_version='watt-ai-room-v1'/);
});
test('R15 migration does not delete triggers, tables or alter release gate',()=>{
 assert.doesNotMatch(sql,/\bdrop\s+(trigger|table|function)\b/i);
 assert.doesNotMatch(sql,/\btruncate\b/i);
 assert.doesNotMatch(sql,/\bdelete\s+from\b/i);
 assert.doesNotMatch(sql,/RELEASE_GATE_OPEN\s*=\s*true/i);
});
test('R15 migration has no daily WATT job count cap',()=>{
 assert.doesNotMatch(sql,/DAILY_AI_JOB_BUDGET_EXCEEDED|daily_count\s*>=\s*20|pg_advisory_xact_lock/i);
});
