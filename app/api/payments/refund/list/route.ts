import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { requireRole, ADMIN_OR_MANAGER, errorResponse } from "@/lib/auth/session"

export const dynamic = "force-dynamic"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

const REFUND_DELAY_DAYS = 2
const DELAY_MS = REFUND_DELAY_DAYS * 24 * 60 * 60 * 1000

function paymentTime(p: any): number {
  const v = p.updated_at || p.payment_date || p.created_at
  return v ? new Date(v).getTime() : Date.now()
}

// All pending refund requests for the manager, with eligibility (2-day rule) computed.
export async function GET(req: NextRequest) {
  try {
    // Lists every pending refund with tenant names and emails — staff only.
    await requireRole(req, ADMIN_OR_MANAGER)

    const { data, error } = await supabase
      .from("tenant_payments")
      .select("*, tenants(full_name, email), apartments(name)")
      .eq("refund_status", "requested")
      .order("refund_requested_at", { ascending: true })

    if (error) {
      const hint = /column .*refund_status/.test(error.message)
        ? " — run the refund columns SQL (refund_status, refund_requested_at)."
        : ""
      return NextResponse.json({ error: error.message + hint, rows: [] }, { status: 500 })
    }

    const now = Date.now()
    const rows = (data || []).map((p: any) => {
      const eligibleAt = paymentTime(p) + DELAY_MS
      const eligible = now >= eligibleAt
      return {
        id: p.id,
        tenant: p.tenants?.full_name || p.tenants?.email || "Guest",
        email: p.tenants?.email || null,
        apartment: p.apartments?.name || (p.apartment_id ? `Apartment #${p.apartment_id}` : "—"),
        amount: Number(p.amount) || 0,
        reference: p.reference_number,
        requestedAt: p.refund_requested_at,
        eligible,
        eligibleAt: new Date(eligibleAt).toISOString(),
        hoursLeft: eligible ? 0 : Math.ceil((eligibleAt - now) / (60 * 60 * 1000)),
      }
    })

    return NextResponse.json({ count: rows.length, rows })
  } catch (err) {
    return errorResponse(err)
  }
}
