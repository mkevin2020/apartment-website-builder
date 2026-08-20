import type { Role, SessionPayload } from "@/lib/auth/session";

// ─────────────────────────────────────────────────────────────────────────────
// THE DATA ACCESS POLICY.
//
// This file is the security boundary for everything the browser reads or writes
// from the database. Read it as you would a set of RLS policies — because that
// is exactly what it is, expressed in a place this app can actually enforce.
//
// WHY IT EXISTS
//
// The app authenticates against its own account tables rather than Supabase
// Auth, so `auth.uid()` is always NULL for the anon key and true per-user RLS
// policies are impossible to write in Postgres. Meanwhile 52 client components
// queried Supabase directly with the anon key, which (with RLS off) meant the
// browser could read admin password hashes and write any row it liked.
//
// The fix is to make the anon key useless — RLS on, no policies, everything
// denied — and route the browser's queries through /api/data instead, where
// the signed session cookie identifies the caller and the rules below decide
// what that caller may see and change.
//
// HOW TO READ A POLICY
//
//   select/insert/update/delete   which actors may perform the operation.
//                                 "anon" means no session required.
//   hidden                        columns never returned, whatever is asked for.
//   writable                      the ONLY columns a client may set. Everything
//                                 else is dropped, which is what stops
//                                 `.update(formData)` from smuggling in
//                                 `approval_status` or `password`.
//   scope                         a filter FORCED onto every query for a role,
//                                 in addition to whatever the caller asked for.
//                                 This is the object-level check: a tenant's
//                                 reads are rewritten to their own rows.
//
// RULES FOR EDITING
//
//   - A table absent from this map is denied outright. Add tables deliberately.
//   - Default to the narrowest actor list that makes the screen work.
//   - Any table holding credentials keeps `password` in `hidden` even if a role
//     is allowed to read the row — no screen needs the hash.
// ─────────────────────────────────────────────────────────────────────────────

export type Actor = Role | "anon";
export type Op = "select" | "insert" | "update" | "delete";

/** A filter the server forces onto the query, whatever the client asked for. */
export interface ScopeFilter {
  column: string;
  value: string | number;
}

export interface TablePolicy {
  select?: Actor[];
  insert?: Actor[];
  update?: Actor[];
  delete?: Actor[];
  hidden?: string[];
  writable?: string[];
  /** Per-role row restriction. Roles absent here are unrestricted. */
  scope?: Partial<Record<Role, (session: SessionPayload) => ScopeFilter>>;
}

const STAFF: Actor[] = ["admin", "manager", "employee"];
const ADMIN_MANAGER: Actor[] = ["admin", "manager"];
const EVERYONE: Actor[] = ["admin", "manager", "employee", "tenant"];

/**
 * Credential and reset material. Hidden on every table that has them, so a
 * policy mistake elsewhere cannot expose a hash.
 */
const SECRETS = [
  "password",
  "password_hash",
  "reset_token",
  "reset_token_expires",
  "otp_code",
  "otp_expires_at",
];

/** A tenant sees only their own rows. tenant_id is VARCHAR on some tables and
 *  INTEGER on others (the migrations disagree), so the gateway compares as
 *  text — see coerceScope in app/api/data/route.ts. */
const ownTenantRows = (session: SessionPayload): ScopeFilter => ({
  column: "tenant_id",
  value: session.sub,
});

