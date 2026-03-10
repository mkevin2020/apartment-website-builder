-- ============================================================
-- PASSWORD RESET REQUESTS TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS password_reset_requests (
  id SERIAL PRIMARY KEY,
  user_id INTEGER,
  user_type VARCHAR(20) NOT NULL, -- 'tenant' or 'employee'
  email VARCHAR(100) NOT NULL,
  user_name VARCHAR(100),
  reason TEXT,
  status VARCHAR(20) DEFAULT 'pending', -- 'pending' or 'resolved'
  resolved_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_password_reset_status ON password_reset_requests(status);
CREATE INDEX IF NOT EXISTS idx_password_reset_user ON password_reset_requests(user_type, user_id);
