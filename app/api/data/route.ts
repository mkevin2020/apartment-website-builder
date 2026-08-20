import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSession, errorResponse, HttpError } from "@/lib/auth/session";
import { parseJson, z } from "@/lib/auth/validate";
import { enforceRateLimit } from "@/lib/auth/rate-limit";
import {
  policyFor,
  actorFor,
  allows,
  type Op,
  type TablePolicy,
} from "@/lib/data-policy";

// ─────────────────────────────────────────────────────────────────────────────
// The data gateway.
//
// Every query the browser used to run against Supabase with the anon key now
// comes here instead. This route authenticates the caller from the signed
// session cookie, checks lib/data-policy.ts, forces the row scope for that
// role, strips columns the caller may not see or set, and only then runs the
// query with the service-role key.
//
// That inversion is what lets RLS be switched on: with the anon key holding no
// grants at all, a stolen or inspected bundle gets an attacker nothing, because
// the key alone can no longer read a single row.
//
// DESIGN NOTES
//
//   - Only the operators the app actually uses are supported. An unknown
//     operator is rejected rather than passed through, so this cannot become an
//     arbitrary-query endpoint.
//   - Column names are validated against a strict identifier pattern before
//     they reach PostgREST, so a filter cannot inject extra syntax.
//   - The forced scope filter is applied AFTER the caller's filters and cannot
//     be overridden by them.
// ─────────────────────────────────────────────────────────────────────────────

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

/** Table and column names: letters, digits, underscore. Nothing else. */
const IDENT = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

/** The filter operators used anywhere in this codebase, and no others. */
const OPERATORS = ["eq", "neq", "gt", "gte", "lt", "lte", "like", "ilike", "in", "is", "not"] as const;

const filterSchema = z.object({
  op: z.enum(OPERATORS),
  column: z.string().max(64).regex(IDENT, "Invalid column name."),
  // `in` takes an array; `is` takes null; everything else a scalar.
  value: z.union([
    z.string().max(500),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(z.union([z.string().max(200), z.number()])).max(200),
  ]),
  /** For `.not("status", "in", "(a,b)")` — the inner operator. */
  inner: z.enum(OPERATORS).optional(),
});

const bodySchema = z.object({
  table: z.string().max(64).regex(IDENT, "Invalid table name."),
  op: z.enum(["select", "insert", "update", "delete"]),
  /** PostgREST select string, e.g. "id, name, apartments(name)". */
  columns: z.string().max(2000).optional(),
  filters: z.array(filterSchema).max(20).optional(),
  order: z
    .object({
      column: z.string().max(64).regex(IDENT),
      ascending: z.boolean().optional(),
    })
    .optional(),
  limit: z.number().int().positive().max(1000).optional(),
  single: z.boolean().optional(),
  /** Row(s) for insert/update/upsert. */
  values: z.union([z.record(z.unknown()), z.array(z.record(z.unknown())).max(100)]).optional(),
  upsert: z.boolean().optional(),
  count: z.enum(["exact", "planned", "estimated"]).optional(),
});

/**
 * Drop any key the policy does not list as writable.
 *
 * This is the mass-assignment guard. app/tenant/profile/page.tsx did
 * `.update(formData)` — whatever the form held went to the database, so a
 * crafted request could set approval_status or is_active. Now anything outside
 * `writable` is silently dropped rather than trusted.
 */
function pickWritable(
  values: Record<string, unknown>,
  policy: TablePolicy,
): Record<string, unknown> {
  if (!policy.writable) return {};
  const clean: Record<string, unknown> = {};
  for (const key of policy.writable) {
    if (Object.prototype.hasOwnProperty.call(values, key)) clean[key] = values[key];
  }
  return clean;
}

/** Remove hidden columns from a returned row, at any nesting depth. */
function stripHidden<T>(row: T, hidden: string[] | undefined): T {
  if (!hidden || hidden.length === 0 || row === null || typeof row !== "object") return row;
  if (Array.isArray(row)) return row.map((r) => stripHidden(r, hidden)) as unknown as T;

  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row as Record<string, unknown>)) {
    if (hidden.includes(key)) continue;
    out[key] = value && typeof value === "object" ? stripHidden(value, hidden) : value;
  }
  return out as unknown as T;
}

/**
 * The scope value is compared loosely because the migrations disagree on the
 * type of tenant_id — VARCHAR in some tables, INTEGER in others. PostgREST
 * coerces a string against an integer column fine, so text is the safe form.
 */
