import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { generateReceiptForPayment } from "@/lib/generate-receipt"
import { requireRole, errorResponse } from "@/lib/auth/session"

export const dynamic = "force-dynamic"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || "",
)

// A paid booking must always have its ticket. Some older payment flows marked a
// payment completed without generating the QR receipt — this backfills any that
// are missing for the tenant. Idempotent (generateReceiptForPayment skips
// payments that already have one) and sends no emails.
export async function POST(req: NextRequest) {
  try {
    // Backfills the caller's OWN tickets. The tenant comes from the session, so
    // this can no longer be pointed at someone else's payments.
    const session = await requireRole(req, ["tenant"])
    const tenantId = session.sub

    const { data: pays } = await supabase
      .from("tenant_payments")
      .select("id, apartment_id, amount, transaction_id, tenants(email)")
      .eq("tenant_id", tenantId)
      .eq("status", "completed")
    if (!pays || pays.length === 0) return NextResponse.json({ created: 0 })

    const { data: recs } = await supabase
      .from("receipts")
      .select("tenant_payment_id")
      .in("tenant_payment_id", pays.map((p) => p.id))
    const have = new Set((recs || []).map((r) => r.tenant_payment_id))

    let created = 0
    for (const p of pays) {
      if (have.has(p.id)) continue
      const result = await generateReceiptForPayment({
        tenantPaymentId: p.id,
        apartmentId: p.apartment_id,
        email: (p as any).tenants?.email,
        amount: Number(p.amount) || 0,
        currency: "rwf",
        transactionId: p.transaction_id,
      })
      if (result.created) created++
    }

    return NextResponse.json({ created })
  } catch (err) {
    return errorResponse(err)
  }
}
