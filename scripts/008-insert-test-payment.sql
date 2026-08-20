-- Add test payment data for development/testing
-- Run these queries in Supabase SQL Editor

-- First, see your actual tenants:
SELECT id, username, full_name, email FROM tenants LIMIT 5;

-- Then check apartments:
SELECT id, building_number, apartment_number, floor_number FROM apartments LIMIT 5;

-- Use the IDs from above queries to insert a test payment
-- Replace 1 and 1 with actual tenant_id and apartment_id from the results above:

INSERT INTO tenant_payments (
  tenant_id,
  apartment_id,
  amount,
  payment_date,
  due_date,
  status,
  reference_number,
  created_at,
  updated_at
) VALUES (
  1,                    -- tenant_id (replace with actual)
  1,                    -- apartment_id (replace with actual)
  50000,                -- amount in RWF
  '2026-04-14',         -- payment_date (today)
  '2026-05-14',         -- due_date (30 days from now)
  'pending',            -- status
  'PAY-2026-' || FLOOR(RANDOM() * 9999),  -- reference number
  NOW(),
  NOW()
);

-- Verify the payment was created:
SELECT * FROM tenant_payments ORDER BY id DESC LIMIT 1;
