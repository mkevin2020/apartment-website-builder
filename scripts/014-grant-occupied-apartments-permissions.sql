-- ============================================================
-- GRANT PERMISSIONS ON OCCUPIED_APARTMENTS TABLE
-- ============================================================

-- Grant permissions to anon role (for anonymous/public users via Supabase client)
GRANT SELECT, INSERT, UPDATE, DELETE ON occupied_apartments TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON occupied_apartments TO authenticated;

-- Grant permission to use the sequence
GRANT USAGE, SELECT ON SEQUENCE occupied_apartments_id_seq TO anon;
GRANT USAGE, SELECT ON SEQUENCE occupied_apartments_id_seq TO authenticated;
