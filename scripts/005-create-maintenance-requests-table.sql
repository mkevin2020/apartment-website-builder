-- Migration: Create maintenance_requests table
-- This table stores maintenance requests from tenants

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

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_maintenance_tenant_id ON maintenance_requests(tenant_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_apartment_id ON maintenance_requests(apartment_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_status ON maintenance_requests(status);
