
CREATE TABLE IF NOT EXISTS occupied_apartments (
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


CREATE INDEX IF NOT EXISTS idx_occupied_apartments_apartment_id ON occupied_apartments(apartment_id);
CREATE INDEX IF NOT EXISTS idx_occupied_apartments_booking_id ON occupied_apartments(booking_id);
CREATE INDEX IF NOT EXISTS idx_occupied_apartments_employee_id ON occupied_apartments(marked_by_employee_id);
CREATE INDEX IF NOT EXISTS idx_occupied_apartments_tenant_id ON occupied_apartments(tenant_id);

