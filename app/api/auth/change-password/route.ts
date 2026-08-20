import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import bcrypt from "bcryptjs";
import {
  requireSession,
  errorResponse,
  HttpError,
  signSession,
  sessionCookieOptions,
  SESSION_COOKIE,
  type Role,
} from "@/lib/auth/session";
import { parseJson, z, passwordSchema } from "@/lib/auth/validate";
import { enforceRateLimit } from "@/lib/auth/rate-limit";
import { recordAudit } from "@/lib/audit";
import { revokeAllForAccount } from "@/lib/auth/revocation";

// ─────────────────────────────────────────────────────────────────────────────
// Change the signed-in user's own password.
//
// This replaces the two change-password modals, which did the whole exchange in
// the browser:
//
//   1. SELECT password  -> pulled the bcrypt hash into the client, where it can
//      be read straight out of the network tab and cracked offline at leisure.
//   2. bcrypt.compare()  -> the "is the current password correct?" decision was
//      made by code the user controls, so it could simply be skipped.
//   3. UPDATE password   -> written with the anon key, and the target table and
//      row id came from component props rather than from a session.
//
// Here the hash never leaves the server, the comparison happens server-side,
// and the row updated is always the caller's own — the client cannot name it.
// ─────────────────────────────────────────────────────────────────────────────

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

/** The session's role determines the table. Never accepted from the client. */
const TABLE_FOR_ROLE: Record<Role, string> = {
  admin: "admin_accounts",
  manager: "managers",
  employee: "employees",
  tenant: "tenants",
};

const bodySchema = z.object({
  currentPassword: z.string().min(1, "Please enter your current password.").max(128),
  newPassword: passwordSchema,
});

export async function POST(request: NextRequest) {
  try {
    const session = await requireSession(request);

    // Guessing the current password is a brute-force target like login is.
    await enforceRateLimit(request, "change-password", 5, 15 * 60, String(session.sub));

    const { currentPassword, newPassword } = await parseJson(request, bodySchema);

    if (currentPassword === newPassword) {
      throw new HttpError(400, "Your new password must be different from the current one.");
    }

    const table = TABLE_FOR_ROLE[session.role];

    const { data: account, error: fetchError } = await supabase
      .from(table)
      .select("id, password")
      .eq("id", session.sub)
      .single();

    if (fetchError || !account) {
      throw new HttpError(404, "Account not found.");
    }

    // Same legacy-plaintext tolerance as the login route, so accounts that have
    // not been through the upgrade-on-login path can still change their password.
    const stored = String(account.password || "");
    const isBcrypt = /^\$2[aby]\$/.test(stored);
    const currentOk = isBcrypt
      ? await bcrypt.compare(currentPassword, stored)
      : currentPassword === stored;

    if (!currentOk) {
      await recordAudit(
        {
          action: "auth.password.reset",
          outcome: "denied",
          target: `${session.role}:${session.sub}`,
          metadata: { reason: "current password incorrect" },
        },
        { req: request, session },
      );
      throw new HttpError(400, "Your current password is incorrect.");
    }

    const hashed = await bcrypt.hash(newPassword, 12);
    const { error: updateError } = await supabase
      .from(table)
      .update({ password: hashed })
      .eq("id", session.sub);

    if (updateError) {
      console.error("Password update failed:", updateError);
      throw new HttpError(500, "Could not update your password. Please try again.");
    }

    // Changing a password must end every other live session for the account —
    // that is the whole point of changing it after a suspected compromise.
    await revokeAllForAccount(session.role, session.sub, "password changed");

    await recordAudit(
      { action: "auth.password.reset", target: `${session.role}:${session.sub}` },
      { req: request, session },
    );

    // The caller's own cookie predates the cutoff too, so re-issue it rather
    // than logging them out of the tab they just used.
    const res = NextResponse.json({ success: true });
    const fresh = await signSession({
      sub: session.sub,
      role: session.role,
      name: session.name,
      email: session.email,
      dept: session.dept ?? null,
    });
    res.cookies.set(SESSION_COOKIE, fresh, sessionCookieOptions());
    return res;
  } catch (err) {
    return errorResponse(err);
  }
}
