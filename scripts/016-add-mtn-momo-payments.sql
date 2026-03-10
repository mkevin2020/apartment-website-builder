-- ============================================================
-- MTN MOMO PAYMENT INTEGRATION
-- ============================================================
-- Extends tenant_payments table with MTN MoMo specific fields

-- Add MTN MoMo columns to tenant_payments if they don't exist
ALTER TABLE tenant_payments
ADD COLUMN IF NOT EXISTS transaction_id VARCHAR(255) UNIQUE,
ADD COLUMN IF NOT EXISTS mtn_reference_code VARCHAR(255),
ADD COLUMN IF NOT EXISTS phone_number VARCHAR(20),
ADD COLUMN IF NOT EXISTS payment_gateway VARCHAR(50) DEFAULT 'mtn_momo',
ADD COLUMN IF NOT EXISTS api_user_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS currency VARCHAR(3) DEFAULT 'XOF';

-- Create MTN MoMo Request Log table (for debugging/audit)
CREATE TABLE IF NOT EXISTS mtn_momo_logs (
  id SERIAL PRIMARY KEY,
  payment_id INTEGER REFERENCES tenant_payments(id) ON DELETE CASCADE,
  request_type VARCHAR(50) NOT NULL, -- 'request_to_pay', 'get_status', etc.
  request_body JSONB,
  response_body JSONB,
  http_status_code INTEGER,
  error_message TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY (payment_id) REFERENCES tenant_payments(id) ON DELETE CASCADE
);

-- Create indexes on MTN MoMo tables
CREATE INDEX IF NOT EXISTS idx_tenant_payments_transaction_id ON tenant_payments(transaction_id);
CREATE INDEX IF NOT EXISTS idx_tenant_payments_phone_number ON tenant_payments(phone_number);
CREATE INDEX IF NOT EXISTS idx_mtn_momo_logs_payment_id ON mtn_momo_logs(payment_id);
CREATE INDEX IF NOT EXISTS idx_mtn_momo_logs_created_at ON mtn_momo_logs(created_at);

-- Enable RLS on mtn_momo_logs if needed
ALTER TABLE mtn_momo_logs ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist, then create new ones
DROP POLICY IF EXISTS "Enable select for all users on mtn_momo_logs" ON mtn_momo_logs;
DROP POLICY IF EXISTS "Enable insert for all users on mtn_momo_logs" ON mtn_momo_logs;

-- Create RLS policies for mtn_momo_logs
CREATE POLICY "Enable select for all users on mtn_momo_logs" ON mtn_momo_logs
  FOR SELECT USING (true);

CREATE POLICY "Enable insert for all users on mtn_momo_logs" ON mtn_momo_logs
  FOR INSERT WITH CHECK (true);

-- Grant permissions
GRANT SELECT, INSERT ON mtn_momo_logs TO anon;
GRANT SELECT, INSERT ON mtn_momo_logs TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE mtn_momo_logs_id_seq TO anon;
GRANT USAGE, SELECT ON SEQUENCE mtn_momo_logs_id_seq TO authenticated;
