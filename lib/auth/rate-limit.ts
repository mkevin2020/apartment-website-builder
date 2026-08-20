import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { HttpError } from "./session";

// ─────────────────────────────────────────────────────────────────────────────
// Rate limiting for the endpoints worth brute-forcing: login, OTP send/verify,
// password reset, payment initiation and the chatbot.
//
// Counters live in Postgres (scripts/033-rate-limit-buckets.sql), shared by
// every serverless instance. They used to live in module memory, which meant
// each Vercel lambda kept its own — so the real limit was "your limit × however
// many instances happened to be warm", and an attacker spreading requests over
// a few seconds was handed fresh counters. For login that is the difference
// between a brute-force control and a speed bump.
//
// The increment happens inside a single SQL function so it is atomic: two
// concurrent requests cannot both read "4 of 5 used" and both proceed.
//
// FAILURE MODE: if the database is unreachable the limiter falls back to the
// in-memory counters below rather than failing the request. Degraded limiting
// beats a total outage of login.
// ─────────────────────────────────────────────────────────────────────────────

interface Bucket {
  count: number;
  /** Epoch ms when this window resets. */
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || "",
);

/** Occasional housekeeping so the shared table does not grow without bound. */
let lastPrune = 0;
async function pruneOccasionally() {
  const now = Date.now();
  if (now - lastPrune < 10 * 60_000) return;
  lastPrune = now;
  try {
    await supabase.rpc("prune_rate_limit_buckets");
  } catch {
    // Housekeeping only — never surface.
  }
}

// Drop expired buckets occasionally so the Map cannot grow without bound.
let lastSweep = Date.now();
function sweep(now: number) {
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

/**
 * Best-effort client IP. Vercel and most proxies set x-forwarded-for; the first
 * entry is the original client. Falls back to a constant so a missing header
 * degrades to a shared global bucket rather than to no limiting at all.
 */
export function clientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return req.headers.get("x-real-ip") || "unknown";
}

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

/** In-memory fallback, used only when the shared store is unreachable. */
export function consumeLocal(
  key: string,
  limit: number,
  windowSeconds: number,
): RateLimitResult {
  const now = Date.now();
  sweep(now);

  const existing = buckets.get(key);
  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowSeconds * 1000 });
    return { ok: true, remaining: limit - 1, retryAfterSeconds: 0 };
  }

  existing.count += 1;
  if (existing.count > limit) {
    return {
      ok: false,
      remaining: 0,
      retryAfterSeconds: Math.ceil((existing.resetAt - now) / 1000),
    };
  }
  return { ok: true, remaining: limit - existing.count, retryAfterSeconds: 0 };
}

/**
 * Shared, atomic consume against Postgres. Falls back to the in-memory counter
 * if the store is unreachable.
 */
export async function consume(
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<RateLimitResult> {
  try {
    const { data, error } = await supabase.rpc("consume_rate_limit", {
      p_key: key,
      p_limit: limit,
      p_window_seconds: windowSeconds,
    });

    if (error || !data) throw error || new Error("no result");

    // The function returns a single row.
    const row = Array.isArray(data) ? data[0] : data;
    void pruneOccasionally();

    return {
      ok: Boolean(row.allowed),
      remaining: Number(row.remaining ?? 0),
      retryAfterSeconds: Number(row.retry_after_seconds ?? 0),
    };
  } catch (err) {
    // Table/function missing (migration 033 not run yet) or a transient outage.
    console.warn("[rate-limit] shared store unavailable, using in-memory counter");
    return consumeLocal(key, limit, windowSeconds);
  }
}

/**
 * Throws a 429 HttpError when the caller is over budget. `scope` separates
 * counters so a burst of OTP requests cannot lock someone out of login.
 *
 * NOTE: async since the counters moved to Postgres — every call site must
 * `await` it, or the limit is never actually applied.
 */
export async function enforceRateLimit(
  req: NextRequest,
  scope: string,
  limit: number,
  windowSeconds: number,
  extraKey?: string,
): Promise<void> {
  const key = `${scope}:${clientIp(req)}${extraKey ? `:${extraKey}` : ""}`;
  const result = await consume(key, limit, windowSeconds);
  if (!result.ok) {
    throw new HttpError(
      429,
      `Too many attempts. Please wait ${result.retryAfterSeconds} seconds and try again.`,
    );
  }
}

/**
 * Rejects obvious automated clients before they reach expensive handlers
 * (OTP sends cost real SMS/email credits).
 *
 * This is deliberately lightweight — a determined bot forges a browser
 * user-agent trivially. It filters out drive-by scanners and naive scripts;
 * the rate limits above are what actually contain a targeted attack.
 */
export function rejectObviousBots(req: NextRequest): void {
  const ua = (req.headers.get("user-agent") || "").toLowerCase();
  if (!ua) throw new HttpError(400, "Request rejected.");

  const blocked = [
    "curl/",
    "wget/",
    "python-requests",
    "python-httpx",
    "go-http-client",
    "java/",
    "okhttp",
    "scrapy",
    "postmanruntime",
    "headlesschrome",
  ];
  if (blocked.some((needle) => ua.includes(needle))) {
    throw new HttpError(400, "Request rejected.");
  }
}

/**
 * Honeypot check for public forms. Render a field that is hidden from humans
 * (e.g. `<input name="website" tabIndex={-1} className="hidden" autoComplete="off" />`)
 * — real users leave it empty, most form bots fill every field they find.
 */
export function rejectHoneypot(value: unknown): void {
  if (typeof value === "string" && value.trim() !== "") {
    throw new HttpError(400, "Request rejected.");
  }
}
