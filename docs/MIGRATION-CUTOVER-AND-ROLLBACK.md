# No-downtime Firebase migration and fallback plan

## Current source of truth

- Supabase project: `qylyuijjeruvbxipnrgh` (leave unchanged).
- Existing Floot marketing + read-only workspace: `https://watt-human-ai.floot.app/` and `/workspace` (preserve).
- Existing Wix authenticated pilot (preserve): `https://headless-hnoporafmau-resonance36912-140e.wix-site-host.com/pilot.html`.
- Firebase Hosting Spark: **intended new frontend host only**. Actual project/domain not yet linked or deployed.

## Stages

1. **S0 — Offline evidence (complete):** static frontend built; 17 Node tests and 2 Chromium mock test groups pass. No backend changes.
2. **S1 — Firebase staging (pending):** select verified Firebase Spark project, deploy as new `*.web.app` site only. Do not touch DNS, Floot, Wix, or Supabase.
3. **S2 — Live authentication acceptance (pending):** real two-account test with actual approved users. Use a newly created private room and an account deliberately not invited to it; check explicit denial of reads/listing/sending before joining, successful join after invite, owner-only invites, message idempotency and rate limits. Inspect HTTP status and UI, not just screenshots. Do not weaken policies.
4. **S3 — Recovery and legal review (pending):** export/backup recovery test, cross-border/POPIA notice, business identity, security findings review, mobile QA and independent human reviewer.
5. **S4 — Primary URL decision (not authorized yet):** after signed release checklist, communicate the new Firebase URL. Only then consider custom DNS. Keep fallbacks for a monitored transition.

## Rollback (before cutover)

If Firebase hosting, CSP, login, message sending, or membership checks fail: **stop giving out the new Firebase URL**. Continue using the unchanged Floot/Wix pilot. Do not change Supabase URLs, keys, policies, customers, or messages. Repair the static archive and redeploy as a new Firebase release after validation. A Firebase Hosting release can also be rolled back using its release history if needed.

## Rollback (after a future cutover)

Document the exact DNS records and previous settings before changing them. If a Firebase release is faulty, revert DNS or return users to the known-good fallback while retaining Supabase as the source of truth. Do not delete or change data while rolling back the frontend.

## Unchanged gates

- Public signup: OFF.
- Paid billing and plan activation: OFF.
- Automatic OpenAI/AI responses: OFF.
- Evidence retrieval: OFF.
- Reviewer signing: OFF.
- Evidence publishing: OFF.
- Sparks issuance and commercialization: OFF.
- Cloudflare import retries: PROHIBITED.
- Wider commercial release: HOLD.

## Known limitations

- Browser access tokens are tab-memory only; page reload requires sign-in.
- No real-time subscription or push notifications. Refresh on send, manual action and tab return.
- First room read fetches at most the latest 50; older history is not implemented in this migration package. Recent updates may require repeat manual refresh to catch up during message bursts.
- Free 1,000-message per-room cap and 2 owned-room cap are server-side existing pilot limits. They should not be confused with Firebase quotas.
- Recovering the original CK30 source parity, privileged-function advisory signoff, and full customer-grade legal terms remain separate open tasks.
