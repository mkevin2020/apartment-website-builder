-- ============================================================
-- Add Stripe tracking columns to tenant_payments
-- ============================================================
-- Fixes: "Could not find the 'stripe_session_id' column of 'tenant_payments'"
-- Run this in the Supabase SQL Editor.

ALTER TABLE tenant_payments
ADD COLUMN IF NOT EXISTS stripe_session_id TEXT;

ALTER TABLE tenant_payments
ADD COLUMN IF NOT EXISTS transaction_id TEXT;

CREATE INDEX IF NOT EXISTS idx_tenant_payments_stripe_session_id
  ON tenant_payments(stripe_session_id);

-- ============================================================
-- Verify
-- ============================================================
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'tenant_payments'
  AND column_name IN ('stripe_session_id', 'transaction_id');
