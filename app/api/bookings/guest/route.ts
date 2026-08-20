import { NextRequest, NextResponse } from "next/server"
import Stripe from "stripe"
import { createClient } from "@supabase/supabase-js"
import { generateReceiptForPayment } from "@/lib/generate-receipt"
import { sendReceiptEmail } from "@/lib/receipt-email"
import { sendIntouchSMS } from "@/lib/intouch-sms"
import { priceStayForDates, type RateType } from "@/lib/booking-pricing"

// Guest booking + FULL-price payment.
// A guest has no account, so they pay the full amount upfront (not a 40% deposit).
// Flow: POST creates the booking + a payment record + a Stripe Checkout session and
// returns the checkout URL. GET (?session_id=) verifies the payment when the guest
// returns from Stripe, confirms the booking, issues the QR receipt, and emails them.

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
  apiVersion: "2026-02-25.clover" as any,
})

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || "",
)

function reference() {
  const year = new Date().getFullYear()
  return `GST-${year}-${Math.floor(100000 + Math.random() * 900000)}`
}

export async function POST(request: NextRequest) {
  try {
    const {
      client_name,
      client_email,
      client_phone,
      apartment_id,
      start_date,
      end_date,
      amount, // full total in RWF (before promo) — only a cross-check, see below
      rate_type,
      promo_code,
    } = await request.json()

    if (!client_name || !client_email || !apartment_id || !start_date || !end_date || !amount) {
      return NextResponse.json({ error: "Missing required booking details" }, { status: 400 })
    }
    if (Number(amount) <= 0) {
      return NextResponse.json({ error: "This apartment has no price set for the chosen rate." }, { status: 400 })
    }

    // Price the stay SERVER-SIDE from the apartment's own rates and the booked dates.
    // The client sends what it displayed, but we charge our own figure so the total
    // can't be edited in the browser before checkout.
    const rateType: RateType = rate_type === "daily" || rate_type === "weekly" ? rate_type : "monthly"

    const { data: pricing } = await supabase
      .from("apartments")
      .select("price_per_month, price_per_day")
      .eq("id", Number(apartment_id))
      .maybeSingle()

    if (!pricing) {
      return NextResponse.json({ error: "That apartment could not be found." }, { status: 404 })
    }

    const stay = priceStayForDates(pricing, start_date, end_date, rateType)
    const serverAmount = Math.round(stay.subtotal)

    if (serverAmount <= 0) {
      return NextResponse.json({ error: "This apartment has no price set for the chosen rate." }, { status: 400 })
    }

    // If what the guest was shown is materially different from the real price, stop
    // rather than silently charging a different number than the one on their screen.
    const shown = Math.round(Number(amount))
    if (Math.abs(shown - serverAmount) > Math.max(1, serverAmount * 0.01)) {
      return NextResponse.json(
        {
          error: "The price for these dates has changed. Please refresh the page and try again.",
          amount: serverAmount,
        },
        { status: 409 },
      )
    }

    // Apply a promo code SERVER-SIDE so the discount can't be forged by the client.
    let finalAmount = serverAmount
    let promoApplied: { id: number; code: string; percent: number } | null = null
    if (promo_code && String(promo_code).trim()) {
      const normalized = String(promo_code).trim().toUpperCase()
      const { data: promo } = await supabase
        .from("promo_codes")
        .select("*")
        .ilike("code", normalized)
        .limit(1)
        .maybeSingle()

      const valid =
        promo &&
        promo.active &&
        (!promo.expires_at || new Date(promo.expires_at) >= new Date()) &&
        (promo.max_uses == null || promo.used_count < promo.max_uses)

      if (!valid) {
        return NextResponse.json(
          { error: "This promo code is invalid, expired, or has reached its usage limit." },
          { status: 400 },
        )
      }

      promoApplied = { id: promo.id, code: promo.code, percent: promo.discount_percent }
      finalAmount = Math.max(1, Math.round(finalAmount * (1 - promo.discount_percent / 100)))
    }

    // 1. Create the booking (awaiting payment — not confirmed until the guest pays).
    // Some databases still have the legacy `apartment_type` NOT NULL column, while
    // newer schemas dropped it. We supply it when available and fall back gracefully.
    const { data: apartmentLookup } = await supabase
      .from("apartments")
      .select("type")
      .eq("id", Number(apartment_id))
      .maybeSingle()

    const bookingInsertBase = {
      client_name,
      email: client_email,
      phone_number: client_phone || null,
      apartment_id: Number(apartment_id),
      start_date,
      end_date,
      status: "awaiting_payment",
      apartment_type: (apartmentLookup?.type as string | null) || "Unknown",
    }

    const bookingInsert = bookingInsertBase
    let booking: { id: number } | null = null
    const { data: firstBooking, error: bookingError } = await supabase
      .from("bookings")
      .insert(bookingInsert)
      .select("id")
      .single()

    if (bookingError || !firstBooking) {
      // 23P01 = exclusion_violation, raised by the bookings_no_overlap
      // constraint added in scripts/032. This is the double-booking race being
      // caught at the database level: two requests for the same apartment and
      // overlapping dates, where the application check passed for both because
      // neither had committed yet. Surface it as a normal "taken" message.
      if (bookingError?.code === "23P01") {
        return NextResponse.json(
          {
            error:
              "Those dates have just been taken for this apartment. Please pick different dates.",
            code: "DATES_UNAVAILABLE",
          },
          { status: 409 },
        )
      }

      const isLegacySchemaIssue = /apartment_type/.test(bookingError?.message || "")
      if (isLegacySchemaIssue) {
        const { data: fallbackBooking, error: fallbackError } = await supabase
          .from("bookings")
          .insert({
            client_name,
            email: client_email,
            phone_number: client_phone || null,
            apartment_id: Number(apartment_id),
            start_date,
            end_date,
            status: "awaiting_payment",
          })
          .select("id")
          .single()

        if (fallbackError || !fallbackBooking) {
          return NextResponse.json({ error: `Could not create booking: ${fallbackError?.message || bookingError?.message}` }, { status: 500 })
        }

        booking = fallbackBooking
      } else {
        return NextResponse.json({ error: `Could not create booking: ${bookingError?.message}` }, { status: 500 })
      }
    } else {
      booking = firstBooking
    }

    if (!booking) {
      return NextResponse.json({ error: "Could not create booking: unknown error" }, { status: 500 })
    }

    // 2. Create the payment record (full price). tenant_id is null for guests —
    //    requires: ALTER TABLE tenant_payments ALTER COLUMN tenant_id DROP NOT NULL;
    const ref = reference()
    const { data: payment, error: paymentError } = await supabase
      .from("tenant_payments")
      .insert({
        tenant_id: null,
        apartment_id: Number(apartment_id),
        amount: finalAmount,
        reference_number: ref,
        status: "pending",
        payment_date: new Date().toISOString().slice(0, 10),
        due_date: start_date,
      })
      .select("id")
      .single()

    if (paymentError || !payment) {
      // Roll back the booking so we don't leave an orphan.
      await supabase.from("bookings").delete().eq("id", booking.id)
      const hint = /null value in column "tenant_id"/.test(paymentError?.message || "")
        ? " — run: ALTER TABLE tenant_payments ALTER COLUMN tenant_id DROP NOT NULL;"
        : ""
      return NextResponse.json(
        { error: `Could not create guest payment: ${paymentError?.message}${hint}` },
        { status: 500 },
      )
    }

    // 3. Stripe Checkout for the FULL amount.
    // Return to the origin the guest booked from so any local state survives the redirect.
    const base = request.headers.get("origin") || process.env.NEXT_PUBLIC_BASE_URL || ""
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "rwf",
            product_data: {
              name: `Cielo Vista booking — Ref ${ref}`,
              description:
                `Full payment for apartment #${apartment_id} (${start_date} to ${end_date})` +
                (promoApplied ? ` — promo ${promoApplied.code} (-${promoApplied.percent}%)` : ""),
            },
            unit_amount: finalAmount, // RWF is zero-decimal
          },
          quantity: 1,
        },
      ],
      success_url: `${base}/booking?guest_session={CHECKOUT_SESSION_ID}`,
      cancel_url: `${base}/booking?status=cancelled`,
      customer_email: client_email,
      metadata: {
        guest: "true",
        tenant_payment_id: payment.id.toString(),
        booking_id: booking.id.toString(),
        apartment_id: String(apartment_id),
        guest_email: client_email,
        guest_name: client_name,
        guest_phone: client_phone || "",
        reference_number: ref,
        promo_code: promoApplied?.code || "",
      },
    })

    await supabase
      .from("tenant_payments")
      .update({ status: "processing", stripe_session_id: session.id })
      .eq("id", payment.id)

    // Consume one use of the promo code now that a discounted checkout was issued.
    if (promoApplied) {
      const { data: fresh } = await supabase
        .from("promo_codes")
        .select("used_count")
        .eq("id", promoApplied.id)
        .single()
      await supabase
        .from("promo_codes")
        .update({ used_count: (fresh?.used_count || 0) + 1 })
        .eq("id", promoApplied.id)
    }

    // Notify the guest by SMS that their booking was submitted (IntouchSMS).
    // Safe no-op until the API key is set; doesn't block the checkout redirect.
    if (client_phone) {
      sendIntouchSMS(
        client_phone,
        `Cielo Vista: Hi ${client_name}, your booking has been submitted. ` +
          `Please complete your payment to confirm it. Ref: ${ref}.`,
      ).catch(() => {})
    }

    return NextResponse.json({ url: session.url, sessionId: session.id })
  } catch (error) {
    console.error("Guest booking error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to start guest booking" },
      { status: 500 },
    )
  }
}

