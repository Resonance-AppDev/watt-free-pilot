# WATT Firebase Spark R0 — Independent Engineering Check

Checked: 2026-11-01; browser automation uses synthetic data only.

## Tests passed

| Test | Result | Meaning |
|---|---|---|
| Node syntax and core contract suite | 17/17 | API paths, auth requirements, memory-only session design, room/message validation, retries, public key only, Hosting CSP, no polling |
| Static build check | Pass | Public HTML, CSS, JS, robots and legal notice complete without npm dependencies |
| Chromium responsive group | Pass | 360, 390, 768 and 1366 px widths, no horizontal overflow or JavaScript errors in adapted test execution |
| Chromium simulated two-account group | Pass | Login, room access, create room, owner invitation, member join, send/receive, manual refresh and signout clearing private text; mocks only |
| Real live Supabase A/B | NOT RUN | Actual browser-session isolation and write acceptance required after Firebase deploy |
| Real Firebase Hosting deployment | NOT RUN | No verified Firebase account/project or callable deployment action in ChatGPT |
| Payment integration or commercial security signoff | NOT RUN | Intentionally disabled |

## Source security properties

The frontend exposes a scoped **publishable** Supabase key, never an administrative service-role key. It uses existing `watt_pilot_*` RPC functions with a bearer token from authenticated login. No direct table CRUD, analytics, advertising trackers, cookies, localStorage or sessionStorage are used by application code. The client validates input and response shapes, but **backend** policies remain authoritative. Owner-only invite controls are enforced server-side and also hidden from ordinary members in the UI.

Firebase's `firebase.json` configures restrictive Content Security Policy, X-Frame-Options, no-referrer, nosniff, disabled camera/mic/geolocation, no-store HTML, limited asset caching, and HTTPS-exclusive Supabase API access (Firebase Hosting supplies HTTPS for its default domain).

## Browser test scope limitation

The Chromium runtime blocked navigation to network and localhost addresses with `ERR_BLOCKED_BY_ADMINISTRATOR`. To avoid claiming a live deployment test, the test harness loaded the exact static HTML/CSS into `about:blank` and ran the actual core and workspace JS with its ES-module boundary adapted for testing. Network calls were fulfilled by an in-memory FakeSupabase fixture. The test therefore does **not** test Firebase's actual response headers, routing, real CORS, or real credentials.

## Defects found and corrected during verification

1. Invalid UUID parser regular expression shape: corrected and covered by 17 Node tests.
2. New-room and join forms could be disabled before FormData extraction: values now captured before disabling submit controls.
3. `crypto.randomUUID` was unavailable in test's opaque origin: secure `getRandomValues` UUID-v4 fallback added without weak randomness.
4. Sign-out left private message elements in the hidden DOM: all text and private room entries are now removed, not merely hidden.
5. Send control disabled during an in-flight action to prevent user draft edits being lost.

## No-production-change audit

This project was built as files in an isolated artifact workspace. It executed no Supabase database writes, no Firebase deploy, no Wix patch and no Floot publish. The earlier staged Floot source is not modified by this portable code, and the preexisting Floot scheduled continuation was disabled to prevent a second release.

## Open approvals

Verified Google Firebase project and account; deployed HTTPS origin smoke tests; actual A/B accounts and private second-room denial; independently reviewed security and backups; finalized pilot privacy policy and commercial contracts; explicit commercial readiness approval. Keep all release holds.
