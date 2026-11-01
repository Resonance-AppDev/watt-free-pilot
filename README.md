# WATT — Private GitHub Frontend / Firebase preview / Supabase backend

**Checkpoint R03 · 1 November 2026 · Verified source snapshot, imported to private GitHub after authorization. Firebase remains preview-only and has not been deployed by this snapshot.**

This is WATT's **dependency-free static frontend**: website, existing-account sign-in, private rooms, invites, human messaging, and mobile styling. It talks directly to the existing Supabase project `qylyuijjeruvbxipnrgh` using only a browser-safe publishable key and auth tokens held in tab memory. There is no new database, no Firebase Auth, no server-side keys, no public signup, no automatic AI calls, and no paid checkout.

**GitHub repository:** `Resonance-AppDev/watt-free-pilot`, private, authorized to the connected `resonance36912-cell` account. Source updates are limited to this WATT repository; the suspended account and unrelated public repositories are not used.

## What it runs

- `npm test` — 21 inherited source/security tests plus a new GitHub integration test suite.
- `npm run check` — JavaScript syntax, source contracts.
- `npm run build` — checks the static Hosting payload. No `npm install` needed.
- `python verify-kit.py` — SHA-256 verification of all archive contents.
- `bash 01-Preview-Only.sh` — previously tested **manual Cloud Shell** guarded preview path, using an unused fixed review channel; refuses to alter production Hosting.

## Source → CI → HTTPS preview

`private GitHub repo` → `GitHub Actions (CI on push/PR)` → **manual** `Firebase Hosting preview workflow` → `existing Supabase Auth + private RPCs`.

CI automatically runs on every push/PR; **deployments never trigger automatically**. To enable the Firebase preview workflow, a GitHub repository secret `WATT_FIREBASE_PREVIEW_SERVICE_ACCOUNT` containing a scoped Firebase Hosting service-account JSON must be configured by an authorized operator. That requires access to the already-used Firebase project `watt-36912`. Never paste the credential into ChatGPT or commit it to the repository.

The workflow creates a new preview channel `watt-gh-<12-character-commit-prefix>` (7-day expiry). It verifies the project, access and nonexistent channel before cloud changes, and requires exact confirmation `PREVIEW_ONLY` when started manually. No live Firebase deployment is present in workflows.

## Repository source and deployment (private only)

The authorized private GitHub repository is `Resonance-AppDev/watt-free-pilot`. This source snapshot is intended to be imported as a single reviewed commit. Do not upload to public repositories, use secret service-account keys in browser code, or deploy Firebase live Hosting. The workflows are separated into CI (automatic on push/PR) and manual Firebase preview (requires approved scoped credentials and explicit confirmation).

For operators: clone the private repository, run `python3 verify-kit.py && npm run check && npm run build`, then review the GitHub Actions CI result. A Firebase preview requires a scoped secret and a human-triggered workflow; live Hosting is not targeted.

## Important limits

- GitHub Actions is a build and source control service, **not WATT's commercial website host**. The frontend is intended for Firebase Hosting Spark subject to quotas.
- No continuous message polling or real-time subscriptions. Refresh on send, manual action or tab return. Older history pagination beyond the initial latest 50 is not yet available.
- Hostwide free quotas, Firebase project permissions and all Supabase security review controls apply.
- Original WATT CK30 canonical source parity, privileged-function security reviewer signoff, two real-account cross-room acceptance, privacy/legal review and paid commercialization remain outstanding.

For the release gate and rollback details, read `docs/MIGRATION-CUTOVER-AND-ROLLBACK.md` and `SECURITY.md`.

## Optional keyless preview route — STAGED, NOT AUTHENTICATED

A separate manual GitHub OIDC Workload Identity Federation workflow is available in `.github/workflows/firebase-preview-keyless.yml` with setup and security gates in `docs/FIREBASE-KEYLESS-PREVIEW-GATE.md`. It requires Google Cloud IAM setup and is not a claim of deployed Hosting or verified billing-free eligibility. It does not auto-run on `push` or `pull_request`.

## R05 — Automatic workflow with locked preview gate

`ci.yml` now runs for every PR/push to main and uploads a one-day private static review artifact after a successful `main` push. The new `firebase-auto-preview.yml` reports readiness automatically and **SKIPS all Firebase access by default**. To permit automatic, temporary previews after the initial manual real-account acceptance and audited Google WIF configuration, an operator must explicitly set **both** `WATT_AUTO_PREVIEW_ENABLED=true` and `WATT_PREVIEW_ACCEPTANCE_APPROVED=true` plus the approved WIF resource identifiers. No live deploy ever runs. See `docs/AUTOMATED-PREVIEW-OPERATIONS.md`.
