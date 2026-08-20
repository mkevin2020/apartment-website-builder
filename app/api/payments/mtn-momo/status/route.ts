import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { completeTenantPayment } from "@/lib/complete-payment";
import { loadOwnedPayment } from "@/lib/auth/payment-access";
import { errorResponse, HttpError } from "@/lib/auth/session";
import { enforceRateLimit } from "@/lib/auth/rate-limit";
import { fetchMomoStatus } from "@/lib/mtn-momo";

// Polled by the checkout dialog after a MoMo payment is initiated.
// Demo transactions (DEMO-<epoch>-<paymentId>) auto-complete ~8 seconds after
// initiation, mimicking the customer confirming the PIN prompt on their phone.
// Real transactions query MTN's transaction-status endpoint.

const DEMO_CONFIRM_AFTER_MS = 8000;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Shared completion: marks paid + generates the QR receipt + emails/SMS it.
// completeTenantPayment is idempotent (skips already-completed payments).
async function markCompleted(paymentId: number, transactionId: string) {
  return completeTenantPayment(paymentId, transactionId, "mtn_momo");
}

export async function GET(req: NextRequest) {
  try {
    // Polled in a loop by the checkout dialog, so the ceiling is generous —
    // but it is a ceiling, and it is per-IP.
    await enforceRateLimit(req, "momo-status", 240, 10 * 60);

    const tid = req.nextUrl.searchParams.get("tid");
    if (!tid) {
      return NextResponse.json({ error: "tid is required" }, { status: 400 });
    }

    // ---- Demo transactions ------------------------------------------------
    //
    // This branch completes a payment, so it needs the same guards as any other
    // money-moving path. It previously had none: a plain GET with
    // `tid=DEMO-<past epoch>-<any payment id>` marked ANY invoice paid, with no
    // session, no ownership check, and regardless of whether demo mode was on.
    if (tid.startsWith("DEMO-")) {
      // 1. Demo completion must be explicitly enabled, and never in production.
      const demoEnabled =
        process.env.MTN_MOMO_DEMO_MODE === "true" &&
        process.env.NODE_ENV !== "production";
      if (!demoEnabled) {
        throw new HttpError(404, "Transaction not found.");
      }

      const [, epoch, paymentId] = tid.split("-");
      const epochMs = Number(epoch);
      const id = Number(paymentId);
      if (!Number.isFinite(epochMs) || !Number.isInteger(id) || id <= 0) {
        throw new HttpError(400, "Invalid transaction reference.");
      }

      // 2. The caller must own the invoice this demo transaction settles.
      await loadOwnedPayment(req, id);

      const elapsed = Date.now() - epochMs;
      if (elapsed >= DEMO_CONFIRM_AFTER_MS) {
        const result = await markCompleted(id, tid);
        return NextResponse.json({
          status: "completed",
          simulated: true,
          emailed: result?.emailed ?? false,
          emailReason: result?.reason,
        });
      }
      return NextResponse.json({ status: "processing", simulated: true });
    }

    // ---- Real MTN transactions --------------------------------------------
    //
    // Authoritative completion happens in the callback route, which MTN calls
    // directly. This poll is the UI's progress indicator, and a fallback for
    // when the callback never arrives — but it resolves the status through the
    // SAME helper, so there is exactly one definition of "MTN says this is
    // paid" rather than two implementations that can drift apart.
    const status = await fetchMomoStatus(tid);

    if (status === "completed") {
      const { data: row } = await supabase
        .from("tenant_payments")
        .select("id")
        .eq("transaction_id", tid)
        .single();
      if (row) {
        // Ownership check before completing: this endpoint takes a transaction
        // id from the query string, so without it any signed-in user who
        // learned a tid could settle someone else's invoice.
        await loadOwnedPayment(req, row.id);
        await markCompleted(row.id, tid);
      }
      return NextResponse.json({ status: "completed" });
    }

    if (status === "failed") {
      await supabase
        .from("tenant_payments")
        .update({ status: "pending", updated_at: new Date().toISOString() })
        .eq("transaction_id", tid)
        .eq("status", "processing");
      return NextResponse.json({ status: "failed" });
    }

    // "processing", or "unknown" because MTN was unreachable. Neither is a
    // failure the customer should be shown — keep the dialog waiting.
    return NextResponse.json({ status: "processing" });
  } catch (err) {
    // Auth/ownership failures must surface as 401/403 rather than being
    // disguised as "still processing", which would silently hide a real denial.
    if (err instanceof HttpError) return errorResponse(err);
    // A genuine upstream/network failure is reported as still-pending so the
    // dialog keeps polling instead of showing a false failure.
    console.error("MoMo status check error:", err);
    return NextResponse.json({ status: "processing" });
  }
}
