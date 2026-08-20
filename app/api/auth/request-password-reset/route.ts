import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { errorResponse } from "@/lib/auth/session";
import { parseJson, z, emailSchema, shortText } from "@/lib/auth/validate";
import { enforceRateLimit } from "@/lib/auth/rate-limit";
import { recordAudit } from "@/lib/audit";

// ─────────────────────────────────────────────────────────────────────────────
// File a password-reset request for staff.
//
// Employees and managers do not reset their own password — an admin does it for
// them from the reset queue. The forgot-password pages used to build that queue
// entry in the browser: read the account row to get its id, then INSERT into
// password_reset_requests with that id.
//
// Two problems with that, beyond it breaking when the account tables stopped
// being readable signed-out:
//
//   1. `user_id` came from the browser, so the request could be filed against
//      any account id regardless of which address was entered.
//   2. It required anonymous read access to `employees` and `managers`.
//
// Here the caller supplies only an email address. The server resolves it to an
// account itself, and the queue entry is built from what it found — not from
// what the client claimed.
// ─────────────────────────────────────────────────────────────────────────────

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const schema = z.object({
  email: emailSchema,
  accountType: z.enum(["employee", "manager"]),
  fullName: shortText(120).optional(),
  reason: shortText(500).optional(),
});

const TABLE_FOR: Record<"employee" | "manager", string> = {
  employee: "employees",
  manager: "managers",
};

export async function POST(request: NextRequest) {
  try {
    // Filing a request is cheap for the user and noisy for the admin queue.
    await enforceRateLimit(request, "password-reset-request", 5, 60 * 60);

    const { email, accountType, fullName, reason } = await parseJson(request, schema);

    const { data: accounts } = await supabase
      .from(TABLE_FOR[accountType])
      .select("id, full_name")
      .ilike("email", email)
      .limit(1);

    const account = accounts?.[0];

    // Same response whether or not the account exists, so this cannot be used
    // to enumerate staff addresses. Nothing is queued for an unknown address.
    if (!account) {
      await recordAudit(
        {
          action: "auth.password.reset",
          outcome: "denied",
          metadata: { reason: "no such staff account", accountType },
        },
        { req: request },
      );
      return NextResponse.json({ ok: true });
    }

    const { error: insertError } = await supabase.from("password_reset_requests").insert({
      // From the lookup above, never from the request body.
      user_id: account.id,
      user_type: accountType,
      email,
      user_name: fullName || account.full_name || "",
      reason: reason || "User requested password reset",
      status: "pending",
    });

    if (insertError) {
      console.error("password reset request insert failed:", insertError.message);
      return NextResponse.json(
        { error: "Could not submit your request. Please try again." },
        { status: 500 },
      );
    }

    await recordAudit(
      {
        action: "auth.password.reset",
        target: `${accountType}:${account.id}`,
        metadata: { via: "staff reset queue" },
      },
      { req: request },
    );

    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
