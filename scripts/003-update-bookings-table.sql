-- Add tenant_id and apartment_id columns to bookings table to link bookings to tenants and apartments
ALTER TABLE bookings
ADD COLUMN IF NOT EXISTS tenant_id UUID,
ADD COLUMN IF NOT EXISTS apartment_id INTEGER;


CREATE INDEX IF NOT EXISTS idx_bookings_tenant_id ON bookings(tenant_id);
CREATE INDEX IF NOT EXISTS idx_bookings_apartment_id ON bookings(apartment_id);
