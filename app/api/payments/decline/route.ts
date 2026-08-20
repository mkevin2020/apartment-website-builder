import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";
import { sendDeclineEmail } from "@/lib/decline-email";
import { requireRole, ADMIN_OR_MANAGER, errorResponse } from "@/lib/auth/session";
import { parseJson, idSchema, z } from "@/lib/auth/validate";
import { recordAudit } from "@/lib/audit";

// Staff (manager/admin) declines a pending tenant payment:
// makes sure no money is captured on Stripe, marks it declined, and emails the
// tenant that they've been fully refunded.
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2024-04-10" as any })
  : null;

export async function POST(request: NextRequest) {
  try {
    // Declining cancels/refunds a Stripe charge — staff only.
    const session = await requireRole(request, ADMIN_OR_MANAGER);

    const { paymentId } = await parseJson(
      request,
      z.object({ paymentId: idSchema }),
    );

    // Load the payment with tenant + apartment info
    const { data: payment, error: fetchError } = await supabase
      .from("tenant_payments")
      .select("*, tenants(full_name, email), apartments(name)")
      .eq("id", paymentId)
      .single();

    if (fetchError || !payment) {
      return NextResponse.json({ error: "Payment not found" }, { status: 404 });
    }

    // Make sure no money goes to Stripe: cancel an uncaptured PaymentIntent, or
    // refund it if it somehow already succeeded. Best-effort — never block the decline.
    let refunded = false;
    const txn: string = payment.transaction_id || "";
    if (stripe && txn.startsWith("pi_")) {
      try {
        const intent = await stripe.paymentIntents.retrieve(txn);
        if (intent.status === "succeeded") {
          await stripe.refunds.create({ payment_intent: txn });
          refunded = true;
        } else if (intent.status !== "canceled") {
          await stripe.paymentIntents.cancel(txn);
          refunded = true;
        }
      } catch (stripeErr) {
        // e.g. test intent that no longer exists — log and continue.
        console.error("Stripe cancel/refund on decline failed:", stripeErr);
      }
    }

    // Mark the payment declined (keeps an audit trail; removes it from the
    // pending list which only shows "pending"/"processing"). If the status
    // column rejects "declined" (e.g. a CHECK constraint), fall back to deleting
    // the pending row so the decline still goes through.
    const { error: updateError } = await supabase
      .from("tenant_payments")
      .update({ status: "declined", updated_at: new Date().toISOString() })
      .eq("id", paymentId);

    if (updateError) {
      console.warn("Could not set status=declined, removing the row instead:", updateError.message);
      const { error: deleteError } = await supabase
        .from("tenant_payments")
        .delete()
        .eq("id", paymentId);
      if (deleteError) {
        return NextResponse.json({ error: deleteError.message }, { status: 500 });
      }
    }

    // Email the tenant that they've been fully refunded (best-effort)
    const email = (payment as any).tenants?.email;
    let emailed = false;
    if (email) {
      try {
        await sendDeclineEmail({
          to: email,
          customerName: (payment as any).tenants?.full_name,
          amount: Number(payment.amount) || 0,
          currency: "RWF",
          referenceNumber: payment.reference_number,
          apartmentName: (payment as any).apartments?.name,
        });
        emailed = true;
      } catch (emailErr) {
        console.error("Failed to send decline email:", emailErr);
      }
    }

    await recordAudit(
      {
        action: "payment.declined",
        target: `tenant_payments:${paymentId}`,
        metadata: {
          amount: payment.amount,
          reference_number: payment.reference_number,
          refunded,
          emailed,
          row_deleted: !!updateError,
        },
      },
      { req: request, session }
    );

    return NextResponse.json({ success: true, emailed, refunded });
  } catch (error) {
    return errorResponse(error);
  }
}
