// Retry helper for flaky connections.
//
// The app is demoed over a mobile hotspot, where a single dropped packet turns
// a Supabase read into "TypeError: Failed to fetch" and the dashboard shows a
// stale or empty panel. Retrying twice with a short backoff turns almost all of
// those into a sub-second delay nobody notices.
//
// Only NETWORK failures are retried. A real database error (bad column, RLS
// denial, constraint violation) is returned immediately — retrying those would
// just hide the problem and waste time.

const NETWORK_ERROR =
  /failed to fetch|fetch failed|network ?error|networkerror|load failed|connect timeout|econnreset|etimedout|socket hang up/i;

export function isNetworkError(err: any): boolean {
  if (!err) return false;
  const msg = String(err?.message ?? err ?? "");
  const name = String(err?.name ?? "");
  return NETWORK_ERROR.test(msg) || NETWORK_ERROR.test(name);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Runs `run()` and retries it on network failure.
 *
 * `run` must BUILD the query each time — a Supabase query builder can only be
 * awaited once, so pass `() => supabase.from(...).select(...)`, not a builder
 * you already created.
 *
 * Works with Supabase's `{ data, error }` shape (it inspects `error`) and with
 * plain promises that throw.
 */
export async function withRetry<T extends { error?: any } | any>(
  run: () => Promise<T>,
  attempts = 3,
  baseDelayMs = 350,
): Promise<T> {
  let lastResult: T | undefined;

  for (let i = 0; i < attempts; i++) {
    const isLast = i === attempts - 1;
    try {
      const res = await run();
      // Supabase resolves (rather than throws) with an error object.
      if (!res || !(res as any).error || !isNetworkError((res as any).error)) {
        return res;
      }
      lastResult = res;
      if (isLast) return res;
    } catch (err) {
      if (isLast || !isNetworkError(err)) throw err;
    }
    // 350ms, then 700ms — short enough that a person barely notices.
    await sleep(baseDelayMs * 2 ** i);
  }

  return lastResult as T;
}
