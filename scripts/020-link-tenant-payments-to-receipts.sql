-- ============================================================
-- Add Receipt Link to Tenant Payments Table
-- ============================================================

ALTER TABLE tenant_payments 
ADD COLUMN IF NOT EXISTS receipt_id UUID REFERENCES receipts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_tenant_payments_receipt_id ON tenant_payments(receipt_id);

-- ============================================================
-- Update Receipts Table to Support Tenant Payments
-- ============================================================

-- Add optional tenant_id column to receipts for tenant payments
ALTER TABLE receipts 
ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE;

ALTER TABLE receipts
ADD COLUMN IF NOT EXISTS tenant_payment_id INTEGER REFERENCES tenant_payments(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_receipts_tenant_id ON receipts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_receipts_tenant_payment_id ON receipts(tenant_payment_id);

-- ============================================================
-- Verify Tables Are Correctly Linked
-- ============================================================

-- Check if migration was successful
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'tenant_payments' AND column_name = 'receipt_id';

SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'receipts' AND column_name IN ('tenant_id', 'tenant_payment_id');

