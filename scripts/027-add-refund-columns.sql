-- 027: Add the refund columns the refund flow expects
--
-- The refund feature (tenant/guest requests a refund, manager processes it)
-- writes these columns, but they were never added to the schema:
--   - tenant_payments.refund_status        'requested' -> 'refunded'
--   - tenant_payments.refund_requested_at  when the tenant/guest asked
--   - receipts.refund_status               mirrored onto the receipt when processed

ALTER TABLE tenant_payments
  ADD COLUMN IF NOT EXISTS refund_status varchar(20),
  ADD COLUMN IF NOT EXISTS refund_requested_at timestamp with time zone;

ALTER TABLE receipts
  ADD COLUMN IF NOT EXISTS refund_status varchar(20);
