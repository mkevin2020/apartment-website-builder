-- ============================================================================
-- 034 — Session revocation
--
-- Sessions are stateless HMAC tokens with an 8-hour TTL (lib/auth/session.ts).
-- Logout clears the cookie, but the token itself stays valid until it expires:
-- anyone who captured it — a shared machine, a proxy log, a copied cookie —
-- keeps access for the rest of the window, and there is no way to cut them off.
--
-- Rather than a session table (a database read on every single request), this
-- uses a DENYLIST. Tokens carry a `jti` claim; only revoked ones are stored.
-- The list is small, cached in-process, and consulted on the paths that matter.
--
-- Two revocation shapes:
--   - one token   (logout on this device)
--   - all tokens for an account issued before a cutoff (password change,
--     "sign out everywhere", or an admin disabling a compromised account)
--
-- Run in the Supabase SQL Editor (same convention as 026/029–033).
-- ============================================================================

-- ── Individual revoked tokens ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS revoked_sessions (
  jti        TEXT        PRIMARY KEY,
  revoked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- When the token would have expired anyway. Rows past this are prunable:
  -- an expired token is already rejected by the signature check.
  expires_at TIMESTAMPTZ NOT NULL,
  reason     TEXT
);

CREATE INDEX IF NOT EXISTS revoked_sessions_expires_idx ON revoked_sessions (expires_at);

-- ── Account-wide cutoffs ────────────────────────────────────────────────────
-- A row here invalidates every token for that account issued before `not_before`.
-- This is what makes "changing your password logs out your other devices" work
-- without enumerating the tokens.
CREATE TABLE IF NOT EXISTS session_cutoffs (
  role       TEXT        NOT NULL,
  subject_id BIGINT      NOT NULL,
  not_before TIMESTAMPTZ NOT NULL,
  reason     TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (role, subject_id)
);

ALTER TABLE revoked_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_cutoffs  ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON revoked_sessions FROM anon, authenticated;
REVOKE ALL ON session_cutoffs  FROM anon, authenticated;

-- ── Housekeeping ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION prune_revoked_sessions()
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_deleted INTEGER;
BEGIN
  -- Once a token is past its own expiry the signature check rejects it, so the
  -- denylist entry is redundant.
  DELETE FROM revoked_sessions WHERE expires_at <= NOW();
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

REVOKE ALL ON FUNCTION prune_revoked_sessions() FROM anon, authenticated;

COMMENT ON TABLE revoked_sessions IS
  'Denylist of individually revoked session tokens, keyed on the jti claim. Consulted by lib/auth/session.ts.';
COMMENT ON TABLE session_cutoffs IS
  'Per-account "invalidate everything issued before this time" markers. Set on password change and forced sign-out.';
