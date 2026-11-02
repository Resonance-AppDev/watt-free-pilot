# WATT R19 — OpenAI database migration design

**Status: source-only design review. This document is not an executable migration. No Supabase schema, data, function, secret, Edge Function or billing state was changed. Keep the live worker release gate closed.**

## 1. Verified live baseline (read-only, 2026-11-03)

Project: WATT Live Pilot, `qylyuijjeruvbxipnrgh`, region `eu-west-1`.

The live schema has the R15/R16 provider accounting tables and the following constraints:

- `watt_ai_provider_consents`, `watt_ai_provider_reservations_r15`, `watt_ai_provider_capacity_r15`, `watt_ai_provider_quota_usage_r15`, `watt_ai_provider_replies`, `watt_daily_provider_usage_r16`, and `watt_provider_usage_events_r16` accept only `groq`, `gemini`, and `openrouter`.
- Provider consent is fixed to `watt-ai-provider-v1`; `watt_ai_set_provider_consent` rejects OpenAI.
- `watt_ai_enqueue_reply` and `watt_ai_claim_reply_job` still require legacy room consent `watt-ai-room-v1`.
- `watt_ai_publish_reply` also checks legacy room consent. Provider-specific publication checks the older provider-consent version.
- The deployed `watt_ai_room_status` deliberately returns `ready:false` / `AI_WORKER_STAGING_NOT_VERIFIED`.
- Membership changes serialize through the room AI settings row and cancel pending/processing jobs. Provider-consent withdrawal also disables the room AI setting and cancels pending/processing jobs.
- Existing R15 reservation rows do not bind a model, requester, room, consent version, or cost estimate. R16 usage events are idempotent but do not accept OpenAI.

These are hard compatibility boundaries. Adding `openai` to a CHECK constraint alone would create an incomplete and unsafe provider path.

## 2. Repository and migration provenance blocker

The R18 GitHub branch is a source candidate and currently contains no `supabase/migrations/` directory or `supabase/config.toml`. The earlier R16 pull request contains worker, frontend, tests and contract documents, but no checked-in database migration history. The live project has a migration history, but its migration source files are not present in this branch.

Do not invent a migration timestamp, infer historical SQL from the live schema, or treat the live database as a source-of-truth migration repository. Before a runnable migration is authored, restore the canonical Supabase project directory and migration workflow from the correct source repository, then create the migration using the Supabase CLI's `supabase migration new` command. The CLI's migration filename and local verification workflow must be used rather than hand-guessing a filename.

This provenance gap is why this R19 artifact is deliberately a design contract, not executable SQL. It prevents a guessed migration from being applied to or diverging from the live project.

## 3. Proposed additive OpenAI-specific data model

Do not reinterpret or bulk-update existing consent rows. Prefer isolated OpenAI-specific tables first; do not widen the existing provider CHECK constraints until every affected RPC, worker path, RLS rule, usage function and rollback has been reviewed.

### 3.1 `watt_openai_member_consents`

- Composite primary key: `(room_id, user_id)`.
- Foreign key to current `watt_pilot_members(room_id,user_id)`, with delete cascade.
- Fields: `allowed boolean NOT NULL DEFAULT false`, exact `consent_version = 'watt-openai-api-2026-v1'`, immutable terms-document digest, `confirmed_at`, and `updated_at`.
- No direct authenticated table writes. RLS enabled. Authenticated users use a narrowly scoped consent RPC; service-role worker may read the minimum consent projection.
- A missing row, wrong version, false value, duplicate/ambiguous member identity, or roster mismatch means no dispatch.

### 3.2 `watt_openai_dispatch_policy`

- One controlled policy row; absence means disabled.
- Default `dispatch_enabled=false`; model unset; no implicit defaults for a model, provider allowance, or spending limit.
- Explicit operator-configured maximum input/output tokens, daily request limit, daily token limit, and daily cost ceiling in integer micro-USD.
- Model pricing evidence and effective date must be reviewed separately. The worker must calculate estimated cost using the verified model pricing snapshot; the database enforces the configured ceiling.
- This table is server-only. No public or authenticated direct write path.

