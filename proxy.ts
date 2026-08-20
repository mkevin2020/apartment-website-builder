import { NextRequest, NextResponse } from "next/server";
import {
  SESSION_COOKIE,
  SESSION_COOKIE_NAMES,
  verifySession,
  type Role,
} from "@/lib/auth/session";

// ─────────────────────────────────────────────────────────────────────────────
// Runs on every request. Three jobs:
//   1. Force HTTPS in production.
//   2. Attach security headers to every response.
//   3. Gate the portal pages on a valid signed session.
//
// Note that (3) is a redirect for the user's benefit, not the security boundary
// — the real enforcement is requireRole() inside each API route, because that
// is what guards the data. This only stops someone landing on a portal shell
// they have no session for.
//
// This is the `proxy.ts` convention, which replaced `middleware.ts` in Next 16.
// Same execution model and same `config.matcher`; the exported function is
// named `proxy` rather than `middleware`.
// ─────────────────────────────────────────────────────────────────────────────

/** Portal prefixes and the roles allowed to open them. */
const PROTECTED: Array<{ prefix: string; roles: Role[]; loginPath: string }> = [
  { prefix: "/admin", roles: ["admin"], loginPath: "/login" },
  { prefix: "/manager", roles: ["admin", "manager"], loginPath: "/login" },
  { prefix: "/employee", roles: ["admin", "manager", "employee"], loginPath: "/employee/login" },
  { prefix: "/tenant", roles: ["tenant"], loginPath: "/login" },
];

/** Pages under a protected prefix that must stay reachable when signed out. */
const PUBLIC_EXCEPTIONS = [
  "/tenant/register",
  "/tenant/forgot-password",
  "/employee/login",
  "/employee/forgot-password",
  "/manager/forgot-password",
];

