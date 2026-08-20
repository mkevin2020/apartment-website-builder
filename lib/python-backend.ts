import { HttpError } from "@/lib/auth/session";

// ─────────────────────────────────────────────────────────────────────────────
// Client for the internal FastAPI payment/SMS service (backend/main.py).
//
// That service authenticates callers with a shared secret in X-Internal-Key.
// Every call from Next must carry it, so all calls go through here rather than
// each route hand-rolling a fetch() and forgetting the header.
//
// It also adds the two things the raw fetch() calls were missing: a timeout (a
// hung payment gateway otherwise holds the Next request open until the platform
// kills it) and error responses that do not forward upstream internals.
// ─────────────────────────────────────────────────────────────────────────────

const BASE_URL = process.env.PYTHON_BACKEND_URL || "http://localhost:8000";
const TIMEOUT_MS = 20_000;

function internalKey(): string {
  const key = process.env.INTERNAL_API_KEY;
  if (!key) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "INTERNAL_API_KEY is not set. Generate one with: openssl rand -base64 48 " +
          "and set the same value on the FastAPI service.",
      );
    }
    return "";
  }
  return key;
}

export interface BackendResult<T = unknown> {
  ok: boolean;
  status: number;
  data: T;
}

export async function callPythonBackend<T = unknown>(
  path: string,
  init: { method: "GET" | "POST"; body?: unknown; query?: Record<string, string> } = {
    method: "GET",
  },
): Promise<BackendResult<T>> {
  const url = new URL(path, BASE_URL);
  // Built with URLSearchParams so values are encoded — the status route
  // previously interpolated transaction ids straight into the query string.
  if (init.query) {
    for (const [key, value] of Object.entries(init.query)) {
      url.searchParams.set(key, value);
    }
  }

  const key = internalKey();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      method: init.method,
      headers: {
        "Content-Type": "application/json",
        ...(key ? { "X-Internal-Key": key } : {}),
      },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      signal: controller.signal,
      cache: "no-store",
    });

    let data: unknown = null;
    try {
      data = await res.json();
    } catch {
      data = null;
    }

    return { ok: res.ok, status: res.status, data: data as T };
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new HttpError(504, "The payment service did not respond in time. Please try again.");
    }
    console.error("[python-backend] request failed:", path, err);
    throw new HttpError(502, "The payment service is unavailable. Please try again shortly.");
  } finally {
    clearTimeout(timer);
  }
}
