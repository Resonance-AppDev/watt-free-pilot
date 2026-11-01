# GitHub / Firebase / Supabase status — 1 November 2026

**GitHub:** `Resonance-AppDev/watt-free-pilot` exists and is PRIVATE. The `resonance36912-cell` connector was verified with admin and push permissions on 1 November 2026. The other connected identity `DataNest-Supository` returns GitHub HTTP 403 (suspended). This document describes the reviewed source package and does not itself prove that a GitHub Actions run or Firebase preview completed.

**Safe destination:** Only `Resonance-AppDev/watt-free-pilot` (PRIVATE); do not copy source into unrelated public repositories.

**Frontend:** R02 is a source-complete static R0 Free Pilot, derived from the independently rebuilt R01 source. All core security limits and allowed API calls remain unchanged. GitHub CI is added; it executes tests on push/PR without secrets. Separate Firebase workflow is manual, verified on `main`, requires exact `PREVIEW_ONLY`, uses a repository secret, and deploys only a new seven-day preview channel. No Firebase `live` deployment, Firestore/Authentication rules, Supabase migrations, Cloudflare, Wix or Floot mutation.

**Firebase:** Existing historical Firebase project `watt-36912` is documented, but this environment has no callable authenticated Firebase Hosting/project action. The new Firebase GitHub preview workflow is not configured or run and has no authenticated service account; no new preview URL exists yet. A qualified operator must authenticate, create a scoped service account, configure the GitHub repository secret, and explicitly launch the manual preview workflow.

**Supabase:** Read-only audit found 1 existing room, 2 memberships, 35 messages, evidence retrieval/signing/publishing and Sparks all OFF. The app only uses `sb_publishable_...` and authenticated RPC calls; backend server authorization remains authoritative. No real-account Firebase A/B tests performed.

**Release decision:** GitHub source kit READY. Private repository confirmed. Source import and Firebase preview must be independently verified. WATT public registration, billing, auto AI, evidence, Sparks and commercial launch remain HOLD. Keep all live fallbacks.
