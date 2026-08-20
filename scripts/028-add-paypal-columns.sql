-- 028: Add PayPal tracking columns to tenant_payments
-- The PayPal create/capture routes (app/api/payments/paypal/*) store the
-- PayPal order id and capture id on the payment row. These columns were
-- missing, so those updates silently failed.

ALTER TABLE tenant_payments
  ADD COLUMN IF NOT EXISTS paypal_order_id TEXT,
  ADD COLUMN IF NOT EXISTS paypal_capture_id TEXT;
