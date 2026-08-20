-- ============================================================================
-- 036 — One identifier, one account
--
-- THE PROBLEM THIS PREVENTS
--
-- Nothing stopped the same email or username existing in two account tables,
-- and two do today:
--
--   mugishakevin73@gmail.com  ->  employees#5   AND  tenants#10
--   christian                 ->  managers#1    AND  employees#1  (usernames)
--
-- The login route used to walk the tables in a fixed order and stop at the
-- first whose password verified, so which portal you reached depended on table
-- order rather than on what you meant. app/api/auth/login/route.ts now resolves
-- across every table and ASKS when an identifier is ambiguous — but asking is a
-- fallback, not a fix. This makes the ambiguity impossible to create.
--
-- Postgres has no cross-table UNIQUE, so this is a trigger on each account
-- table that refuses an insert or update colliding with any of the others.
--
-- Run in the Supabase SQL Editor (same convention as 026 and 029-035).
-- ============================================================================


-- ════════════════════════════════════════════════════════════════════════════
-- STAGE 1 — Report existing collisions. Run this ALONE first.
-- ════════════════════════════════════════════════════════════════════════════
-- The trigger in Stage 3 does not retroactively reject existing rows, so these
-- keep working — but each one will keep prompting "which account?" at login
-- until you resolve it. Decide per row: change one address, or delete the
-- duplicate account.

WITH identities AS (
  SELECT 'admin_accounts' AS tbl, id, lower(trim(username)) AS ident, 'username' AS kind
    FROM admin_accounts WHERE username IS NOT NULL
  UNION ALL
  SELECT 'managers', id, lower(trim(username)), 'username' FROM managers WHERE username IS NOT NULL
  UNION ALL
  SELECT 'managers', id, lower(trim(email)), 'email' FROM managers WHERE email IS NOT NULL
  UNION ALL
  SELECT 'employees', id, lower(trim(username)), 'username' FROM employees WHERE username IS NOT NULL
  UNION ALL
  SELECT 'employees', id, lower(trim(email)), 'email' FROM employees WHERE email IS NOT NULL
  UNION ALL
  SELECT 'tenants', id, lower(trim(username)), 'username' FROM tenants WHERE username IS NOT NULL
  UNION ALL
  SELECT 'tenants', id, lower(trim(email)), 'email' FROM tenants WHERE email IS NOT NULL
)
SELECT
  ident                                   AS identifier,
  COUNT(*)                                AS account_count,
  string_agg(tbl || '#' || id || ' (' || kind || ')', ', ' ORDER BY tbl, id) AS accounts
FROM identities
GROUP BY ident
HAVING COUNT(*) > 1
ORDER BY account_count DESC, ident;


-- ════════════════════════════════════════════════════════════════════════════
-- STAGE 2 — The guard function
-- ════════════════════════════════════════════════════════════════════════════
-- Checks the row being written against the OTHER three tables. Comparison is
-- lower(trim(...)) because that is how the login route matches — the constraint
-- and the lookup must agree, or one will allow what the other cannot resolve.

CREATE OR REPLACE FUNCTION assert_identifier_unique()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_clash  text;
  v_ident  text;
BEGIN
  FOREACH v_ident IN ARRAY ARRAY[
    lower(trim(COALESCE(NEW.username, ''))),
    lower(trim(COALESCE(
      CASE WHEN TG_TABLE_NAME = 'admin_accounts' THEN NULL ELSE NEW.email END, '')))
  ] LOOP
    CONTINUE WHEN v_ident = '';

    SELECT tbl || '#' || id INTO v_clash FROM (
      SELECT 'admin_accounts' AS tbl, id FROM admin_accounts
        WHERE TG_TABLE_NAME <> 'admin_accounts' AND lower(trim(username)) = v_ident
      UNION ALL
      SELECT 'managers', id FROM managers
        WHERE TG_TABLE_NAME <> 'managers'
          AND (lower(trim(username)) = v_ident OR lower(trim(email)) = v_ident)
      UNION ALL
      SELECT 'employees', id FROM employees
        WHERE TG_TABLE_NAME <> 'employees'
          AND (lower(trim(username)) = v_ident OR lower(trim(email)) = v_ident)
      UNION ALL
      SELECT 'tenants', id FROM tenants
        WHERE TG_TABLE_NAME <> 'tenants'
          AND (lower(trim(username)) = v_ident OR lower(trim(email)) = v_ident)
    ) AS others
    LIMIT 1;

    IF v_clash IS NOT NULL THEN
      RAISE EXCEPTION
        'The identifier "%" already belongs to another account (%). One email or username may only be used by one account.',
        v_ident, v_clash
        USING ERRCODE = 'unique_violation';
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;


