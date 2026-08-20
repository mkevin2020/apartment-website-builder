import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import bcrypt from "bcryptjs";
import { dashboardPathFor } from "@/lib/employee-departments";
import {
  signSession,
  sessionCookieOptions,
  SESSION_COOKIE,
  errorResponse,
  type Role,
} from "@/lib/auth/session";
import { enforceRateLimit } from "@/lib/auth/rate-limit";
import { parseJson, z } from "@/lib/auth/validate";
import { recordAudit } from "@/lib/audit";

// Server-side login. Runs with the service-role key so credentials never touch the client,
// and the password column is never returned to the browser.
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const loginSchema = z.object({
  username: z.string().trim().min(1, "Please enter your email or username.").max(254),
  password: z.string().min(1, "Please enter your password.").max(128),
  /**
   * Only sent on the SECOND attempt, when the first came back with
   * `needsChoice` because the identifier matched accounts in more than one
   * table. The password is re-verified against the chosen account — this is a
   * disambiguator, never an authorisation.
   */
  accountType: z.enum(["admin", "manager", "employee", "tenant"]).optional(),
});

// Columns that must never leave the server, whichever table the account is in.
const SENSITIVE_COLUMNS = [
  "password",
  "reset_token",
  "reset_token_expires",
  "otp_code",
  "otp_expires_at",
];

/**
 * Fields the browser is allowed to keep.
 *
 * This is an ALLOWLIST, not a denylist. The previous version returned the whole
 * account row minus a handful of credential columns, and the client wrote that
 * straight into localStorage — so a tenant's phone number, national ID, address,
 * emergency contact and approval state all sat in browser storage, readable by
 * any XSS and surviving until an explicit logout.
 *
 * The browser needs enough to render a header and route the user. Everything
 * else it needs, it fetches per screen from an authenticated endpoint.
 */
const CLIENT_VISIBLE_FIELDS = [
  "id",
  "full_name",
  "username",
  "email",
  // The caller's OWN number. Kept because the MoMo checkout prefills it
  // (components/PaymentCheckoutModal.tsx) and the booking flow sends it as the
  // contact number — removing it would make the tenant retype their number at
  // the most abandonment-sensitive moment in the product.
  "phone",
  "role",
  "department",
  "position",
  "profile_picture_url",
];

// Deliberately NOT sent to the browser, and therefore never written to
// localStorage: national_id / id_number, address, emergency_contact*,
// date_of_birth, gender, occupation, approval_status, is_active.
// app/tenant/profile/page.tsx re-fetches the full row through the authenticated
// data gateway, so every screen that legitimately displays these still works —
// they just no longer sit in browser storage between visits.

/** Reduce an account row to the fields the UI actually renders. */
const toPublicProfile = <T extends Record<string, unknown>>(row: T) => {
  const clean: Record<string, unknown> = {};
  for (const key of CLIENT_VISIBLE_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(row, key)) clean[key] = row[key];
  }
  return clean;
};

/**
 * Escape LIKE wildcards so a login of "%" cannot match every row. The exact
 * string comparison below would reject the impostor anyway, but there is no
 * reason to let an unauthenticated caller run a full-table scan.
 */
const likeLiteral = (v: string): string => v.replace(/[\\%_]/g, "\\$&");

// A bcrypt hash always starts with $2a$ / $2b$ / $2y$
const isHashed = (v: unknown): boolean =>
  typeof v === "string" && /^\$2[aby]\$/.test(v);

// Verify a password against the stored value.
// - If stored value is already a bcrypt hash, compare normally.
// - If it's legacy plaintext and matches, transparently upgrade it to a hash (upgrade-on-login).
async function verifyPassword(
  input: string,
  stored: string,
  table: string,
  id: number
): Promise<boolean> {
  if (isHashed(stored)) {
    return bcrypt.compare(input, stored);
  }
  // Legacy plaintext path
  if (input === stored) {
    try {
      const hash = await bcrypt.hash(input, 10);
      await supabase.from(table).update({ password: hash }).eq("id", id);
    } catch {
      // best-effort upgrade — never block login if the rehash write fails
    }
    return true;
  }
  return false;
}