function securityHeaders(isDev: boolean): Record<string, string> {
  const connectSrc = [
    "'self'",
    "https://*.supabase.co",
    "wss://*.supabase.co",
    "https://api.stripe.com",
    "https://api-m.paypal.com",
    "https://api-m.sandbox.paypal.com",
    "https://www.paypal.com",
    "https://*.tawk.to",
    "wss://*.tawk.to",
    // Local helper services used in development (Ollama, LibreTranslate).
    ...(isDev ? ["http://localhost:11434", "http://localhost:5000", "ws://localhost:*"] : []),
  ].join(" ");

  const csp = [
    "default-src 'self'",
    // 'unsafe-inline' is required by the printable receipt / report / schedule
    // popups, which are built with document.write() and inline handlers.
    // 'unsafe-eval' is only needed by the dev bundler.
    `script-src 'self' 'unsafe-inline' ${isDev ? "'unsafe-eval'" : ""} https://js.stripe.com https://www.paypal.com https://embed.tawk.to https://*.tawk.to`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' data: https://fonts.gstatic.com https://*.tawk.to",
    "img-src 'self' data: blob: https:",
    "media-src 'self' data: blob: https:",
    `connect-src ${connectSrc}`,
    "frame-src 'self' https://js.stripe.com https://hooks.stripe.com https://www.paypal.com https://*.tawk.to",
    "worker-src 'self' blob:",
    // Hard stops that cost nothing and close real attack classes.
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(isDev ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");

  const headers: Record<string, string> = {
    "Content-Security-Policy": csp,
    // Legacy clickjacking defence; frame-ancestors above covers modern browsers.
    "X-Frame-Options": "DENY",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "X-DNS-Prefetch-Control": "off",
    "Permissions-Policy": [
      "camera=(self)", // QR check-in scanner needs the camera
      "microphone=(self)", // voice notes in internal chat
      "geolocation=()",
      "payment=()",
      "interest-cohort=()",
    ].join(", "),
  };

  if (!isDev) {
    headers["Strict-Transport-Security"] =
      "max-age=63072000; includeSubDomains; preload";
  }
  return headers;
}

/**
 * Paths that must accept cross-origin POSTs because a third party calls them.
 * Each authenticates the caller by other means (a provider signature), so the
 * origin check below would only get in the way.
 */
const CROSS_ORIGIN_ALLOWED = [
  "/api/stripe/webhook", // verified via stripe-signature
  "/api/payments/stripe", // PUT branch is the Stripe webhook
];

/**
 * Reject state-changing requests that arrive from another site.
 *
 * The session cookie is SameSite=Lax, which already blocks cross-site POSTs
 * carrying it — this is the belt to that braces. It costs one header comparison
 * and covers the cases Lax does not: a same-site-but-different-subdomain
 * attacker, and any future change of the cookie to SameSite=None.
 *
 * Requests with no Origin header at all are allowed through: server-to-server
 * callers and some older clients omit it, and the cookie's SameSite attribute
 * is what actually stops a browser-driven attack.
 */
function isCrossSiteWrite(req: NextRequest, isDev: boolean): boolean {
  const method = req.method.toUpperCase();
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") return false;

  const { pathname } = req.nextUrl;
  if (CROSS_ORIGIN_ALLOWED.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return false;
  }

  const origin = req.headers.get("origin");
  if (!origin) return false;

  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    return true; // Unparseable Origin — treat as hostile.
  }

  // Build the set of hosts this request could legitimately have come from.
  //
  // Comparing against the Host header alone was wrong behind a tunnel. ngrok
  // (and any proxy run with --host-header=rewrite) replaces Host with the
  // upstream address, so a phone browsing https://x.ngrok-free.dev sends
  // Origin: x.ngrok-free.dev while the server sees Host: localhost:3000. Those
  // never match, and every POST — including login — was rejected with 403.
  const candidates = new Set<string>();

  const forwardedHost = req.headers.get("x-forwarded-host");
  if (forwardedHost) {
    // A proxy that sets this is telling us the address the client actually used.
    for (const h of forwardedHost.split(",")) candidates.add(h.trim());
  }

  const host = req.headers.get("host");
  if (host) candidates.add(host);

  // The canonical deployment address, so a correct request is accepted even if
  // an intermediary mangles both headers.
  for (const value of [process.env.NEXT_PUBLIC_BASE_URL, process.env.TRUSTED_ORIGIN]) {
    if (!value) continue;
    try {
      candidates.add(new URL(value).host);
    } catch {
      candidates.add(value); // already a bare host
    }
  }

  // Extra hosts an operator explicitly trusts (comma-separated), for setups
  // where the tunnel address changes and is not worth hardcoding.
  for (const extra of (process.env.TRUSTED_ORIGINS || "").split(",")) {
    const trimmed = extra.trim();
    if (trimmed) {
      try {
        candidates.add(new URL(trimmed).host);
      } catch {
        candidates.add(trimmed);
      }
    }
  }

  if (candidates.has(originHost)) return false;

  // In development the origin check is not the control that matters — the
  // session cookie is SameSite=Lax, which is what actually stops a cross-site
  // POST in a browser. Blocking here mainly breaks tunnels used for phone
  // testing, so warn loudly instead of failing the request. Production stays
  // strict.
  if (isDev) {
    console.warn(
      `[security] cross-origin write allowed in development: origin=${originHost} ` +
        `host=${host ?? "?"}. This WOULD be rejected in production — set ` +
        `TRUSTED_ORIGINS or NEXT_PUBLIC_BASE_URL if this address is legitimate.`,
    );
    return false;
  }

  return true;
}

export async function proxy(req: NextRequest) {
  const isDev = process.env.NODE_ENV !== "production";
  const { pathname, search } = req.nextUrl;

  // ── 1. Force HTTPS ────────────────────────────────────────────────────────
  // Next 16 already 308s http→https in production builds on its own, so this is
  // a backstop rather than the primary mechanism: it covers hosts that hand the
  // original scheme over in x-forwarded-proto (Vercel and most reverse proxies)
  // where the framework's own check sees an https connection.
  const proto = req.headers.get("x-forwarded-proto");
  if (!isDev && proto === "http") {
    const httpsUrl = new URL(req.url);
    httpsUrl.protocol = "https:";
    return NextResponse.redirect(httpsUrl, 308);
  }

  // ── 2. Reject cross-site writes ───────────────────────────────────────────
  if (isCrossSiteWrite(req, isDev)) {
    return NextResponse.json(
      { error: "Cross-site request rejected." },
      { status: 403, headers: securityHeaders(isDev) },
    );
  }

  // ── 3. Gate portal pages ──────────────────────────────────────────────────
  let response: NextResponse | undefined;

  const isException = PUBLIC_EXCEPTIONS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );

  if (!isException) {
    const rule = PROTECTED.find(
      (r) => pathname === r.prefix || pathname.startsWith(`${r.prefix}/`),
    );
    if (rule) {
      // Both cookie names, for the __Host- migration window.
      let session = null;
      for (const name of SESSION_COOKIE_NAMES) {
        const token = req.cookies.get(name)?.value;
        if (token) {
          session = await verifySession(token);
          if (session) break;
        }
      }
      if (!session || !rule.roles.includes(session.role)) {
        const loginUrl = new URL(rule.loginPath, req.url);
        loginUrl.searchParams.set("next", pathname + search);
        response = NextResponse.redirect(loginUrl);
        // Clear a stale or wrong-role cookie so the login page starts clean.
        if (!session) {
          for (const name of SESSION_COOKIE_NAMES) response.cookies.delete(name);
        }
      }
    }
  }

  // ── 4. Security headers on whatever response we return ────────────────────
  response ??= NextResponse.next();
  for (const [key, value] of Object.entries(securityHeaders(isDev))) {
    response.headers.set(key, value);
  }
  return response;
}

export const config = {
  // Everything except Next's own static output and public asset files.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest.json|sw.js|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico|mp4|webm|woff2?)$).*)",
  ],
};
