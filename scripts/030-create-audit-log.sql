-- ============================================================================
-- 030 — Audit log for authentication and privileged actions
--
-- Nothing in the app previously recorded who approved a payment, processed a
-- refund, or deleted a tenant. This table is the trail. It is written only by
-- the API routes (service_role) via lib/audit.ts.
--
-- Run in the Supabase SQL Editor (same convention as 026 and 029 — the
-- PostgREST schema cache is refreshed on that path).
-- ============================================================================

CREATE TABLE IF NOT EXISTS audit_log (
  id           BIGSERIAL PRIMARY KEY,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

  -- What happened
  action       TEXT         NOT NULL,
  outcome      TEXT         NOT NULL DEFAULT 'success'
                            CHECK (outcome IN ('success', 'denied', 'failure')),
  target       TEXT,                       -- e.g. 'tenant_payments:412'

  -- Who did it. Deliberately NOT a foreign key: the trail must survive the
  -- deletion of the account it refers to, which is exactly when it matters.
  actor_role   TEXT         NOT NULL DEFAULT 'anonymous',
  actor_id     BIGINT,
  actor_email  TEXT,

  -- Where from
  ip_address   TEXT,
  user_agent   TEXT,

  -- Identifiers and amounts only. lib/audit.ts redacts anything whose key looks
  -- like a credential, card number, OTP, or national ID before it gets here.
  metadata     JSONB
);

-- Indexes for the three questions actually asked of an audit trail:
-- "what happened recently", "what did this account do", "who touched this record".
CREATE INDEX IF NOT EXISTS audit_log_created_at_idx ON audit_log (created_at DESC);
CREATE INDEX IF NOT EXISTS audit_log_actor_idx      ON audit_log (actor_role, actor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS audit_log_target_idx     ON audit_log (target) WHERE target IS NOT NULL;
CREATE INDEX IF NOT EXISTS audit_log_action_idx     ON audit_log (action, created_at DESC);

-- Denied attempts are the security signal worth alerting on; keep them cheap
-- to scan for.
CREATE INDEX IF NOT EXISTS audit_log_denied_idx
  ON audit_log (created_at DESC) WHERE outcome = 'denied';

-- ── Access control ──────────────────────────────────────────────────────────
-- RLS on with no policy = anon and authenticated are denied outright, while
-- service_role (the API routes) bypasses RLS by design. An audit trail the
-- browser can read is an information leak; one it can write is worthless.
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON audit_log FROM anon, authenticated;
REVOKE UPDATE, DELETE ON audit_log FROM anon, authenticated, service_role;

COMMENT ON TABLE audit_log IS
  'Append-only trail of auth and privileged actions. Written by lib/audit.ts via service_role. Never expose to the anon key.';
