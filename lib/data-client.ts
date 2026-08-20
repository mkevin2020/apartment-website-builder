// ─────────────────────────────────────────────────────────────────────────────
// Browser-side query builder that talks to /api/data instead of to Supabase.
//
// It mirrors the subset of the supabase-js chaining API this app actually uses,
// so migrating a component is a one-line change:
//
//     const supabase = createBrowserClient(URL, ANON_KEY)   // before
//     const supabase = dataClient()                         // after
//
// …and every `.from(...).select(...).eq(...)` below it keeps working, now
// carrying the session cookie and going through the policy in lib/data-policy.ts.
//
// WHAT IS DELIBERATELY NOT HERE
//
//   - No realtime. Nothing in this app subscribes to channels.
//   - No storage. components/ProfileCard.tsx calls supabase.storage directly and
//     keeps its own client for that; uploads are governed by bucket policy, not
//     by table RLS.
//   - No .rpc(). Nothing calls one.
//
// Adding an operator here without adding it to OPERATORS in the gateway will
// fail closed — the request is rejected rather than silently unfiltered.
// ─────────────────────────────────────────────────────────────────────────────

type FilterOp = "eq" | "neq" | "gt" | "gte" | "lt" | "lte" | "like" | "ilike" | "in" | "is" | "not";

interface Filter {
  op: FilterOp;
  column: string;
  value: unknown;
  inner?: string;
}

export interface QueryError {
  message: string;
  /** Present only when the gateway chooses to surface it; PostgREST codes are
   *  deliberately not forwarded, so callers must not branch on them. */
  code?: string;
  details?: string;
  hint?: string;
}

export interface QueryResult<T = any> {
  data: T | null;
  error: QueryError | null;
  count?: number | null;
}

interface Payload {
  table: string;
  op: "select" | "insert" | "update" | "delete";
  columns?: string;
  filters: Filter[];
  order?: { column: string; ascending: boolean };
  limit?: number;
  single?: boolean;
  values?: unknown;
  upsert?: boolean;
  count?: "exact" | "planned" | "estimated";
}

/**
 * Thenable so `await query` works exactly like supabase-js, while the chaining
 * methods stay available until the moment it is awaited.
 */
class Query<T = any> implements PromiseLike<QueryResult<T>> {
  /** Lets a Query satisfy a `Promise<T>` type annotation, which some callers
   *  (e.g. Promise.all with an explicit type) require structurally. */
  readonly [Symbol.toStringTag] = "Query";

  private payload: Payload;

  constructor(payload: Payload) {
    this.payload = payload;
  }

  private push(op: FilterOp, column: string, value: unknown, inner?: string): this {
    this.payload.filters.push({ op, column, value, inner });
    return this;
  }

  select(
    columns = "*",
    opts?: { count?: "exact" | "planned" | "estimated"; head?: boolean },
  ): this {
    // After insert/update/delete, .select() only asks for the rows back — the
    // gateway already returns them, so the operation must not be overwritten.
    if (this.payload.op === "select") this.payload.columns = columns;
    if (opts?.count) this.payload.count = opts.count;
    return this;
  }

  eq(column: string, value: unknown) { return this.push("eq", column, value); }
  neq(column: string, value: unknown) { return this.push("neq", column, value); }
  gt(column: string, value: unknown) { return this.push("gt", column, value); }
  gte(column: string, value: unknown) { return this.push("gte", column, value); }
  lt(column: string, value: unknown) { return this.push("lt", column, value); }
  lte(column: string, value: unknown) { return this.push("lte", column, value); }
  like(column: string, value: string) { return this.push("like", column, value); }
  ilike(column: string, value: string) { return this.push("ilike", column, value); }
  in(column: string, values: unknown[]) { return this.push("in", column, values); }
  is(column: string, value: null) { return this.push("is", column, value); }
  not(column: string, inner: string, value: unknown) {
    return this.push("not", column, value, inner);
  }

  /** `.match({ a: 1, b: 2 })` is sugar for chained .eq() calls. */
  match(criteria: Record<string, unknown>): this {
    for (const [column, value] of Object.entries(criteria)) this.push("eq", column, value);
    return this;
  }

  order(column: string, opts?: { ascending?: boolean }): this {
    this.payload.order = { column, ascending: opts?.ascending ?? true };
    return this;
  }

  limit(n: number): this {
    this.payload.limit = n;
    return this;
  }

