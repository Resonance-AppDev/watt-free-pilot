# WATT — optional keyless Firebase Hosting preview gate

**STAGED ONLY — NOT AUTHENTICATED OR DEPLOYED.** This option is separate from the existing `firebase-preview.yml` JSON-secret workflow and MUST NOT be run until Google IAM has been inspected. No credential, preview URL or live deployment is created by adding these files.

## Purpose and cost limits

`.github/workflows/firebase-preview-keyless.yml` uses GitHub's short-lived OIDC identity via `google-github-actions/auth@v3`, instead of exporting a service-account JSON key. It only runs by manual `workflow_dispatch` from `main` with the exact confirmation `PREVIEW_ONLY`. It calls the existing `scripts/github-preview-only.sh` to deploy to a fresh, non-live Firebase Hosting channel with seven-day expiry and `--no-authorized-domains`.

This requires **no ChatGPT Work, TinyFish, Desktop Commander or paid builder credits**. However, first verify Google Cloud permits identity-pool configuration on the **existing Firebase Spark project**. Some Google Cloud features require project billing. **Do not enable billing, upgrade the project, or activate paid APIs to enable this path.** If not supported on the current project plan, do not use WIF; keep the existing authenticated Cloud Shell preview procedure.

## One-time Google Cloud administrator work — not performed here

1. Verify the real Firebase project `watt-36912`, project number, existing Hosting site, billing state, IAM and current preview channels.
2. If permitted, configure a GitHub Workload Identity Pool and GitHub OIDC provider with issuer `https://token.actions.githubusercontent.com`. Use an admission condition restricted to this exact repository, its immutable ID, branch, event and workflow:

   ```text
   assertion.repository == 'Resonance-AppDev/watt-free-pilot' &&
   assertion.repository_id == '1441700773' &&
   assertion.ref == 'refs/heads/main' &&
   assertion.event_name == 'workflow_dispatch' &&
   assertion.workflow_ref == 'Resonance-AppDev/watt-free-pilot/.github/workflows/firebase-preview-keyless.yml@refs/heads/main'
   ```

   Attribute mapping must at least include `google.subject=assertion.sub,attribute.repository=assertion.repository`. Validate the actual GitHub claims, project IDs and provider mappings before applying. Never trust every repo in the organization or arbitrary forks.
3. Create a dedicated Google service account in `watt-36912`. Bind `roles/iam.workloadIdentityUser` **on that service account only** to the GitHub principalSet for this exact repository and pool. Have a Google Cloud IAM administrator explicitly review which minimal Firebase Hosting roles are necessary. **Do not grant project Owner, Editor, Firebase Admin, Auth or Firestore privileges.** Even a Hosting Admin role may permit **live** deployments; scripts reduce risk but do not remove that IAM capability.
4. Only after IAM, the service account and cost boundaries are approved, add two **non-secret** GitHub Actions repository variables under `Settings → Secrets and variables → Actions → Variables`:
   - `WATT_WIF_PROVIDER`: `projects/PROJECT_NUMBER/locations/global/workloadIdentityPools/POOL_ID/providers/PROVIDER_ID`
   - `WATT_WIF_SERVICE_ACCOUNT`: `DEDICATED_ACCOUNT@watt-36912.iam.gserviceaccount.com`

   These names are resource identifiers, **not passwords**. Do not paste Google tokens or JSON keys into chats or source.
5. Trigger **Actions → WATT Firebase — keyless manual preview ONLY → Run workflow**, choose `main` and enter `PREVIEW_ONLY`. If any check fails, stop and investigate. Record the new preview URL and expiry. Two real-account browser acceptance tests, data preservation verification and security review must pass before any future live cutover.

## Release restrictions

Firebase preview URLs are publicly accessible and interact with the actual backend. Never put customer test secrets or permanent unapproved test messages in production. The workflow MUST NOT change Firebase live Hosting, Firebase Auth authorized domains, Firestore, Supabase records, Cloudflare import, Floot or Wix. Public registration, automated AI, billing, Sparks, reviewer signing and evidence publishing remain on hold.

Official reference: https://github.com/google-github-actions/auth ; https://docs.cloud.google.com/iam/docs/workload-identity-federation-with-deployment-pipelines ; https://docs.github.com/en/actions/reference/security/oidc ; https://firebase.google.com/docs/hosting/test-preview-deploy
