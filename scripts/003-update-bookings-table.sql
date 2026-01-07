-- Add tenant_id and apartment_id columns to bookings table to link bookings to tenants and apartments
ALTER TABLE bookings
ADD COLUMN IF NOT EXISTS tenant_id UUID,
ADD COLUMN IF NOT EXISTS apartment_id INTEGER;

-- Add foreign key constraints (if your database supports them)
-- ALTER TABLE bookings ADD CONSTRAINT fk_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
-- ALTER TABLE bookings ADD CONSTRAINT fk_apartment_id FOREIGN KEY (apartment_id) REFERENCES apartments(id) ON DELETE CASCADE;

-- Create an index for faster lookups by tenant_id
CREATE INDEX IF NOT EXISTS idx_bookings_tenant_id ON bookings(tenant_id);
CREATE INDEX IF NOT EXISTS idx_bookings_apartment_id ON bookings(apartment_id);
