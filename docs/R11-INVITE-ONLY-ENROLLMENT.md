# R11 — Invite-only pilot enrollment at sign-in

**Status: candidate. No change to live Firebase Hosting or Supabase Auth configuration.**

The sign-in screen offers **Have a pilot invitation? Enroll here**. An applicant enters a private 64-character invitation code, email, password (12+ characters), confirmation, and consent to the pilot notice. The browser first asks the existing `watt_pilot_reserve_signup` RPC for a fresh reservation; only after the server validates the code does it send `/auth/v1/signup` with that one-time reservation ID in `user_metadata`. It never adopts a returned token. The applicant must confirm email, then sign in and use the original room code to join. A reservation can expire and is not a guarantee of account creation.

**Important security requirement:** Enabling the Auth Signup toggle without a working **Before User Created** server hook makes it possible to call Supabase Auth directly and bypass the browser-side invitation check. Therefore never enable Auth signup until the hook rejects requests with missing, expired, reused or invalid reservation IDs. Auth hooks are server-owned; `public` source code is not the security boundary.

The proposed, **unapplied** SQL is included below in this review document. It restricts `watt_pilot_reserve_signup` to anon callers using the existing internal token validator, and configures a separate one-use reservation hook callable only by Supabase Auth. The hook deliberately rejects other account-creation methods unless separately reviewed. It must be audited and acceptance-tested on a disposable fixture before installing in production.

Activation prerequisites:
1. Review the existing invite issuance, room capacity, total enrollment limit, email confirmation and Auth rate limits.
2. Independently audit the SQL including privileges on `watt_pilot_private`, use of `SECURITY DEFINER` and possible effects on other Supabase applications.
3. Test invalid/no-token, replay, expired and correct-token flows without altering existing conversations.
4. Activate the Before User Created hook in Supabase Dashboard and prove its **deny-by-default** behavior.
5. Only then enable Supabase Auth email signup, requiring email confirmation and approving the preview origin/redirect.
6. Verify a newly enrolled user cannot list or read other users' rooms, and must present a valid room invitation to join.
7. Update a new temporary Firebase preview channel; do **not** overwrite the accepted R09 preview or deploy live.

No OpenAI autoprocessing, public account registration, billing or production migration is included. Existing GitHub R10 security-acceptance draft remains separate from this proposal.

Official references:
- https://supabase.com/docs/guides/auth/auth-hooks/before-user-created-hook
- https://supabase.com/docs/guides/auth/general-configuration
- https://supabase.com/docs/guides/auth/users

## Proposed SQL (review only — do not execute)

```sql
-- WATT R11 proposed security-reviewed migration; NOT applied automatically.
-- Activate ONLY after a matching Supabase Auth Before User Created Hook is configured.
-- This allows enrollment by a single-use reservation backed by an existing
-- private room invitation or operator-issued bootstrap token.
BEGIN;
CREATE OR REPLACE FUNCTION public.watt_pilot_before_user_created(event jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $hook$
DECLARE
  rid_text text;
  rid uuid;
  accepted uuid;
BEGIN
  IF event->'user'->'app_metadata'->>'provider' IS DISTINCT FROM 'email'
     OR event->'user'->>'email' IS NULL
     OR event->'user'->>'is_anonymous' = 'true' THEN
    RETURN jsonb_build_object('error',
      jsonb_build_object('http_code',403,'message','Pilot invitation required'));
  END IF;
  rid_text:=event->'user'->'user_metadata'->>'watt_reservation_id';
  IF rid_text IS NULL OR rid_text !~
    '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    RETURN jsonb_build_object('error',
      jsonb_build_object('http_code',403,'message','Pilot invitation required'));
  END IF;
  rid:=rid_text::uuid;
  -- A reservation is a one-use bearer grant created only through the
  -- room/bootstrap token validator, with a short lifetime.
  DELETE FROM watt_pilot_private.enrollment_requests
  WHERE id=rid AND created_at > clock_timestamp()-interval '10 minutes'
  RETURNING id INTO accepted;
  IF accepted IS NULL THEN
    RETURN jsonb_build_object('error',
      jsonb_build_object('http_code',403,'message','Pilot invitation required'));
  END IF;
  RETURN '{}'::jsonb;
END;
$hook$;
REVOKE ALL ON FUNCTION public.watt_pilot_before_user_created(jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.watt_pilot_before_user_created(jsonb)
  TO supabase_auth_admin;
GRANT USAGE ON SCHEMA public TO supabase_auth_admin;

-- This wrapper does NOT enable unrestricted Auth signup. It only checks a
-- 64-character existing room/bootstrap invite and enforces fixed rate limits.
CREATE OR REPLACE FUNCTION public.watt_pilot_reserve_signup(p_token text)
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path TO ''
AS $gate$
  SELECT watt_pilot_private.reserve_signup(p_token);
$gate$;
REVOKE ALL ON FUNCTION public.watt_pilot_reserve_signup(text)
  FROM PUBLIC, authenticated, anon;
GRANT EXECUTE ON FUNCTION public.watt_pilot_reserve_signup(text) TO anon;
COMMIT;

-- Supabase Dashboard steps (separate, owner-controlled):
-- 1. Authentication -> Hooks -> Before User Created:
--    configure public.watt_pilot_before_user_created. VERIFY it rejects
--    missing, expired and replayed reservation IDs before enabling signup.
-- 2. Authentication -> Providers -> Email: require email confirmation.
-- 3. Authentication -> General Settings: Allow new users to sign up;
--    activate ONLY AFTER Hook denial is proven. This toggle is NOT in SQL.
-- 4. Configure Redirect URLs for the *new preview* after it is deployed.
-- 5. Do not turn on public registration, paid addons or an unrestricted hook.
-- 6. Check that admin invitations/OAuth account creation policies remain
--    compatible: the hook deliberately rejects account creation not bearing
--    an approved reservation.

```
