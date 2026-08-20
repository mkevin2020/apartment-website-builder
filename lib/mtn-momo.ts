// ─────────────────────────────────────────────────────────────────────────────
// MTN MoMo transaction status — the single source of truth.
//
// Both the checkout poll (app/api/payments/mtn-momo/status) and the provider
// callback (app/api/payments/mtn-momo/callback) resolve a transaction through
// here, so there is exactly one definition of "MTN says this is paid".
//
// WHY THE CALLBACK USES THIS
//
// MADAPI's callback signing scheme is not documented to us, and inventing one
// would be worse than having none: a fabricated check looks like protection
// while accepting anything. So the callback is treated as an unverified HINT —
// "something may have happened for transaction X" — and this module then asks
// MTN directly, over an authenticated request made with OUR credentials.
//
// A forged callback therefore achieves nothing except making the server ask MTN
// a question, to which MTN answers "not paid". That gives callback-latency
// confirmation with poll-grade trust, and requires no cryptography we cannot
// verify.
// ─────────────────────────────────────────────────────────────────────────────

const BASE_URL = process.env.MTN_MOMO_BASE_URL || "https://api.mtn.com";
const CONSUMER_KEY = process.env.MTN_MOMO_CONSUMER_KEY;
const CONSUMER_SECRET = process.env.MTN_MOMO_CONSUMER_SECRET;

/** Outbound calls get a ceiling so a hung provider cannot pin a serverless worker. */
const TIMEOUT_MS = 15_000;

export type MomoStatus = "completed" | "failed" | "processing" | "unknown";

const SUCCESS = ["successful", "succeeded", "completed", "success"];
const FAILURE = ["failed", "rejected", "cancelled", "expired", "timeout"];

/** Cached OAuth token — MTN's tokens are short-lived but not per-request. */
let cachedToken: { value: string; expiresAt: number } | null = null;

async function accessToken(): Promise<string | null> {
  if (!CONSUMER_KEY || !CONSUMER_SECRET) return null;

  if (cachedToken && cachedToken.expiresAt > Date.now() + 30_000) {
    return cachedToken.value;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(
      `${BASE_URL}/v1/oauth/access_token?grant_type=client_credentials`,
      {
        method: "POST",
        headers: {
          Authorization:
            "Basic " +
            Buffer.from(`${CONSUMER_KEY}:${CONSUMER_SECRET}`).toString("base64"),
          "Content-Type": "application/x-www-form-urlencoded",
          "Content-Length": "0",
        },
        signal: controller.signal,
        cache: "no-store",
      },
    );

    if (!res.ok) {
      console.error("[momo] token request failed:", res.status);
      return null;
    }

    const body = await res.json();
    if (!body?.access_token) return null;

    cachedToken = {
      value: body.access_token,
      expiresAt: Date.now() + Number(body.expires_in || 3599) * 1000,
    };
    return cachedToken.value;
  } catch (err) {
    console.error("[momo] token request error:", err);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Ask MTN what actually happened to a transaction.
 *
 * Returns "unknown" rather than throwing when MTN is unreachable, so callers can
 * keep waiting instead of showing a customer a false failure. "unknown" must
 * never be treated as either paid or failed.
 */
export async function fetchMomoStatus(transactionId: string): Promise<MomoStatus> {
  const token = await accessToken();
  if (!token) return "unknown";

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(
      `${BASE_URL}/v1/payments/${encodeURIComponent(transactionId)}/transactionStatus`,
      {
        headers: { Authorization: `Bearer ${token}` },
        signal: controller.signal,
        cache: "no-store",
      },
    );

    if (!res.ok) {
      // A 404 usually means MTN has not registered the transaction yet, which
      // is a normal race immediately after initiation — not a failure.
      return "unknown";
    }

    const data = await res.json();
    const raw = String(data?.data?.status || data?.status || "").toLowerCase();

    if (SUCCESS.includes(raw)) return "completed";
    if (FAILURE.includes(raw)) return "failed";
    return "processing";
  } catch (err) {
    console.error("[momo] status request error:", err);
    return "unknown";
  } finally {
    clearTimeout(timer);
  }
}

/** True when MoMo is configured well enough to verify anything at all. */
export function momoConfigured(): boolean {
  return Boolean(CONSUMER_KEY && CONSUMER_SECRET);
}
