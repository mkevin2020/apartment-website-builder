import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { requireRole, ADMIN_OR_MANAGER, errorResponse } from "@/lib/auth/session"

export const dynamic = "force-dynamic"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || "",
)

const TZ = "Africa/Kigali"
function kigaliToday(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date())
}

// GET ?date=YYYY-MM-DD  -> every employee with their attendance for that day.
// Employees with no record are reported as "absent".
export async function GET(req: NextRequest) {
  try {
    // Exposes every employee's name and attendance record — supervisors only.
    await requireRole(req, ADMIN_OR_MANAGER)

    const date = req.nextUrl.searchParams.get("date") || kigaliToday()

    const { data: employees, error: empErr } = await supabase
      .from("employees")
      .select("id, full_name, username, department, position")
      .order("full_name", { ascending: true })
    if (empErr) return NextResponse.json({ error: empErr.message }, { status: 500 })

    const { data: records } = await supabase
      .from("attendance")
      .select("employee_id, clock_in, clock_out, status, method")
      .eq("date", date)

    const byEmp: Record<number, any> = {}
    ;(records || []).forEach((r: any) => (byEmp[r.employee_id] = r))

    const rows = (employees || []).map((e: any) => {
      const r = byEmp[e.id]
      // Verified = physically confirmed at the office: scanned the QR, or
      // (later, with hardware) tapped an RFID card — not just a login.
      const verified = !!r && (r.method === "qr" || r.method === "card")
      return {
        employeeId: e.id,
        name: e.full_name || e.username || `Employee #${e.id}`,
        department: e.department || "—",
        position: e.position || "",
        clockIn: r?.clock_in || null,
        clockOut: r?.clock_out || null,
        status: r ? r.status || "present" : "absent",
        method: r?.method || null,
        verified,
      }
    })

    const summary = {
      total: rows.length,
      present: rows.filter((r) => r.status === "present").length,
      late: rows.filter((r) => r.status === "late").length,
      absent: rows.filter((r) => r.status === "absent").length,
      verified: rows.filter((r) => r.verified).length,
    }

    return NextResponse.json({ date, summary, rows })
  } catch (err) {
    return errorResponse(err)
  }
}
