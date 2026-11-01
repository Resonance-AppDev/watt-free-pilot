# WATT R05 — Automated CI, downloadable review build, gated auto-preview

**Implementation status: merged source automation can run without credentials; Firebase automated deployment remains OFF until Google Cloud IAM and real acceptance checks are separately completed.**

## What runs automatically at no added deployment risk

1. Every pull request and main-branch push runs `.github/workflows/ci.yml`: checksum verification, all Node source/security tests, syntax checks, static build and credential-file protections. Failure blocks a release decision; configure branch checks when GitHub plan permits.
2. On `main` pushes passing that job, the same workflow uploads the built `public/` tree to a private **GitHub Actions artifact** called `watt-reviewed-static-<commit>`, retained for **one day**. This is not a hosted website and does not call Supabase or Firebase.
3. Every `main` push evaluates `.github/workflows/firebase-auto-preview.yml`; by default the deployment job is **skipped** and a non-privileged readiness summary explains why. **GitHub may mark skipped checks successful: this is not proof of a deployed preview.**

## Two-step, OFF-by-default deployment control

Automatic Firebase preview deployment requires all of the following:
- Repository is private and exactly `Resonance-AppDev/watt-free-pilot` on `refs/heads/main`, event `push`.
- Existing client and Hosting safety checks pass within the auto-preview job.
- Google Cloud IAM has been reviewed; a dedicated *scoped* service account has Federated Identity access and the reviewer has verified Google Cloud costs and privileges. **Do not enable billing or upgrade this existing Firebase Spark project.**
- GitHub Actions repository variables `WATT_WIF_PROVIDER` and `WATT_WIF_SERVICE_ACCOUNT` contain the approved non-secret Google resource identifiers. No JSON key is needed.
- The **first manual seven-day preview** has been deployed and accepted by real owner/member accounts, with strict room access, cross-device refresh, sign-out, CSP and production-data preservation checked. No persistent test data may be written to production without a separately approved test/cleanup plan.
- Only after this first acceptance, an authorized operator manually sets both *non-secret* repository variables **`WATT_AUTO_PREVIEW_ENABLED=true`** and **`WATT_PREVIEW_ACCEPTANCE_APPROVED=true`**. Missing/false values keep deployment OFF.

The existing `.github/workflows/firebase-preview-keyless.yml` remains **manual only** and serves as the initial approved test deployment, gated by exact `PREVIEW_ONLY` input and `main` branch. The legacy JSON-secret workflow is unchanged and remains manual.

## Separate Workload Identity Federation admission for auto-preview

The Google administrator must review a provider condition restricted to immutable repository ID, exact push event, default branch and exact workflow path:

```text
assertion.repository == 'Resonance-AppDev/watt-free-pilot' &&
assertion.repository_id == '1441700773' &&
assertion.ref == 'refs/heads/main' &&
assertion.event_name == 'push' &&
assertion.workflow_ref == 'Resonance-AppDev/watt-free-pilot/.github/workflows/firebase-auto-preview.yml@refs/heads/main'
```

Map `google.subject=assertion.sub,attribute.repository=assertion.repository` and review all actual token claims before creating or changing Google Cloud IAM. **Do not widen the manual workflow's `workflow_dispatch` admission to all push workflows, forks, or entire organizations.** A separate provider with this exact restricted condition is preferable for auditable isolation. If using separate WIF providers, configure the `WATT_WIF_PROVIDER` variable for the provider intended for automatic previews; the manual provider may then need to remain separate. Protect the main branch and the deployment workflow before enabling automatic preview.

Google IAM permissions for Firebase Hosting may include the ability to deploy live, even if this workflow never calls a live endpoint. A shell guard is not an IAM permission boundary. Keep the preview permission review and rollback governance before any authorization.

## What the automated preview does — after explicit enablement

- Tests/validates static content again BEFORE Google authentication.
- Authenticates with short-lived OIDC (`google-github-actions/auth@v3`), never a long-lived JSON key.
- Checks project `watt-36912` identity and current preview channels; targets only a *new* seven-day channel named for the commit; refuses an existing channel on retry.
- Invokes Firebase CLI with `--no-authorized-domains`, never `firebase deploy` live or Cloudflare migration.
- Includes the same shared concurrency group as manual preview workflows to avoid simultaneous updates.
- Never changes Firebase Auth, Firestore, Supabase, live Hosting, Wix or Floot. Human-AI automated posting, public signup, billing, Sparks, reviewer signing, external retrieval and evidence publishing remain blocked.

## Stop conditions and monitoring

If any IAM variable is missing, tests fail, source hashes disagree, an existing preview channel is found, or the free plan would require billing, **stop**. Review GitHub Actions job summary and deployment logs, never post credentials or real user data there. The automatic preview workflow may show a successful readiness job with a **skipped** deployment; inspect the actual Firebase deployment job before claiming success.

Current release gate: https://github.com/Resonance-AppDev/watt-free-pilot/issues/2
