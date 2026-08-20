import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { requireRole, ADMIN_OR_MANAGER, errorResponse } from "@/lib/auth/session"
import { parseJson, idSchema, z } from "@/lib/auth/validate"
import { recordAudit } from "@/lib/audit";

export const dynamic = "force-dynamic"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || "",
)

// Delete a tenant and RELEASE any apartments they were holding (make them available),
// cleaning up the related bookings, occupancy, payments and receipts so nothing is orphaned.
export async function POST(req: NextRequest) {
  try {
    // Destructive and irreversible (deletes bookings, payments and receipts) —
    // staff only.
    const session = await requireRole(req, ADMIN_OR_MANAGER)

    const { tenantId } = await parseJson(req, z.object({ tenantId: idSchema }))

    // 1. Find the apartments this tenant is holding (via their bookings)
    const { data: bookings } = await supabase
      .from("bookings")
      .select("apartment_id")
      .eq("tenant_id", tenantId)
    const apartmentIds = Array.from(
      new Set((bookings || []).map((b) => b.apartment_id).filter((x) => x != null)),
    )

    // 2. Release those apartments → available again
    if (apartmentIds.length > 0) {
      await supabase.from("apartments").update({ is_available: true }).in("id", apartmentIds)
      // best-effort: clear the occupied table if present
      await supabase.from("occupied_apartments").delete().in("apartment_id", apartmentIds)
    }

    // 3. Remove the tenant's bookings
    await supabase.from("bookings").delete().eq("tenant_id", tenantId)

    // 4. Remove the tenant's payments + their receipts (receipts FK -> tenant_payments)
    const { data: payments } = await supabase
      .from("tenant_payments")
      .select("id")
      .eq("tenant_id", tenantId)
    const paymentIds = (payments || []).map((p) => p.id)
    if (paymentIds.length > 0) {
      await supabase.from("receipts").delete().in("tenant_payment_id", paymentIds)
    }
    await supabase.from("receipts").delete().eq("tenant_id", tenantId) // any receipts linked directly
    await supabase.from("tenant_payments").delete().eq("tenant_id", tenantId)

    // 5. Finally delete the tenant
    const { error } = await supabase.from("tenants").delete().eq("id", tenantId)
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Destructive and cascading — this is the single most important entry in
    // the trail, since afterwards there is no tenant row left to inspect.
    await recordAudit(
      {
        action: "tenant.deleted",
        target: `tenants:${tenantId}`,
        metadata: {
          freed_apartments: apartmentIds.length,
          deleted_payments: paymentIds.length,
        },
      },
      { req, session }
    )

    return NextResponse.json({ ok: true, freedApartments: apartmentIds.length })
  } catch (err) {
    return errorResponse(err)
  }
}
