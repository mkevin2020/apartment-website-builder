-- Check what tables and columns exist
-- Run this first to see your actual table structure:

-- For tenants/users:
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'tenants' OR table_name = 'users'
ORDER BY table_name, ordinal_position;

-- For apartments:
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'apartments'
ORDER BY ordinal_position;

-- For tenant_payments:
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'tenant_payments'
ORDER BY ordinal_position;

-- See a sample tenant:
SELECT * FROM tenants LIMIT 1;

-- See a sample apartment:
SELECT * FROM apartments LIMIT 1;

-- See existing payments (if any):
SELECT * FROM tenant_payments LIMIT 5;
