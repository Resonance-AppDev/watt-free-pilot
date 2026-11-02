# WATT R13 — Verified free provider options and zero-paid-use configuration

**Reviewed: 2026-11-02. This is a candidate only, NOT a live provider activation.**

## Public free-tier comparison

| Provider | Public free allocation | Verification limitation |
|---|---|---|
| GroqCloud GPT-OSS 20B (`openai/gpt-oss-20b`) | 30 RPM, 1,000 RPD, 8,000 TPM, 200,000 TPD on its listed base/free limits | Per-organization limits may vary; inspect the operator's Groq console and live `x-ratelimit-` headers before enabling |
| Cloudflare Workers AI | 10,000 neurons per day on Workers Free | Model-dependent consumption prevents meaningful requests/day comparison |
| Gemini API | Free input/output tokens on eligible models | Model-specific per-project RPM, TPM and RPD shown only in AI Studio; free data may be used to improve provider products |
| OpenRouter free models | 20 RPM, 50 RPD without paid credit purchases | 1,000 RPD requires previously purchasing credits; not a zero-spend new account |
| Direct OpenAI API | Account-specific credits/rate limits | No connected API organization balance or credit grant verified for WATT; ChatGPT Plus does not itself grant an API budget |

Groq's `openai/gpt-oss-20b` is an **OpenAI-developed open-weight model served by Groq**, not the OpenAI API or ChatGPT. The hosted service still has published token prices, so WATT may use it only after verifying the organization is on Groq's truly free plan with no billable overages. The pricing table is **not** a certificate of free usage on a particular account.

Official sources:
- https://console.groq.com/docs/rate-limits
- https://console.groq.com/docs/model/openai/gpt-oss-20b
- https://console.groq.com/docs/your-data
- https://developers.cloudflare.com/workers-ai/platform/pricing/
- https://ai.google.dev/gemini-api/docs/rate-limits
- https://ai.google.dev/gemini-api/docs/pricing
- https://openrouter.ai/pricing
- https://developers.openai.com/api/docs/guides/chatgpt-api-credits

## Implementation (code staged in this PR)
`edge/watt-ai-room-worker/free-provider.mjs` constrains requests to the explicit `@WATT` trigger and a single allowlisted model, with no tools, hidden reasoning, a 256-token response ceiling and maximum 2,000-character user input. No room history is sent.

`edge/watt-ai-room-worker/index.ts` retains all existing authentication, room membership checks, all-member versioned consent, owner-enabled room setting, duplicate-trigger prevention, transactional publish guard, body/response timeouts and concurrency limits. It accepts a free Groq provider only when the following **server-side configuration** is present:

- `WATT_AI_PROVIDER=groq_free`
- `WATT_GROQ_FREE_CONFIRMED=true`
- `WATT_FREE_ONLY=true`
- `GROQ_API_KEY` stored **only** in Supabase Edge Function secrets.

No secrets were set, no provider calls were made and **`RELEASE_GATE_OPEN = false`** remains in source.

### Why 1,000 RPD is NOT yet an app limit
The existing database job guard currently caps AI requests at **20 per day** and has not been increased. Raising it to 1,000 without a verified 200,000-tokens/day ledger and provider account limit could exceed the free token allocation and trigger unintended charges or denials. Before raising capacity, implement an atomic provider-token ledger and a no-overage hard stop. The provider's 1,000 RPD is only one of four simultaneous limits. WATT must fail closed on the first exceeded limit and never retry into a paid tier.

Use `scripts/probe-groq-free-quota.sh` with a locally configured Groq free account to inspect response rate-limit headers. It makes **one minimal real model call**; it must not be run with a paid/overage-enabled account. Never paste the key, tokens, room messages or provider response body into GitHub or chat.

## Deployment gates (still closed)

1. Verify actual Groq organization free status and remaining RPD/TPD; a published limit alone is insufficient.
2. Confirm Groq's data location/retention policy, user consent and cross-border transfer terms (especially for South African personal information). Zero Data Retention can be enabled through the Groq console if available; do not assume it is on.
3. Ensure provider-managed billing cannot exceed a zero-cost cap; leave `RELEASE_GATE_OPEN` false until this is established.
4. Review backend quota guards, provider error behavior and total-token ledger using a disposable room; preserve existing real users' rooms.
5. Set the server secret securely, audit the policy, deploy the reviewed worker, and enable server readiness *only after* all-member room consent, and only to a separately approved pilot origin.
6. Verify one real AI reply, retry/duplicate behavior, revocation, two-device delivery, budget exhaustion and no unapproved paid usage.
7. Live Firebase Hosting, public enrollment, all governance gates and unrestricted registrations remain separate releases. Never switch off RLS, authentication, consent or rate limiting to make a release pass.

Current WATT status at preparation: existing human chat works; no AI replies have been generated through the backend; no AI rooms enabled. Public GitHub code contains no provider credentials.
