# WATT R09 — Firebase folder redirect loop repair

## Evidence and cause
The first temporary preview URL was live and its root, `/robots.txt` and `/assets/core.js` returned HTTP 200. However, `/workspace/` and `/legal/` returned repeated HTTP 301 responses until curl exceeded 50 redirects. The original `firebase.json` configured redundant redirects from `/workspace` to `/workspace/` and `/legal` to `/legal/` together with `trailingSlash: true`. Firebase Hosting evaluates configured redirects before static folder indexes. Removing both settings lets the provider's default directory-index behavior serve `public/workspace/index.html` and `public/legal/index.html` directly.

## Isolation and deployment
- The original `watt-r0-supabase-review` channel and original `01-Preview-Only.sh` are not overwritten.
- This repair creates only a new seven-day channel `watt-r09-routing-review` after project ID, source checksum, full source integrity, static build, Firebase CLI authorization, and unused-channel checks. No live deployment.
- From an authenticated Google Cloud Shell, use a **fresh clone of protected `main` after PR approval** and run `bash 02-Preview-Routing-Fix.sh`. Do not run the earlier fixed-channel script again.
- After the CLI returns a new preview URL, verify `/`, `/workspace/`, `/legal/`, `/robots.txt` and `/assets/core.js` all return HTTP 200 with `curl -sS -L --max-redirs 5`. Check CSP and other response headers separately.
- No Firebase Auth authorized-domain changes, Supabase data writes, billing activation, live Hosting, Wix/Floot changes, or release-gate changes are permitted.
- Real browser sign-in and two-account messaging acceptance still need separate checks.

Official Hosting configuration: https://firebase.google.com/docs/hosting/full-config
