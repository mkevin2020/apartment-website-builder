import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import bcrypt from "bcryptjs"
import { requireSession, errorResponse, HttpError } from "@/lib/auth/session"

export const dynamic = "force-dynamic"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || "",
)

const ALLOWED = ["employees", "managers", "tenants"] as const
type Table = (typeof ALLOWED)[number]

function randomPassword(len = 12) {
  // crypto.getRandomValues, not Math.random — this password protects an account,
  // and Math.random is predictable from previous outputs.
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789"
  const bytes = new Uint32Array(len)
  crypto.getRandomValues(bytes)
  let out = ""
  for (let i = 0; i < len; i++) out += chars[bytes[i] % chars.length]
  return out
}

/**
 * This endpoint resets passwords and disables accounts, so it is limited to
 * admins, managers, and employees in the IT department. Before this check it
 * was unauthenticated — anyone who knew the URL could reset any account's
 * password and read the replacement out of the response.
 */
async function requireItStaff(req: NextRequest) {
  const session = await requireSession(req)
  const isIt =
    session.role === "admin" ||
    session.role === "manager" ||
    (session.role === "employee" && /^it\b|information tech/i.test(session.dept || ""))
  if (!isIt) throw new HttpError(403, "You do not have permission to manage accounts.")
  return session
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireItStaff(req)
    const { table, id, action, active, newPassword } = await req.json()

    if (!ALLOWED.includes(table) || !id || !action) {
      return NextResponse.json({ error: "Missing or invalid parameters" }, { status: 400 })
    }
    const t = table as Table

    // Privilege escalation guard: otherwise an IT employee could reset a
    // manager's password and sign in as them.
    if (t === "managers" && session.role !== "admin") {
      return NextResponse.json(
        { error: "Only an administrator can manage manager accounts." },
        { status: 403 },
      )
    }
    // Don't let someone disable or lock themselves out of their own account.
    if (
      session.role === "employee" &&
      t === "employees" &&
      Number(id) === session.sub
    ) {
      return NextResponse.json(
        { error: "You cannot change the status of your own account." },
        { status: 400 },
      )
    }

    // ---- Reset password ----
    if (action === "reset-password") {
      const temp = (newPassword && String(newPassword).trim()) || randomPassword()
      const hash = await bcrypt.hash(temp, 10)
      const { error } = await supabase.from(t).update({ password: hash }).eq("id", id)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      // Return the plaintext temp password so IT can hand it to the user
      return NextResponse.json({ ok: true, tempPassword: temp })
    }

    // ---- Activate / deactivate ----
    if (action === "set-status") {
      const payload =
        t === "tenants"
          ? { is_active: !!active }
          : { status: active ? "active" : "inactive" }
      const { error } = await supabase.from(t).update(payload).eq("id", id)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ ok: true, active: !!active })
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 })
  } catch (err) {
    return errorResponse(err)
  }
}
