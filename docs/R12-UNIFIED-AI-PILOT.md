# WATT R12 — One chat for people and WATT AI

**Implementation:** A single existing room timeline and message composer display human messages and clearly attributed **WATT AI** replies. No AI Studio, no message-by-message approval dialogs. Write `@WATT` at the beginning of a normal room message (or use **Ask WATT AI** to insert it). The human message is saved before the backend is invoked; the AI reply, if allowed and successfully produced, appears in the same conversation.

## Consent and permission model
- A signed-in room member may choose **Allow AI in this room** once; this is stored as version `watt-ai-room-v1`, not approval for every individual reply.
- Every current room member must consent, then the owner must enable WATT AI. The controls support withdrawal and disabling. Existing database triggers prevent ongoing AI service if membership or consent changes.
- Client checks merely improve UX. Membership, consent, enabled state, sender identity, unique trigger-message ID, publishing and global daily job limits are rechecked by server RPCs.
- Requests are initiated only for messages prefixed `@WATT`, to avoid unexpectedly sending ordinary human-to-human conversation to OpenAI. Only that initiating message is sent to OpenAI; no room history is sent by this design.
- The original OpenAI-direct worker requests the Responses API with `store:false`, a bounded output and no tools. No provider key is present in frontend files, checked-in source, or GitHub settings.

## Critical: feature staged, NOT active
The currently deployed Supabase `watt-ai-room-worker` has an intentional compile-time `RELEASE_GATE_OPEN = false`, and its CORS policy only permits the older Wix origin. Also `watt_ai_room_status` reports `ready:false` and `watt_ai_set_room_enabled` refuses activation. The R12 worker source in `edge/watt-ai-room-worker/index.ts` adds the unique R12 Firebase preview origin pattern, **but retains the hard release gate OFF**. No Edge Function has been deployed by this PR.

Consequently the R12 UI may load room AI status/history and allow explicit member consent; it will not invoke a provider until a separate, reviewed activation changes the worker, server-side readiness, and owner settings. If the status remains `ready:false`, human-to-human messaging continues normally.

## Required controlled activation (separate review)
1. Complete an independent security audit of the existing Edge worker and the member-consent, job-budget, room-status and enable/disable database functions. Investigate how worker-wide concurrency and per-member quota are bounded. The existing job insertion guard allows at most 20 AI jobs per day globally, **not a guaranteed monetary spending cap**.
2. Review API billing: OpenAI API use is billed separately from any ChatGPT subscription. Authorize a provider-specific spend limit before entering any key or enabling calls. If no allowable free credits exist, leave the provider disabled.
3. Configure `OPENAI_API_KEY` and allowlisted `OPENAI_MODEL` only in Supabase Edge Function secrets; do not copy them to public GitHub or Firebase assets.
4. Deploy a separately reviewed worker revision with the R12 preview Origin restriction, strict JWT user validation, 20-second timeout, max input 2,000 characters, max output 300 tokens, and room membership/consent checks; explicitly open the compile-time gate only after approval.
5. Change the server `room_status` readiness and owner `set_room_enabled` checks in a reviewed migration. Never automatically grant room AI consent. Preserve withdrawal and cancellation triggers.
6. Create the new temporary Firebase preview from protected `main` using `03-Preview-Unified-AI.sh` *after CI passes*; check HTTP 200 on /, /workspace/, /legal/ and /assets/unified-ai.js. This script cannot deploy Supabase functions or change Firebase live.
7. Test two enrolled accounts in an isolated room: sign in, both consent, owner enables room, one user asks `@WATT`, exactly one AI message is saved and visible on both devices, and refresh retains it. Test revoked consent, disabled AI, nonmember access, duplicate trigger, provider error and budget exhaustion. Never use the existing user-history room as disposable test content.
8. Release production Hosting, public signup, auto-deploy and evidence publishing only with separate authorizations.

## Release safety
- User's existing pilot rooms and messages must not be migrated, deleted or rewritten.
- The original R09 temporary preview remains untouched and expires on 8 November 2026 (Firebase receipt).
- Automatic GitHub→Firebase preview deployment, Google/Firebase billing upgrade, public signup, AI evidence publishing, reviewer signing and Sparks remain gated.
- No generated text is silently represented as a human participant. The AI bubble always shows **WATT AI · assistant**.

References:
- https://supabase.com/docs/guides/functions/auth
- https://platform.openai.com/docs/api-reference/responses
- https://platform.openai.com/pricing/
