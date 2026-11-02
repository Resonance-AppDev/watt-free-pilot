# R15 cloud integration contract (review-only)
This document is a release-blocking implementation contract, not evidence of deployment.

## Verified current discrepancy
The deployed Supabase watt-ai-room-worker uses the earlier OpenAI path and has RELEASE_GATE_OPEN=false. GitHub's R13 worker uses a Groq free candidate; neither is the three-provider implementation. Never flip the release gate as a substitute for deploying and testing the intended code.

## Database transaction contract
For each AI reply job, the service-role worker must authenticate the caller and verify room membership, room enabled state, consent version, and all current room members' provider-specific approval. Recheck these after job claim and immediately before publication. A single room-wide consent for an older provider must NOT authorize sending content to Gemini or OpenRouter.

Before every external provider call, reserve a provider-specific request and estimated token allowance in one database transaction, enforcing per-minute and daily request/token budgets plus the existing per-user/global daily caps. Reservation identity must be unique for (job_id,provider), and duplicate requests must return the original reservation without dispatching twice. A reservation must identify the consented provider, model, requester, room, job, quota day, token estimate, and lifecycle state. Commit reservation before dispatch; record actual usage and terminal status afterward. On timeout, reserve pessimistically until usage can be reconciled; never blindly refund an uncertain attempt.

## Response and interface contract
At most one answer per distinct provider, up to three answers in a single labeled WATT poll. Partial outcomes must be represented as partial; never invent missing answers. Responses are bounded to 2,000 characters and provider/model attributions remain visible. Human message persistence must be independent of provider failures. The current one-reply publication schema and frontend must be extended to store and display a grouped poll without bypassing room membership checks.

## Required release evidence
1. Confirm actual free tier and selected model, remaining quota, provider terms and server-side credential for each provider.
2. Deploy a staging worker matching the reviewed GitHub commit; prove worker and repository source parity.
3. Test consent withdrawal, member departure, duplicate delivery, concurrent quota contention, provider timeouts, partial responses and daily resets.
4. Confirm no client-side provider secrets, audit logs with redaction, explicit deployment authorization and rollback path.
5. Keep the existing release gate closed until every above requirement passes.
