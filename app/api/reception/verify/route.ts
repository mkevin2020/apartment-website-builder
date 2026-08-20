import { NextRequest, NextResponse } from "next/server"
import jwt from "jsonwebtoken"
import { createClient } from "@supabase/supabase-js"
import { sendCheckinEmail } from "@/lib/checkin-email"
import { jwtSecret } from "@/lib/auth/secrets"
import { requireRole, STAFF, errorResponse } from "@/lib/auth/session"

export const dynamic = "force-dynamic"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || "",
)

const JWT_SECRET = jwtSecret()

// Pull a tenant_payment_id from a scanned value: it may be a full verify URL,
// a raw JWT token, or empty.
function paymentIdFromToken(raw: string): number | null {
  try {
    // If it's a URL, extract ?token=
    let token = raw.trim()
    if (token.includes("token=")) {
      token = decodeURIComponent(token.split("token=")[1].split("&")[0])
    }
    const decoded = jwt.verify(token, JWT_SECRET) as any
    return decoded.tenant_payment_id || decoded.booking_id || null
  } catch {
    return null
  }
}

export async function POST(req: NextRequest) {
  try {
    // Check-in desk operation: reveals the guest's booking and can mark a
    // ticket used, so it is staff only.
    const session = await requireRole(req, STAFF)

    const { token, code, markUsed } = await req.json()
    // Record who actually performed the check-in, not who the client claims.
    const verifiedBy = session.sub

    let paymentId: number | null = null

    if (token) {
      paymentId = paymentIdFromToken(String(token))
      if (!paymentId) {
        return NextResponse.json({ valid: false, reason: "Invalid or expired QR code." })
      }
    } else if (code) {
      // Look up by human-readable reference number (e.g. PAY-2026-197693)
      const ref = String(code).trim()
      const { data } = await supabase
        .from("tenant_payments")
        .select("id")
        .ilike("reference_number", ref)
        .limit(1)
      if (!data || data.length === 0) {
        return NextResponse.json({ valid: false, reason: "No receipt found for that code." })
      }
      paymentId = data[0].id
    } else {
      return NextResponse.json({ error: "Provide a token or code" }, { status: 400 })
    }

    // Load receipt + payment + tenant + apartment
    const { data: receiptRows } = await supabase
      .from("receipts")
      .select("*")
      .eq("tenant_payment_id", paymentId)
      .limit(1)
    const receipt = receiptRows?.[0]

    const { data: payment } = await supabase
      .from("tenant_payments")
      .select("*, tenants(full_name, email), apartments(name)")
      .eq("id", paymentId)
      .single()

    if (!payment) {
      return NextResponse.json({ valid: false, reason: "Receipt/payment not found." })
    }

    const paid = payment.status === "completed"
    if (!paid) {
      return NextResponse.json({
        valid: false,
        reason: `Payment is not completed (status: ${payment.status}).`,
        details: buildDetails(payment, receipt),
      })
    }
    if (!receipt) {
      return NextResponse.json({
        valid: false,
        reason: "Payment is completed but no receipt was issued.",
        details: buildDetails(payment, receipt),
      })
    }

    // ---- Expiry check: a receipt is valid only through the booking's check-out date ----
    // Prefer the booking made by THIS tenant for this apartment (the dates they entered);
    // fall back to the apartment's latest booking, then the payment due date.
    let checkoutDate: string | null = null
    if (payment.tenant_id) {
      const { data } = await supabase
        .from("bookings")
        .select("end_date")
        .eq("apartment_id", payment.apartment_id)
        .eq("tenant_id", payment.tenant_id)
        .order("end_date", { ascending: false })
        .limit(1)
      checkoutDate = data?.[0]?.end_date || null
    }
    if (!checkoutDate) {
      const { data } = await supabase
        .from("bookings")
        .select("end_date")
        .eq("apartment_id", payment.apartment_id)
        .order("end_date", { ascending: false })
        .limit(1)
      checkoutDate = data?.[0]?.end_date || payment.due_date || null
    }

    if (checkoutDate) {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const end = new Date(checkoutDate + "T00:00:00")
      if (today > end) {
        // Expired — free the apartment so it becomes available again
        await supabase.from("apartments").update({ is_available: true }).eq("id", payment.apartment_id)
        // best-effort cleanup of the occupied table if present
        await supabase.from("occupied_apartments").delete().eq("apartment_id", payment.apartment_id)

        return NextResponse.json({
          valid: false,
          expired: true,
          reason: `This receipt is expired. Check-out date was ${checkoutDate}. The apartment has been released and is now available.`,
          details: { ...buildDetails(payment, receipt), checkout: checkoutDate },
        })
      }
    }

    const alreadyVerified = !!receipt.is_verified

    // Optionally check the ticket in (one-time use), recording WHO checked it.
    // Also backfill tenant_id on the receipt so the tenant's notification can find it.
    let justChecked = false
    let checkedById: number | null = receipt.verified_by_admin_id || null
    let verifiedAt: string | null = receipt.verified_at || null
    let checkerWarning: string | null = null
    if (markUsed && !alreadyVerified) {
      const update: Record<string, any> = {
        is_verified: true,
        verified_at: new Date().toISOString(),
        tenant_id: payment.tenant_id ?? receipt.tenant_id ?? null,
      }
      if (verifiedBy) update.verified_by_admin_id = Number(verifiedBy)

      let { error: updateError } = await supabase
        .from("receipts")
        .update(update)
        .eq("id", receipt.id)

      // If recording WHO checked it fails (e.g. a stale foreign-key constraint
      // pointing verified_by_admin_id at the admins table), still check the
      // ticket in — just without the checker — so reception is never blocked.
      let checkerRecorded = true
      if (updateError && update.verified_by_admin_id != null) {
        checkerRecorded = false
        const { verified_by_admin_id, ...withoutChecker } = update
        const retry = await supabase
          .from("receipts")
          .update(withoutChecker)
          .eq("id", receipt.id)
        updateError = retry.error
      }

      if (updateError) {
        console.error("Failed to mark receipt as used:", updateError)
        return NextResponse.json(
          { valid: false, reason: `Could not check in the ticket: ${updateError.message}` },
          { status: 500 },
        )
      }

      justChecked = true
      checkedById = checkerRecorded && verifiedBy ? Number(verifiedBy) : null
      verifiedAt = update.verified_at
      if (!checkerRecorded) {
        checkerWarning =
          "Ticket checked in, but the receptionist could not be recorded. Run the DB fix (drop receipts_verified_by_admin_id_fkey)."
      }

      // Checking the ticket in assigns the tenant to the apartment: their
      // pending booking becomes confirmed and the apartment is marked occupied.
      // Best-effort — a failure here must not block the check-in itself.
      if (payment.tenant_id && payment.apartment_id) {
        await supabase
          .from("bookings")
          .update({ status: "confirmed" })
          .eq("tenant_id", String(payment.tenant_id))
          .eq("apartment_id", payment.apartment_id)
          .eq("status", "pending")
        await supabase
          .from("apartments")
          .update({ is_available: false })
          .eq("id", payment.apartment_id)
      }

      // Tell the tenant by email that they have entered the apartment, with the
      // check-in day. Best-effort — an SMTP failure must not block the check-in.
      const tenantEmail = (payment as any).tenants?.email
      if (tenantEmail) {
        try {
          await sendCheckinEmail({
            to: tenantEmail,
            tenantName: (payment as any).tenants?.full_name,
            apartmentName: (payment as any).apartments?.name || `Apartment #${payment.apartment_id}`,
            checkinAt: update.verified_at,
            checkoutDate,
          })
        } catch (e) {
          console.error("Check-in email failed:", e)
        }
      }
    }

    // Resolve the receptionist's name (employee who checked the ticket)
    let checkedBy: string | null = null
    if (checkedById) {
      const { data: emp } = await supabase
        .from("employees")
        .select("full_name")
        .eq("id", checkedById)
        .single()
      checkedBy = emp?.full_name || `Staff #${checkedById}`
    }

    return NextResponse.json({
      valid: true,
      alreadyVerified,
      justChecked,
      verifiedAt,
      checkedBy,
      checkerWarning,
      receiptId: receipt.id,
      checkout: checkoutDate,
      details: { ...buildDetails(payment, receipt), checkout: checkoutDate },
    })
  } catch (err) {
    return errorResponse(err)
  }
}

function buildDetails(payment: any, receipt: any) {
  return {
    reference: payment.reference_number,
    tenant: payment.tenants?.full_name || receipt?.user_email || "—",
    email: payment.tenants?.email || receipt?.user_email || "—",
    apartment: payment.apartments?.name || `Apartment #${payment.apartment_id}`,
    amount: Number(payment.amount) || Number(receipt?.amount_paid) || 0,
    currency: (receipt?.currency || "rwf").toUpperCase(),
    status: payment.status,
    paidOn: payment.updated_at || receipt?.created_at,
  }
}