/** Build the signed-cookie response for a successful login. */
async function grantSession(opts: {
  role: Role;
  id: number;
  profile: Record<string, unknown>;
  redirect: string;
  dept?: string | null;
  req: NextRequest;
}) {
  const payload = {
    sub: opts.id,
    role: opts.role,
    name: String(opts.profile.full_name || opts.profile.username || ""),
    email: opts.profile.email ? String(opts.profile.email) : undefined,
    dept: opts.dept ?? null,
  };
  const token = await signSession(payload);

  await recordAudit(
    { action: "auth.login.success", target: `${opts.role}:${opts.id}` },
    { req: opts.req, session: { ...payload, exp: 0 } },
  );

  // The `session` body is a convenience copy for rendering the UI (names,
  // avatars). It is NOT what authorises anything — every API route reads the
  // signed cookie instead, so tampering with the localStorage copy achieves
  // nothing beyond changing what the user sees on their own screen.
  const res = NextResponse.json({
    role: opts.role,
    session: opts.profile,
    redirect: opts.redirect,
  });
  res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
  return res;
}


/** Where each role lands after signing in. Employees are routed by department. */
const ROLE_HOME: Record<Role, string> = {
  admin: "/admin/dashboard",
  manager: "/manager/dashboard",
  employee: "/employee/dashboard",
  tenant: "/tenant/dashboard",
};

/** Human labels for the "which account?" prompt. */
const ROLE_LABEL: Record<Role, string> = {
  admin: "Administrator",
  manager: "Manager",
  employee: "Staff",
  tenant: "Tenant",
};

interface ResolvedAccount {
  role: Role;
  table: string;
  id: number;
  password: string;
  row: Record<string, any>;
}

/**
 * Every account, in any table, whose username or email matches the input.
 *
 * Matching is deliberately case-insensitive and trim-tolerant, because that is
 * how people actually type an address — but the comparison is then re-checked
 * exactly in JS so a LIKE wildcard cannot widen the match.
 */
