-- ============================================================
-- DATABASE CLEANUP - DROP DUPLICATE POLICIES
-- ============================================================
-- Run this to fix "policy already exists" errors

-- Drop all duplicate policies safely
DROP POLICY IF EXISTS "Enable select for all users on mtn_momo_logs" ON mtn_momo_logs;
DROP POLICY IF EXISTS "Enable insert for all users on mtn_momo_logs" ON mtn_momo_logs;
DROP POLICY IF EXISTS "Enable delete for all users on mtn_momo_logs" ON mtn_momo_logs;
DROP POLICY IF EXISTS "Enable update for all users on mtn_momo_logs" ON mtn_momo_logs;

-- Drop occupied apartments policies
DROP POLICY IF EXISTS "Enable insert for all users" ON occupied_apartments;
DROP POLICY IF EXISTS "Enable select for all users" ON occupied_apartments;
DROP POLICY IF EXISTS "Enable delete for all users" ON occupied_apartments;
DROP POLICY IF EXISTS "Enable update for all users" ON occupied_apartments;
DROP POLICY IF EXISTS "Employees can insert occupied apartments" ON occupied_apartments;
DROP POLICY IF EXISTS "Anyone can view occupied apartments" ON occupied_apartments;
DROP POLICY IF EXISTS "Employees can delete occupied apartments" ON occupied_apartments;

-- Drop chat policies  
DROP POLICY IF EXISTS "Users can view their own sessions" ON chat_sessions;
DROP POLICY IF EXISTS "Users can create sessions" ON chat_sessions;
DROP POLICY IF EXISTS "Users can update their own sessions" ON chat_sessions;
DROP POLICY IF EXISTS "Users can view messages from their sessions" ON chat_messages;
DROP POLICY IF EXISTS "Users can insert messages to their sessions" ON chat_messages;

-- Verify policies are dropped
SELECT schemaname, tablename, policyname 
FROM pg_policies 
WHERE tablename IN ('mtn_momo_logs', 'occupied_apartments', 'chat_sessions', 'chat_messages')
ORDER BY tablename, policyname;
