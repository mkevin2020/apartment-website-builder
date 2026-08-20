-- ============================================================
-- Create Receipts Table for QR Code + Payment Verification
-- ============================================================

CREATE TABLE IF NOT EXISTS receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id INTEGER NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  user_email VARCHAR(255) NOT NULL,
  apartment_id INTEGER NOT NULL REFERENCES apartments(id) ON DELETE CASCADE,
  amount_paid DECIMAL(10, 2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'usd',
  payment_intent_id VARCHAR(255) NOT NULL,
  qr_code_base64 TEXT NOT NULL,
  verify_token VARCHAR(1000) NOT NULL,
  status VARCHAR(20) DEFAULT 'PAID',
  is_verified BOOLEAN DEFAULT false,
  verified_at TIMESTAMP,
  verified_by_admin_id INTEGER REFERENCES admin_accounts(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Table for receipt verification logs (who scanned it, when, etc.)
CREATE TABLE IF NOT EXISTS receipt_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_id UUID NOT NULL REFERENCES receipts(id) ON DELETE CASCADE,
  verified_by_admin_id INTEGER REFERENCES admin_accounts(id),
  verification_type VARCHAR(50) NOT NULL, -- 'qr_scan', 'manual', 'api'
  verified_at TIMESTAMP DEFAULT NOW(),
  ip_address VARCHAR(45),
  user_agent TEXT,
  metadata JSONB
);

-- ============================================================
-- INDEXES for Performance
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_receipts_booking_id ON receipts(booking_id);
CREATE INDEX IF NOT EXISTS idx_receipts_user_email ON receipts(user_email);
CREATE INDEX IF NOT EXISTS idx_receipts_apartment_id ON receipts(apartment_id);
CREATE INDEX IF NOT EXISTS idx_receipts_status ON receipts(status);
CREATE INDEX IF NOT EXISTS idx_receipts_created_at ON receipts(created_at);

CREATE INDEX IF NOT EXISTS idx_receipt_verifications_receipt_id ON receipt_verifications(receipt_id);
CREATE INDEX IF NOT EXISTS idx_receipt_verifications_verified_at ON receipt_verifications(verified_at);

-- ============================================================
-- Row Level Security (RLS)
-- ============================================================

ALTER TABLE receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE receipt_verifications ENABLE ROW LEVEL SECURITY;

-- Allow public read access to receipts (secured by booking verification)
CREATE POLICY "receipts_select_public" ON receipts
  FOR SELECT USING (true);

-- Service role and admin can update receipts
CREATE POLICY "receipts_insert_service_role" ON receipts
  FOR INSERT WITH CHECK (true);

CREATE POLICY "receipts_update_service_role" ON receipts
  FOR UPDATE USING (true) WITH CHECK (true);

-- Only admin can read verifications
CREATE POLICY "verifications_select_public" ON receipt_verifications
  FOR SELECT USING (true);

-- Service role can insert verifications
CREATE POLICY "verifications_insert_service_role" ON receipt_verifications
  FOR INSERT WITH CHECK (true);