export const DATA_POLICY: Record<string, TablePolicy> = {
  // ── Public-facing ─────────────────────────────────────────────────────────

  apartments: {
    // The marketing site and listings must work signed out.
    select: ["anon", ...EVERYONE],
    insert: ADMIN_MANAGER,
    update: ADMIN_MANAGER,
    delete: ADMIN_MANAGER,
    writable: [
      "name", "type", "description", "price_per_month", "price_per_day",
      "bedrooms", "bathrooms", "size_sqm", "floor_number", "building_number",
      "apartment_number", "is_available", "image_url", "gallery", "amenities",
      "status",
    ],
  },

  client_feedback: {
    // Visitors submit feedback; only staff read it back.
    select: STAFF,
    insert: ["anon", ...EVERYONE],
    update: ADMIN_MANAGER,
    delete: ADMIN_MANAGER,
    writable: ["name", "email", "phone", "subject", "message", "rating", "user_email"],
  },

  // ── Tenant-facing: scoped to the caller ───────────────────────────────────

  tenants: {
    select: EVERYONE,
    // Signup goes through /api/tenant/register, which validates and hashes.
    // No anon insert here, or anyone could create approved accounts.
    insert: ADMIN_MANAGER,
    update: EVERYONE,
    delete: ADMIN_MANAGER,
    hidden: SECRETS,
    // Deliberately excludes approval_status, is_active, password: a tenant
    // editing their profile must not be able to approve or reactivate
    // themselves. Staff changes to those go through their own API routes.
    writable: [
      "full_name", "email", "phone", "username", "profile_picture_url",
      "emergency_contact_name", "emergency_contact_phone", "occupation",
      "date_of_birth", "gender", "address",
    ],
    scope: {
      // A tenant's own row is keyed by id, not tenant_id.
      tenant: (s) => ({ column: "id", value: s.sub }),
    },
  },

  tenant_payments: {
    select: EVERYONE,
    // Invoice creation is POST /api/tenant/payments, which verifies the tenant
    // actually holds the apartment before writing.
    insert: ADMIN_MANAGER,
    update: ADMIN_MANAGER,
    delete: ADMIN_MANAGER,
    writable: ["status", "amount", "due_date", "payment_date", "notes"],
    scope: { tenant: ownTenantRows },
  },

  bookings: {
    select: EVERYONE,
    insert: EVERYONE,
    update: STAFF,
    delete: ADMIN_MANAGER,
    writable: [
      "apartment_id", "tenant_id", "client_name", "email", "phone_number",
      "start_date", "end_date", "status", "total_amount", "notes",
      "guests", "special_requests",
    ],
    scope: { tenant: ownTenantRows },
  },

  receipts: {
    select: EVERYONE,
    insert: STAFF,
    update: STAFF,
    delete: ADMIN_MANAGER,
    writable: ["is_verified", "verified_at", "status"],
    scope: { tenant: ownTenantRows },
  },

  maintenance_requests: {
    select: EVERYONE,
    insert: EVERYONE,
    update: STAFF,
    delete: ADMIN_MANAGER,
    writable: [
      "tenant_id", "apartment_id", "title", "description", "category",
      "priority", "status", "assigned_to", "resolution_notes", "images",
    ],
    scope: { tenant: ownTenantRows },
  },

  occupied_apartments: {
    select: EVERYONE,
    insert: STAFF,
    update: STAFF,
    delete: STAFF,
    writable: [
      "apartment_id", "booking_id", "tenant_id", "user_email",
      "check_in_date", "check_out_date", "status",
    ],
    scope: { tenant: ownTenantRows },
  },

  // ── Staff-only ────────────────────────────────────────────────────────────

  employees: {
    select: STAFF,
    insert: ADMIN_MANAGER,
    update: ADMIN_MANAGER,
    delete: ADMIN_MANAGER,
    hidden: SECRETS,
    writable: [
      "full_name", "username", "email", "phone", "department", "position",
      "status", "profile_picture_url", "hire_date", "salary",
    ],
  },

  managers: {
    select: STAFF,
    insert: ["admin"],
    update: ["admin"],
    delete: ["admin"],
    hidden: SECRETS,
    writable: [
      "full_name", "username", "email", "phone", "department", "status",
      "profile_picture_url",
    ],
  },

  admin_accounts: {
    // Only an admin can list admins, and never the hash.
    select: ["admin"],
    insert: ["admin"],
    update: ["admin"],
    delete: ["admin"],
    hidden: SECRETS,
    writable: ["username", "full_name", "profile_picture_url", "email"],
  },

  employee_schedules: {
    select: STAFF,
    insert: ADMIN_MANAGER,
    update: ADMIN_MANAGER,
    delete: ADMIN_MANAGER,
    writable: [
      "employee_id", "shift_date", "start_time", "end_time", "shift_type",
      "notes", "status", "updated_by",
    ],
  },

  password_reset_requests: {
    // Staff read the queue; the forgot-password pages file into it unauthenticated.
    select: ADMIN_MANAGER,
    insert: ["anon", ...EVERYONE],
    update: ADMIN_MANAGER,
    delete: ADMIN_MANAGER,
    writable: ["email", "username", "account_type", "status", "requested_at", "notes"],
  },

  promo_codes: {
    select: STAFF,
    insert: ADMIN_MANAGER,
    update: ADMIN_MANAGER,
    delete: ADMIN_MANAGER,
    writable: [
      "code", "discount_percent", "discount_amount", "active",
      "valid_from", "valid_until", "max_uses", "description",
    ],
  },

  settings: {
    select: STAFF,
    insert: ["admin"],
    update: ["admin"],
    delete: ["admin"],
    writable: ["key", "value", "description"],
  },

  internal_messages: {
    select: STAFF,
    insert: STAFF,
    update: STAFF,
    delete: ADMIN_MANAGER,
    writable: ["sender_id", "sender_role", "recipient_id", "recipient_role", "body", "read_at"],
  },

  chat_sessions: {
    select: STAFF,
    insert: ["anon", ...EVERYONE],
    update: STAFF,
    delete: ADMIN_MANAGER,
    writable: ["user_email", "user_name", "user_role", "status"],
  },
};

/** Look up a policy. Unknown tables are denied, not defaulted. */
export function policyFor(table: string): TablePolicy | null {
  return Object.prototype.hasOwnProperty.call(DATA_POLICY, table)
    ? DATA_POLICY[table]
    : null;
}

export function actorFor(session: SessionPayload | null): Actor {
  return session ? session.role : "anon";
}

export function allows(policy: TablePolicy, op: Op, actor: Actor): boolean {
  const allowed = policy[op];
  return Array.isArray(allowed) && allowed.includes(actor);
}
