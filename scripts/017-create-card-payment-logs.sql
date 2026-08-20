-- Create card payment logs table
CREATE TABLE IF NOT EXISTS card_payment_logs (
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

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_card_payment_logs_tenant_id ON card_payment_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_card_payment_logs_payment_id ON card_payment_logs(payment_id);
CREATE INDEX IF NOT EXISTS idx_card_payment_logs_transaction_id ON card_payment_logs(transaction_id);
CREATE INDEX IF NOT EXISTS idx_card_payment_logs_created_at ON card_payment_logs(created_at);

-- Row Level Security is not needed since the system uses traditional password authentication
-- Access control is managed at the application level through role-based authorization
