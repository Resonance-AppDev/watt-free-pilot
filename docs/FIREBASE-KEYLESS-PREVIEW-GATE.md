# Firebase Hosting preview with no service-account JSON key (optional)

**Status: STAGED, NOT CONFIGURED, NOT DEPLOYED.** This workflow only prepares an option for existing Firebase project `watt-36912`; it does not create Google Cloud IAM resources, GitHub variables, channels, billing accounts or deployments. Existing Firebase live Hosting, prior channels and Supabase are untouched.

## Why this path

The recommended approach is GitHub Actions **Workload Identity Federation (WIF)** through a Google service account, rather than storing an exportable long-lived JSON key. The repository now provides `.github/workflows/firebase-preview-keyless.yml`, which uses `google-github-actions/auth@v3`. It is manually triggered only on `main`, requires exact `PREVIEW_ONLY`, and calls the existing guarded `scripts/github-preview-only.sh` (a new 7-day channel, never `live`, no Auth authorized-domain changes). The original JSON-secret workflow is left intact as a separate *unconfigured* alternative; do not run both.

**Cost:** This does not require paid ChatGPT Work, Desktop Commander, TinyFish or Floot credits. Whether Google Cloud permits configuring WIF *without enabling project billing* must be checked for this exact project before use. **Do not enable billing, attach a billing account, enable new paid Google Cloud APIs, or upgrade Firebase Spark solely to configure this pathway.** If unavailable on the current project plan, stop and retain the prior manual signed-in Cloud Shell preview path instead.

## One-time cloud identity setup (authorized Google Cloud administrator)

Google Cloud IAM cannot be changed by the currently connected GitHub tools, and the installed Firebase integration does not expose an invocation here. The administrator must inspect IAM roles and project billing settings directly and use Google's official steps below. Do not paste credential files or tokens in GitHub issues, logs, or ChatGPT.

1. Confirm the existing **project ID** `watt-36912`, project **number**, Hosting site and Firebase Spark/billing status from the Google Cloud / Firebase consoles. Stop if permissions or pricing are unclear.
2. Only if permitted on the existing no-upgrade project: create a dedicated GitHub WIF pool and OIDC provider with issuer `https://token.actions.githubusercontent.com` and a strict admission condition (using GitHub's OIDC claims) equivalent to:

   ```text
   assertion.repository == 'Resonance-AppDev/watt-free-pilot' &&
   assertion.repository_id == '1441700773' &&
   assertion.repository_owner_id == '337308611' &&
   assertion.ref == 'refs/heads/main' &&
   assertion.event_name == 'workflow_dispatch' &&
   assertion.workflow_ref == 'Resonance-AppDev/watt-free-pilot/.github/workflows/firebase-preview-keyless.yml@refs/heads/main'
   ```

   Map at least `google.subject=assertion.sub` and `attribute.repository=assertion.repository`. Prefer additional immutable organization/repository ID conditions after confirming GitHub's actual claims. **Do not** accept tokens solely by organization name or allow arbitrary forks/branches.
3. Create/reuse a **dedicated deployment service account** in this project. Grant `roles/iam.workloadIdentityUser` on that *service account* only to the principal set for **this one repository** and **this one pool**. Review all Google Cloud permissions it will inherit; do **not** grant Owner, Editor, Firebase Admin, or privileges covering Auth/Firestore/Supabase. Firebase Hosting roles may still allow *live* releases; workflow guardrails are not a substitute for reviewing that risk and restricting who can edit/trigger workflows.
4. Have a Google Cloud security administrator review the minimum required Firebase Hosting permissions and all policy binding diffs **before** granting them. Never assume a generic Hosting Admin role is preview-channel-only: it is not. Stop if no acceptable permission boundary is available.
5. Under the private GitHub repository **Settings → Secrets and variables → Actions → Variables**, add two **non-secret resource identifiers**:
   - `WATT_WIF_PROVIDER` = `projects/PROJECT_NUMBER/locations/global/workloadIdentityPools/POOL_ID/providers/PROVIDER_ID`
   - `WATT_WIF_SERVICE_ACCOUNT` = `DEDICATED_ACCOUNT@watt-36912.iam.gserviceaccount.com`
   Neither is an access token or a service-account key. Do not put secret credentials in repository variables.
6. After IAM and the provider condition have been independently verified, manually run **Actions → WATT Firebase — keyless manual preview ONLY → Run workflow** on `main`, entering `PREVIEW_ONLY`. The job validates source integrity and configuration before requesting an OIDC token and stops if access/project checks fail. Record the returned unique 7-day preview URL, and perform real two-account acceptance under an approved data-handling plan.

## Security / release gates

- **Public Firebase preview URLs still interact with real backend resources.** The link's obscurity does not make it private. Do not post production test messages or secrets.
- Never invoke `firebase deploy`, `hosting:clone`, Firebase Auth domain changes, production site cutover, or Cloudflare import retries as part of this preview.
- Every failed gate stops before deployment; missing WIF variables do not authorize any cloud access.
- Supabase baseline: 1 pilot room, 2 members, 35 messages; evidence retrieval, signing, publishing, Sparks and daily-user intake disabled. Revalidate before/after preview, and retain all release holds.

Official sources: https://github.com/google-github-actions/auth ; https://docs.cloud.google.com/iam/docs/workload-identity-federation-with-deployment-pipelines ; https://docs.github.com/en/actions/reference/security/oidc ; https://firebase.google.com/docs/hosting/test-preview-deploy .

## R06 isolation from push-based automatic previews

This manual-only provider must admit **only** `event_name=workflow_dispatch` with the exact `firebase-preview-keyless.yml` workflow. The push-based automatic preview needs a distinct dedicated provider with `event_name=push` and `firebase-auto-preview.yml@refs/heads/main` as documented in `docs/AUTOMATED-PREVIEW-OPERATIONS.md`. Its repository variables use the **`WATT_AUTO_WIF_`** prefix. Do not modify this manual provider to accept all push workflows or enable paid Google APIs to make automation work. Before configuring either provider, an authorized operator can run `bash scripts/audit-firebase-cloud-readonly.sh` in authenticated Google Cloud Shell for read-only project eligibility assessment.
