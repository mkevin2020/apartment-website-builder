-- ============================================================
-- 028 — Record WHO last changed the work schedule
-- ============================================================
-- Employees can see the weekly roster (read-only) on their dashboard, but until
-- now a change appeared out of nowhere. These columns let the app show
-- "Last changed by <manager> on <date>" to everyone.
--
-- Safe to run more than once. Adding nullable columns rewrites no existing data,
-- and the app works with or without them — if these columns are missing it just
-- omits the attribution line.
--
-- Run this in the Supabase SQL Editor.
-- ============================================================

ALTER TABLE employee_schedules
  ADD COLUMN IF NOT EXISTS updated_by_name TEXT,
  ADD COLUMN IF NOT EXISTS updated_by_id   INTEGER,
  ADD COLUMN IF NOT EXISTS updated_by_role TEXT;

COMMENT ON COLUMN employee_schedules.updated_by_name IS
  'Display name of the manager/admin who last saved this row.';
COMMENT ON COLUMN employee_schedules.updated_by_id IS
  'Id of that manager/admin, in the table named by updated_by_role.';
COMMENT ON COLUMN employee_schedules.updated_by_role IS
  'Which account table updated_by_id refers to: manager | admin.';

-- Let PostgREST see the new columns immediately.
NOTIFY pgrst, 'reload schema';
