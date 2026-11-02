# WATT R17 — OpenAI API integration groundwork

**Source-only candidate. Not wired into the deployed room worker. No API key, provider call, database migration, billing change, preview deployment or release-gate change.**

The candidate adds a dedicated server-side OpenAI Responses API adapter and a provider-specific room-consent validator. Every current room member must accept `watt-openai-api-2026-v1`; the operator must separately authorize billable API use and release activation; and a committed job-bound OpenAI reservation is required. Historical consent is not migrated or reinterpreted.

The adapter uses `POST https://api.openai.com/v1/responses`, sends credentials only in the server-side Authorization header, sets `store:false`, bounds prompts to 2,000 characters, output to 512 tokens, response bodies to 64 KiB, timeout to 30 seconds and returned text to 2,000 characters. It records only provider-reported usage and observed rate-limit headers. It does not retry, silently switch providers, publish room messages, persist prompts or log credentials. OpenAI API use can incur charges; this is not a free-tier route. `store:false` is not a guarantee of zero retention.

Before live integration: review current OpenAI data controls, model availability, pricing and South African cross-border privacy obligations; implement a database consent migration and atomic provider usage ledger; wire into the authenticated worker only after UI/database review; store credentials only in the protected secret manager; test with an authorized API account; keep the worker release flag and hosting deployment blocked until security, two-account, rollback and source/deployment parity checks pass.

Closing the R17 PR discards these additive files without changing database, hosting, room, consent or message state.
