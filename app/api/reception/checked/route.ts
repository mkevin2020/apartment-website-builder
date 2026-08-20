import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { requireRole, STAFF, errorResponse } from "@/lib/auth/session"

export const dynamic = "force-dynamic"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || "",
)

// Returns checked-in (verified) tickets.
//  - ?employee_id=N  -> only the tickets that receptionist checked (reception dashboard)
//  - no param        -> all checked tickets + who checked them (manager view)
export async function GET(req: NextRequest) {
  try {
    // Guest emails and payment amounts — reception staff only.
    await requireRole(req, STAFF)

    const employeeId = req.nextUrl.searchParams.get("employee_id")

    let query = supabase
      .from("receipts")
      .select("id, tenant_payment_id, user_email, amount_paid, currency, verified_at, verified_by_admin_id")
      .eq("is_verified", true)
      .order("verified_at", { ascending: false })
      .limit(200)

    if (employeeId) query = query.eq("verified_by_admin_id", Number(employeeId))

    const { data: receipts, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const rows = receipts || []

    // Enrich with the payment reference + apartment name, and the receptionist's name
    const paymentIds = Array.from(new Set(rows.map((r) => r.tenant_payment_id).filter(Boolean)))
    const checkerIds = Array.from(new Set(rows.map((r) => r.verified_by_admin_id).filter(Boolean)))

    const paymentsMap: Record<number, any> = {}
    if (paymentIds.length) {
      const { data: pays } = await supabase
        .from("tenant_payments")
        .select("id, reference_number, apartment_id, tenants(full_name), apartments(name)")
        .in("id", paymentIds)
      ;(pays || []).forEach((p: any) => (paymentsMap[p.id] = p))
    }

    const checkerMap: Record<number, string> = {}
    if (checkerIds.length) {
      const { data: emps } = await supabase.from("employees").select("id, full_name").in("id", checkerIds)
      ;(emps || []).forEach((e: any) => (checkerMap[e.id] = e.full_name))
    }

    const tickets = rows.map((r) => {
      const p = paymentsMap[r.tenant_payment_id as number]
      return {
        id: r.id,
        reference: p?.reference_number || "—",
        tenant: p?.tenants?.full_name || r.user_email || "—",
        apartment: p?.apartments?.name || (p?.apartment_id ? `Apartment #${p.apartment_id}` : "—"),
        amount: Number(r.amount_paid) || 0,
        currency: (r.currency || "rwf").toUpperCase(),
        checkedAt: r.verified_at,
        checkedBy: r.verified_by_admin_id ? checkerMap[r.verified_by_admin_id as number] || `Staff #${r.verified_by_admin_id}` : "—",
      }
    })

    return NextResponse.json({ count: tickets.length, tickets })
  } catch (err: any) {
    console.error("Checked tickets error:", err)
    return NextResponse.json({ error: err?.message || "Failed" }, { status: 500 })
  }
}
