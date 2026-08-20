-- Create test payments for testing the payment form
-- First, check if you have tenants and apartments
-- SELECT * FROM tenants LIMIT 1;
-- SELECT * FROM apartments LIMIT 1;

-- Then insert test payment. Replace values as needed:
INSERT INTO tenant_payments (
  tenant_id,
  apartment_id,
  amount,
  status,
  due_date,
  reference_number,
  payment_date,
  payment_method,
  created_at,
  updated_at
) VALUES (
  1,  -- Replace with actual tenant_id
  1,  -- Replace with actual apartment_id
  50000,  -- Amount in RWF
  'pending',
  '2026-05-14',  -- Due date
  'PAY-2026-001',  -- Reference number
  NULL,
  NULL,
  NOW(),
  NOW()
);

-- If you get an error about tenant_id not existing, use this query first to see available tenants:
-- SELECT id, full_name, email FROM tenants LIMIT 5;

-- To see apartments:
-- SELECT id, building_number, apartment_number FROM apartments LIMIT 5;