  single(): this {
    this.payload.single = true;
    this.payload.limit = 1;
    return this;
  }

  /** maybeSingle and single behave identically here: the gateway uses
   *  maybeSingle throughout, returning null rather than erroring on no rows. */
  maybeSingle(): this {
    return this.single();
  }

  /** Present so a Query can stand in for a Promise anywhere the app treats it
   *  as one — Promise.all, .catch(), try/finally. */
  catch<R = never>(
    onrejected?: ((reason: unknown) => R | PromiseLike<R>) | null,
  ): Promise<QueryResult<T> | R> {
    return this.then(undefined, onrejected);
  }

  finally(onfinally?: (() => void) | null): Promise<QueryResult<T>> {
    return this.then(
      (v) => { onfinally?.(); return v; },
      (e) => { onfinally?.(); throw e; },
    );
  }

  async then<R1 = QueryResult<T>, R2 = never>(
    onfulfilled?: ((value: QueryResult<T>) => R1 | PromiseLike<R1>) | null,
    onrejected?: ((reason: unknown) => R2 | PromiseLike<R2>) | null,
  ): Promise<R1 | R2> {
    try {
      const res = await fetch("/api/data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Same-origin fetch sends the session cookie by default; stated
        // explicitly because the whole model depends on it.
        credentials: "same-origin",
        cache: "no-store",
        body: JSON.stringify(this.payload),
      });

      const body = await res.json().catch(() => null);

      if (!res.ok) {
        const message =
          body?.error?.message || body?.error || "That request could not be completed.";
        const result: QueryResult<T> = {
          data: null,
          error: { message: typeof message === "string" ? message : "Request failed" },
          count: null,
        };
        return onfulfilled ? onfulfilled(result) : (result as unknown as R1);
      }

      const result: QueryResult<T> = {
        data: body?.data ?? null,
        error: null,
        count: body?.count ?? null,
      };
      return onfulfilled ? onfulfilled(result) : (result as unknown as R1);
    } catch (err) {
      const result: QueryResult<T> = {
        data: null,
        error: { message: "Network error. Please check your connection and try again." },
        count: null,
      };
      if (onrejected && !onfulfilled) return onrejected(err);
      return onfulfilled ? onfulfilled(result) : (result as unknown as R1);
    }
  }
}

class Table {
  constructor(private table: string) {}

  private base(op: Payload["op"]): Payload {
    return { table: this.table, op, filters: [] };
  }

  select(
    columns = "*",
    opts?: { count?: "exact" | "planned" | "estimated"; head?: boolean },
  ) {
    const p = this.base("select");
    // `head: true` means "count only, no rows" — the gateway returns the count
    // either way, so this only needs to avoid shipping rows we discard.
    if (opts?.head) p.limit = 1;
    p.columns = columns;
    if (opts?.count) p.count = opts.count;
    return new Query(p);
  }

  insert(values: unknown) {
    const p = this.base("insert");
    p.values = values;
    return new Query(p);
  }

  /** `opts` mirrors supabase-js (`{ onConflict }`). The gateway resolves
   *  conflicts on the table's own constraints, so the hint is accepted for
   *  call-site compatibility and not forwarded. */
  upsert(values: unknown, _opts?: { onConflict?: string; ignoreDuplicates?: boolean }) {
    const p = this.base("insert");
    p.values = values;
    p.upsert = true;
    return new Query(p);
  }

  update(values: unknown) {
    const p = this.base("update");
    p.values = values;
    return new Query(p);
  }

  delete() {
    return new Query(this.base("delete"));
  }
}

export interface DataClient {
  from(table: string): Table;
}

/**
 * The single shared instance.
 *
 * This MUST be a stable object, not a fresh one per call. Components hold the
 * client in a render-scoped const and list it in effect dependencies:
 *
 *     const supabase = dataClient();
 *     useEffect(() => { ... }, [router, supabase]);
 *
 * A new object each call makes that dependency change on every render, so the
 * effect re-runs, sets state, triggers a render, and loops until React gives up
 * with "Maximum update depth exceeded". `createBrowserClient` returned a stable
 * instance, so the components were written assuming one.
 *
 * The client carries no state of its own — every query builds a fresh Query —
 * so sharing one instance is safe.
 */
const INSTANCE: DataClient = { from: (table: string) => new Table(table) };

/** Drop-in replacement for createBrowserClient(...). Always the same instance. */
export function dataClient(): DataClient {
  return INSTANCE;
}
