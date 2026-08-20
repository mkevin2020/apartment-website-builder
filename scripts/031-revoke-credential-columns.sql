-- ============================================================================
-- 031 — Stop the anon key reading credential columns
--
-- WHY THIS EXISTS, AND WHY IT IS SEPARATE FROM 029
--
-- RLS is still off (023 disabled it), so the anon key — which ships inside the
-- public browser bundle by design — can read every table. Confirmed against the
-- live project: a plain REST call with the anon key returns admin_accounts rows
-- including the `password` column, i.e. every administrator's bcrypt hash, plus
-- all tenant PII.
--
-- 029 fixes this properly by enabling RLS, but it cannot run yet: 52 client
-- components still read Supabase directly with the anon key and would all break
-- at once. That migration is real work and needs to be staged.
--
-- This script is the stopgap that does NOT need the migration first. It uses
-- column-level privileges to keep the anon key working for everything the app
-- currently does, while removing its access to the columns that must never be
-- public: password hashes, reset tokens and OTP codes.
--
-- Safe to run today: no client component reads any of these columns any more.
-- Password changes moved to POST /api/auth/change-password, and login has been
-- server-side for a while. Both use the service-role key, which is unaffected —
-- column grants do not apply to it.
--
-- Run in the Supabase SQL Editor (same convention as 026 and 029).
-- ============================================================================

DO $$
DECLARE
  tbl          text;
  col          text;
  cols_granted int;
  -- Tables holding credentials, and the columns within them that anon must not
  -- see. Anything not listed here stays readable exactly as before.
  cred_tables  text[] := ARRAY[
    'admin_accounts',
    'managers',
    'employees',
    'tenants'
  ];
  secret_cols  text[] := ARRAY[
    'password',
    'password_hash',
    'reset_token',
    'reset_token_expires',
    'otp_code',
    'otp_expires_at',
    'national_id',
    'id_number'
  ];
BEGIN
  FOREACH tbl IN ARRAY cred_tables LOOP
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = tbl
    ) THEN
      RAISE NOTICE 'skipped (no such table): %', tbl;
      CONTINUE;
    END IF;

    -- A table-level SELECT grant overrides any column-level grant, so it has to
    -- go first. Column grants are then re-added one by one for the safe columns.
    EXECUTE format('REVOKE SELECT ON public.%I FROM anon', tbl);
    EXECUTE format('REVOKE SELECT ON public.%I FROM authenticated', tbl);

    -- Writing a password from the browser is never legitimate either: those
    -- paths are POST /api/auth/change-password and POST /api/auth/reset-password,
    -- both of which run as service_role. But profile edits and the staff
    -- management screens still UPDATE other columns with the anon key, so this
    -- is column-level too rather than a blanket revoke that would break them.
    EXECUTE format('REVOKE UPDATE ON public.%I FROM anon', tbl);
    EXECUTE format('REVOKE UPDATE ON public.%I FROM authenticated', tbl);

    cols_granted := 0;

    FOR col IN
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = tbl
        AND NOT (column_name = ANY (secret_cols))
      ORDER BY ordinal_position
    LOOP
      EXECUTE format('GRANT SELECT (%I) ON public.%I TO anon', col, tbl);
      EXECUTE format('GRANT SELECT (%I) ON public.%I TO authenticated', col, tbl);
      EXECUTE format('GRANT UPDATE (%I) ON public.%I TO anon', col, tbl);
      EXECUTE format('GRANT UPDATE (%I) ON public.%I TO authenticated', col, tbl);
      cols_granted := cols_granted + 1;
    END LOOP;

    RAISE NOTICE 'hardened %: % safe columns granted (select+update), secrets revoked', tbl, cols_granted;
  END LOOP;
END $$;

-- otp_codes is auth material end to end — there is no "safe subset" of columns,
-- so the whole table goes. This is safe as of now: the tenant forgot-password
-- page was the last client reader, and it now calls
-- POST /api/auth/reset-password, which re-verifies the code server-side.
--
-- NOTE: password_reset_requests is deliberately NOT included. The employee and
-- manager forgot-password pages still INSERT into it from the browser, and
-- components/password-reset-requests-manager.tsx reads it. Locking it now would
-- break those flows; it is covered in Stage C of 029 instead.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'otp_codes'
  ) THEN
    REVOKE ALL ON public.otp_codes FROM anon;
    REVOKE ALL ON public.otp_codes FROM authenticated;
    ALTER TABLE public.otp_codes ENABLE ROW LEVEL SECURITY;
    RAISE NOTICE 'otp_codes: anon access revoked, RLS enabled';
  END IF;
END $$;

-- ── Verify ──────────────────────────────────────────────────────────────────
-- Expected: NO rows. Any row returned is a credential column anon can still read.
SELECT
  table_name,
  column_name,
  grantee
FROM information_schema.column_privileges
WHERE table_schema = 'public'
  AND grantee IN ('anon', 'authenticated')
  AND privilege_type = 'SELECT'
  AND column_name IN (
    'password', 'password_hash', 'reset_token', 'reset_token_expires',
    'otp_code', 'otp_expires_at', 'national_id', 'id_number'
  )
ORDER BY table_name, column_name;

-- ── Rollback, if something unexpected breaks ────────────────────────────────
-- This restores the (insecure) previous state. Prefer fixing the caller.
--
--   GRANT SELECT ON public.admin_accounts TO anon, authenticated;
--   GRANT SELECT ON public.managers       TO anon, authenticated;
--   GRANT SELECT ON public.employees      TO anon, authenticated;
--   GRANT SELECT ON public.tenants        TO anon, authenticated;
--
-- NOTE: 031 is a stopgap, not the destination. 029 (full RLS) is still the fix;
-- this only removes the worst of the exposure while that migration is staged.
-- ============================================================================
