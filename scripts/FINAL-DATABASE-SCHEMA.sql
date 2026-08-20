-- ============================================================
-- CIELO VISTA APARTMENTS — FINAL DATABASE SCHEMA
-- Consolidated from migration scripts 001–027.
-- This is the final state of every table (all later ALTERs merged in).
-- Database: PostgreSQL (Supabase)
-- ============================================================

-- ============================================================
-- 1. USER ACCOUNT TABLES
-- ============================================================

-- Administrators of the system
CREATE TABLE admin_accounts (
  id SERIAL PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  full_name VARCHAR(100),
  profile_picture_url TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Managers (created by an admin)
CREATE TABLE managers (
  id SERIAL PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  email VARCHAR(100) UNIQUE NOT NULL,
  full_name VARCHAR(100) NOT NULL,
  phone VARCHAR(20),
  department VARCHAR(100),
  profile_image_url TEXT,
  status VARCHAR(50) DEFAULT 'active',
  hire_date DATE,
  created_by_admin_id INTEGER REFERENCES admin_accounts(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Employees (reception / staff)
CREATE TABLE employees (
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
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Tenants (must be approved by an admin before they can log in)
CREATE TABLE tenants (
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

CREATE TABLE apartments (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  type VARCHAR(50) NOT NULL,
  description TEXT,
  size_sqm INTEGER,
  bedrooms INTEGER,
  bathrooms INTEGER,
  price_per_month DECIMAL(10, 2),
  price_per_day DECIMAL(10, 2) DEFAULT 0,
  image_url TEXT,
  image_urls JSONB DEFAULT '[]'::jsonb,
  video_url TEXT,
  is_available BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Bookings (guest bookings keep contact info on the row;
-- registered tenants link through tenant_id)
CREATE TABLE bookings (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER REFERENCES tenants(id) ON DELETE SET NULL,
  apartment_id INTEGER REFERENCES apartments(id) ON DELETE SET NULL,
  client_name VARCHAR(100) NOT NULL,
  phone_number VARCHAR(20) NOT NULL,
  email VARCHAR(100) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT NOW()
);

-- Apartments currently marked occupied (by an employee, after check-in)
CREATE TABLE occupied_apartments (
  id SERIAL PRIMARY KEY,
  apartment_id INTEGER NOT NULL REFERENCES apartments(id) ON DELETE CASCADE,
  booking_id INTEGER NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  tenant_id INTEGER REFERENCES tenants(id) ON DELETE SET NULL,
  marked_by_employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
  occupied_date DATE NOT NULL,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Maintenance requests submitted by tenants
CREATE TABLE maintenance_requests (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
  apartment_id INTEGER REFERENCES apartments(id) ON DELETE CASCADE,
  issue_type VARCHAR(100) NOT NULL,
  description TEXT NOT NULL,
  priority VARCHAR(20) DEFAULT 'normal',
  status VARCHAR(20) DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  resolved_at TIMESTAMP
);

-- ============================================================
-- 3. PAYMENT TABLES
-- ============================================================

-- Tenant rent payments (Stripe / MTN MoMo / card; supports refunds)
CREATE TABLE tenant_payments (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  apartment_id INTEGER NOT NULL REFERENCES apartments(id),
  amount DECIMAL(10, 2) NOT NULL,
  payment_date DATE NOT NULL,
  due_date DATE NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',
  payment_method VARCHAR(50),
  reference_number VARCHAR(100),
  stripe_session_id TEXT,
  transaction_id TEXT,
  refund_status VARCHAR(20),
  refund_requested_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Receipts with QR code for check-in verification
-- (a receipt is a frozen snapshot of the transaction at payment time)
CREATE TABLE receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id INTEGER NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
  tenant_payment_id INTEGER REFERENCES tenant_payments(id) ON DELETE CASCADE,
  apartment_id INTEGER NOT NULL REFERENCES apartments(id) ON DELETE CASCADE,
  user_email VARCHAR(255) NOT NULL,
  amount_paid DECIMAL(10, 2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'usd',
  payment_intent_id VARCHAR(255) NOT NULL,
  qr_code_base64 TEXT NOT NULL,
  verify_token VARCHAR(1000) NOT NULL,
  status VARCHAR(20) DEFAULT 'PAID',
  is_verified BOOLEAN DEFAULT false,
  verified_at TIMESTAMP,
  verified_by_admin_id INTEGER REFERENCES employees(id) ON DELETE SET NULL,
  refund_status VARCHAR(20),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Log of card payment attempts
CREATE TABLE card_payment_logs (
  id BIGSERIAL PRIMARY KEY,
  payment_id BIGINT REFERENCES tenant_payments(id) ON DELETE CASCADE,
  tenant_id BIGINT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  transaction_id VARCHAR(255) NOT NULL UNIQUE,
  amount NUMERIC(10, 2) NOT NULL,
  card_last_four VARCHAR(4) NOT NULL,
  cardholder_name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  status VARCHAR(50) DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- 4. STAFF OPERATIONS TABLES
-- ============================================================

-- Weekly work schedule: one row per employee per weekday
CREATE TABLE employee_schedules (
  id SERIAL PRIMARY KEY,
  employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  weekday TEXT NOT NULL CHECK (weekday IN
    ('Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday')),
  start_time TIME DEFAULT '08:00',
  end_time TIME DEFAULT '17:00',
  is_off BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE (employee_id, weekday)
);

-- Daily attendance: one row per employee per day
-- (method: 'qr' = scanned office QR, 'card' = RFID card, 'login' = unverified)
CREATE TABLE attendance (
  id SERIAL PRIMARY KEY,
  employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  clock_in TIMESTAMP WITH TIME ZONE,
  clock_out TIMESTAMP WITH TIME ZONE,
  status VARCHAR(20) DEFAULT 'present',
  method VARCHAR(20) DEFAULT 'login',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Internal chat between manager and employees (and employee ↔ employee)
CREATE TABLE internal_messages (
  id SERIAL PRIMARY KEY,
  employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  sender_role VARCHAR(20) NOT NULL,
  sender_id INTEGER NOT NULL,
  sender_name VARCHAR(100) NOT NULL,
  receiver_role VARCHAR(20) NOT NULL,
  receiver_id INTEGER NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- 5. COMMUNICATION & SUPPORT TABLES
-- ============================================================

-- Visitor / client feedback with star rating
CREATE TABLE client_feedback (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(100) NOT NULL,
  message TEXT NOT NULL,
  rating INTEGER DEFAULT 0,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
);

-- AI chatbot sessions
CREATE TABLE chat_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  user_email VARCHAR(255),
  user_role VARCHAR(50) DEFAULT 'visitor',
  user_name VARCHAR(255),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- AI chatbot messages
CREATE TABLE chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
  sender_role VARCHAR(50) NOT NULL,
  message TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- 6. SECURITY / ACCOUNT-RECOVERY TABLES
-- ============================================================

-- Password reset requests (resolved manually by admin)
CREATE TABLE password_reset_requests (
  id SERIAL PRIMARY KEY,
  user_id INTEGER,
  user_type VARCHAR(20) NOT NULL,          -- 'tenant' or 'employee'
  email VARCHAR(100) NOT NULL,
  user_name VARCHAR(100),
  reason TEXT,
  status VARCHAR(20) DEFAULT 'pending',    -- 'pending' or 'resolved'
  resolved_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- One-time passwords for email verification
CREATE TABLE otp_codes (
  id SERIAL PRIMARY KEY,
  email VARCHAR(100) NOT NULL UNIQUE,
  otp_code VARCHAR(6) NOT NULL,
  user_id INTEGER,
  user_type VARCHAR(20) DEFAULT 'tenant',  -- 'tenant', 'employee', 'manager'
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 5,
  is_verified BOOLEAN DEFAULT FALSE,
  verified_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '15 minutes'),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- System settings (key/value)
CREATE TABLE settings (
  id SERIAL PRIMARY KEY,
  setting_key VARCHAR(100) UNIQUE NOT NULL,
  setting_value TEXT,
  updated_at TIMESTAMP DEFAULT NOW()
);
