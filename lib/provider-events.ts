import { createClient } from "@supabase/supabase-js";

// ─────────────────────────────────────────────────────────────────────────────
// Webhook de-duplication.
//
// Payment providers guarantee at-least-once delivery. Stripe retries a failed
// webhook for up to three days; MoMo and IntouchPay callbacks can duplicate or
// arrive out of order. Before this, the only guard was reading
// tenant_payments.status and branching on it — a read-then-write that two
// concurrent deliveries can both pass, producing duplicate receipts and
// duplicate confirmation emails.
//
// claimEvent() makes the FIRST delivery win by inserting into a table whose
// primary key is (provider, event_id). A duplicate hits the key, gets `false`,
// and the handler returns without doing the work again.
//
// Requires scripts/032-integrity-constraints.sql.
// ─────────────────────────────────────────────────────────────────────────────

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || "",
);

export type Provider = "stripe" | "mtn_momo" | "intouchpay" | "paypal";

/** Postgres unique-violation. The insert lost the race, i.e. it is a duplicate. */
const UNIQUE_VIOLATION = "23505";

/**
 * Try to claim an event for processing.
 *
 * @returns true  — this caller owns the event and should do the work.
 *          false — already claimed (duplicate/replay); do nothing.
 *
 * Fails OPEN on an unexpected error: if the ledger itself is unavailable we
 * would rather risk a duplicate receipt than drop a real payment on the floor.
 * The alternative — failing closed — silently loses money.
 */
export async function claimEvent(
  provider: Provider,
  eventId: string,
  opts: { eventType?: string; target?: string } = {},
): Promise<boolean> {
  if (!eventId) {
    // No id to key on — cannot dedupe, so let it through rather than block it.
    console.warn(`[provider-events] ${provider} event with no id; processing without dedupe`);
    return true;
  }

  const { error } = await supabase.from("provider_events").insert({
    provider,
    event_id: eventId,
    event_type: opts.eventType ?? null,
    target: opts.target ?? null,
    status: "received",
  });

  if (!error) return true;

  if (error.code === UNIQUE_VIOLATION) {
    console.info(`[provider-events] duplicate ${provider} event ${eventId} ignored`);
    return false;
  }

  // Table missing (migration not run yet) or transient failure.
  console.error(`[provider-events] could not claim ${provider} ${eventId}:`, error.message);
  return true;
}

/** Mark a claimed event finished. Best-effort: never throws into a webhook. */
export async function completeEvent(
  provider: Provider,
  eventId: string,
  outcome: { status: "processed" | "failed" | "ignored"; target?: string; error?: string },
): Promise<void> {
  try {
    await supabase
      .from("provider_events")
      .update({
        status: outcome.status,
        processed_at: new Date().toISOString(),
        target: outcome.target ?? null,
        error: outcome.error ?? null,
      })
      .eq("provider", provider)
      .eq("event_id", eventId);
  } catch (err) {
    console.error("[provider-events] could not finalise event:", err);
  }
}
