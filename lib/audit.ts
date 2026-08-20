import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { SessionPayload } from "@/lib/auth/session";
import { clientIp } from "@/lib/auth/rate-limit";

// ─────────────────────────────────────────────────────────────────────────────
// Audit trail for authentication and privileged actions.
//
// Before this existed, nothing in the app recorded *who* approved a payment,
// processed a refund, deleted a tenant, or created a staff account — the row
// simply changed. That makes both incident response and dispute resolution
// impossible ("the refund was issued, by whom?").
//
// Design notes:
//   - Writes go through the service-role key to a table that is server-only
//     under RLS, so a compromised browser session cannot forge or erase entries.
//   - Logging never blocks or fails the action it is describing. An audit write
//     that throws would otherwise turn a working refund into a 500.
//   - `metadata` is for identifiers and amounts. Never put credentials, card
//     data, OTP codes, or full national IDs in it — see redact() below.
//
// Table lives in scripts/030-create-audit-log.sql.
// ─────────────────────────────────────────────────────────────────────────────

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || "",
);

export type AuditAction =
  // Authentication
  | "auth.login.success"
  | "auth.login.failure"
  | "auth.logout"
  | "auth.otp.sent"
  | "auth.otp.verified"
  | "auth.password.reset"
  // Money
  | "payment.checkout.created"
  | "payment.completed"
  | "payment.approved"
  | "payment.declined"
  | "refund.requested"
  | "refund.processed"
  // Records
  | "tenant.approved"
  | "tenant.declined"
  | "tenant.deleted"
  | "account.created"
  | "account.updated"
  | "receipt.viewed"
  | "attendance.clocked";

export interface AuditEntry {
  action: AuditAction;
  /** The record acted upon, e.g. "tenant_payments:412". */
  target?: string;
  /** "success" | "denied" | "failure" — denied entries are the interesting ones. */
  outcome?: "success" | "denied" | "failure";
  metadata?: Record<string, unknown>;
}

/**
 * Keys whose values must never reach the audit table, matched case-insensitively
 * against the whole key name. Anything matching is replaced with "[redacted]".
 */
const SENSITIVE_KEY = /pass|secret|token|cvv|cvc|card|pan|otp|national_?id|id_number|authorization|cookie/i;

function redact(metadata: Record<string, unknown>): Record<string, unknown> {
  const clean: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (SENSITIVE_KEY.test(key)) {
      clean[key] = "[redacted]";
    } else if (typeof value === "string" && value.length > 500) {
      clean[key] = `${value.slice(0, 500)}…[truncated]`;
    } else {
      clean[key] = value;
    }
  }
  return clean;
}

/**
 * Record one audit entry. Fire-and-forget by design: callers may `await` it, but
 * a failure here is swallowed and logged rather than propagated.
 */
export async function recordAudit(
  entry: AuditEntry,
  ctx: { req?: NextRequest; session?: SessionPayload | null } = {},
): Promise<void> {
  try {
    const { req, session } = ctx;

    await supabase.from("audit_log").insert({
      action: entry.action,
      outcome: entry.outcome || "success",
      actor_role: session?.role ?? "anonymous",
      actor_id: session?.sub ?? null,
      // Email is stored to keep the trail readable after an account is deleted.
      actor_email: session?.email ?? null,
      target: entry.target ?? null,
      ip_address: req ? clientIp(req) : null,
      user_agent: req ? (req.headers.get("user-agent") || "").slice(0, 300) : null,
      metadata: entry.metadata ? redact(entry.metadata) : null,
    });
  } catch (err) {
    // Never let auditing break the request it is describing.
    console.error("[audit] failed to record entry:", entry.action, err);
  }
}
