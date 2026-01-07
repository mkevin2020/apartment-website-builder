-- Create Tenants Table with approval status
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

-- Create Tenant-Apartment Assignment Table
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

-- Create Tenant Payments Table
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

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_tenants_username ON tenants(username);
CREATE INDEX IF NOT EXISTS idx_tenants_email ON tenants(email);
CREATE INDEX IF NOT EXISTS idx_tenants_approval_status ON tenants(approval_status);
CREATE INDEX IF NOT EXISTS idx_tenants_is_active ON tenants(is_active);
CREATE INDEX IF NOT EXISTS idx_tenant_apartment_assignments_tenant_id ON tenant_apartment_assignments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_apartment_assignments_apartment_id ON tenant_apartment_assignments(apartment_id);
CREATE INDEX IF NOT EXISTS idx_tenant_payments_tenant_id ON tenant_payments(tenant_id);