### 3.3 `watt_openai_job_reservations`

One reservation per job, unique by `job_id`, bound to:

- `room_id`, `requester_id`, `job_id`, unique idempotency key;
- exact OpenAI model and consent version;
- estimated input tokens, output tokens, and cost in micro-USD;
- lifecycle: `reserved`, `committed`, `settled`, `uncertain`, or `released`;
- created, committed, dispatch-attempt, and settled timestamps.

Foreign keys must bind the job, room, and requester to their real records. A duplicate request with identical immutable attributes returns the original reservation; a duplicate with different attributes is a conflict. Do not create a second chargeable reservation for the same job.

### 3.4 `watt_openai_usage_buckets` and `watt_openai_usage_events`

- UTC-day buckets atomically track reserved requests, reserved tokens, reserved cost, completed requests, actual tokens, and actual cost.
- Usage events are append-only and idempotent, unique by event ID and reservation. They bind the same job, room, requester, model, and reservation.
- Actual provider-reported token usage is recorded separately from estimated reservation. Never infer actual usage from a prompt estimate.
- If the request times out after dispatch may have occurred, mark the reservation `uncertain` and retain its reserved budget until reconciled. Never blindly refund it.
- A confirmed pre-dispatch failure may release a reservation. A committed reservation must not be treated as safely refundable merely because the client did not receive a response.

All new public-schema tables require explicit least-privilege grants, RLS enabled, and no client access unless a specific policy is reviewed. Prefer RPC-only access. No anon grants.

## 4. Required RPC contract

Every privileged function must set an empty `search_path`, schema-qualify objects, validate caller role, revoke default PUBLIC execute, and grant execute only to the intended role.

1. **Set consent (authenticated):** derive user identity from `auth.uid()`; validate the user; lock the room's AI-settings row using the existing lock convention; verify current membership; write only the exact OpenAI consent version. On withdrawal, cancel OpenAI-associated pending/processing jobs. Release only reservations proven not dispatched; mark already committed/in-flight reservations uncertain.
2. **Read consent status (authenticated):** require room membership; return this member's consent, current member count, and exact count of current members with the exact OpenAI consent. It must never report ready while the worker release gate is closed.
3. **Reserve job (service role):** require a valid processing job, current requester membership, exact model-policy match, all current room members' OpenAI consent, enabled policy, positive verified safety limits, and an acceptable estimated cost. Under one transaction, lock in the established order, idempotently create the job-bound reservation, and atomically reserve daily request/token/cost capacity. A reservation alone does not authorize dispatch.
4. **Commit reservation (service role):** immediately before network dispatch, re-lock and recheck job, room settings, current roster, all-member consent, policy, model, and reservation identity. Commit only once. The worker may call OpenAI only after this transaction confirms the exact committed reservation.
5. **Record usage (service role):** record actual usage idempotently after a valid upstream response; settle the reservation and reconcile reserved versus actual accounting. A duplicate identical event is harmless; a duplicate event with different attributes is a hard conflict.
6. **Mark uncertain (service role):** on ambiguous timeout/connection loss after dispatch may have started, retain reserved cost/tokens and mark the attempt uncertain. Do not auto-refund.
7. **Publish OpenAI reply (service role):** separate from usage recording. Recheck current membership, current all-member OpenAI consent, room enabled state, processing job identity, committed reservation and settled usage. If consent was withdrawn during the provider call, preserve usage accounting but do not publish the answer.

## 5. Transaction and concurrency rules

