import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE_NAMES, getSession } from "@/lib/auth/session";
import { revokeToken } from "@/lib/auth/revocation";
import { recordAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

/**
 * Sign out.
 *
 * Clearing the cookie is what logs this browser out, but it does nothing about
 * the token itself: a stateless HMAC token stays valid until it expires, so a
 * copy captured from a shared machine, a proxy log or devtools kept working for
 * the rest of the 8-hour window. The token is now added to the revocation
 * denylist as well, so it is dead everywhere and not merely forgotten here.
 */
export async function POST(request: NextRequest) {
  const session = await getSession(request);

  if (session) {
    await revokeToken(session, "logout");
    await recordAudit(
      { action: "auth.logout", target: `${session.role}:${session.sub}` },
      { req: request, session },
    );
  }

  const res = NextResponse.json({ ok: true });
  // Clear BOTH the prefixed and legacy names — during the __Host- migration a
  // browser may still be holding the old one, and leaving it behind would keep
  // the user signed in.
  for (const name of SESSION_COOKIE_NAMES) {
    res.cookies.set(name, "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });
  }
  return res;
}
