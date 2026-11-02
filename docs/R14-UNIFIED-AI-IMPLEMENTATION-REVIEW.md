# R14 — Unified AI cloud implementation review

Status: development branch only. No production deployment or database changes.

## Verified frontend
- `public/assets/workspace.js` already merges human and AI messages into one room.
- `public/assets/unified-ai.js` invokes `/functions/v1/watt-ai-room-worker` only after an explicit `@WATT` message.
- Current AI eligibility requires server readiness, owner enablement, and consent from every room member.
- The frontend does not contain a provider API secret.

## Approved target
1. Make automatic AI participation configurable per room, without requiring approval for each AI reply.
2. Present provider-specific data disclosures at sign-in or onboarding and preserve individual withdrawal.
3. Require server-side authorization and consent checks on every AI trigger; client-side toggles are not sufficient.
4. Preserve idempotent triggers, rate limits, bounded spending, room isolation, and human-message durability.
5. Keep deployment separate from source changes until the cloud worker, database schema, tests, and credentials are verified.

## Unverified dependencies
- Actual Supabase Edge Function implementation and deployment state.
- Database RPC definitions and consent persistence.
- AI provider selection, quota, and billing configuration.
- Real-account integration and end-to-end tests.

Do not enable automatic posting merely by changing browser checks: the backend must enforce these conditions.
