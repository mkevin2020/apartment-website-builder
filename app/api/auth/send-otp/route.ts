import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import nodemailer from "nodemailer";
import { sendIntouchSMS } from "@/lib/intouch-sms";
import { errorResponse } from "@/lib/auth/session";
import { enforceRateLimit, rejectObviousBots } from "@/lib/auth/rate-limit";

// Initialize Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Initialize nodemailer
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
});

// Generate 6-digit OTP.
// crypto.getRandomValues, not Math.random: Math.random is a predictable PRNG,
// so an attacker who sees a few codes can narrow down the next one — and this
// code is what guards account registration and password reset.
function generateOTP(): string {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return String(100000 + (buf[0] % 900000));
}

export async function POST(request: NextRequest) {
  try {
    // Each OTP costs an email or an SMS, so cap both the sender and the target
    // address before doing any work.
    rejectObviousBots(request);
    await enforceRateLimit(request, "otp-send-ip", 10, 60 * 60);

    // channel: where the tenant wants the OTP — "email" (default) or "sms".
    const { email, flowType = "registration", phone, channel = "email" } = await request.json();

    if (email) {
      await enforceRateLimit(request, "otp-send-addr", 5, 60 * 60, String(email).toLowerCase());
    }

    // ── SMS toll-fraud cap ──────────────────────────────────────────────────
    //
    // Every SMS is billed to the business, and the destination number for the
    // registration flow arrives in the request body — so without a per-NUMBER
    // cap, one caller could rotate the `email` field to dodge the address limit
    // above and pump paid messages at a single number (or at many numbers, to
    // burn credit). The per-IP limit alone does not cover a distributed caller.
    //
    // Normalised to digits so "+250 78..." and "078..." share one bucket rather
    // than being counted as two different numbers.
    if (channel === "sms" && phone) {
      const normalised = String(phone).replace(/[^0-9]/g, "").slice(-9);
      if (normalised) {
        await enforceRateLimit(request, "otp-send-phone", 3, 60 * 60, normalised);
      }
    }

    if (!email) {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: "Invalid email format" },
        { status: 400 }
      );
    }

    // For registration: check if email already exists
    if (flowType === "registration") {
      const { data: existingTenant } = await supabase
        .from("tenants")
        .select("id")
        .ilike("email", email)
        .limit(1);

      if (existingTenant && existingTenant.length > 0) {
        return NextResponse.json(
          { error: "Email already registered" },
          { status: 400 }
        );
      }
    }

    // For forgot-password: email MUST exist. Also grab the phone so we can SMS the OTP.
    let tenantPhone: string | null = null;
    if (flowType === "forgot-password") {
      const { data: tenant } = await supabase
        .from("tenants")
        .select("id, phone")
        .ilike("email", email)
        .limit(1);

      if (!tenant || tenant.length === 0) {
        return NextResponse.json(
          { error: "Email not found" },
          { status: 404 }
        );
      }
      tenantPhone = (tenant[0] as any).phone || null;
    }

    // Generate OTP
    const otpCode = generateOTP();

    // Delete any existing OTP for this email (case-insensitive)
    await supabase.from("otp_codes").delete().ilike("email", email);

    // Store OTP in database
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 15 * 60 * 1000); // 15 minutes
    
    console.log("OTP Send Debug Info:", {
      email,
      flowType,
      created_at: now.toISOString(),
      expires_at: expiresAt.toISOString(),
      expiresInMs: 15 * 60 * 1000,
    });
    
    const { error: insertError } = await supabase
      .from("otp_codes")
      .insert({
        email,
        otp_code: otpCode,
        user_type: "tenant",
        attempts: 0,
        created_at: now.toISOString(),
        expires_at: expiresAt.toISOString(),
      });

    if (insertError) {
      console.error("Error storing OTP:", insertError);
      return NextResponse.json(
        { error: "Failed to generate OTP" },
        { status: 500 }
      );
    }

    // Deliver the OTP on the channel the tenant chose.
    //
    // forgot-password uses the number ON FILE — the caller cannot redirect
    // someone else's reset code to a phone they control.
    //
    // registration necessarily uses the number from the form (there is no
    // account yet to look it up on), which is why the per-number cap above
    // exists: it is the only thing standing between this endpoint and an
    // attacker using it as a free SMS pump. The message body is fixed below and
    // never taken from the request, so it cannot be used to send arbitrary text.
    const otpPhone = flowType === "forgot-password" ? tenantPhone : phone;
    const label = flowType === "forgot-password" ? "password reset" : "verification";
    const phoneMessage = `Cielo Vista: Your ${label} code is ${otpCode}. It expires in 15 minutes. Do not share it with anyone.`;

    if (channel === "sms") {
      if (!otpPhone) {
        return NextResponse.json(
          { error: "No phone number available for this account" },
          { status: 400 }
        );
      }
      const result = await sendIntouchSMS(otpPhone, phoneMessage);
      if (!result.success) {
        return NextResponse.json(
          { error: "Could not send the SMS. Please choose email instead." },
          { status: 502 }
        );
      }
      return NextResponse.json(
        { success: true, message: "OTP sent by SMS", email },
        { status: 200 }
      );
    }

    // Default channel: email
    try {
      await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: email,
        subject: "Your OTP for Account Verification - Cielo Vista",
        html: `
          <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
              <div style="text-align: center; margin-bottom: 30px;">
                <h2 style="color: #2563eb; margin: 0;">Cielo Vista</h2>
                <p style="color: #666; margin: 5px 0;">Account Verification</p>
              </div>

              <div style="background-color: #f0f9ff; border-left: 4px solid #2563eb; padding: 20px; margin-bottom: 20px;">
                <h3 style="margin-top: 0; color: #1e40af;">Email Verification Required</h3>
                <p>Thank you for creating an account with Cielo Vista. To complete your registration, please enter the following OTP code:</p>
              </div>

              <div style="text-align: center; background-color: #f3f4f6; padding: 30px; border-radius: 8px; margin-bottom: 20px;">
                <div style="font-size: 36px; font-weight: bold; letter-spacing: 2px; color: #2563eb; font-family: 'Courier New', monospace;">
                  ${otpCode}
                </div>
                <p style="color: #666; margin-top: 10px;">This code expires in 15 minutes</p>
              </div>

              <div style="background-color: #fef3c7; border: 1px solid #fcd34d; border-radius: 8px; padding: 15px; margin-bottom: 20px;">
                <p style="margin: 0; color: #92400e;"><strong>⚠️ Security Note:</strong> Never share this OTP with anyone. Cielo Vista support will never ask for your OTP.</p>
              </div>

              <div style="color: #666; font-size: 14px; line-height: 1.8;">
                <p><strong>If you didn't create this account:</strong></p>
                <p>Please ignore this email. If you continue to receive emails, please contact our support team.</p>
              </div>

              <div style="border-top: 1px solid #e5e7eb; padding-top: 20px; margin-top: 30px; text-align: center; color: #999; font-size: 12px;">
                <p style="margin: 0;">© 2024 Cielo Vista. All rights reserved.</p>
                <p style="margin: 5px 0;">This is an automated message. Please do not reply.</p>
              </div>
            </div>
          </div>
        `,
      });
    } catch (emailError) {
      console.error("Error sending email:", emailError);
      // Don't fail the request if email fails - OTP is still generated
    }

    return NextResponse.json(
      {
        success: true,
        message: "OTP sent to your email",
        email: email,
      },
      { status: 200 }
    );
  } catch (error) {
    return errorResponse(error);
  }
}
