import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

/**
 * Who is the caller, according to the signed cookie?
 *
 * Client pages use this to confirm a session is genuinely still valid, rather
 * than trusting the presence of a localStorage key (which anyone can create).
 */
export async function GET(request: NextRequest) {
  const session = await getSession(request);
  if (!session) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }
  return NextResponse.json({
    authenticated: true,
    id: session.sub,
    role: session.role,
    name: session.name ?? null,
    email: session.email ?? null,
    department: session.dept ?? null,
  });
}
