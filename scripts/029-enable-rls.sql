-- ============================================================================
-- 029 — Re-enable Row Level Security (STAGED)
--
-- Replaces 023-rollback-rls.sql, which disabled RLS on every table. With RLS
-- off, the anon key — which ships inside the browser bundle by design — can
-- read and write every table directly, bypassing the API routes entirely.
-- Verified against the live project: a plain REST call with the anon key
-- returns admin_accounts rows including the `password` column.
--
-- This app authenticates against its own account tables rather than Supabase
-- Auth, so `auth.uid()` is always NULL for the anon key and per-user policies
-- are impossible. The workable model is therefore:
--
--     anon / authenticated  ->  denied, except genuinely public data
--     service_role          ->  full access (bypasses RLS by design)
--
-- ⚠️  WHY THIS IS STAGED, AND NOT ONE BIG SWITCH
--
-- 52 client components still query Supabase directly with the anon key
-- (`createBrowserClient` from @supabase/ssr). The moment RLS is enabled on a
-- table with no policy, every one of those queries starts returning nothing —
-- silently, because PostgREST returns an empty set rather than an error. Turning
-- it on everywhere at once would take most of the admin, employee, manager and
-- tenant screens down simultaneously.
--
-- So the stages below are ordered by "can this run today without breaking a
-- screen". Run Stage A now. Each later stage names exactly which files must be
-- moved to an API route first.
--
-- Run in the Supabase SQL Editor (per this project's convention — the
-- PostgREST schema cache needs the SQL Editor path, same as 026).
-- ============================================================================


-- ════════════════════════════════════════════════════════════════════════════
-- STAGE A — SAFE TO RUN NOW. No client component touches these tables.
-- ════════════════════════════════════════════════════════════════════════════
-- Verified by inventorying every `.from("…")` call in a "use client" file.
-- These hold payment logs, auth codes, attendance and chat history, so they are
-- also among the most sensitive things currently readable by the anon key.

DO $$
DECLARE
  t text;
  stage_a text[] := ARRAY[
    'otp_codes',                    -- one-time auth codes
    'card_payment_logs',            -- payment attempt records
    'attendance',                   -- staff clock-in history
    'chat_messages',                -- conversation bodies
    'receipt_verifications',        -- QR check-in audit
    'tenant_apartment_assignments', -- occupancy mapping
    'audit_log'                     -- the trail from 030; must never be public
  ];
BEGIN
  FOREACH t IN ARRAY stage_a LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = t
    ) THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
      -- Belt and braces: also drop direct grants, so a policy added later by
      -- mistake cannot silently re-expose the table.
      EXECUTE format('REVOKE ALL ON public.%I FROM anon', t);
      EXECUTE format('REVOKE ALL ON public.%I FROM authenticated', t);
      RAISE NOTICE 'Stage A — RLS enabled + grants revoked: %', t;
    ELSE
      RAISE NOTICE 'Stage A — skipped (no such table): %', t;
    END IF;
  END LOOP;
END $$;


-- ════════════════════════════════════════════════════════════════════════════
-- STAGE B — apartments and client_feedback.
-- ════════════════════════════════════════════════════════════════════════════
-- Blocked by:
--   apartments       components/apartments-manager.tsx     (INSERT/UPDATE/DELETE)
--                    components/occupied-apartments-manager.tsx
--   client_feedback  components/feedback-manager.tsx       (SELECT)
--                    app/employee/administration/page.tsx  (SELECT)
--
-- Apartment listings and the feedback form must stay reachable signed out, so
-- these get real policies rather than a blanket deny. Uncomment once the admin
-- write paths above move to an API route — reads keep working throughout, only
-- the browser-side writes and the staff-only feedback reads need moving.

-- ALTER TABLE apartments ENABLE ROW LEVEL SECURITY;
-- DROP POLICY IF EXISTS "apartments_public_read" ON apartments;
-- CREATE POLICY "apartments_public_read"
--   ON apartments FOR SELECT
--   TO anon, authenticated
--   USING (true);
-- -- No INSERT/UPDATE/DELETE policy: only service_role can change listings.
--
-- ALTER TABLE client_feedback ENABLE ROW LEVEL SECURITY;
-- DROP POLICY IF EXISTS "feedback_public_insert" ON client_feedback;
-- CREATE POLICY "feedback_public_insert"
--   ON client_feedback FOR INSERT
--   TO anon, authenticated
--   WITH CHECK (true);
-- -- No SELECT policy: visitors submit feedback but must not read others'.


