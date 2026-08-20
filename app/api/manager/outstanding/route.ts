import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { requireRole, ADMIN_OR_MANAGER, errorResponse } from "@/lib/auth/session"

export const dynamic = "force-dynamic"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || "",
)

// Upfront share a tenant pays when booking; the rest is the outstanding balance.
// Kept in step with app/tenant/dashboard/page.tsx and TenantNotificationBell.
const DEPOSIT_RATE = 0.4

export type OutstandingRow = {
  tenantId: string
  tenant: string
  email: string | null
  phone: string | null
  apartment: string
  bookingId: number | null
  startDate: string | null
  endDate: string | null
  total: number
  paid: number
  outstanding: number
  pendingAmount: number
  pendingCount: number
  /** "pending" = money in flight; "balance" = deposit paid, remainder never started */
  kind: "pending" | "balance"
}

export async function GET(req: NextRequest) {
  try {
    // Names, emails, phone numbers and debts for every tenant — staff only.
    await requireRole(req, ADMIN_OR_MANAGER)

    const [bookingsRes, paymentsRes, apartmentsRes, tenantsRes] = await Promise.all([
      supabase
        .from("bookings")
        .select("id,tenant_id,apartment_id,client_name,email,status,start_date,end_date")
        .not("tenant_id", "is", null),
      supabase.from("tenant_payments").select("id,tenant_id,apartment_id,amount,status,reference_number,due_date"),
      supabase.from("apartments").select("id,name,price_per_month"),
      supabase.from("tenants").select("id,full_name,email,phone"),
    ])

    const bookings = bookingsRes.data || []
    const payments = paymentsRes.data || []
    const apartments = apartmentsRes.data || []
    const tenants = tenantsRes.data || []

    const aptById = new Map(apartments.map((a: any) => [String(a.id), a]))
    const tenantById = new Map(tenants.map((t: any) => [String(t.id), t]))

    // Latest confirmed booking per tenant — that's the stay they currently owe on.
    // bookings.tenant_id is varchar while tenant_payments.tenant_id is integer,
    // so every comparison goes through String().
    const latestByTenant = new Map<string, any>()
    for (const b of bookings) {
      if (b.status !== "confirmed") continue
      const key = String(b.tenant_id)
      const prev = latestByTenant.get(key)
      if (!prev || String(b.start_date || "") > String(prev.start_date || "")) {
        latestByTenant.set(key, b)
      }
    }

    const rows: OutstandingRow[] = []

    for (const [tenantId, booking] of latestByTenant) {
      const mine = payments.filter((p: any) => String(p.tenant_id) === tenantId)

      const paid = mine
        .filter((p: any) => p.status === "completed")
        .reduce((s: number, p: any) => s + (Number(p.amount) || 0), 0)

      const pendingRows = mine.filter((p: any) => p.status === "pending" || p.status === "processing")
      const pendingAmount = pendingRows.reduce((s: number, p: any) => s + (Number(p.amount) || 0), 0)

      // Recover the full booking price: newer rows store the total (ref "BKG-"),
      // legacy ones stored only the deposit (ref "DEP-") and need scaling back up.
      const bookingPay = mine.find((p: any) => {
        const ref = String(p.reference_number || "")
        return ref.startsWith("BKG-") || ref.startsWith("DEP-")
      })
      let total = 0
      if (bookingPay) {
        const ref = String(bookingPay.reference_number || "")
        const amt = Number(bookingPay.amount) || 0
        total = ref.startsWith("DEP-") ? amt / DEPOSIT_RATE : amt
      }
      const apt = aptById.get(String(booking.apartment_id))
      if (!total) total = Number(apt?.price_per_month) || 0

      const outstanding = Math.max(0, Math.round(total - paid))
      if (outstanding <= 0 && pendingAmount <= 0) continue

      const t = tenantById.get(tenantId)
      rows.push({
        tenantId,
        tenant: t?.full_name || booking.client_name || "Unknown tenant",
        email: t?.email || booking.email || null,
        phone: t?.phone || null,
        apartment: apt?.name || "—",
        bookingId: booking.id ?? null,
        startDate: booking.start_date ?? null,
        endDate: booking.end_date ?? null,
        total: Math.round(total),
        paid: Math.round(paid),
        outstanding,
        pendingAmount: Math.round(pendingAmount),
        pendingCount: pendingRows.length,
        kind: pendingRows.length > 0 ? "pending" : "balance",
      })
    }

    rows.sort((a, b) => b.outstanding - a.outstanding)

    return NextResponse.json({
      rows,
      depositRate: DEPOSIT_RATE,
      totals: {
        outstanding: rows.reduce((s, r) => s + r.outstanding, 0),
        pending: rows.reduce((s, r) => s + r.pendingAmount, 0),
      },
    })
  } catch (err) {
    return errorResponse(err)
  }
}
