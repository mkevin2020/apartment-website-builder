-- ============================================================================
-- 032 — Integrity constraints the application cannot enforce on its own
--
-- Two problems that only the database can actually solve, because both are
-- races: application-level checks read, decide, then write, and another request
-- can slip between the read and the write.
--
--   1. Double-booking. Nothing stopped two overlapping bookings on the same
--      apartment except application logic.
--   2. Webhook replay. Payment completion was guarded by reading
--      tenant_payments.status and branching on it (lib/complete-payment.ts),
--      which is exactly that read-then-write pattern.
--
-- Run in the Supabase SQL Editor (same convention as 026/029/030/031).
--
-- ⚠️  SECTION 1 CAN FAIL ON EXISTING DATA. That is deliberate — it reports the
--     overlaps rather than silently dropping them. Resolve them, then re-run.
-- ============================================================================


-- ════════════════════════════════════════════════════════════════════════════
-- 1. Double-booking prevention
-- ════════════════════════════════════════════════════════════════════════════

-- Range-overlap exclusion needs gist indexing over scalar types.
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- ── 1a. Look before you leap ────────────────────────────────────────────────
-- Run this on its own FIRST. Every row it returns is a pair of bookings that
-- already overlap and must be resolved by hand before the constraint can exist.
SELECT
  a.id            AS booking_a,
  b.id            AS booking_b,
  a.apartment_id,
  a.start_date    AS a_start, a.end_date AS a_end, a.status AS a_status,
  b.start_date    AS b_start, b.end_date AS b_end, b.status AS b_status
FROM bookings a
JOIN bookings b
  ON a.apartment_id = b.apartment_id
 AND a.id < b.id
 AND a.status NOT IN ('cancelled', 'rejected', 'declined')
 AND b.status NOT IN ('cancelled', 'rejected', 'declined')
 AND a.start_date IS NOT NULL AND a.end_date IS NOT NULL
 AND b.start_date IS NOT NULL AND b.end_date IS NOT NULL
 AND daterange(a.start_date, a.end_date, '[)') && daterange(b.start_date, b.end_date, '[)')
ORDER BY a.apartment_id, a.start_date;

-- ── 1b. The constraint ──────────────────────────────────────────────────────
-- Only applies to live bookings: a cancelled or rejected booking should not
-- block the dates it used to hold. The WHERE clause is what makes that work.
--
-- '[)' is half-open on purpose — a stay ending on the 10th and another starting
-- on the 10th are NOT an overlap, which is how check-out/check-in actually works.
ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_no_overlap;

ALTER TABLE bookings
  ADD CONSTRAINT bookings_no_overlap
  EXCLUDE USING gist (
    apartment_id WITH =,
    daterange(start_date, end_date, '[)') WITH &&
  )
  WHERE (
    status NOT IN ('cancelled', 'rejected', 'declined')
    AND start_date IS NOT NULL
    AND end_date IS NOT NULL
  );

COMMENT ON CONSTRAINT bookings_no_overlap ON bookings IS
  'Prevents double-booking at the database level. Two concurrent requests for the same apartment and dates cannot both succeed: the loser fails with SQLSTATE 23P01 (exclusion_violation), which the API surfaces as "those dates were just taken".';


-- ════════════════════════════════════════════════════════════════════════════
-- 2. Webhook idempotency
-- ════════════════════════════════════════════════════════════════════════════
-- Payment providers guarantee AT-LEAST-once delivery, not exactly-once. Stripe
-- retries for up to three days, and MoMo/IntouchPay callbacks can duplicate or
-- arrive out of order. The primary key on (provider, event_id) is what makes a
-- replay a no-op: the second insert fails, and the handler stops.

CREATE TABLE IF NOT EXISTS provider_events (
  provider     TEXT        NOT NULL,   -- 'stripe' | 'mtn_momo' | 'intouchpay' | 'paypal'
  event_id     TEXT        NOT NULL,   -- the provider's own id, e.g. Stripe evt_…
  event_type   TEXT,
  received_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  -- What the event resolved to, for reconciliation: 'tenant_payments:412'
  target       TEXT,
  status       TEXT        NOT NULL DEFAULT 'received'
                           CHECK (status IN ('received', 'processed', 'failed', 'ignored')),
  error        TEXT,
  PRIMARY KEY (provider, event_id)
);

CREATE INDEX IF NOT EXISTS provider_events_received_idx ON provider_events (received_at DESC);
CREATE INDEX IF NOT EXISTS provider_events_target_idx   ON provider_events (target) WHERE target IS NOT NULL;
-- Stuck or failed events are the reconciliation queue.
CREATE INDEX IF NOT EXISTS provider_events_unprocessed_idx
  ON provider_events (received_at DESC) WHERE processed_at IS NULL;

ALTER TABLE provider_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON provider_events FROM anon, authenticated;

COMMENT ON TABLE provider_events IS
  'De-duplication ledger for payment provider webhooks. Written by lib/provider-events.ts via service_role. A duplicate delivery hits the primary key and is ignored.';


-- ════════════════════════════════════════════════════════════════════════════
-- 3. Idempotency keys on payment initiation
-- ════════════════════════════════════════════════════════════════════════════
-- Stops a double-tap or a client retry creating two charges for one invoice.
ALTER TABLE tenant_payments
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS tenant_payments_idempotency_key_idx
  ON tenant_payments (idempotency_key)
  WHERE idempotency_key IS NOT NULL;


-- ── Verify ──────────────────────────────────────────────────────────────────
SELECT conname, pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid = 'bookings'::regclass AND conname = 'bookings_no_overlap';

SELECT COUNT(*) AS provider_events_ready FROM provider_events;
