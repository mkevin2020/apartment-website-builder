-- ============================================================
-- COMPREHENSIVE OCCUPIED_APARTMENTS TABLE SETUP/RESET
-- ============================================================
-- Run this if the table exists but has issues with schema or permissions

-- Drop existing table if it exists
DROP TABLE IF EXISTS occupied_apartments CASCADE;

-- Recreate with correct schema
CREATE TABLE occupied_apartments (
  id SERIAL PRIMARY KEY,
  apartment_id INTEGER NOT NULL,
  booking_id INTEGER NOT NULL,
  tenant_id VARCHAR(255) NOT NULL,
  marked_by_employee_id INTEGER NOT NULL,
  occupied_date DATE NOT NULL,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY (apartment_id) REFERENCES apartments(id) ON DELETE CASCADE,
  FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE,
  FOREIGN KEY (marked_by_employee_id) REFERENCES employees(id) ON DELETE RESTRICT
);

-- Create indexes
CREATE INDEX idx_occupied_apartments_apartment_id ON occupied_apartments(apartment_id);
CREATE INDEX idx_occupied_apartments_booking_id ON occupied_apartments(booking_id);
CREATE INDEX idx_occupied_apartments_employee_id ON occupied_apartments(marked_by_employee_id);
CREATE INDEX idx_occupied_apartments_tenant_id ON occupied_apartments(tenant_id);

-- Enable RLS
ALTER TABLE occupied_apartments ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Enable insert for all users" ON occupied_apartments
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable select for all users" ON occupied_apartments
  FOR SELECT USING (true);

CREATE POLICY "Enable delete for all users" ON occupied_apartments
  FOR DELETE USING (true);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON occupied_apartments TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON occupied_apartments TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE occupied_apartments_id_seq TO anon;
GRANT USAGE, SELECT ON SEQUENCE occupied_apartments_id_seq TO authenticated;
