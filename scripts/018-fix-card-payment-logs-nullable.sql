-- Migration to fix card_payment_logs table for advance/manual payments
-- Makes payment_id nullable to support payments without an existing invoice

-- Drop the existing foreign key constraint
ALTER TABLE card_payment_logs
DROP CONSTRAINT IF EXISTS card_payment_logs_payment_id_fkey;

-- Alter the column to be nullable
ALTER TABLE card_payment_logs
ALTER COLUMN payment_id DROP NOT NULL;

-- Recreate the foreign key with ON DELETE SET NULL
ALTER TABLE card_payment_logs
ADD CONSTRAINT card_payment_logs_payment_id_fkey 
FOREIGN KEY (payment_id) REFERENCES tenant_payments(id) ON DELETE SET NULL;

-- Re-enable the index
CREATE INDEX IF NOT EXISTS idx_card_payment_logs_payment_id ON card_payment_logs(payment_id);

-- Verify the change
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'card_payment_logs' AND column_name = 'payment_id';
