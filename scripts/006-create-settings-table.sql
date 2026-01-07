-- Migration: Create settings table
-- This table stores application-level settings like master deletion password

CREATE TABLE IF NOT EXISTS settings (
  id SERIAL PRIMARY KEY,
  setting_key VARCHAR(100) UNIQUE NOT NULL,
  setting_value TEXT,
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Insert default master deletion password
INSERT INTO settings (setting_key, setting_value)
VALUES ('master_deletion_password', 'kevin')
ON CONFLICT (setting_key) DO NOTHING;
