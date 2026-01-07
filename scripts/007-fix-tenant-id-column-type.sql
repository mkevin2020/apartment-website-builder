-- Migration: Fix tenant_id column type in bookings table
-- Convert tenant_id from UUID to VARCHAR(255) and handle existing data

ALTER TABLE bookings 
ALTER COLUMN tenant_id TYPE VARCHAR(255) USING tenant_id::text;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_bookings_tenant_id ON bookings(tenant_id);
