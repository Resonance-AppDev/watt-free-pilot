# WATT R14 — Explicit processor consent and free-tier activation safety

**Status:** source-only candidate. No deployed Supabase worker, database function, provider key, AI call, Firebase release or billing change is performed by this proposal.

## What was discovered

- WATT R12 room consent version `watt-ai-room-v1` was presented in the earlier pilot UI in connection with **OpenAI**.
- R13 selected **GroqCloud's open-weight GPT-OSS 20B** as a free-provider candidate. GroqCloud is **not** ChatGPT or the direct OpenAI API.
- The existing server returns `ready:false`, the Edge worker has `RELEASE_GATE_OPEN = false` and the database still caps AI job creation at **20/day**.
- Public base limits for this Groq model are documented as up to **1,000 RPD, 30 RPM, 8,000 TPM and 200,000 TPD**, subject to the operator's actual organization limits. Published ceilings are not remaining quota or a guarantee of zero overage.
- Gemini's free tier is project/model dependent. Its actual remaining quota is visible in Google AI Studio, not in WATT's connected Supabase/GitHub tools.
- The current authenticated GitHub/Supabase tools do **not** expose a Groq or Gemini API quota account or a safe Supabase Edge secrets management action. Do not claim those accounts were checked.

## R14 implementation

`provider-consent.mjs` introduces a distinct processing scope `watt-ai-groq-2026-v1`. The staged worker queries **the current room membership and versioned consent** using its server-only service credential. All members must have accepted that *same provider scope*, and checks occur before queueing, before contacting Groq, and before publishing. Any failure is a denial. Old generic/OpenAI consent is never silently carried across to the new processor. Client content remains private, with provider calls allowed only for explicit `@WATT` messages after separate release authorization.

The UI disclosure now identifies the proposed Groq model and warns that old consent is insufficient. **The existing live Supabase consent RPC still only supports its original version** and does not create `watt-ai-groq-2026-v1` approvals. This is intentional: without an independently reviewed consent migration, no AI prompt can be sent, even if another operator removes the compile-time release flag. Never fabricate or bulk-migrate another participant's permission.

## Required to complete actual live activation

1. **Provider authorization:** in Groq Console, confirm the organization's Free plan with no billable overage and, if available, enable Zero Data Retention. Check exact model availability and organization-specific RPM/RPD/TPM/TPD. The official privacy policy allows up to 30-day abuse/reliability retention unless ZDR is enabled. Consider South African cross-border data protections. Provider consent must explain this.
2. **One-request quota probe:** from an authorized shell, with a Groq account key kept private, run `scripts/probe-groq-free-quota.sh` after confirming the two explicit environment gates and no billing. It makes one minimal provider request, not a WATT room message, and returns sanitized rate-limit headers. **It is not a free-service activation or an unlimited daily quota certificate.**
3. **Consent migration:** update and test the owner-controlled `watt_ai_set_member_consent`, `watt_ai_room_status`, `watt_ai_reply_job_budget_guard`, `watt_ai_set_room_enabled` and transactional publisher so the active model/provider-specific consent version is enforced end to end. Keep all current room memberships, older consents and messages unchanged. Do not enable AI until every member explicitly re-accepts the new processing terms.
4. **Enforced usage ledger:** the current DB limit of 20 AI jobs/day stays in place. Before raising it, implement a DB-atomic provider request and token budget controlling minute and day limits across all Edge instances. Groq's 1,000 RPD is NOT 1,000 guaranteed responses: 200,000 TPD, 8,000 TPM and organization capacity can bind earlier. Fail closed on provider `429`, never retry on a paid model, and stop when any budget is exhausted.
5. **Protected backend:** review the worker's JWT account confirmation, room membership, request author, deduplication and consent recheck; configure `GROQ_API_KEY` only in Supabase secrets. If R14 source is ever deployed, keep `RELEASE_GATE_OPEN=false` until all checks pass.
6. **Controlled acceptance:** use an isolated two-account room. Test one `@WATT` reply, duplicate request, revoked consent, changed membership, invalid room, provider outage, quota exhaustion and message persistence. Verify actual provider billing remains zero.
7. **Live cutover:** require separate deployment verification and rollback plan. Preserve current Firebase live Hosting, R12 temporary review channel, customer messages, WATT signup security, publishing and governance release gates until accepted.

## Provider selection policy

Groq is the first candidate because its public model-specific free quota is quantified and its inference endpoints support Zero Data Retention configuration. **Gemini is not an automatic fallback**: it can have different processing/retention conditions and requires its own explicit room consent and verified Free-tier project. No automatic provider switching in response to rate limits; that could disclose conversation content to a newly chosen vendor.

References:
- https://console.groq.com/docs/rate-limits
- https://console.groq.com/docs/your-data
- https://ai.google.dev/gemini-api/docs/rate-limits
- https://ai.google.dev/gemini-api/docs/billing
- https://supabase.com/docs/guides/functions/secrets
