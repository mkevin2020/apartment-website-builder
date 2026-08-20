import { NextRequest, NextResponse } from "next/server"
import { currentAttendanceToken } from "@/lib/attendance-token"
import { requireRole, ADMIN_OR_MANAGER, errorResponse } from "@/lib/auth/session"

export const dynamic = "force-dynamic"

// The office display polls this to get the current rotating attendance code.
//
// Restricted to admins/managers: this token is what proves someone is
// physically in the office. While it was public, any employee could fetch the
// current code from home and clock in as VERIFIED present without turning up.
export async function GET(req: NextRequest) {
  try {
    await requireRole(req, ADMIN_OR_MANAGER)
    return NextResponse.json(currentAttendanceToken())
  } catch (err) {
    return errorResponse(err)
  }
}
