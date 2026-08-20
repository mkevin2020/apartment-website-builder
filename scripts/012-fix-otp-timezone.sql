-- ============================================================
-- FIX OTP TIMEZONE ISSUE
-- ============================================================
-- This script drops the old OTP table and recreates it with
-- proper timezone-aware timestamps

-- Drop the old table (careful with this!)
DROP TABLE IF EXISTS otp_codes CASCADE;

-- Create the new table with TIMESTAMP WITH TIME ZONE
CREATE TABLE otp_codes (
  id SERIAL PRIMARY KEY,
  email VARCHAR(100) NOT NULL UNIQUE,
  otp_code VARCHAR(6) NOT NULL,
  user_id INTEGER,
  user_type VARCHAR(20) DEFAULT 'tenant',
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 5,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '15 minutes'),
  verified_at TIMESTAMP WITH TIME ZONE,
  is_verified BOOLEAN DEFAULT FALSE,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_otp_email ON otp_codes(email);
CREATE INDEX idx_otp_expires ON otp_codes(expires_at);
CREATE INDEX idx_otp_verified ON otp_codes(is_verified);

-- Verify table was created
SELECT table_name FROM information_schema.tables WHERE table_name = 'otp_codes';
