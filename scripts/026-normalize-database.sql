-- 026: Normalize the database
--
-- Fixes three classes of problems:
--   1. Dead tables with no rows and no code references
--   2. Missing relations: tenant_id stored as varchar (can't FK to tenants.id),
--      and child tables with no foreign keys at all
--   3. 3NF violations: facts duplicated from other tables
--
-- Deliberate exceptions kept:
--   - bookings.client_name / email / phone_number stay: guest bookings have no
--     tenant row, so the row itself is the only place to store guest contact info.
--   - receipts keeps amount_paid / user_email: a receipt is a frozen snapshot of
--     the transaction at payment time and must not change if source rows change.

BEGIN;

-- ============================================================
-- 1. Drop dead tables (0 rows, zero references in the app)
-- ============================================================
DROP TABLE IF EXISTS tenant_apartment_assignments;
DROP TABLE IF EXISTS receipt_verifications;

-- ============================================================
-- 2. bookings: fix tenant_id type, add missing relations,
--    drop duplicated apartment_type
-- ============================================================

-- Clear references to tenants that no longer exist (they remain as
-- guest-style bookings; their contact info lives on the row).
UPDATE bookings
SET tenant_id = NULL
WHERE tenant_id IS NOT NULL
  AND (tenant_id !~ '^[0-9]+$'
       OR tenant_id::integer NOT IN (SELECT id FROM tenants));

ALTER TABLE bookings
  ALTER COLUMN tenant_id TYPE integer USING NULLIF(tenant_id, '')::integer;

ALTER TABLE bookings
  ADD CONSTRAINT bookings_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE SET NULL;

ALTER TABLE bookings ALTER COLUMN apartment_id DROP NOT NULL;
ALTER TABLE bookings
  ADD CONSTRAINT bookings_apartment_id_fkey
  FOREIGN KEY (apartment_id) REFERENCES apartments(id) ON DELETE SET NULL;

-- 3NF: the apartment's type is a fact about the apartment, not the booking.
-- The app now reads it through the apartment relation.
ALTER TABLE bookings DROP COLUMN IF EXISTS apartment_type;

-- ============================================================
-- 3. maintenance_requests: fix tenant_id type, add relations
-- ============================================================
UPDATE maintenance_requests
SET tenant_id = NULL
WHERE tenant_id IS NOT NULL
  AND (tenant_id !~ '^[0-9]+$'
       OR tenant_id::integer NOT IN (SELECT id FROM tenants));

ALTER TABLE maintenance_requests
  ALTER COLUMN tenant_id TYPE integer USING NULLIF(tenant_id, '')::integer;

ALTER TABLE maintenance_requests
  ADD CONSTRAINT maintenance_requests_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;

ALTER TABLE maintenance_requests
  ADD CONSTRAINT maintenance_requests_apartment_id_fkey
  FOREIGN KEY (apartment_id) REFERENCES apartments(id) ON DELETE CASCADE;

-- ============================================================
-- 4. occupied_apartments: fix tenant_id type + relation
--    (apartment/booking/employee FKs already exist)
-- ============================================================
UPDATE occupied_apartments
SET tenant_id = NULL
WHERE tenant_id IS NOT NULL
  AND (tenant_id !~ '^[0-9]+$'
       OR tenant_id::integer NOT IN (SELECT id FROM tenants));

ALTER TABLE occupied_apartments
  ALTER COLUMN tenant_id TYPE integer USING NULLIF(tenant_id, '')::integer;

ALTER TABLE occupied_apartments
  ADD CONSTRAINT occupied_apartments_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE SET NULL;

-- ============================================================
-- 5. attendance -> employees
-- ============================================================
ALTER TABLE attendance
  ADD CONSTRAINT attendance_employee_id_fkey
  FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE;

-- ============================================================
-- 6. internal_messages -> employees
--    (employee_id is the conversation-thread key: which employee's
--    chat with the manager this message belongs to)
-- ============================================================
ALTER TABLE internal_messages
  ADD CONSTRAINT internal_messages_employee_id_fkey
  FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE;

-- ============================================================
-- 7. receipts.verified_by_admin_id -> employees
--    Check-in verification is performed by employees (reception),
--    so the relation targets employees, not admin_accounts.
-- ============================================================
UPDATE receipts
SET verified_by_admin_id = NULL
WHERE verified_by_admin_id IS NOT NULL
  AND verified_by_admin_id NOT IN (SELECT id FROM employees);

ALTER TABLE receipts
  ADD CONSTRAINT receipts_verified_by_employee_fkey
  FOREIGN KEY (verified_by_admin_id) REFERENCES employees(id) ON DELETE SET NULL;

-- ============================================================
-- 8. Break the circular relation between tenant_payments and receipts.
--    receipts.tenant_payment_id is the single source of truth
--    (every receipt row has it; tenant_payments.receipt_id was never set).
-- ============================================================
ALTER TABLE tenant_payments DROP COLUMN IF EXISTS receipt_id;

COMMIT;
