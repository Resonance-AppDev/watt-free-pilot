# WATT repository safety policy

The frontend uses only the **Supabase publishable key**, not the service-role key or privileged database credentials. The publishable key is an identifier, **not** a security boundary; server-side membership and row authorization are mandatory.

- Repository must be **private** before upload. Never turn on GitHub Pages for the commercial WATT application.
- GitHub Actions `ci.yml` runs tests only. No push or pull request automatically deploys to a live environment.
- `firebase-preview.yml` is `workflow_dispatch` only, runs on `main`, requires exact `PREVIEW_ONLY`, and targets a new seven-day Firebase Hosting channel only. Every rerun of the same commit refuses to overwrite the existing preview.
- **Never** commit Firebase service-account JSON, Supabase service-role keys, GitHub tokens, OAuth credentials, private messages, user emails/passwords or backups.
- Store any Firebase preview-only service account in GitHub repository secret **`WATT_FIREBASE_PREVIEW_SERVICE_ACCOUNT`**. Prefer a dedicated least-privileged identity; revoke or rotate if exposed. On GitHub Free private repositories, don't rely on environment secret/reviewer protections: configure a **repository** secret and keep deploy manual.
- Firebase live channel, Firestore, Firebase Auth, Supabase records/settings, Floot and Wix are excluded from automated deployment.
- No public registration, billing, AI autopost, Sparks, evidence retrieval/publishing or human reviewer signing; commercial release remains on HOLD.
- Release to Firebase live requires **another separate approval** after two real-account tests, source review and backup/recovery verification.

## Optional keyless alternative

`.github/workflows/firebase-preview-keyless.yml` is **unconfigured** and uses GitHub OIDC WIF. It does not store a JSON key; a reviewed GCP provider, dedicated service account, strictly scoped IAM and two GitHub Actions variables are required before use. See `docs/FIREBASE-KEYLESS-PREVIEW-GATE.md`. **WIF does not remove the possibility that a Hosting role can reach the live channel.** Do not loosen the release gates or add project billing to enable this.

## R05 — Automatic preview is explicitly OFF

Automatic tests and one-day private static review artifacts on `main` are permitted. `firebase-auto-preview.yml` runs a readiness report on `main` push but can only request Google OIDC and deploy if **both** `WATT_AUTO_PREVIEW_ENABLED` and `WATT_PREVIEW_ACCEPTANCE_APPROVED` are explicitly set to `true`, two WIF identity variables are present, and the source safety checks pass. Keep these flags unset until Google IAM reviewed and the **first manual Firebase preview has passed** real two-account acceptance. See `docs/AUTOMATED-PREVIEW-OPERATIONS.md`.