// Verify the checkout when the guest returns, then confirm everything.
export async function GET(request: NextRequest) {
  const sessionId = request.nextUrl.searchParams.get("session_id")
  if (!sessionId) return NextResponse.json({ error: "Missing session_id" }, { status: 400 })

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId)
    const m = session.metadata || {}
    const paymentId = m.tenant_payment_id ? parseInt(m.tenant_payment_id) : null
    const bookingId = m.booking_id ? parseInt(m.booking_id) : null

    if (session.payment_status !== "paid" || !paymentId) {
      return NextResponse.json({ paid: false, status: session.payment_status })
    }

    const transactionId =
      typeof session.payment_intent === "string" ? session.payment_intent : session.id

    // Was it already completed? (so we don't re-email on reload)
    const { data: existing } = await supabase
      .from("tenant_payments")
      .select("status")
      .eq("id", paymentId)
      .single()
    const wasCompleted = existing?.status === "completed"

    // 1. Mark the payment completed
    if (!wasCompleted) {
      await supabase
        .from("tenant_payments")
        .update({ status: "completed", transaction_id: transactionId, payment_method: "stripe", updated_at: new Date().toISOString() })
        .eq("id", paymentId)
    }

    // 2. Confirm the booking + take the apartment off the market
    if (bookingId) {
      await supabase.from("bookings").update({ status: "confirmed" }).eq("id", bookingId)
    }
    if (m.apartment_id) {
      await supabase.from("apartments").update({ is_available: false }).eq("id", Number(m.apartment_id))
    }

    // 3. Issue the QR receipt (idempotent)
    await generateReceiptForPayment({
      tenantPaymentId: paymentId,
      apartmentId: m.apartment_id ? Number(m.apartment_id) : undefined,
      email: m.guest_email,
      amount: Number(session.amount_total) || 0,
      currency: "rwf",
      transactionId,
    })

    // 4. Email the guest their receipt (only on first completion)
    let emailed = false
    if (!wasCompleted && m.guest_email) {
      try {
        const { data: rec } = await supabase
          .from("receipts")
          .select("qr_code_base64")
          .eq("tenant_payment_id", paymentId)
          .limit(1)
        const base = process.env.NEXT_PUBLIC_BASE_URL || ""
        await sendReceiptEmail({
          to: m.guest_email,
          customerName: m.guest_name,
          amount: Number(session.amount_total) || 0,
          currency: "RWF",
          referenceNumber: m.reference_number,
          transactionId,
          paymentDate: new Date().toISOString(),
          receiptUrl: `${base}/receipt?payment_id=${paymentId}`,
          qrCodeBase64: rec?.[0]?.qr_code_base64 || undefined,
        })
        emailed = true
      } catch (e) {
        console.error("Guest receipt email failed:", e)
      }
    }

    // 5. SMS the guest their ticket number (IntouchSMS) — first completion only.
    //    Safe no-op until the IntouchSMS API key is configured.
    if (!wasCompleted && m.guest_phone) {
      try {
        await sendIntouchSMS(
          m.guest_phone,
          `Thank you for choosing Cielo Vista. Your full payment was received and your apartment is booked. ` +
            `Your ticket number is ${m.reference_number}. A receipt with a QR code has been emailed to you — ` +
            `show it at reception when you check in.`,
        )
      } catch (e) {
        console.error("Guest ticket SMS failed:", e)
      }
    }

    return NextResponse.json({
      paid: true,
      paymentId,
      reference: m.reference_number,
      emailed,
      alreadyCompleted: wasCompleted,
    })
  } catch (error) {
    console.error("Guest verify error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Verification failed" },
      { status: 500 },
    )
  }
}
