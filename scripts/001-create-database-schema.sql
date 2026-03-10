-- ============================================================
-- CORE TABLES
-- ============================================================

-- Create Admin Accounts Table
CREATE TABLE IF NOT EXISTS admin_accounts (
  id SERIAL PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  full_name VARCHAR(100),
  profile_picture_url TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create Employees Table
CREATE TABLE IF NOT EXISTS employees (
  id SERIAL PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  full_name VARCHAR(100) NOT NULL,
  email VARCHAR(100),
  phone VARCHAR(20),
  position VARCHAR(100),
  department VARCHAR(100),
  hire_date DATE,
  profile_image_url TEXT,
  status VARCHAR(50) DEFAULT 'active',
  last_login TIMESTAMP,
  updated_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create Apartments Table
CREATE TABLE IF NOT EXISTS apartments (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  type VARCHAR(50) NOT NULL,
  description TEXT,
  size_sqm INTEGER,
  bedrooms INTEGER,
  bathrooms INTEGER,
  price_per_month DECIMAL(10, 2),
  image_url TEXT,
  is_available BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create Bookings Table (with tenant and apartment relationships)
CREATE TABLE IF NOT EXISTS bookings (
  id SERIAL PRIMARY KEY,
  tenant_id VARCHAR(255),
  apartment_id INTEGER,
  client_name VARCHAR(100) NOT NULL,
  phone_number VARCHAR(20) NOT NULL,
  email VARCHAR(100) NOT NULL,
  apartment_type VARCHAR(50) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create Feedback Table
CREATE TABLE IF NOT EXISTS client_feedback (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(100) NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- TENANT MANAGEMENT TABLES
-- ============================================================

CREATE TABLE IF NOT EXISTS tenants (
  id SERIAL PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  full_name VARCHAR(100) NOT NULL,
  email VARCHAR(100) UNIQUE NOT NULL,
  phone VARCHAR(20),
  id_number VARCHAR(50) UNIQUE,
  emergency_contact VARCHAR(100),
  emergency_contact_phone VARCHAR(20),
  address TEXT,
  city VARCHAR(100),
  country VARCHAR(100),
  approval_status VARCHAR(20) DEFAULT 'pending',
  approved_by INTEGER REFERENCES admin_accounts(id),
  approved_at TIMESTAMP,
  is_active BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tenant_apartment_assignments (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  apartment_id INTEGER NOT NULL REFERENCES apartments(id),
  lease_start_date DATE NOT NULL,
  lease_end_date DATE NOT NULL,
  monthly_rent DECIMAL(10, 2),
  status VARCHAR(20) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tenant_payments (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  apartment_id INTEGER NOT NULL REFERENCES apartments(id),
  amount DECIMAL(10, 2) NOT NULL,
  payment_date DATE NOT NULL,
  due_date DATE NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',
  payment_method VARCHAR(50),
  reference_number VARCHAR(100),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- MAINTENANCE & SETTINGS TABLES
-- ============================================================

CREATE TABLE IF NOT EXISTS maintenance_requests (
  id SERIAL PRIMARY KEY,
  tenant_id VARCHAR(255) NOT NULL,
  apartment_id INTEGER,
  issue_type VARCHAR(100) NOT NULL,
  description TEXT NOT NULL,
  priority VARCHAR(20) DEFAULT 'normal',
  status VARCHAR(20) DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  resolved_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS settings (
  id SERIAL PRIMARY KEY,
  setting_key VARCHAR(100) UNIQUE NOT NULL,
  setting_value TEXT,
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS occupied_apartments (
  id SERIAL PRIMARY KEY,
  apartment_id INTEGER NOT NULL REFERENCES apartments(id) ON DELETE CASCADE,
  booking_id INTEGER NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  tenant_id VARCHAR(255) NOT NULL,
  marked_by_employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
  occupied_date DATE NOT NULL,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- CHAT TABLES
-- ============================================================

CREATE TABLE IF NOT EXISTS chat_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  user_email VARCHAR(255),
  user_role VARCHAR(50) DEFAULT 'visitor',
  user_name VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  is_active BOOLEAN DEFAULT true
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
  sender_role VARCHAR(50) NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  metadata JSONB
);

-- ============================================================
-- INDEXES
-- ============================================================

-- Employee indexes
CREATE INDEX IF NOT EXISTS idx_employees_username ON employees(username);
CREATE INDEX IF NOT EXISTS idx_employees_email ON employees(email);
CREATE INDEX IF NOT EXISTS idx_employees_status ON employees(status);

-- Tenant indexes
CREATE INDEX IF NOT EXISTS idx_tenants_username ON tenants(username);
CREATE INDEX IF NOT EXISTS idx_tenants_email ON tenants(email);
CREATE INDEX IF NOT EXISTS idx_tenants_approval_status ON tenants(approval_status);
CREATE INDEX IF NOT EXISTS idx_tenants_is_active ON tenants(is_active);

-- Tenant assignment indexes
CREATE INDEX IF NOT EXISTS idx_tenant_apartment_assignments_tenant_id ON tenant_apartment_assignments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_apartment_assignments_apartment_id ON tenant_apartment_assignments(apartment_id);

-- Payment indexes
CREATE INDEX IF NOT EXISTS idx_tenant_payments_tenant_id ON tenant_payments(tenant_id);

-- Booking indexes
CREATE INDEX IF NOT EXISTS idx_bookings_tenant_id ON bookings(tenant_id);
CREATE INDEX IF NOT EXISTS idx_bookings_apartment_id ON bookings(apartment_id);

-- Maintenance indexes
CREATE INDEX IF NOT EXISTS idx_maintenance_tenant_id ON maintenance_requests(tenant_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_apartment_id ON maintenance_requests(apartment_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_status ON maintenance_requests(status);

-- Occupied apartments indexes
CREATE INDEX IF NOT EXISTS idx_occupied_apartments_apartment_id ON occupied_apartments(apartment_id);
CREATE INDEX IF NOT EXISTS idx_occupied_apartments_booking_id ON occupied_apartments(booking_id);
CREATE INDEX IF NOT EXISTS idx_occupied_apartments_tenant_id ON occupied_apartments(tenant_id);

-- Chat indexes
CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_id ON chat_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_email ON chat_sessions(user_email);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_created_at ON chat_sessions(created_at);
CREATE INDEX IF NOT EXISTS idx_chat_messages_session_id ON chat_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON chat_messages(created_at);

-- ============================================================
-- INITIAL DATA
-- ============================================================

INSERT INTO admin_accounts (username, password, full_name) 
VALUES ('kevin', '123456', 'Kevin Administrator')
ON CONFLICT (username) DO NOTHING;

INSERT INTO apartments (name, type, description, size_sqm, bedrooms, bathrooms, price_per_month, image_url) VALUES
('Luxury Studio A', 'Studio', 'Modern studio apartment with city views in Kigali, Karama Sector', 45, 1, 1, 350000, '/placeholder.svg?height=400&width=600'),
('Deluxe One Bedroom', '1 Bedroom', 'Spacious one-bedroom apartment with balcony', 65, 1, 1, 500000, '/placeholder.svg?height=400&width=600'),
('Premium Two Bedroom', '2 Bedroom', 'Beautiful two-bedroom apartment perfect for families', 90, 2, 2, 750000, '/placeholder.svg?height=400&width=600'),
('Executive Three Bedroom', '3 Bedroom', 'Exclusive three-bedroom penthouse with stunning views', 120, 3, 2, 1200000, '/placeholder.svg?height=400&width=600')
ON CONFLICT DO NOTHING;

INSERT INTO settings (setting_key, setting_value)
VALUES ('master_deletion_password', 'kevin')
ON CONFLICT (setting_key) DO NOTHING;

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================

ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their own sessions" ON chat_sessions;
DROP POLICY IF EXISTS "Users can create sessions" ON chat_sessions;
DROP POLICY IF EXISTS "Users can update their own sessions" ON chat_sessions;
DROP POLICY IF EXISTS "Users can view messages from their sessions" ON chat_messages;
DROP POLICY IF EXISTS "Users can insert messages to their sessions" ON chat_messages;

-- Chat sessions policies
CREATE POLICY "Users can view their own sessions"
  ON chat_sessions FOR SELECT
  USING (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Users can create sessions"
  ON chat_sessions FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can update their own sessions"
  ON chat_sessions FOR UPDATE
  USING (auth.uid() = user_id OR user_id IS NULL);

-- Chat messages policies
CREATE POLICY "Users can view messages from their sessions"
  ON chat_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM chat_sessions 
      WHERE chat_sessions.id = chat_messages.session_id 
      AND (auth.uid() = chat_sessions.user_id OR chat_sessions.user_id IS NULL)
    )
  );

CREATE POLICY "Users can insert messages to their sessions"
  ON chat_messages FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM chat_sessions 
      WHERE chat_sessions.id = session_id 
      AND (auth.uid() = chat_sessions.user_id OR chat_sessions.user_id IS NULL)
    )
  );
