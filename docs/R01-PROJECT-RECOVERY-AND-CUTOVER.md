# WATT R01 — Firebase project recovery and cutover controls

**Primary candidate:** Firebase project ID `watt-36912` (verified in historical user-owned R03/R07.1 Cloud Shell deployment records). The former version of WATT used this Firebase project for Hosting preview channels and separate Firebase/Firestore research. This R0 Free Pilot is different: it connects to the already-live Supabase project `qylyuijjeruvbxipnrgh` for Auth and conversation storage.

**Important distinction:** historical records identify the project, but no current CLI login or control of that project was established in this ChatGPT execution. Never guess the current Hosting channel inventory or a new preview URL.

## Plan
1. Preserve the Firebase live channel and existing R03–R07.1 review channels.
2. Deploy this static app to a **new preview channel** using the guarded `01-Preview-Only.sh` in authorized Cloud Shell, only after its preflight passes.
3. Verify the assigned preview URL with public HTTP checks and Supabase CORS/auth denial. Then use two real enrolled accounts in separate browser profiles for room access, create, join, invite expiry/revoke, message send/receive, idempotent retry, logout and unexpected token expiry.
4. Confirm old WATT Firebase review releases, Floot site, Wix pilot and every Supabase record remain intact. Check Firebase Hosting metrics, quotas, and whether the project is still on Spark before promotion.
5. Only after independent approval, prepare a *separate*, explicitly authorized live Hosting promotion. **No live promotion is included in this kit.**

## What is intentionally absent
- No migration of users/messages from Supabase to Firebase Firestore.
- No Firebase Auth updates, authorized domain changes, Cloud Functions, billing, Realtime DB or Analytics.
- No public enrollment, automatic AI posting, Sparks, evidence retrieval or reviewer signing.
- No service-role key, privileged SQL migration, Stripe or checkout.
- No rollback deletion: the preview channel expires automatically after seven days; existing sites remain available.

## Remaining security gates
Source verification from the original CK30 code remains incomplete. Privileged-function security advisories, independent human reviewer and real authenticated isolation tests remain open. Preview publishing alone is **not** a commercial release.
