import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { isValidAttendanceToken } from "@/lib/attendance-token"
import { requireRole, errorResponse } from "@/lib/auth/session"
import { parseJson, z } from "@/lib/auth/validate"

export const dynamic = "force-dynamic"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || "",
)

// Work day starts at 09:00 (Kigali). Clocking in after this is marked "late".
const LATE_AFTER_HOUR = 9
const TZ = "Africa/Kigali"

function kigaliDate(d: Date): string {
  // YYYY-MM-DD in Kigali time
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d)
}

function kigaliHour(d: Date): number {
  return Number(
    new Intl.DateTimeFormat("en-US", { timeZone: TZ, hour: "2-digit", hour12: false }).format(d),
  )
}

// POST { action: "in" | "out", token? }
//  - "in"  : records clock-in once per day (keeps the first time; flags late).
//            A valid office QR `token` marks it VERIFIED present (method "qr");
//            a plain login (no token) is "login" = unverified.
//  - "out" : updates today's clock-out time
//
// The employee is taken from the signed session, never from the request body.
// While it came from the body, anyone could clock any colleague in or out just
// by sending their id.
export async function POST(req: NextRequest) {
  try {
    const session = await requireRole(req, ["employee"])
    const employeeId = session.sub

    const { action, token } = await parseJson(
      req,
      z.object({
        action: z.enum(["in", "out"]).default("in"),
        token: z.string().max(200).optional(),
      }),
    )

    const now = new Date()
    const date = kigaliDate(now)

    // Figure out how (if at all) this clock-in is physically verified:
    //   "qr"    -> scanned a valid office QR code (verified present)
    //   "login" -> just a login (unverified)
    const tokenOk = !!token && isValidAttendanceToken(String(token))
    const method = action === "in" ? (tokenOk ? "qr" : "login") : "login"
    const verified = method === "qr"

    // A QR token was supplied but it's wrong/expired → tell the employee.
    if (action === "in" && token && !tokenOk) {
      return NextResponse.json(
        { error: "This office code is expired or invalid. Scan the current code again." },
        { status: 400 },
      )
    }

    if (action === "out") {
      await supabase
        .from("attendance")
        .update({ clock_out: now.toISOString() })
        .eq("employee_id", Number(employeeId))
        .eq("date", date)
      return NextResponse.json({ ok: true, action: "out" })
    }

    const { data: existing } = await supabase
      .from("attendance")
      .select("id, method")
      .eq("employee_id", Number(employeeId))
      .eq("date", date)
      .limit(1)

    // Already have a record today
    if (existing && existing.length > 0) {
      const row = existing[0] as any
      // Upgrade an unverified (login) record once they scan the office QR
      if (verified && row.method === "login") {
        await supabase.from("attendance").update({ method }).eq("id", row.id)
        return NextResponse.json({ ok: true, verified: true, method, upgraded: true })
      }
      return NextResponse.json({
        ok: true,
        already: true,
        verified: row.method === "qr" || row.method === "card",
      })
    }

    // First record of the day
    const status = kigaliHour(now) >= LATE_AFTER_HOUR ? "late" : "present"
    const { error } = await supabase.from("attendance").insert({
      employee_id: Number(employeeId),
      date,
      clock_in: now.toISOString(),
      status,
      method,
    })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ ok: true, action: "in", status, verified, method })
  } catch (err) {
    return errorResponse(err)
  }
}
