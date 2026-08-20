import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { enforceRateLimit } from "@/lib/auth/rate-limit";

export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Increment a promo code's used_count after a booking actually used it.
// Re-checks validity so a code can't be over-redeemed past its limit.
export async function POST(request: NextRequest) {
  try {
    // Reachable from the public guest-booking flow, so it cannot require a
    // session — capped per IP instead so a script can't burn a code's
    // remaining redemptions.
    await enforceRateLimit(request, "promo-redeem", 20, 60 * 60);

    const { code } = await request.json();
    if (!code) return NextResponse.json({ ok: false }, { status: 400 });

    const normalized = String(code).trim().toUpperCase();
    const { data } = await supabase
      .from("promo_codes")
      .select("*")
      .ilike("code", normalized)
      .limit(1)
      .maybeSingle();

    if (!data || !data.active) return NextResponse.json({ ok: false }, { status: 200 });
    if (data.max_uses != null && data.used_count >= data.max_uses)
      return NextResponse.json({ ok: false }, { status: 200 });

    await supabase
      .from("promo_codes")
      .update({ used_count: (data.used_count || 0) + 1 })
      .eq("id", data.id);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Promo redeem error:", err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
