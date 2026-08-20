import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { requireRole, errorResponse } from "@/lib/auth/session"
import { parseJson, idSchema, z } from "@/lib/auth/validate"

export const dynamic = "force-dynamic"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || "",
)

// Format a Date as yyyy-mm-dd using local calendar parts — toISOString() would
// shift local midnight to the previous UTC day in UTC+ timezones like Kigali's.
function fmt(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

// Add n months to a yyyy-mm-dd date, returning yyyy-mm-dd
function addMonths(dateStr: string, n: number): string {
  const d = new Date(dateStr + "T00:00:00")
  d.setMonth(d.getMonth() + n)
  return fmt(d)
}

// Add n days to a yyyy-mm-dd date, returning yyyy-mm-dd
function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + "T00:00:00")
  d.setDate(d.getDate() + n)
  return fmt(d)
}

// Tenant accepted the check-out notice and paid a top-up to extend their stay.
// Convert the money paid on/after the check-out date into extra time and push
// the booking's end_date forward, so the "check-out date reached" notice clears.
// Idempotent: only payments dated on/after the CURRENT end_date count, and
// extending moves end_date past them, so a second call finds nothing to apply.
export async function POST(req: NextRequest) {
  try {
    // The booking-belongs-to-tenant check below is only meaningful if the
    // tenant identity is trustworthy, so take it from the session rather than
    // the request body.
    const session = await requireRole(req, ["tenant"])
    const tenantId = session.sub

    const { bookingId } = await parseJson(req, z.object({ bookingId: idSchema }))

    const { data: booking, error: bkErr } = await supabase
      .from("bookings")
      .select("*")
      .eq("id", Number(bookingId))
      .single()
    if (bkErr || !booking) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 })
    }
    if (String(booking.tenant_id) !== String(tenantId)) {
      return NextResponse.json({ error: "Booking does not belong to this tenant" }, { status: 403 })
    }
    if (booking.status === "cancelled" || !booking.end_date) {
      return NextResponse.json({ extended: false, newEndDate: booking.end_date })
    }

    const { data: apt } = await supabase
      .from("apartments")
      .select("price_per_month, price_per_day")
      .eq("id", booking.apartment_id)
      .single()
    const monthly = Number(apt?.price_per_month) || 0
    const daily = Number(apt?.price_per_day) || 0

    // Completed top-ups made on/after the current end date are the extension money
    const { data: pays } = await supabase
      .from("tenant_payments")
      .select("amount, payment_date, status")
      .eq("tenant_id", tenantId)
      .eq("apartment_id", booking.apartment_id)
      .eq("status", "completed")
      .gte("payment_date", booking.end_date)
    const paid = (pays || []).reduce((s, p) => s + (Number(p.amount) || 0), 0)

    if (paid <= 0) {
      return NextResponse.json({ extended: false, newEndDate: booking.end_date })
    }

    // Whole months first, then leftover as days (via the daily rate, or a
    // 30-day prorate of the monthly rate when no daily price is set).
    let newEnd = booking.end_date as string
    let remaining = paid
    if (monthly > 0) {
      const months = Math.floor(remaining / monthly)
      if (months > 0) {
        newEnd = addMonths(newEnd, months)
        remaining -= months * monthly
      }
    }
    const dayPrice = daily > 0 ? daily : monthly > 0 ? monthly / 30 : 0
    if (dayPrice > 0) {
      const days = Math.floor(remaining / dayPrice)
      if (days > 0) newEnd = addDays(newEnd, days)
    }
    // They paid something — grant at least one day so the notice clears fairly
    if (newEnd === booking.end_date) newEnd = addDays(newEnd, 1)

    // Optimistic guard: only apply if end_date hasn't moved since we read it,
    // so two overlapping calls can't both extend.
    const { data: updated, error: upErr } = await supabase
      .from("bookings")
      .update({ end_date: newEnd })
      .eq("id", booking.id)
      .eq("end_date", booking.end_date)
      .select("end_date")
    if (upErr) {
      return NextResponse.json({ error: `Could not extend the stay: ${upErr.message}` }, { status: 500 })
    }
    if (!updated || updated.length === 0) {
      // Someone else extended first — report the current value
      const { data: fresh } = await supabase.from("bookings").select("end_date").eq("id", booking.id).single()
      return NextResponse.json({ extended: false, newEndDate: fresh?.end_date || booking.end_date })
    }

    // Keep the apartment marked occupied while the extended stay runs
    await supabase.from("apartments").update({ is_available: false }).eq("id", booking.apartment_id)

    return NextResponse.json({ extended: true, newEndDate: newEnd })
  } catch (err) {
    return errorResponse(err)
  }
}
