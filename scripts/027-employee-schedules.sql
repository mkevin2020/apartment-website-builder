-- ============================================================
-- 027 — Employee work schedules
-- Run this in the Supabase SQL Editor (like scripts/026).
--
-- One row per employee per weekday. The manager edits hours per
-- day in Manager Dashboard → Operations → Work Schedule; a day
-- with is_off = TRUE is that employee's day off.
-- ============================================================

CREATE TABLE IF NOT EXISTS employee_schedules (
  id SERIAL PRIMARY KEY,
  employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  weekday TEXT NOT NULL CHECK (weekday IN
    ('Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday')),
  start_time TIME DEFAULT '08:00',
  end_time TIME DEFAULT '17:00',
  is_off BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE (employee_id, weekday)
);

CREATE INDEX IF NOT EXISTS idx_employee_schedules_employee
  ON employee_schedules(employee_id);

-- Backfill existing employees with a default week:
-- Monday–Saturday 08:00–17:00, Sunday off.
INSERT INTO employee_schedules (employee_id, weekday, start_time, end_time, is_off)
SELECT e.id, d.weekday, '08:00'::time, '17:00'::time, (d.weekday = 'Sunday')
FROM employees e
CROSS JOIN (VALUES
  ('Monday'),('Tuesday'),('Wednesday'),('Thursday'),
  ('Friday'),('Saturday'),('Sunday')
) AS d(weekday)
ON CONFLICT (employee_id, weekday) DO NOTHING;

-- Make PostgREST pick up the new table + FK immediately
-- (needed for relational selects like employee_schedules(...) embeds).
NOTIFY pgrst, 'reload schema';