- Follow the live WATT room-first convention: lock the room and trigger message as appropriate, then the room AI-settings row, then the job row, then the OpenAI reservation and accounting rows. Confirm exact ordering against every function being replaced before coding.
- Membership triggers currently serialize through the AI-settings row and cancel pending/processing work. OpenAI consent, reservation, commit and publish must serialize on that same row so a member join or revocation cannot slip between the final consent check and dispatch authorization.
- Recheck consent after claim and immediately before external dispatch, then again before publication.
- A member joining after prior consent must not inherit another member's approval. A member leaving or moving rooms invalidates pending work.
- A revocation after dispatch does not erase possible provider usage. Mark the in-flight reservation uncertain/settled as evidence permits; suppress publication.
- Avoid nested functions that acquire parent locks in a different order. Test concurrent operations for deadlocks and serialization anomalies.

## 6. Existing functions that must be reconciled

A later executable migration must review and update, without weakening legacy provider behavior:

- `watt_ai_set_provider_consent` — keep existing provider/version semantics; do not reuse it for OpenAI.
- `watt_ai_room_status` — expose a separate OpenAI consent summary and remain not-ready until every worker and release gate is verified.
- `watt_ai_enqueue_reply`, `watt_ai_claim_reply_job`, `watt_ai_publish_reply`, `watt_ai_publish_provider_reply`, and `watt_ai_publish_provider_poll` — add an explicit OpenAI-specific route or a carefully reviewed provider discriminator. Their current legacy consent checks are not OpenAI consent.
- `watt_record_provider_usage_r16` and R15 reservation/capacity functions — do not simply broaden provider constraints. Either preserve their current three-provider scope and use the dedicated OpenAI ledger, or design a fully atomic cross-provider accounting migration with a complete rollback and regression suite.
- Existing consent-revocation and membership triggers — add OpenAI reservation invalidation without changing their current safe-off behavior.

## 7. Mandatory test matrix before any live migration

- Consent: two-member room, one missing approval, wrong version, false consent, duplicate/invalid member identity, new member join, member departure, room move, revoke before dispatch, revoke during request.
- Authorization: anon denied; authenticated non-member denied; one member can set only their own consent; service-role-only functions reject authenticated callers; no direct table writes.
- Reservation: missing policy, disabled policy, unset model, stale pricing evidence, zero/NULL caps, over-cap estimate, requester not a member, job not processing, wrong room, duplicate identical reservation, duplicate conflicting reservation.
- Concurrency: simultaneous reservations near daily request/token/cost limits; simultaneous consent revocation and commit; membership change and commit; duplicate job delivery; deadlock/lock-order checks.
- Lifecycle: reserved pre-dispatch failure can release; committed request timeout becomes uncertain and is not refunded; successful response records actual tokens/cost once; conflicting duplicate usage is rejected; usage still records when publication is denied.
- Publication: wrong job/room/model/reservation, missing usage event, stale consent, disabled room, duplicate publication, oversized/invalid provider output, publish rollback.
- Compatibility: existing Groq/Gemini/OpenRouter consent, queue, reservation, usage, and publication tests remain unchanged and pass.
- Security: RLS, grants, function ownership, empty search paths, no PUBLIC execute, no secrets in SQL, no accidental Data API exposure.

## 8. Release and cost boundary

- No Supabase development branch: the quoted branch compute cost was USD 0.01344/hour and the user directed that work continue on the existing GitHub branch.
- No live SQL execution, `apply_migration`, schema mutation, secret creation, OpenAI API request, Edge Function deployment, CI deployment, merge, or release-gate change is authorized by this source-only task.
- OpenAI API usage is potentially billable. A separate, explicit billing approval and operator policy are required before dispatch can ever be enabled.
- `store:false` is not a zero-retention guarantee. Complete current OpenAI data-control, model/pricing, POPIA, and cross-border processing review before production.
- The R17 adapter remains a candidate primitive, not a live worker integration. Keep the release gate closed until source/deployment parity, UI consent, migration verification, two-account tests, usage reconciliation, security review, and separate release approval are complete.
