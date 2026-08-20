import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import bcrypt from "bcryptjs";
import { errorResponse, HttpError } from "@/lib/auth/session";
import { enforceRateLimit, rejectObviousBots, rejectHoneypot } from "@/lib/auth/rate-limit";
import { parseJson, emailSchema, phoneSchema, passwordSchema, z } from "@/lib/auth/validate";
import { encryptFieldIfConfigured } from "@/lib/auth/field-encryption";

export const dynamic = "force-dynamic";

// Tenant self-registration.
//
// This used to be an anon-key INSERT straight from the browser, which meant the
// client chose every column value — including approval_status and is_active.
// Doing it here lets the server fix those, validate the input, and encrypt the
// national ID before it is stored.
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const registrationSchema = z.object({
  username: z
    .string()
    .trim()
    .toLowerCase()
    .min(3, "Username must be at least 3 characters.")
    .max(40)
    .regex(/^[a-z0-9._-]+$/, "Username may only contain letters, numbers, dots, dashes and underscores."),
  full_name: z.string().trim().min(2, "Please enter your full name.").max(120),
  email: emailSchema,
  password: passwordSchema,
  phone: phoneSchema,
  id_number: z.string().trim().min(5, "Please enter a valid ID number.").max(32),
  emergency_contact: z.string().trim().max(120).optional().default(""),
  emergency_contact_phone: z.string().trim().max(30).optional().default(""),
  address: z.string().trim().max(200).optional().default(""),
  city: z.string().trim().max(80).optional().default(""),
  country: z.string().trim().max(80).optional().default(""),
  /** Hidden field — humans leave it empty, naive bots fill it in. */
  website: z.string().max(200).optional(),
});

export async function POST(req: NextRequest) {
  try {
    rejectObviousBots(req);
    await enforceRateLimit(req, "tenant-register", 5, 60 * 60);

    const input = await parseJson(req, registrationSchema);
    rejectHoneypot(input.website);

    // The OTP flow must have verified this address before registration.
    const { data: otpRow } = await supabase
      .from("otp_codes")
      .select("is_verified")
      .eq("email", input.email)
      .limit(1);
    if (!otpRow?.[0]?.is_verified) {
      throw new HttpError(400, "Please verify your email address first.");
    }

    // Uniqueness checks (the database constraints are the real guarantee; these
    // just produce a friendlier message).
    const [{ data: byUsername }, { data: byEmail }] = await Promise.all([
      supabase.from("tenants").select("id").ilike("username", input.username).limit(1),
      supabase.from("tenants").select("id").ilike("email", input.email).limit(1),
    ]);
    if (byUsername?.length) throw new HttpError(409, "That username is already taken.");
    if (byEmail?.length) throw new HttpError(409, "That email is already registered.");

    const { data: created, error } = await supabase
      .from("tenants")
      .insert([
        {
          username: input.username,
          full_name: input.full_name,
          email: input.email,
          // Hashed here rather than in the browser, so the server never has to
          // trust that the client actually hashed it.
          password: await bcrypt.hash(input.password, 10),
          phone: input.phone,
          // Encrypted at the application layer — see lib/auth/field-encryption.
          id_number: encryptFieldIfConfigured(input.id_number),
          emergency_contact: input.emergency_contact,
          emergency_contact_phone: input.emergency_contact_phone,
          address: input.address,
          city: input.city,
          country: input.country,
          // Fixed by the server. A client-supplied INSERT could previously set
          // these to "approved"/true and self-approve the account.
          approval_status: "pending",
          is_active: false,
        },
      ])
      .select("id, full_name, email, approval_status")
      .single();

    if (error) {
      if (/duplicate|unique/i.test(error.message)) {
        throw new HttpError(409, "An account with those details already exists.");
      }
      console.error("Tenant registration insert failed:", error);
      throw new HttpError(500, "Registration failed. Please try again.");
    }

    // Only what the confirmation screen needs.
    return NextResponse.json({ ok: true, tenant: created });
  } catch (err) {
    return errorResponse(err);
  }
}
