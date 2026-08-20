

ALTER TABLE client_feedback
ADD COLUMN IF NOT EXISTS rating INTEGER DEFAULT 0;

-- Verify
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'client_feedback' AND column_name = 'rating';
