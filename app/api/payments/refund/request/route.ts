import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { getSession, errorResponse, HttpError } from "@/lib/auth/session"

export const dynamic = "force-dynamic"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

// A tenant (by paymentId) or a guest (by reference + email) requests a refund.
// We just FLAG the payment as "refund requested" — the manager processes it later
// (and only 2+ days after the payment).
export async function POST(req: NextRequest) {
  try {
    const { paymentId, reference, email } = await req.json()

    // The paymentId path is for signed-in tenants acting on their own payment;
    // the reference+email path is for guests, who prove ownership below. Before
    // this check, passing any paymentId flagged that payment for refund
    // regardless of who it belonged to.
    const session = await getSession(req)
    if (paymentId && session?.role !== "tenant") {
      throw new HttpError(401, "Please sign in to request a refund on this payment.")
    }

    // 1. Find the payment
    let query = supabase.from("tenant_payments").select("*, tenants(email)")
    if (paymentId) {
      query = query.eq("id", Number(paymentId)).eq("tenant_id", session!.sub)
    } else if (reference) {
      query = query.ilike("reference_number", String(reference).trim())
    } else {
      return NextResponse.json({ error: "Provide a payment or a reference number." }, { status: 400 })
    }

    const { data: rows } = await query.limit(1)
    const payment = rows?.[0]
    if (!payment) {
      return NextResponse.json({ error: "No payment found for that reference." }, { status: 404 })
    }

    // 2. Guests must prove ownership with the email on the receipt/booking
    if (!paymentId) {
      const provided = String(email || "").trim().toLowerCase()
      if (!provided) {
        return NextResponse.json({ error: "Email is required." }, { status: 400 })
      }
      // Match against the tenant email or the receipt's user_email
      const tenantEmail = (payment as any).tenants?.email?.toLowerCase()
      let ok = tenantEmail === provided
      if (!ok) {
        const { data: rec } = await supabase
          .from("receipts")
          .select("user_email")
          .eq("tenant_payment_id", payment.id)
          .limit(1)
        ok = rec?.[0]?.user_email?.toLowerCase() === provided
      }
      if (!ok) {
        return NextResponse.json({ error: "Reference and email do not match our records." }, { status: 403 })
      }
    }

    // 3. Only a completed payment can be refunded
    if (payment.status !== "completed") {
      return NextResponse.json(
        { error: "Only a completed payment can be refunded." },
        { status: 400 },
      )
    }
    if (payment.refund_status === "refunded") {
      return NextResponse.json({ error: "This payment has already been refunded." }, { status: 400 })
    }
    if (payment.refund_status === "requested") {
      return NextResponse.json({ ok: true, already: true, message: "Refund already requested." })
    }

    // 4. Flag the request
    const { error } = await supabase
      .from("tenant_payments")
      .update({ refund_status: "requested", refund_requested_at: new Date().toISOString() })
      .eq("id", payment.id)

    if (error) {
      const hint = /column .*refund_status/.test(error.message)
        ? " — run the refund columns SQL (refund_status, refund_requested_at)."
        : ""
      return NextResponse.json({ error: error.message + hint }, { status: 500 })
    }

    return NextResponse.json({ ok: true, reference: payment.reference_number })
  } catch (err) {
    return errorResponse(err)
  }
}
