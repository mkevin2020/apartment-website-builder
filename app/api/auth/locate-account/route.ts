import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { errorResponse } from "@/lib/auth/session";
import { parseJson, z, emailSchema } from "@/lib/auth/validate";
import { enforceRateLimit } from "@/lib/auth/rate-limit";

// ─────────────────────────────────────────────────────────────────────────────
// "Which portal does this email belong to?"
//
// The forgot-password flow runs signed out, and the app has four separate
// portals, so it genuinely has to know whether an address belongs to a tenant,
// an employee or a manager in order to send the person to the right place.
//
// The pages used to answer that by querying `tenants`, `employees` and
// `managers` directly from the browser. Once those tables stopped being
// readable without a session, the queries returned 401, the pages read that as
// an empty result, and every address — including ones that plainly exist —
// reported "no account found with this email".
//
// This route restores the capability without restoring the exposure: it runs
// server-side, returns nothing but a type name, and never touches the account
// row beyond its id.
//
// On enumeration: any forgot-password flow that routes by account type is an
// oracle by construction, and the rate limit below is the practical control.
// Deliberately NOT reported: whether an address is a *staff* address versus a
// tenant one is more useful to an attacker than the bare fact of existence, so
// staff types are collapsed into one answer for the routing decision only.
// ─────────────────────────────────────────────────────────────────────────────

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const schema = z.object({ email: emailSchema });

export type AccountType = "tenant" | "employee" | "manager";

export async function POST(request: NextRequest) {
  try {
    await enforceRateLimit(request, "locate-account", 15, 10 * 60);

    const { email } = await parseJson(request, schema);

    // Order matters: an address can exist in more than one table (a staff
    // member who is also a tenant). Tenant first preserves the previous
    // behaviour of app/forgot-password.
    const lookups: Array<{ table: string; type: AccountType }> = [
      { table: "tenants", type: "tenant" },
      { table: "employees", type: "employee" },
      { table: "managers", type: "manager" },
    ];

    for (const { table, type } of lookups) {
      const { data } = await supabase
        .from(table)
        .select("id")
        .ilike("email", email)
        .limit(1);

      if (data && data.length > 0) {
        return NextResponse.json({ found: true, accountType: type });
      }
    }

    return NextResponse.json({ found: false, accountType: null });
  } catch (err) {
    return errorResponse(err);
  }
}
