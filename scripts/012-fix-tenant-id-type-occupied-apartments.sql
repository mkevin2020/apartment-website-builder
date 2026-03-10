-- ============================================================
-- FIX TENANT_ID TYPE IN OCCUPIED_APARTMENTS TABLE
-- ============================================================
-- This migration changes tenant_id from UUID to VARCHAR(255)
-- to match the bookings table schema

ALTER TABLE IF EXISTS occupied_apartments
ALTER COLUMN tenant_id TYPE VARCHAR(255);