function scopeValue(value: string | number): string {
  return String(value);
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession(request);
    const actor = actorFor(session);

    // Generous, but stops this becoming a bulk-extraction endpoint if a session
    // is stolen. Signed-in users get a per-account budget too.
    await enforceRateLimit(request, "data-gateway", 300, 60);
    if (session) {
      await enforceRateLimit(request, "data-gateway-user", 600, 60, String(session.sub));
    }

    const body = await parseJson(request, bodySchema);

    const policy = policyFor(body.table);
    if (!policy) {
      // Unknown table: same message as a forbidden one, so this cannot be used
      // to map the schema.
      throw new HttpError(403, "You do not have access to this data.");
    }

    const op = body.op as Op;
    if (!allows(policy, op, actor)) {
      throw new HttpError(
        session ? 403 : 401,
        session
          ? "You do not have access to this data."
          : "You must be signed in to do this.",
      );
    }

    // The forced row restriction for this role, if any.
    const scope =
      session && policy.scope?.[session.role]
        ? policy.scope[session.role]!(session)
        : null;

    // ── SELECT ──────────────────────────────────────────────────────────────
    if (op === "select") {
      let query = supabase
        .from(body.table)
        .select(body.columns || "*", body.count ? { count: body.count } : undefined);

      for (const f of body.filters || []) {
        query = applyFilter(query, f);
      }
      if (scope) query = query.eq(scope.column, scopeValue(scope.value));
      if (body.order) {
        query = query.order(body.order.column, { ascending: body.order.ascending ?? true });
      }
      if (body.limit) query = query.limit(body.limit);

      const { data, error, count } = body.single
        ? await query.maybeSingle()
        : await query;

      if (error) return dbError(error);
      return NextResponse.json({ data: stripHidden(data, policy.hidden), count: count ?? null });
    }

    // ── INSERT ──────────────────────────────────────────────────────────────
    if (op === "insert") {
      if (!body.values) throw new HttpError(400, "Nothing to insert.");
      const rows = (Array.isArray(body.values) ? body.values : [body.values]).map((row) => {
        const clean = pickWritable(row, policy);
        // A scoped role can only create rows that belong to them — the client
        // does not get to name the owner.
        if (scope) clean[scope.column] = scope.value;
        return clean;
      });

      const query = supabase.from(body.table);
      const { data, error } = body.upsert
        ? await query.upsert(rows).select()
        : await query.insert(rows).select();

      if (error) return dbError(error);
      return NextResponse.json({ data: stripHidden(data, policy.hidden), count: null });
    }

    // ── UPDATE ──────────────────────────────────────────────────────────────
    if (op === "update") {
      if (!body.values || Array.isArray(body.values)) {
        throw new HttpError(400, "Nothing to update.");
      }
      const values = pickWritable(body.values, policy);
      if (Object.keys(values).length === 0) {
        throw new HttpError(400, "No updatable fields were provided.");
      }

      let query = supabase.from(body.table).update(values);
      for (const f of body.filters || []) query = applyFilter(query, f);
      // Without at least one filter this would rewrite the whole table.
      if (!body.filters?.length && !scope) {
        throw new HttpError(400, "An update must be filtered.");
      }
      if (scope) query = query.eq(scope.column, scopeValue(scope.value));

      const { data, error } = await query.select();
      if (error) return dbError(error);
      return NextResponse.json({ data: stripHidden(data, policy.hidden), count: null });
    }

    // ── DELETE ──────────────────────────────────────────────────────────────
    let query = supabase.from(body.table).delete();
    for (const f of body.filters || []) query = applyFilter(query, f);
    if (!body.filters?.length && !scope) {
      throw new HttpError(400, "A delete must be filtered.");
    }
    if (scope) query = query.eq(scope.column, scopeValue(scope.value));

    const { data, error } = await query.select();
    if (error) return dbError(error);
    return NextResponse.json({ data: stripHidden(data, policy.hidden), count: null });
  } catch (err) {
    return errorResponse(err);
  }
}

type Filter = z.infer<typeof filterSchema>;

/** Apply one validated filter. Operators are a closed set; columns are checked
 *  against IDENT by the schema before they get here. */
function applyFilter(query: any, f: Filter): any {
  switch (f.op) {
    case "eq":
      return query.eq(f.column, f.value);
    case "neq":
      return query.neq(f.column, f.value);
    case "gt":
      return query.gt(f.column, f.value);
    case "gte":
      return query.gte(f.column, f.value);
    case "lt":
      return query.lt(f.column, f.value);
    case "lte":
      return query.lte(f.column, f.value);
    case "like":
      return query.like(f.column, String(f.value));
    case "ilike":
      return query.ilike(f.column, String(f.value));
    case "in":
      return query.in(f.column, Array.isArray(f.value) ? f.value : [f.value as string]);
    case "is":
      return query.is(f.column, f.value as null);
    case "not":
      // Supports the one shape the app uses: .not(col, "in", "(a,b,c)")
      return query.not(f.column, f.inner || "in", f.value);
    default:
      throw new HttpError(400, "Unsupported filter.");
  }
}

/** Log the driver detail, return something generic. */
function dbError(error: { message?: string; code?: string }): NextResponse {
  console.error("[data-gateway] query failed:", error.code, error.message);
  return NextResponse.json(
    { data: null, error: { message: "That request could not be completed." } },
    { status: 400 },
  );
}
