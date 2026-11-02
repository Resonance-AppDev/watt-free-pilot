# R15 — Unified free-AI pool / top-three poll (review candidate)

## Implemented in this branch
- `free-poll.mjs` selects at most three **distinct** providers, in a stable order: GroqCloud, Google Gemini, OpenRouter.
- Selection fails closed unless **each provider** has a verified free account/tier, configured server credential, positive remaining request and token quotas, room-wide provider-specific consent, and explicit release approval.
- Results preserve provider/model attribution. Missing or failed answers produce a clearly partial poll; the system never fabricates three answers.
- Unit tests cover selection, consent, quotas, release gating, duplicates, and partial results.

## Not implemented / release blockers
- This module is not wired to the deployed worker or frontend. No live calls are enabled.
- The current R13 Groq worker requires explicit @WATT and has RELEASE_GATE_OPEN=false. R14 frontend auto-requests ordinary messages, so the backend and frontend still disagree.
- Implement provider-specific consent records and withdrawal checks for Gemini and OpenRouter. Existing Groq consent must not be reused.
- Implement transactional quota reservations for **each** provider, user and room, with provider 429 handling, retry-after, token budgets and strict cost ceiling. A 20/day job cap is not a 60/day provider allowance.
- Verify provider free-tier account eligibility, available models, current quotas and terms. Never assume all advertised free models are usable or that a zero-cost route is available.
- Make each provider call independently cancellable; recheck consent before dispatch and before publication. Use one idempotent poll ID, bound concurrency and bounded outputs.
- Persist each provider response with attribution and display three labeled candidates in the same WATT room. Do not automatically claim consensus or rank truth without an evaluated rubric.
- Review disclosure, cross-border processing, data retention, security, abuse limits and the public repository's source history before deployment.
- Update checksum manifests and run CI on this branch before merge.
- Obtain separate release approval following security and real-account end-to-end tests.

## Decision carried forward
R13 selected GroqCloud first; Gemini optional. OpenAI remains optional paid/API-backed, not assumed free. Provider-specific consent and cloud-only hosting remain mandatory.
