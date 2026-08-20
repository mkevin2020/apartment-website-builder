import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { completeTenantPayment } from "@/lib/complete-payment";
import { claimEvent, completeEvent } from "@/lib/provider-events";
import { recordAudit } from "@/lib/audit";

// ─────────────────────────────────────────────────────────────────────────────
// MTN Mobile Money payment callback.
//
// WHY THIS FILE EXISTS
//
// app/api/payments/mtn-momo/route.ts registers this URL with MTN when it
// initiates a payment:
//
//     callbackURL: `${NEXT_PUBLIC_BASE_URL}/api/payments/mtn-momo/callback`
//
// …but the route did not exist. Every callback MTN sent hit a 404, so nothing
// server-side ever learned that a payment had settled. Confirmation depended
// entirely on the browser polling /api/payments/mtn-momo/status — which means a
// customer who paid and then closed the tab was never marked paid, and the
// authoritative record of a real-money event was a client-side loop.
//
// ⚠️ SIGNATURE VERIFICATION IS A STUB — READ BEFORE GOING LIVE
//
// I do not know how MTN MADAPI signs its callbacks, and I will not guess: a
// fabricated verification scheme is worse than none, because it looks like
// protection while accepting anything. `verifyMtnCallback()` below is a
// deliberate placeholder with the real checks written out as TODOs.
//
// Until you fill it in, this route runs in one of two modes:
//
//   MTN_CALLBACK_VERIFICATION=strict   (default, and what production MUST use)
//       Unverified callbacks are REJECTED with 401 and logged. Payments are not
//       completed from callbacks at all. This is safe but means MoMo payments
//       still rely on the status poll until you implement verification.
//
//   MTN_CALLBACK_VERIFICATION=insecure-accept-all
//       Every callback is trusted. This lets you observe real payloads in a
//       sandbox so you can implement the checks. NEVER set this in production:
//       anyone who finds the URL can mark any payment paid.
//
// What to ask MTN for:
//   1. Do they sign callbacks? Which header carries the signature, which
//      algorithm, and which secret/public key?
//   2. Is the signature over the RAW request body? (It almost always is, which
//      is why this route reads text() before parsing.)
//   3. Do they publish a source IP range to allowlist?
//   4. Is there a callback-specific shared secret separate from the API key?
// ─────────────────────────────────────────────────────────────────────────────

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

type VerificationResult =
  | { ok: true; reason: "verified" | "insecure-mode" }
  | { ok: false; reason: string };

/**
 * Verify that a callback genuinely came from MTN.
 *
 * IMPLEMENT THIS. The raw body is passed in unparsed precisely because
 * signatures are computed over the exact bytes received — parsing and
 * re-serialising JSON changes key order and whitespace and breaks the digest.
 */
async function verifyMtnCallback(
  request: NextRequest,
  rawBody: string,
): Promise<VerificationResult> {
  const mode = process.env.MTN_CALLBACK_VERIFICATION || "strict";

  if (mode === "insecure-accept-all") {
    console.warn(
      "[mtn-callback] MTN_CALLBACK_VERIFICATION=insecure-accept-all — every " +
        "callback is being trusted. This must never be set in production.",
    );
    return { ok: true, reason: "insecure-mode" };
  }

  // ── TODO 1: signature header ──────────────────────────────────────────────
  // const signature = request.headers.get("x-mtn-signature");   // ← real name?
  // if (!signature) return { ok: false, reason: "missing signature header" };
  //
  // ── TODO 2: recompute over the RAW body ───────────────────────────────────
  // const expected = crypto
  //   .createHmac("sha256", process.env.MTN_CALLBACK_SECRET!)
  //   .update(rawBody, "utf8")
  //   .digest("hex");
  // if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
  //   return { ok: false, reason: "signature mismatch" };
  // }
  //
  // ── TODO 3 (optional): source IP allowlist ────────────────────────────────
  // const ip = clientIp(request);
  // if (!MTN_CALLBACK_IPS.includes(ip)) return { ok: false, reason: "unknown source ip" };

  void request;
  void rawBody;

  return {
    ok: false,
    reason:
      "callback verification is not implemented — see verifyMtnCallback() in this file",
  };
}

export async function POST(request: NextRequest) {
  // Read the raw body FIRST: any signature scheme will be computed over these
  // exact bytes, so it must not be parsed and re-serialised before checking.
  const rawBody = await request.text();

  const verification = await verifyMtnCallback(request, rawBody);

  if (!verification.ok) {
    // Rejected, not "trusted and logged". An unverifiable payment notification
    // is not evidence that money moved.
    console.error("[mtn-callback] rejected:", verification.reason);
    await recordAudit(
      {
        action: "payment.completed",
        outcome: "denied",
        metadata: { provider: "mtn_momo", reason: verification.reason },
      },
      { req: request },
    );
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  // MADAPI payload shapes vary by product; accept the common spellings rather
  // than guessing one. Adjust once you have a real payload to look at.
  const transactionId = String(
    payload.transactionId ??
      payload.transaction_id ??
      payload.referenceId ??
      payload.externalId ??
      "",
  );
  const status = String(payload.status ?? "").toLowerCase();

  if (!transactionId) {
    return NextResponse.json({ error: "No transaction reference" }, { status: 400 });
  }

  // De-duplicate: providers retry, and deliveries can overlap.
  const claimed = await claimEvent("mtn_momo", transactionId, {
    eventType: status || "callback",
  });
  if (!claimed) {
    return NextResponse.json({ received: true, duplicate: true });
  }

  try {
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
      // 200 so MTN stops retrying a callback we will never be able to match.
      return NextResponse.json({ received: true, matched: false });
    }

    const SUCCESS = ["successful", "succeeded", "completed", "success"];
    const FAILURE = ["failed", "rejected", "cancelled", "expired"];

    if (SUCCESS.includes(status)) {
      await completeTenantPayment(row.id, transactionId, "mtn_momo");
      await completeEvent("mtn_momo", transactionId, {
        status: "processed",
        target: `tenant_payments:${row.id}`,
      });
      await recordAudit(
        {
          action: "payment.completed",
          target: `tenant_payments:${row.id}`,
          metadata: { provider: "mtn_momo", transaction_id: transactionId },
        },
        { req: request },
      );
      return NextResponse.json({ received: true, status: "completed" });
    }

    if (FAILURE.includes(status)) {
      await supabase
        .from("tenant_payments")
        .update({ status: "pending", updated_at: new Date().toISOString() })
        .eq("id", row.id)
        .eq("status", "processing");
      await completeEvent("mtn_momo", transactionId, {
        status: "processed",
        target: `tenant_payments:${row.id}`,
      });
      return NextResponse.json({ received: true, status: "failed" });
    }

    // Intermediate state — acknowledge without changing anything.
    await completeEvent("mtn_momo", transactionId, {
      status: "ignored",
      target: `tenant_payments:${row.id}`,
    });
    return NextResponse.json({ received: true, status: status || "pending" });
  } catch (err) {
    console.error("[mtn-callback] processing failed:", err);
    await completeEvent("mtn_momo", transactionId, {
      status: "failed",
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ received: true, error: "processing failed" });
  }
}
