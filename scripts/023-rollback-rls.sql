-- ============================================================
-- Roll back RLS so the app works again
-- ============================================================
-- The app uses the anon key client-side and custom (non-Supabase) auth,
-- so RLS with no policies blocks everything. Disable RLS for now; we'll
-- re-enable it at the END, after data access is moved server-side.
-- Run this in the Supabase SQL Editor.

ALTER TABLE apartments              DISABLE ROW LEVEL SECURITY;
ALTER TABLE tenants                 DISABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_payments         DISABLE ROW LEVEL SECURITY;
ALTER TABLE bookings                DISABLE ROW LEVEL SECURITY;
ALTER TABLE managers                DISABLE ROW LEVEL SECURITY;
ALTER TABLE employees               DISABLE ROW LEVEL SECURITY;
ALTER TABLE admin_accounts          DISABLE ROW LEVEL SECURITY;
ALTER TABLE occupied_apartments     DISABLE ROW LEVEL SECURITY;
ALTER TABLE receipts                DISABLE ROW LEVEL SECURITY;
ALTER TABLE internal_messages       DISABLE ROW LEVEL SECURITY;

-- These may or may not exist in your project — ignore errors for any that don't:
ALTER TABLE tenant_apartment_assignments DISABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance_requests    DISABLE ROW LEVEL SECURITY;
ALTER TABLE client_feedback         DISABLE ROW LEVEL SECURITY;
ALTER TABLE otp_codes               DISABLE ROW LEVEL SECURITY;
ALTER TABLE settings                DISABLE ROW LEVEL SECURITY;
