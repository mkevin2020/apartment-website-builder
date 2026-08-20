import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

// ─────────────────────────────────────────────────────────────────────────────
// Signed session tokens.
//
// The app uses its own account tables (admin_accounts / managers / employees /
// tenants) rather than Supabase Auth, so there is no Supabase JWT to lean on.
// Instead the login route mints an HMAC-signed token and stores it in an
// httpOnly cookie. The browser can read neither the signing key nor the cookie,
// so a session can no longer be forged from the devtools console the way the
// old `localStorage.setItem("admin_session", ...)` sessions could.
//
// Signing uses Web Crypto (not the `jsonwebtoken` package) so the exact same
// code verifies tokens in the Edge runtime (proxy.ts) and the Node runtime
// (route handlers, server components).
// ─────────────────────────────────────────────────────────────────────────────

// ── Cookie naming ───────────────────────────────────────────────────────────
//
// The `__Host-` prefix is enforced by the browser, not by us: a cookie with it
// is REFUSED unless it is Secure, Path=/, and carries no Domain attribute. That
// makes it impossible for a sibling subdomain to overwrite the session — the
// cookie-fixation vector a bare name leaves open.
//
// The prefix requires Secure, which requires HTTPS, so it is only used where
// the connection actually is secure. Development over http://localhost keeps
// the plain name.
//
// MIGRATION: reads accept BOTH names (see readSessionCookie). Existing sessions
// keep working; the prefixed cookie is what gets written from now on. The
// legacy fallback can be deleted once every issued cookie has expired — they
// last 8 hours, so a day after deploying is comfortably enough.
const SESSION_COOKIE_SECURE = "__Host-cv_session";
const SESSION_COOKIE_PLAIN = "cv_session";

/** The name to WRITE. Prefixed only when the cookie will carry Secure. */
export const SESSION_COOKIE =
  process.env.NODE_ENV === "production" ? SESSION_COOKIE_SECURE : SESSION_COOKIE_PLAIN;

/** Every name to READ, newest first. */
export const SESSION_COOKIE_NAMES = [SESSION_COOKIE_SECURE, SESSION_COOKIE_PLAIN];

/** Legacy name, exported so logout can clear it too. */
export const SESSION_COOKIE_LEGACY = SESSION_COOKIE_PLAIN;
const MAX_AGE_SECONDS = 60 * 60 * 8; // 8 hours

export type Role = "admin" | "manager" | "employee" | "tenant";

export interface SessionPayload {
  /** Primary key in the table that owns this role. */
  sub: number;
  role: Role;
  name?: string;
  email?: string;
  /** Employees only — drives which departmental dashboard they land on. */
  dept?: string | null;
  /** Issued-at, epoch seconds. Lets an account-wide cutoff invalidate every
   *  token minted before a password change. */
  iat?: number;
  /** Unique token id, so a single session can be revoked on logout. */
  jti?: string;
  /** Expiry, epoch seconds. */
  exp: number;
}

function signingSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (secret && secret.length >= 32) return secret;

  // A weak secret means forgeable sessions, so refuse to run with one in prod.
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "SESSION_SECRET is missing or shorter than 32 characters. Generate one with: openssl rand -base64 48",
    );
  }
  return "dev-only-insecure-session-secret-change-me!!";
}

const encoder = new TextEncoder();

function b64urlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// Returns a view over a freshly allocated ArrayBuffer, which is what
// crypto.subtle's BufferSource parameters expect.
function b64urlDecode(value: string): Uint8Array<ArrayBuffer> {
  const padding = value.length % 4 === 0 ? "" : "=".repeat(4 - (value.length % 4));
  const binary = atob(value.replace(/-/g, "+").replace(/_/g, "/") + padding);
  const out = new Uint8Array(new ArrayBuffer(binary.length));
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

async function hmacKey(): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(signingSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

export async function signSession(
  payload: Omit<SessionPayload, "exp" | "iat" | "jti">,
  ttlSeconds = MAX_AGE_SECONDS,
): Promise<string> {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const full: SessionPayload = {
    ...payload,
    iat: nowSeconds,
    // Random per-token id so logout can revoke exactly this session without
    // touching the user's other devices.
    jti: crypto.randomUUID(),
    exp: nowSeconds + ttlSeconds,
  };
  const body = b64urlEncode(encoder.encode(JSON.stringify(full)));
  const signature = new Uint8Array(
    await crypto.subtle.sign("HMAC", await hmacKey(), encoder.encode(body)),
  );
  return `${body}.${b64urlEncode(signature)}`;
}

export async function verifySession(
  token: string | undefined | null,
): Promise<SessionPayload | null> {
  if (!token) return null;
  const [body, signature] = token.split(".");
  if (!body || !signature) return null;

  try {
    const valid = await crypto.subtle.verify(
      "HMAC",
      await hmacKey(),
      b64urlDecode(signature),
      encoder.encode(body),
    );
    if (!valid) return null;

    const payload = JSON.parse(
      new TextDecoder().decode(b64urlDecode(body)),
    ) as SessionPayload;

    if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;

    // Signature and expiry are necessary but not sufficient: a token that was
    // logged out, or predates a password change, is still perfectly well-formed.
    // isRevoked() fails open if the revocation tables are unavailable.
    const { isRevoked } = await import("./revocation");
    if (await isRevoked(payload)) return null;

    return payload;
  } catch {
    // Malformed token — treat exactly like no token at all.
    return null;
  }
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    // Allows http://localhost during development; always on once deployed.
    // NOTE: the __Host- prefix used in production REQUIRES this to be true and
    // `path` to be exactly "/", and forbids a Domain attribute. The browser
    // silently drops the cookie otherwise, so do not "relax" any of these.
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  };
}

/** Read the session from a route-handler request, or from the ambient
 *  request when called inside a server component. */
export async function getSession(req?: NextRequest): Promise<SessionPayload | null> {
  const jar = req ? req.cookies : await cookies();
  // Accept the prefixed name and the legacy one, so rolling out __Host- does
  // not sign every logged-in user out mid-session.
  for (const name of SESSION_COOKIE_NAMES) {
    const token = jar.get(name)?.value;
    if (token) {
      const session = await verifySession(token);
      if (session) return session;
    }
  }
  return null;
}

/** Thrown by the require* helpers; turn it into a response with errorResponse. */
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export async function requireSession(req?: NextRequest): Promise<SessionPayload> {
  const session = await getSession(req);
  if (!session) throw new HttpError(401, "You must be signed in to do this.");
  return session;
}

export async function requireRole(
  req: NextRequest | undefined,
  roles: Role[],
): Promise<SessionPayload> {
  const session = await requireSession(req);
  if (!roles.includes(session.role)) {
    throw new HttpError(403, "You do not have permission to do this.");
  }
  return session;
}

/** Staff = anyone who can act on other people's records. */
export const STAFF: Role[] = ["admin", "manager", "employee"];
export const ADMIN_OR_MANAGER: Role[] = ["admin", "manager"];

/**
 * Standard catch-block response. Known HttpErrors keep their status and
 * message; anything else is logged server-side and returned as a generic 500,
 * so internal details (table names, driver errors) never reach the browser.
 */
export function errorResponse(err: unknown): NextResponse {
  if (err instanceof HttpError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  console.error("Unhandled route error:", err);
  return NextResponse.json(
    { error: "An unexpected error occurred. Please try again." },
    { status: 500 },
  );
}
