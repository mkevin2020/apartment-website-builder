import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { errorResponse } from "@/lib/auth/session";
import { enforceRateLimit } from "@/lib/auth/rate-limit";

// Initialize Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function POST(request: NextRequest) {
  try {
    // The per-record attempt counter below resets whenever a fresh OTP is
    // issued, so an attacker could otherwise cycle request-guess-request
    // through the whole 6-digit space. This caps guessing per IP as well.
    await enforceRateLimit(request, "otp-verify-ip", 20, 60 * 60);

    const { email, otp } = await request.json();

    if (email) {
      await enforceRateLimit(request, "otp-verify-addr", 10, 60 * 60, String(email).toLowerCase());
    }

    if (!email || !otp) {
      return NextResponse.json(
        { error: "Email and OTP are required" },
        { status: 400 }
      );
    }

    // Find OTP record
    const { data: otpRecord, error: queryError } = await supabase
      .from("otp_codes")
      .select("*")
      .eq("email", email)
      .single();

    if (queryError || !otpRecord) {
      return NextResponse.json(
        { error: "No OTP found for this email" },
        { status: 404 }
      );
    }

    // Check if OTP is already verified
    if (otpRecord.is_verified) {
      return NextResponse.json(
        { error: "OTP has already been verified" },
        { status: 400 }
      );
    }

    // Check if OTP has expired
    const expiresAt = new Date(otpRecord.expires_at);
    const now = new Date();
    
    // Add 1-second buffer for clock skew
    if (now.getTime() > expiresAt.getTime() + 1000) {
      return NextResponse.json(
        { error: "OTP has expired. Please request a new one." },
        { status: 400 }
      );
    }

    // Check max attempts
    if (otpRecord.attempts >= otpRecord.max_attempts) {
      return NextResponse.json(
        { error: "Maximum OTP attempts exceeded. Please request a new OTP." },
        { status: 400 }
      );
    }

    // Verify OTP
    if (otpRecord.otp_code !== otp) {
      // Increment attempts
      const { error: updateError } = await supabase
        .from("otp_codes")
        .update({ attempts: otpRecord.attempts + 1 })
        .eq("id", otpRecord.id);

      const remainingAttempts = otpRecord.max_attempts - (otpRecord.attempts + 1);
      return NextResponse.json(
        {
          error: "Incorrect OTP",
          remainingAttempts,
          message: remainingAttempts > 0 
            ? `Wrong OTP. ${remainingAttempts} attempt(s) remaining.`
            : "Maximum attempts exceeded. Please request a new OTP.",
        },
        { status: 400 }
      );
    }

    // OTP is correct - mark as verified
    const { error: verifyError } = await supabase
      .from("otp_codes")
      .update({
        is_verified: true,
        verified_at: new Date().toISOString(),
        attempts: otpRecord.attempts + 1,
      })
      .eq("id", otpRecord.id);

    if (verifyError) {
      return NextResponse.json(
        { error: "Failed to verify OTP" },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: "OTP verified successfully",
        email: email,
      },
      { status: 200 }
    );
  } catch (error) {
    return errorResponse(error);
  }
}
