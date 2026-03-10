-- ============================================================
-- ADD MISSING FOREIGN KEY TO MARKED_BY_EMPLOYEE_ID
-- ============================================================

-- Add foreign key constraint to marked_by_employee_id
ALTER TABLE IF EXISTS occupied_apartments
ADD CONSTRAINT fk_occupied_apartments_employee_id 
FOREIGN KEY (marked_by_employee_id) 
REFERENCES employees(id) ON DELETE RESTRICT;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_occupied_apartments_employee_id 
ON occupied_apartments(marked_by_employee_id);
