import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { errorResponse } from "@/lib/auth/session";
import { parseJson, z, emailSchema } from "@/lib/auth/validate";
import { enforceRateLimit } from "@/lib/auth/rate-limit";

// ─────────────────────────────────────────────────────────────────────────────
// Signup uniqueness check.
//
// The registration form used to run these three queries itself, against the
// `tenants` table with the anon key:
//
//     supabase.from("tenants").select("id").ilike("email", entered)
//     supabase.from("tenants").select("id").eq("id_number", entered)
//
// Two problems. It required the browser to hold read access to `tenants` (which
// blocks RLS), and it is an oracle: anyone could sit on the endpoint and test
// whether an email address or a national ID number belongs to a resident here.
// The ID-number check is the worse of the two — it confirms a specific real
// person lives at this address.
//
// This route answers the same question with a boolean, behind a rate limit, and
// deliberately never says which field collided in a way that could be mined:
// the caller gets back exactly the flags it asked about.
// ─────────────────────────────────────────────────────────────────────────────

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const schema = z.object({
  username: z.string().trim().min(1).max(64).optional(),
  email: emailSchema.optional(),
  idNumber: z.string().trim().min(1).max(64).optional(),
});

export async function POST(request: NextRequest) {
  try {
    // The whole point of the endpoint is to answer "does this exist?", so the
    // rate limit is the control that stops it being enumerated at scale.
    await enforceRateLimit(request, "check-availability", 20, 10 * 60);

    const { username, email, idNumber } = await parseJson(request, schema);

    const [byUsername, byEmail, byId] = await Promise.all([
      username
        ? supabase.from("tenants").select("id").ilike("username", username).limit(1)
        : Promise.resolve({ data: null }),
      email
        ? supabase.from("tenants").select("id").ilike("email", email).limit(1)
        : Promise.resolve({ data: null }),
      idNumber
        ? supabase.from("tenants").select("id").eq("id_number", idNumber).limit(1)
        : Promise.resolve({ data: null }),
    ]);

    const taken = (r: { data: unknown[] | null }) => Boolean(r.data && r.data.length > 0);

    return NextResponse.json({
      usernameTaken: username ? taken(byUsername as { data: unknown[] | null }) : false,
      emailTaken: email ? taken(byEmail as { data: unknown[] | null }) : false,
      idNumberTaken: idNumber ? taken(byId as { data: unknown[] | null }) : false,
    });
  } catch (err) {
    return errorResponse(err);
  }
}