-- ════════════════════════════════════════════════════════════════════════════
-- STAGE C — credentials and staff records.
-- ════════════════════════════════════════════════════════════════════════════
-- Highest value, and the reason 031 exists as an interim measure: until this
-- runs, 031's column-level grants are what keep password hashes out of anon's
-- reach. Enable here once these files fetch from an API route instead.
--
--   admin_accounts            components/admin-manager.tsx
--   managers                  components/managers-manager.tsx
--                             components/ui/employee/EmployeeHeader.tsx
--                             components/EmployeeChat.tsx, components/TeamChat.tsx
--                             app/employee/it/page.tsx, app/forgot-password/page.tsx
--                             app/manager/forgot-password/page.tsx
--   employees                 components/employees-manager.tsx
--                             components/employee-schedule-manager.tsx
--                             components/ManagerChat.tsx, components/TeamChat.tsx
--                             app/employee/bookings/page.tsx, app/employee/it/page.tsx
--                             app/employee/forgot-password/page.tsx
--                             app/forgot-password/page.tsx
--   employee_schedules        components/employee-schedule-manager.tsx
--                             components/employees-manager.tsx
--   password_reset_requests   components/password-reset-requests-manager.tsx
--                             app/employee/forgot-password/page.tsx
--                             app/manager/forgot-password/page.tsx
--   settings                  components/admin-manager.tsx
--   internal_messages         components/ManagerChat.tsx
--   chat_sessions             components/ChatSessionsManager.tsx (server) + client callers

-- (uncomment table by table as each is migrated)
-- ALTER TABLE admin_accounts ENABLE ROW LEVEL SECURITY;
-- REVOKE ALL ON admin_accounts FROM anon, authenticated;


-- ════════════════════════════════════════════════════════════════════════════
-- STAGE D — tenant PII and money.
-- ════════════════════════════════════════════════════════════════════════════
--   tenants               components/tenants-manager.tsx
--                         app/admin/components/tenant-approvals.tsx
--                         app/admin/dashboard/page.tsx
--                         app/employee/administration/page.tsx
--                         app/employee/it/page.tsx
--                         app/employee/maintenance/page.tsx
--                         app/manager/dashboard/page.tsx
--                         app/tenant/profile/page.tsx
--                         app/tenant/register/page.tsx
--                         app/forgot-password/page.tsx
--                         components/ProfileCard.tsx
--   tenant_payments       app/tenant/dashboard/page.tsx
--                         app/tenant/payment-history/page.tsx
--                         app/tenant/booked-apartments/page.tsx
--                         app/manager/dashboard/page.tsx
--                         app/receipt/[booking_id]/page.tsx
--                         components/TenantNotificationBell.tsx
--                         (app/tenant/payments/page.tsx — ALREADY MIGRATED ✓)
--   bookings              components/bookings-manager.tsx, booked-apartments-table.tsx
--                         components/apartments-manager.tsx
--                         components/occupied-apartments-manager.tsx
--                         components/TenantNotificationBell.tsx
--                         app/admin/bookings/page.tsx, app/admin/dashboard/page.tsx
--                         app/employee/bookings/page.tsx, app/employee/security/page.tsx
--                         app/employee/administration/page.tsx
--                         app/tenant/apartments/page.tsx, app/tenant/dashboard/page.tsx
--                         app/tenant/maintenance/page.tsx
--                         app/tenant/booked-apartments/page.tsx
--                         app/manager/dashboard/page.tsx
--                         app/receipt/[booking_id]/page.tsx
--                         components/ui/employee/bookings.tsx
--   receipts              app/tenant/booked-apartments/page.tsx
--                         app/receipt/[booking_id]/page.tsx
--                         components/TenantNotificationBell.tsx
--   maintenance_requests  app/tenant/maintenance/page.tsx
--                         app/employee/maintenance/page.tsx
--                         components/MaintenanceRequestForm.tsx
--                         components/ui/employee/maintenance-manager.tsx
--   occupied_apartments   components/occupied-apartments-manager.tsx
--                         components/apartments-manager.tsx
--                         app/employee/bookings/page.tsx
--   promo_codes           components/promo-codes-manager.tsx


-- ════════════════════════════════════════════════════════════════════════════
-- VERIFY — run after each stage.
-- ════════════════════════════════════════════════════════════════════════════
SELECT
  c.relname               AS table_name,
  c.relrowsecurity        AS rls_enabled,
  COUNT(p.polname)        AS policy_count
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
LEFT JOIN pg_policy p ON p.polrelid = c.oid
WHERE n.nspname = 'public' AND c.relkind = 'r'
GROUP BY c.relname, c.relrowsecurity
ORDER BY c.relrowsecurity, c.relname;

-- ============================================================================
-- MIGRATION PATTERN — what "move it to an API route" means here
--
-- app/tenant/payments/page.tsx is the worked example (see app/api/tenant/
-- payments/route.ts). The shape is always the same:
--
--   1. New route under app/api/**, using SUPABASE_SERVICE_ROLE_KEY.
--   2. First line of the handler: requireRole(request, [...]) or requireSession.
--   3. Scope every query by session.sub / session.role — never by an id from
--      the request body, which is what made the old client queries forgeable.
--   4. Replace the component's supabase.from(...) with fetch("/api/...").
--   5. Delete the createBrowserClient() call from the component.
--
-- Suggested order: Stage C before Stage D — credentials outrank PII.
-- ============================================================================
