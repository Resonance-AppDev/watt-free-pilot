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
