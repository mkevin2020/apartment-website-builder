import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { completeTenantPayment } from "@/lib/complete-payment";
import { claimEvent, completeEvent, releaseEvent } from "@/lib/provider-events";
import { recordAudit } from "@/lib/audit";
import { enforceRateLimit } from "@/lib/auth/rate-limit";
import { fetchMomoStatus, momoConfigured } from "@/lib/mtn-momo";

// ─────────────────────────────────────────────────────────────────────────────
// MTN Mobile Money callback.
//
// WHY THIS ROUTE EXISTS
//
// app/api/payments/mtn-momo/route.ts registers this URL with MTN when it
// initiates a payment. The route did not exist, so every callback hit a 404 and
// nothing server-side ever learned that a payment had settled — confirmation
// depended entirely on the customer's browser still being open and polling.
//
// HOW IT TRUSTS THE CALLER — IT DOESN'T
//
// MADAPI's callback signing scheme is not documented to us. Rather than invent
// one (a fabricated check looks like protection while accepting anything), this
// route treats the callback as an unverified DOORBELL:
//
//     "something may have happened for transaction X"
//
// It then asks MTN directly, over a request authenticated with OUR OAuth
// credentials, and completes the payment only if MTN itself confirms it.
//
// A forged callback therefore achieves nothing. The worst an attacker can do by
// POSTing here is make the server ask MTN about a transaction id, and MTN
// answers "not paid" — or "no such transaction". The body is never treated as
// evidence of anything except which id to ask about.
//
// This also means the route is correct BEFORE MTN documents their signatures.
// If you later obtain the scheme, verifying the signature up front is a
// worthwhile extra layer, but it is no longer load-bearing.
// ─────────────────────────────────────────────────────────────────────────────

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

/** Pull a transaction reference out of whatever shape MADAPI sends. */
function transactionIdFrom(payload: Record<string, unknown>): string {
  return String(
    payload.transactionId ??
      payload.transaction_id ??
      payload.referenceId ??
      payload.reference_id ??
      payload.externalId ??
      payload.external_id ??
      "",
  ).trim();
}

export async function POST(request: NextRequest) {
  try {
    // Publicly reachable by necessity, so it gets a ceiling. Generous, because
    // MTN legitimately retries.
    await enforceRateLimit(request, "momo-callback", 300, 10 * 60);

    // Read the body as text first: if a signature scheme is ever added, it will
    // be computed over these exact bytes, and parsing then re-serialising JSON
    // changes key order and whitespace.
    const rawBody = await request.text();

    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const transactionId = transactionIdFrom(payload);
    if (!transactionId || transactionId.length > 128) {
      return NextResponse.json({ error: "No usable transaction reference" }, { status: 400 });
    }

    // Without credentials we cannot verify anything, and an unverified callback
    // is not evidence that money moved. Acknowledge so MTN stops retrying, but
    // change nothing.
    if (!momoConfigured()) {
      console.error("[momo-callback] MTN credentials are not configured — cannot verify");
      await recordAudit(
        {
          action: "payment.completed",
          outcome: "denied",
          metadata: { provider: "mtn_momo", reason: "credentials not configured" },
        },
        { req: request },
      );
      return NextResponse.json({ received: true, verified: false });
    }

    // De-duplicate before doing work: providers retry, and deliveries overlap.
    const claimed = await claimEvent("mtn_momo", transactionId, {
      eventType: String(payload.status ?? "callback"),
    });
    if (!claimed) {
      return NextResponse.json({ received: true, duplicate: true });
    }

    // ── The actual authority: MTN's own API, not this request body ──────────
    const status = await fetchMomoStatus(transactionId);

    const { data: row } = await supabase
      .from("tenant_payments")
      .select("id")
      .eq("transaction_id", transactionId)
      .single();

    if (!row) {
      await completeEvent("mtn_momo", transactionId, {
        status: "ignored",
        error: "no matching payment",
      });
      // 200 so MTN stops retrying something we can never match.
      return NextResponse.json({ received: true, matched: false });
    }

    const target = `tenant_payments:${row.id}`;

    if (status === "completed") {
      await completeTenantPayment(row.id, transactionId, "mtn_momo");
      await completeEvent("mtn_momo", transactionId, { status: "processed", target });
      await recordAudit(
        {
          action: "payment.completed",
          target,
          metadata: { provider: "mtn_momo", transaction_id: transactionId, verified_with: "mtn api" },
        },
        { req: request },
      );
      return NextResponse.json({ received: true, status: "completed" });
    }

    if (status === "failed") {
      await supabase
        .from("tenant_payments")
        .update({ status: "pending", updated_at: new Date().toISOString() })
        .eq("id", row.id)
        .eq("status", "processing");
      await completeEvent("mtn_momo", transactionId, { status: "processed", target });
      return NextResponse.json({ received: true, status: "failed" });
    }

    // "processing" or "unknown" — MTN has not confirmed, so nothing changes.
    //
    // The claim MUST be released. Leaving it would make MTN's next retry — the
    // one that would tell us the payment settled — look like a duplicate and be
    // discarded, and the payment would never complete.
    await releaseEvent("mtn_momo", transactionId);
    return NextResponse.json({ received: true, status });
  } catch (err) {
    console.error("[momo-callback] processing failed:", err);
    // 200 on purpose: a non-2xx makes MTN retry, and the de-duplication claim
    // would then suppress the retry. The failure is recorded for reconciliation.
    return NextResponse.json({ received: true, error: "processing failed" });
  }
}
