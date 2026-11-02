# WATT R18 — Live OpenAI integration schema contract

**Status: verified read-only schema review + isolated source contract. No live database migration, Edge Function deployment, provider request, secret write, billing change or release-gate change.**

## Read-only inspection

Project `qylyuijjeruvbxipnrgh` (WATT Live Pilot) was inspected through the connected Supabase project tools. It is active in `eu-west-1`. The current database contains the R15/R16 provider tables, but their provider constraints exclude OpenAI:

- `watt_ai_provider_consents.provider`: `groq | gemini | openrouter`.
- `watt_ai_provider_reservations_r15.provider`: `groq | gemini | openrouter`.
- `watt_ai_provider_capacity_r15.provider`: `groq | gemini | openrouter`.
- `watt_ai_provider_quota_usage_r15` is linked to that capacity table.
- `watt_daily_provider_usage_r16.provider` and `watt_provider_usage_events_r16.provider`: `groq | gemini | openrouter`.
- `watt_record_provider_usage_r16` rejects any other provider.
- `watt_ai_set_provider_consent` accepts only `groq`, `gemini`, and `openrouter`, and writes the fixed consent version `watt-ai-provider-v1`.
- Existing enqueue, claim and publish RPCs still validate the legacy room consent `watt-ai-room-v1`; they do not enforce the R17 OpenAI-specific consent version.
- Existing `watt_ai_room_status` returns `ready:false` and `AI_WORKER_STAGING_NOT_VERIFIED`.

The deployed `watt-ai-room-worker` is version 8 and differs from the R13 GitHub worker. Its source contains an OpenAI request path, but its release gate is false. It does not import the R17 adapter. The source's default model string is `gpt-6-luna`, which is not an approved model selection and must not be relied on. No provider call is enabled by this review.

## Why R18 cannot safely flip the worker on yet

Adding `openai` to a CHECK constraint alone would be insufficient. The consent write RPC, consent status calculation, enqueue/claim/publish transaction gates, reservation identity, quota accounting and usage recorder must all agree on the same provider and consent scope. The present database has no verified OpenAI path across those components.

The existing reservation table also has no model, requester, room, consent-version or reservation-window fields. A new provider reservation contract must bind those facts to the job and enforce one reservation per (job, provider) atomically. Existing Groq/Gemini/OpenRouter reservations and consent rows must remain unchanged.

## R18 implementation requirements

1. Add a separate `watt-openai-api-2026-v1` consent record per current room member. A room's legacy OpenAI-era consent is not proof of consent to the current API terms, model, processing purpose, data handling or potential charges.
2. Extend provider checks and provider consent RPC with OpenAI as a distinct processor; never reinterpret existing consent.
3. Update room status, enqueue, claim and publish transaction functions so all-member OpenAI consent is checked under the established room-first lock hierarchy before dispatch and publication. Membership joins, departures, revocation and room setting changes must invalidate or cancel pending work.
4. Add an atomic, idempotent OpenAI request/token reservation and usage ledger. Keep actual provider limits and any operator-set safety bounds distinct; never describe an OpenAI API plan as free.
5. Bind each reservation to job, room, requester, provider, model, consent version and estimate; commit before external dispatch; record actual usage afterward; treat timeouts as uncertain usage and do not blindly refund.
6. Wire the R17 adapter into the authenticated worker only after the database functions and UI are reviewed. Keep the current release gate closed.
7. Verify OpenAI model availability, pricing, data controls and retention terms at implementation time. `store:false` is not a zero-retention guarantee. Complete POPIA and cross-border processing review for South African users.
8. Test two-account room consent, revocation during a request, roster changes, duplicate job delivery, concurrent reservations, upstream 429/timeout, invalid provider output, and publish rollback.

## Deployment and billing boundary

No changes were made to Supabase project data, schema, functions or secrets. No GitHub CI/CD workflow or Firebase hosting deployment was triggered by this R18 source-only contract. The production worker release gate remains closed. Do not deploy the R17 adapter or any R18 work until the database migration and security review are complete.

## Development database branch

A separate Supabase development branch was requested for isolated schema work. Supabase quoted **USD 0.01344 per hour**. Creation is pending explicit cost approval. No branch was created.
