# WATT R10 security acceptance

This review is read-only. The existing two-account pilot remains on a temporary Firebase preview. No existing rooms, members or messages were changed.

The `tests/security-acceptance.test.mjs` suite checks client behavior against simulated authorization errors, malformed responses, invalid roles, unsafe rendering and Hosting configuration. Its mock network responses do not establish server authorization.

Verified read-only: pilot tables have RLS enabled and anonymous access is restricted by database grants. Existing user-level membership authorization code was examined, but no real nonmember access attempt was made.

Pending before production approval: independently review the outstanding Supabase Security Advisor findings, perform negative account-isolation acceptance in an isolated test fixture, and confirm session/recovery controls.

The public repository must not contain live credentials, account identifiers, private message contents or raw security-advisor findings. Firebase live release, automated AI, billing, public registration and unattended cloud deployment remain disabled.
