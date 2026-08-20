import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { requireRole, ADMIN_OR_MANAGER, errorResponse } from "@/lib/auth/session"

export const dynamic = "force-dynamic"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || "",
)

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]

// Kigali is UTC+2 with no DST, so "today" there is just UTC + 2h.
const kigaliToday = () => new Date(Date.now() + 2 * 3600 * 1000).toISOString().slice(0, 10)
const addDays = (iso: string, n: number) => {
  const d = new Date(iso + "T00:00:00Z")
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

// Attendance over a date range, per employee.
//   ?from=YYYY-MM-DD&to=YYYY-MM-DD   (defaults to the last 30 days)
//
// "Expected days" comes from employee_schedules: a day the employee is marked
// OFF isn't counted against them. If the schedule table is unavailable we fall
// back to Mon–Sat, so the report still works.
export async function GET(req: NextRequest) {
  try {
    // Whole-workforce performance data — supervisors only.
    await requireRole(req, ADMIN_OR_MANAGER)

    const to = req.nextUrl.searchParams.get("to") || kigaliToday()
    const from = req.nextUrl.searchParams.get("from") || addDays(to, -29)

    if (from > to) {
      return NextResponse.json({ error: "'from' must be on or before 'to'" }, { status: 400 })
    }

    const [empRes, attRes, schedRes] = await Promise.all([
      supabase
        .from("employees")
        .select("id, full_name, username, department, position, status")
        .neq("status", "inactive")
        .order("full_name", { ascending: true }),
      supabase
        .from("attendance")
        .select("employee_id, date, clock_in, clock_out, status, method")
        .gte("date", from)
        .lte("date", to),
      supabase.from("employee_schedules").select("employee_id, weekday, is_off"),
    ])

    if (empRes.error) return NextResponse.json({ error: empRes.error.message }, { status: 500 })

    const employees = empRes.data || []
    const records = attRes.data || []
    const schedules = schedRes.data || []

    // employee -> weekday -> is_off
    const offByEmp: Record<string, Record<string, boolean>> = {}
    for (const s of schedules as any[]) {
      const key = String(s.employee_id)
      if (!offByEmp[key]) offByEmp[key] = {}
      offByEmp[key][s.weekday] = !!s.is_off
    }

    // Every date in the range
    const dates: string[] = []
    for (let d = from; d <= to; d = addDays(d, 1)) dates.push(d)

    // employee -> date -> record
    const byEmpDate: Record<string, Record<string, any>> = {}
    for (const r of records as any[]) {
      const key = String(r.employee_id)
      if (!byEmpDate[key]) byEmpDate[key] = {}
      byEmpDate[key][r.date] = r
    }

    const rows = employees.map((e: any) => {
      const key = String(e.id)
      const mine = byEmpDate[key] || {}
      const off = offByEmp[key]

      let expected = 0
      let present = 0
      let late = 0
      let absent = 0
      let verified = 0
      let totalMinutes = 0
      let lastSeen: string | null = null

      for (const date of dates) {
        const weekday = WEEKDAYS[new Date(date + "T00:00:00Z").getUTCDay()]
        // No schedule row for this employee? Assume Mon–Sat working, Sunday off.
        const isOff = off ? off[weekday] === true : weekday === "Sunday"
        if (isOff) continue

        expected += 1
        const r = mine[date]
        if (!r) {
          absent += 1
          continue
        }

        if (r.status === "late") late += 1
        else present += 1

        if (r.method === "qr" || r.method === "card") verified += 1
        if (!lastSeen || date > lastSeen) lastSeen = date

        if (r.clock_in && r.clock_out) {
          const mins = (new Date(r.clock_out).getTime() - new Date(r.clock_in).getTime()) / 60000
          if (mins > 0 && mins < 24 * 60) totalMinutes += mins
        }
      }

      const attended = present + late
      return {
        employeeId: e.id,
        name: e.full_name || e.username || `Employee #${e.id}`,
        department: e.department || "—",
        position: e.position || "",
        expected,
        attended,
        present,
        late,
        absent,
        verified,
        hours: Math.round((totalMinutes / 60) * 10) / 10,
        // Share of expected working days actually attended.
        rate: expected > 0 ? Math.round((attended / expected) * 100) : 0,
        // Share of attended days that were late.
        punctuality: attended > 0 ? Math.round((present / attended) * 100) : 0,
        lastSeen,
      }
    })

    const totals = {
      employees: rows.length,
      expected: rows.reduce((s, r) => s + r.expected, 0),
      attended: rows.reduce((s, r) => s + r.attended, 0),
      late: rows.reduce((s, r) => s + r.late, 0),
      absent: rows.reduce((s, r) => s + r.absent, 0),
      hours: Math.round(rows.reduce((s, r) => s + r.hours, 0) * 10) / 10,
    }
    const overallRate = totals.expected > 0 ? Math.round((totals.attended / totals.expected) * 100) : 0

    return NextResponse.json({
      from,
      to,
      days: dates.length,
      usedSchedule: schedules.length > 0,
      totals: { ...totals, rate: overallRate },
      rows,
    })
  } catch (err) {
    return errorResponse(err)
  }
}
