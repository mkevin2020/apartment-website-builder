import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Validate a promo code the tenant typed in. Returns the discount if the code is
// active, not expired, and hasn't hit its usage limit. Does NOT consume a use —
// that happens on booking (see /api/promo/redeem).
export async function POST(request: NextRequest) {
  try {
    const { code } = await request.json();
    if (!code || !String(code).trim()) {
      return NextResponse.json({ valid: false, error: "Enter a promo code." }, { status: 400 });
    }

    const normalized = String(code).trim().toUpperCase();

    const { data, error } = await supabase
      .from("promo_codes")
      .select("*")
      .ilike("code", normalized)
      .limit(1)
      .maybeSingle();

    if (error) {
      const missing = /relation .*promo_codes.* does not exist|could not find the table/i.test(error.message);
      return NextResponse.json(
        { valid: false, error: missing ? "Promo codes aren't set up yet." : error.message },
        { status: 500 }
      );
    }

    if (!data) {
      return NextResponse.json({ valid: false, error: "Invalid promo code." }, { status: 200 });
    }
    if (!data.active) {
      return NextResponse.json({ valid: false, error: "This promo code is no longer active." }, { status: 200 });
    }
    if (data.expires_at && new Date(data.expires_at) < new Date()) {
      return NextResponse.json({ valid: false, error: "This promo code has expired." }, { status: 200 });
    }
    if (data.max_uses != null && data.used_count >= data.max_uses) {
      return NextResponse.json({ valid: false, error: "This promo code has reached its usage limit." }, { status: 200 });
    }

    return NextResponse.json({
      valid: true,
      code: data.code,
      discount_percent: data.discount_percent,
    });
  } catch (err: any) {
    console.error("Promo validate error:", err);
    return NextResponse.json({ valid: false, error: "Failed to validate promo code." }, { status: 500 });
  }
}
