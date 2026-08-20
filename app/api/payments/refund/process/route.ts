import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import Stripe from "stripe"
import { sendRefundEmail } from "@/lib/refund-email"
import { requireRole, ADMIN_OR_MANAGER, errorResponse } from "@/lib/auth/session"
import { parseJson, idSchema, z } from "@/lib/auth/validate"

export const dynamic = "force-dynamic"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2024-04-10" as any })
  : null

// Refunds can only be processed 2+ days after the payment.
const REFUND_DELAY_DAYS = 2
const DELAY_MS = REFUND_DELAY_DAYS * 24 * 60 * 60 * 1000

// When did the payment actually happen? (completion time, else payment_date, else created)
function paymentTime(p: any): number {
  const v = p.updated_at || p.payment_date || p.created_at
  return v ? new Date(v).getTime() : Date.now()
}

// Manager processes a requested refund: enforces the 2-day wait, refunds on
// Stripe, marks it refunded, and emails the customer.
export async function POST(req: NextRequest) {
  try {
    // Issues a real Stripe refund — staff only.
    await requireRole(req, ADMIN_OR_MANAGER)

    const { paymentId } = await parseJson(req, z.object({ paymentId: idSchema }))

    const { data: payment, error: fetchError } = await supabase
      .from("tenant_payments")
      .select("*, tenants(full_name, email), apartments(name)")
      .eq("id", Number(paymentId))
      .single()

    if (fetchError || !payment) {
      return NextResponse.json({ error: "Payment not found" }, { status: 404 })
    }
    if (payment.refund_status === "refunded") {
      return NextResponse.json({ error: "Already refunded." }, { status: 400 })
    }

    // Enforce the 2-day rule
    const eligibleAt = paymentTime(payment) + DELAY_MS
    if (Date.now() < eligibleAt) {
      const hoursLeft = Math.ceil((eligibleAt - Date.now()) / (60 * 60 * 1000))
      return NextResponse.json(
        {
          error: `Refunds can only be processed ${REFUND_DELAY_DAYS} days after payment. Eligible in ~${hoursLeft} hour(s).`,
          eligibleAt: new Date(eligibleAt).toISOString(),
        },
        { status: 400 },
      )
    }

    // Refund on Stripe (best-effort — never block the refund record)
    let stripeRefunded = false
    const txn: string = payment.transaction_id || ""
    if (stripe && txn.startsWith("pi_")) {
      try {
        const intent = await stripe.paymentIntents.retrieve(txn)
        if (intent.status === "succeeded") {
          await stripe.refunds.create({ payment_intent: txn })
          stripeRefunded = true
        } else if (intent.status !== "canceled") {
          await stripe.paymentIntents.cancel(txn)
          stripeRefunded = true
        }
      } catch (stripeErr) {
        console.error("Stripe refund failed:", stripeErr)
      }
    }

    // Mark refunded
    const { error: updateError } = await supabase
      .from("tenant_payments")
      .update({ refund_status: "refunded", status: "refunded", updated_at: new Date().toISOString() })
      .eq("id", payment.id)
    if (updateError) {
      // status CHECK constraint might reject "refunded" — at least set refund_status
      await supabase
        .from("tenant_payments")
        .update({ refund_status: "refunded" })
        .eq("id", payment.id)
    }

    // Free the apartment again (the booking is being refunded/cancelled)
    if (payment.apartment_id) {
      await supabase.from("apartments").update({ is_available: true }).eq("id", payment.apartment_id)
    }

    // Find the customer email (tenant, else the receipt's guest email)
    let email = (payment as any).tenants?.email
    let name = (payment as any).tenants?.full_name
    if (!email) {
      const { data: rec } = await supabase
        .from("receipts")
        .select("user_email")
        .eq("tenant_payment_id", payment.id)
        .limit(1)
      email = rec?.[0]?.user_email
    }

    let emailed = false
    if (email) {
      try {
        await sendRefundEmail({
          to: email,
          customerName: name,
          amount: Number(payment.amount) || 0,
          currency: "RWF",
          referenceNumber: payment.reference_number,
          apartmentName: (payment as any).apartments?.name,
        })
        emailed = true
      } catch (emailErr) {
        console.error("Failed to send refund email:", emailErr)
      }
    }

    return NextResponse.json({ success: true, stripeRefunded, emailed })
  } catch (err) {
    return errorResponse(err)
  }
}
