import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireRole, errorResponse } from "@/lib/auth/session";
import { parseJson, z, idSchema, amountSchema } from "@/lib/auth/validate";
import { enforceRateLimit } from "@/lib/auth/rate-limit";

// ─────────────────────────────────────────────────────────────────────────────
// Server-side data for the tenant payments page.
//
// The page previously talked to Supabase directly from the browser with the
// anon key, which had two consequences:
//
//   1. It was the last blocker on enabling Row Level Security (scripts/029) —
//      with RLS on, those anon-key reads return nothing.
//   2. The "Make a Payment" flow INSERTed into tenant_payments with a tenant_id
//      read out of localStorage, so an invoice could be created against any
//      tenant, for any amount, by editing one value in devtools.
//
// Both now go through the signed session cookie: the tenant id comes from
// session.sub and is never accepted from the client.
// ─────────────────────────────────────────────────────────────────────────────

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

/** GET — everything the payments page renders, scoped to the caller. */
export async function GET(request: NextRequest) {
  try {
    const session = await requireRole(request, ["tenant"]);
    const tenantId = session.sub;

    const { data: payments, error: paymentsError } = await supabase
      .from("tenant_payments")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("due_date", { ascending: false });

    if (paymentsError) throw paymentsError;

    // Apartments referenced by those payments, for display names.
    const apartmentIds = [
      ...new Set((payments || []).map((p) => p.apartment_id).filter((id) => id != null)),
    ];
    let apartments: Record<number, unknown> = {};
    if (apartmentIds.length > 0) {
      const { data: apartmentRows } = await supabase
        .from("apartments")
        // Only columns that exist. An earlier version also asked for
        // building_number / floor_number / apartment_number, which are not in
        // the apartments table — PostgREST rejects the whole select with 42703,
        // so the lookup returned nothing and unit names rendered blank.
        .select("id, name, type, price_per_month, price_per_day, bedrooms, bathrooms, size_sqm")
        .in("id", apartmentIds);
      apartments = (apartmentRows || []).reduce(
        (acc, apt) => {
          acc[apt.id] = apt;
          return acc;
        },
        {} as Record<number, unknown>,
      );
    }

    // Apartments the tenant still holds, for the "Make a Payment" dropdown.
    // Same rules as before: a cancelled/rejected/declined booking means they
    // gave it up, and a booking past its check-out date is over.
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
      now.getDate(),
    ).padStart(2, "0")}`;

    const { data: bookings } = await supabase
      .from("bookings")
      .select("apartment_id")
      .eq("tenant_id", String(tenantId))
      .not("status", "in", "(cancelled,rejected,declined)")
      .gte("end_date", todayStr);

    const heldIds = [
      ...new Set((bookings || []).map((b) => b.apartment_id).filter(Boolean)),
    ];

    // "Accept & Top Up" can arrive with an apartment whose stay just ended —
    // keep it selectable so the extension can be paid. Validated as an id, and
    // only honoured if this tenant has ever booked it.
    const requested = Number(request.nextUrl.searchParams.get("apartment_id"));
    if (Number.isInteger(requested) && requested > 0 && !heldIds.includes(requested)) {
      const { data: everBooked } = await supabase
        .from("bookings")
        .select("apartment_id")
        .eq("tenant_id", String(tenantId))
        .eq("apartment_id", requested)
        .limit(1);
      if (everBooked && everBooked.length > 0) heldIds.push(requested);
    }

    let tenantApartments: unknown[] = [];
    if (heldIds.length > 0) {
      const { data: aptRows } = await supabase
        .from("apartments")
        .select("*")
        .in("id", heldIds);
      tenantApartments = aptRows || [];
    }

    return NextResponse.json({
      payments: payments || [],
      apartments,
      tenantApartments,
    });
  } catch (err) {
    return errorResponse(err);
  }
}

/** POST — create a pending invoice for the caller's own apartment. */
const createSchema = z.object({
  apartmentId: idSchema,
  amount: amountSchema,
});

export async function POST(request: NextRequest) {
  try {
    const session = await requireRole(request, ["tenant"]);
    // Invoice creation is cheap but not free — cap it.
    await enforceRateLimit(request, "tenant-invoice", 20, 60 * 60, String(session.sub));

    const { apartmentId, amount } = await parseJson(request, createSchema);

    // The tenant must actually hold this apartment. Without this check, the
    // amount and apartment could be pointed anywhere.
    const { data: booking } = await supabase
      .from("bookings")
      .select("id")
      .eq("tenant_id", String(session.sub))
      .eq("apartment_id", apartmentId)
      .not("status", "in", "(cancelled,rejected,declined)")
      .limit(1);

    if (!booking || booking.length === 0) {
      throw Object.assign(new Error("not-held"), { status: 403 });
    }

    const today = new Date().toISOString().split("T")[0];
    const referenceNumber = `PAY-${new Date().getFullYear()}-${Math.floor(
      Math.random() * 900000 + 100000,
    )}`;

    const { data: newPayment, error: insertError } = await supabase
      .from("tenant_payments")
      .insert({
        // From the signed session, never from the request body.
        tenant_id: session.sub,
        apartment_id: apartmentId,
        amount,
        payment_date: today,
        due_date: today,
        status: "pending",
        reference_number: referenceNumber,
      })
      .select("*")
      .single();

    if (insertError) throw insertError;

    return NextResponse.json({ payment: newPayment });
  } catch (err) {
    if (err && typeof err === "object" && (err as { status?: number }).status === 403) {
      return NextResponse.json(
        { error: "You can only create a payment for an apartment you currently hold." },
        { status: 403 },
      );
    }
    return errorResponse(err);
  }
}