async function findCandidates(input: string): Promise<ResolvedAccount[]> {
  const needle = input.toLowerCase();
  const like = likeLiteral(input);

  const [admins, managers, empByUser, empByEmail, tenantsByEmail, tenantsByUser] =
    await Promise.all([
      supabase.from("admin_accounts").select("*").ilike("username", like),
      supabase.from("managers").select("*").ilike("username", like),
      supabase.from("employees").select("*").ilike("username", like),
      supabase.from("employees").select("*").ilike("email", like),
      supabase.from("tenants").select("*").ilike("email", like),
      supabase.from("tenants").select("*").ilike("username", like),
    ]);

  const matches = (row: Record<string, any>) =>
    String(row.username || "").trim().toLowerCase() === needle ||
    String(row.email || "").trim().toLowerCase() === needle;

  const out: ResolvedAccount[] = [];
  const seen = new Set<string>();

  const collect = (rows: any[] | null, role: Role, table: string) => {
    for (const row of rows || []) {
      if (!matches(row)) continue;
      const key = `${table}:${row.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ role, table, id: row.id, password: String(row.password || ""), row });
    }
  };

  collect(admins.data, "admin", "admin_accounts");
  collect(managers.data, "manager", "managers");
  collect(empByUser.data, "employee", "employees");
  collect(empByEmail.data, "employee", "employees");
  collect(tenantsByEmail.data, "tenant", "tenants");
  collect(tenantsByUser.data, "tenant", "tenants");

  return out;
}

/**
 * Why this account may not sign in, or null if it may.
 * Same rules as before — only the place they are applied has moved.
 */
function accountBlockedReason(account: ResolvedAccount): string | null {
  const row = account.row;

  if (account.role === "manager" || account.role === "employee") {
    if (row.status !== "active") {
      return "Your account has been deactivated. Please contact your administrator.";
    }
  }

  if (account.role === "tenant") {
    if (row.approval_status !== "approved") {
      return row.approval_status === "pending"
        ? "Your account is pending admin approval. You'll be notified once approved."
        : "Your account application has been declined. Please contact support.";
    }
    if (!row.is_active) {
      return "Your account has been deactivated. Please contact your administrator.";
    }
  }

  return null;
}

export async function POST(request: NextRequest) {
  try {
    // Brute-force protection: per-IP overall, then per-account so one attacker
    // cannot lock every user out by targeting a shared IP.
    //
    // These were 10/IP and 5/account per 15 minutes, which locked out anyone who
    // mistyped twice and retried — especially on a shared office or household
    // IP. Widened to numbers that still make guessing hopeless against bcrypt
    // (8 tries per account per 15 min is 32/hour) without punishing a real
    // person having a bad morning.
    await enforceRateLimit(request, "login-ip", 25, 15 * 60);

    const { username, password, accountType } = await parseJson(request, loginSchema);
    const input = username.trim();
    const pass = password.trim();

    await enforceRateLimit(request, "login-user", 8, 15 * 60, input.toLowerCase());

    // ── Resolve the identifier across EVERY account table ───────────────────
    //
    // This used to walk admin -> manager -> employee -> tenant and stop at the
    // first table whose password verified. That is wrong when one identifier
    // exists in two tables, which it does in this data:
    //
    //   mugishakevin73@gmail.com  ->  employees#5  AND  tenants#10
    //   christian                 ->  managers#1   AND  employees#1
    //
    // Because employees are matched by email BEFORE tenants, that address could
    // only ever reach the staff dashboard — the tenant portal was unreachable
    // with it, and which portal you landed in depended on which record happened
    // to share the password. A login whose outcome depends on table order is
    // not a login.
    //
    // Now every table is checked, the password is verified against each, and
    // the decision is explicit: exactly one match signs in, several ask which.
    const candidates = await findCandidates(input);

    const verified: ResolvedAccount[] = [];
    for (const c of candidates) {
      if (await verifyPassword(pass, c.password, c.table, c.id)) verified.push(c);
    }

    // If the caller already told us which account they meant, keep only that.
    const chosen = accountType
      ? verified.filter((v) => v.role === accountType)
      : verified;

    if (chosen.length === 0) {
      await recordAudit(
        {
          action: "auth.login.failure",
          outcome: "denied",
          metadata: { attempted_identifier: input.toLowerCase() },
        },
        { req: request }
      );
      return NextResponse.json(
        { error: "Invalid email/username or password. Please check your credentials and try again." },
        { status: 401 }
      );
    }

    // More than one account shares this identifier AND this password. Ask,
    // rather than silently picking one and sending them to the wrong portal.
    if (chosen.length > 1) {
      return NextResponse.json(
        {
          needsChoice: true,
          message: "This email is used by more than one account. Which would you like to open?",
          choices: chosen.map((c) => ({
            accountType: c.role,
            label: ROLE_LABEL[c.role],
            name: String(c.row.full_name || c.row.username || ""),
          })),
        },
        { status: 300 }
      );
    }

    const account = chosen[0];

    // ── Account-state gates, unchanged in meaning ───────────────────────────
    const blocked = accountBlockedReason(account);
    if (blocked) {
      return NextResponse.json({ error: blocked }, { status: 403 });
    }

    return grantSession({
      role: account.role,
      id: account.id,
      profile: toPublicProfile(account.row),
      redirect:
        account.role === "employee"
          ? dashboardPathFor(account.row.department)
          : ROLE_HOME[account.role],
      dept: account.role === "employee" ? account.row.department : null,
      req: request,
    });
  } catch (err) {
    return errorResponse(err);
  }
}
