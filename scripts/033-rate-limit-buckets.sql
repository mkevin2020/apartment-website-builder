-- ============================================================================
-- 033 — Shared rate-limit buckets
--
-- lib/auth/rate-limit.ts kept its counters in module memory. On Vercel every
-- serverless instance has its own copy, so the effective limit was
-- "your limit × however many instances happen to be warm" — and an attacker
-- spreading requests over a few seconds gets fresh instances handed to them.
-- For login and OTP that is the difference between a real brute-force control
-- and a speed bump.
--
-- This moves the counter into Postgres, where every instance shares it. The
-- increment happens inside a single SQL function so it is atomic: two
-- concurrent requests cannot both read "4 of 5 used" and both proceed.
--
-- Run in the Supabase SQL Editor (same convention as 026/029–032).
-- ============================================================================

CREATE TABLE IF NOT EXISTS rate_limit_buckets (
  -- scope:identifier, e.g. 'login-user:someone@example.com'
  key        TEXT        PRIMARY KEY,
  count      INTEGER     NOT NULL DEFAULT 0,
  reset_at   TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS rate_limit_buckets_reset_idx ON rate_limit_buckets (reset_at);

ALTER TABLE rate_limit_buckets ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON rate_limit_buckets FROM anon, authenticated;

-- ── The atomic consume ──────────────────────────────────────────────────────
-- Returns one row: (allowed, remaining, retry_after_seconds).
--
-- The INSERT … ON CONFLICT DO UPDATE is the whole point: it is a single
-- statement, so the read-modify-write cannot interleave with another request.
-- An expired window is reset in the same statement rather than in a separate
-- read, which would reintroduce the race.
CREATE OR REPLACE FUNCTION consume_rate_limit(
  p_key            TEXT,
  p_limit          INTEGER,
  p_window_seconds INTEGER
)
RETURNS TABLE (allowed BOOLEAN, remaining INTEGER, retry_after_seconds INTEGER)
LANGUAGE plpgsql
AS $$
DECLARE
  v_count    INTEGER;
  v_reset_at TIMESTAMPTZ;
BEGIN
  INSERT INTO rate_limit_buckets AS b (key, count, reset_at)
  VALUES (p_key, 1, NOW() + make_interval(secs => p_window_seconds))
  ON CONFLICT (key) DO UPDATE
    SET
      -- Window expired? start a fresh one. Otherwise increment.
      count    = CASE WHEN b.reset_at <= NOW() THEN 1 ELSE b.count + 1 END,
      reset_at = CASE
                   WHEN b.reset_at <= NOW()
                     THEN NOW() + make_interval(secs => p_window_seconds)
                   ELSE b.reset_at
                 END
  RETURNING b.count, b.reset_at INTO v_count, v_reset_at;

  RETURN QUERY SELECT
    v_count <= p_limit,
    GREATEST(p_limit - v_count, 0),
    CASE
      WHEN v_count <= p_limit THEN 0
      ELSE GREATEST(CEIL(EXTRACT(EPOCH FROM (v_reset_at - NOW())))::INTEGER, 1)
    END;
END;
$$;

-- Housekeeping: drop expired buckets so the table stays small. Safe to call
-- from anywhere; the app calls it occasionally rather than on every request.
CREATE OR REPLACE FUNCTION prune_rate_limit_buckets()
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_deleted INTEGER;
BEGIN
  DELETE FROM rate_limit_buckets WHERE reset_at <= NOW() - INTERVAL '1 hour';
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

-- Only the API routes (service_role) may touch these.
REVOKE ALL ON FUNCTION consume_rate_limit(TEXT, INTEGER, INTEGER) FROM anon, authenticated;
REVOKE ALL ON FUNCTION prune_rate_limit_buckets() FROM anon, authenticated;

-- ── Verify ──────────────────────────────────────────────────────────────────
-- Third call should come back allowed = false.
SELECT * FROM consume_rate_limit('selftest', 2, 60);
SELECT * FROM consume_rate_limit('selftest', 2, 60);
SELECT * FROM consume_rate_limit('selftest', 2, 60);
DELETE FROM rate_limit_buckets WHERE key = 'selftest';
