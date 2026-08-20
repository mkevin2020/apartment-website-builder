-- ============================================================
-- Add per-day pricing to apartments
-- ============================================================
-- Apartments already have price_per_month; this adds a daily rate
-- so tenants can book by day or by month.

ALTER TABLE apartments
ADD COLUMN IF NOT EXISTS price_per_day DECIMAL(10, 2) DEFAULT 0;

-- Verify
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'apartments' AND column_name = 'price_per_day';
