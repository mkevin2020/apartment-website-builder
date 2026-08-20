import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import bcrypt from "bcryptjs";
import { errorResponse, HttpError } from "@/lib/auth/session";
import { parseJson, z, emailSchema, passwordSchema } from "@/lib/auth/validate";
import { enforceRateLimit } from "@/lib/auth/rate-limit";
import { recordAudit } from "@/lib/audit";
import { revokeAllForAccount } from "@/lib/auth/revocation";

// ─────────────────────────────────────────────────────────────────────────────
// Complete a forgotten-password reset.
//
// The three forgot-password pages previously finished the reset in the browser:
//
//     await supabase.from("tenants")
//       .update({ password: hashed })
//       .ilike("email", enteredEmail)
//
// with the anon key. Because RLS is off, that statement works for ANY caller
// against ANY email — the OTP check sat in client-side JavaScript and could
// simply be skipped. Anyone who read the bundle could take over any tenant,
// employee or manager account without ever receiving an OTP.
//
// Here the OTP is re-verified server-side against otp_codes as part of the same
// request that writes the password. The client's claim to have verified it
// earlier counts for nothing.
// ─────────────────────────────────────────────────────────────────────────────

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

/** Account tables that support email-based reset, in lookup order. */
const RESET_TABLES = [
  { table: "tenants", role: "tenant" },
  { table: "employees", role: "employee" },
  { table: "managers", role: "manager" },
] as const;

const bodySchema = z.object({
  email: emailSchema,
  otp: z.string().trim().regex(/^\d{4,8}$/, "Enter the code from your email."),
  newPassword: passwordSchema,
  /** Optional hint; the account is still located by email regardless. */
  accountType: z.enum(["tenant", "employee", "manager"]).optional(),
});

export async function POST(request: NextRequest) {
  try {
    await enforceRateLimit(request, "password-reset-ip", 10, 60 * 60);

    const { email, otp, newPassword, accountType } = await parseJson(request, bodySchema);
    await enforceRateLimit(request, "password-reset-addr", 5, 60 * 60, email);

    // ── 1. The OTP must be present, unexpired, unspent, and correct ─────────
    const { data: otpRecord } = await supabase
      .from("otp_codes")
      .select("*")
      .ilike("email", email)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    // One message for every failure mode below, so this cannot be used to
    // discover which addresses have accounts or pending resets.
    const invalid = () =>
      new HttpError(400, "That code is invalid or has expired. Please request a new one.");

    if (!otpRecord) throw invalid();

    if (new Date(otpRecord.expires_at).getTime() + 1000 < Date.now()) throw invalid();

    if (otpRecord.attempts >= otpRecord.max_attempts) throw invalid();

    if (String(otpRecord.otp_code) !== otp) {
      // Burn an attempt so this endpoint cannot be used to brute-force the code
      // independently of /api/auth/verify-otp.
      await supabase
        .from("otp_codes")
        .update({ attempts: (otpRecord.attempts ?? 0) + 1 })
        .eq("id", otpRecord.id);

      await recordAudit(
        {
          action: "auth.password.reset",
          outcome: "denied",
          metadata: { reason: "wrong otp", email },
        },
        { req: request },
      );
      throw invalid();
    }

    // ── 2. Locate the account ───────────────────────────────────────────────
    const candidates = accountType
      ? RESET_TABLES.filter((t) => t.role === accountType)
      : RESET_TABLES;

    let found: { table: string; role: string; id: number } | null = null;
    for (const { table, role } of candidates) {
      const { data } = await supabase
        .from(table)
        .select("id")
        .ilike("email", email)
        .limit(1);
      if (data && data.length > 0) {
        found = { table, role, id: data[0].id };
        break;
      }
    }

    // Consume the OTP whether or not an account matched, so a spent code cannot
    // be replayed while the attacker hunts for the right accountType.
    await supabase
      .from("otp_codes")
      .update({
        is_verified: true,
        verified_at: new Date().toISOString(),
        attempts: (otpRecord.attempts ?? 0) + 1,
      })
      .eq("id", otpRecord.id);

    if (!found) throw invalid();

    // ── 3. Write the new password ───────────────────────────────────────────
    const hashed = await bcrypt.hash(newPassword, 12);
    const { error: updateError } = await supabase
      .from(found.table)
      .update({ password: hashed })
      .eq("id", found.id);

    if (updateError) {
      console.error("Password reset write failed:", updateError);
      throw new HttpError(500, "Could not reset your password. Please try again.");
    }

    // A forgotten-password reset is exactly the case where someone else may be
    // holding a live session for this account. Kill all of them.
    await revokeAllForAccount(found.role, found.id, "password reset via OTP");

    await recordAudit(
      {
        action: "auth.password.reset",
        target: `${found.role}:${found.id}`,
        metadata: { via: "otp" },
      },
      { req: request },
    );

    return NextResponse.json({ success: true, accountType: found.role });
  } catch (err) {
    return errorResponse(err);
  }
}
