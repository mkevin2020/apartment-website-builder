-- Migration: Add tenant_id and apartment_id to bookings table
-- This migration adds the necessary columns to link bookings to tenants and apartments

-- Check if columns exist and add them if they don't
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'bookings' AND column_name = 'tenant_id'
    ) THEN
        ALTER TABLE bookings ADD COLUMN tenant_id VARCHAR(255);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'bookings' AND column_name = 'apartment_id'
    ) THEN
        ALTER TABLE bookings ADD COLUMN apartment_id INTEGER;
    END IF;
END $$;

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_bookings_tenant_id ON bookings(tenant_id);
CREATE INDEX IF NOT EXISTS idx_bookings_apartment_id ON bookings(apartment_id);
