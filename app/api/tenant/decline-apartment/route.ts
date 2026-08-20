import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { requireRole, errorResponse, HttpError } from "@/lib/auth/session"
import { parseJson, idSchema, z } from "@/lib/auth/validate"

export const dynamic = "force-dynamic"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || "",
)

// Tenant declines paying the balance on their apartment.
// We release the apartment (mark it available again), cancel the booking,
// and cancel any still-pending payments so it's free for someone else.
export async function POST(req: NextRequest) {
  try {
    const session = await requireRole(req, ["tenant"])
    const tenantId = session.sub

    const { bookingId, apartmentId } = await parseJson(
      req,
      z.object({ bookingId: idSchema.optional(), apartmentId: idSchema }),
    )

    // Verify this tenant actually holds the apartment before releasing it.
    // Without this any signed-in tenant could free someone else's apartment
    // and cancel their booking.
    const { data: ownBookings } = await supabase
      .from("bookings")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("apartment_id", apartmentId)
      .not("status", "eq", "cancelled")

    const owns = (ownBookings || []).some(
      (b) => bookingId === undefined || Number(b.id) === Number(bookingId),
    )
    if (!owns) {
      throw new HttpError(403, "This apartment is not booked under your account.")
    }

    // 1. Free the apartment so it shows as available again
    const { error: aptErr } = await supabase
      .from("apartments")
      .update({ is_available: true })
      .eq("id", Number(apartmentId))
    if (aptErr) {
      return NextResponse.json({ error: `Could not release the apartment: ${aptErr.message}` }, { status: 500 })
    }

    // 2. Cancel the booking
    if (bookingId) {
      await supabase.from("bookings").update({ status: "cancelled" }).eq("id", Number(bookingId))
    } else if (tenantId) {
      await supabase
        .from("bookings")
        .update({ status: "cancelled" })
        .eq("tenant_id", String(tenantId))
        .eq("apartment_id", Number(apartmentId))
    }

    // 3. Best-effort cleanup of the occupied table if it's used
    await supabase.from("occupied_apartments").delete().eq("apartment_id", Number(apartmentId))

    // 4. Cancel any still-pending payments for this apartment so they don't linger
    if (tenantId) {
      await supabase
        .from("tenant_payments")
        .update({ status: "cancelled" })
        .eq("apartment_id", Number(apartmentId))
        .eq("tenant_id", tenantId)
        .in("status", ["pending", "processing"])
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    return errorResponse(err)
  }
}