-- ════════════════════════════════════════════════════════════════════════════
-- STAGE 3 — Attach the trigger
-- ════════════════════════════════════════════════════════════════════════════
-- Fires only when an identifier actually changes, so ordinary updates (status,
-- profile photo, password) are unaffected and cost nothing.

DROP TRIGGER IF EXISTS admin_accounts_identifier_unique ON admin_accounts;
CREATE TRIGGER admin_accounts_identifier_unique
  BEFORE INSERT OR UPDATE OF username ON admin_accounts
  FOR EACH ROW EXECUTE FUNCTION assert_identifier_unique();

DROP TRIGGER IF EXISTS managers_identifier_unique ON managers;
CREATE TRIGGER managers_identifier_unique
  BEFORE INSERT OR UPDATE OF username, email ON managers
  FOR EACH ROW EXECUTE FUNCTION assert_identifier_unique();

DROP TRIGGER IF EXISTS employees_identifier_unique ON employees;
CREATE TRIGGER employees_identifier_unique
  BEFORE INSERT OR UPDATE OF username, email ON employees
  FOR EACH ROW EXECUTE FUNCTION assert_identifier_unique();

DROP TRIGGER IF EXISTS tenants_identifier_unique ON tenants;
CREATE TRIGGER tenants_identifier_unique
  BEFORE INSERT OR UPDATE OF username, email ON tenants
  FOR EACH ROW EXECUTE FUNCTION assert_identifier_unique();


-- ════════════════════════════════════════════════════════════════════════════
-- STAGE 4 — Within-table uniqueness too
-- ════════════════════════════════════════════════════════════════════════════
-- The trigger covers ACROSS tables; these cover WITHIN one. Case-insensitive,
-- matching how login compares. Each will fail if duplicates already exist —
-- Stage 1 lists them.

CREATE UNIQUE INDEX IF NOT EXISTS tenants_email_lower_idx
  ON tenants (lower(trim(email))) WHERE email IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS employees_email_lower_idx
  ON employees (lower(trim(email))) WHERE email IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS managers_email_lower_idx
  ON managers (lower(trim(email))) WHERE email IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS admin_username_lower_idx
  ON admin_accounts (lower(trim(username))) WHERE username IS NOT NULL;


-- ════════════════════════════════════════════════════════════════════════════
-- VERIFY
-- ════════════════════════════════════════════════════════════════════════════
-- Should list four triggers.
SELECT event_object_table AS table_name, trigger_name
FROM information_schema.triggers
WHERE trigger_name LIKE '%identifier_unique'
ORDER BY event_object_table;

-- Should now fail with unique_violation:
--   INSERT INTO tenants (username, email, password, full_name)
--   VALUES ('probe', 'mugishakevin73@gmail.com', 'x', 'Probe');


-- ════════════════════════════════════════════════════════════════════════════
-- ROLLBACK
-- ════════════════════════════════════════════════════════════════════════════
-- DROP TRIGGER IF EXISTS admin_accounts_identifier_unique ON admin_accounts;
-- DROP TRIGGER IF EXISTS managers_identifier_unique       ON managers;
-- DROP TRIGGER IF EXISTS employees_identifier_unique      ON employees;
-- DROP TRIGGER IF EXISTS tenants_identifier_unique        ON tenants;
-- DROP FUNCTION IF EXISTS assert_identifier_unique();
