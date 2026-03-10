-- ============================================================
-- ENABLE RLS AND ADD POLICIES FOR OCCUPIED_APARTMENTS
-- ============================================================

-- Enable Row Level Security on occupied_apartments table
ALTER TABLE IF EXISTS occupied_apartments ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Employees can insert occupied apartments" ON occupied_apartments;
DROP POLICY IF EXISTS "Anyone can view occupied apartments" ON occupied_apartments;
DROP POLICY IF EXISTS "Employees can delete occupied apartments" ON occupied_apartments;

-- Allow employees to insert occupied apartment records
CREATE POLICY "Employees can insert occupied apartments"
  ON occupied_apartments
  FOR INSERT
  WITH CHECK (true);

-- Allow anyone to view occupied apartments
CREATE POLICY "Anyone can view occupied apartments"
  ON occupied_apartments
  FOR SELECT
  USING (true);

-- Allow deletion of occupied apartment records
CREATE POLICY "Employees can delete occupied apartments"
  ON occupied_apartments
  FOR DELETE
  USING (true);
