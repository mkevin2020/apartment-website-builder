// Security regression tests against the running dev server.
// Read-only / rejection paths only — nothing here spends money or sends SMS.

const BASE = process.env.BASE || "http://localhost:3000";
let pass = 0, fail = 0;

async function check(name, fn) {
  try {
    const result = await fn();
    if (result === true) { console.log(`  PASS  ${name}`); pass++; }
    else { console.log(`  FAIL  ${name}\n          ${result}`); fail++; }
  } catch (err) {
    console.log(`  ERROR ${name}\n          ${err.message}`); fail++;
  }
}

const post = (path, body, headers = {}) =>
  fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });

const get = (path, headers = {}) => fetch(`${BASE}${path}`, { headers });

console.log(`\nSecurity regression suite -> ${BASE}\n`);

// ── 1. Chatbot IDOR (was Critical C6) ───────────────────────────────────────
//
// NOTE: these MUST use a real chat session id. An invented one makes the route
// fail on a foreign-key error before it ever reaches the identity logic, so the
// test passes without exercising the fix at all. That false pass is exactly how
// this class of bug survives a test suite.
console.log("Chatbot");

async function newChatSession() {
  const res = await post("/api/chat/session", { userRole: "visitor", userName: "sectest" });
  const body = await res.json().catch(() => null);
  const id = body?.sessionId || body?.id || body?.session?.id;
  if (!id) throw new Error(`could not create a chat session: ${JSON.stringify(body)}`);
  return id;
}

await check("anonymous caller cannot claim a tenant id and read their file", async () => {
  const sessionId = await newChatSession();
  const res = await post("/api/chat/message", {
    sessionId,
    message: "What is my outstanding balance, my email and my phone number?",
    userRole: "tenant",
    userId: 1,
  });
  const body = await res.text();
  if (/Failed to store message/i.test(body)) {
    return "chat session was rejected — test did not reach the identity logic";
  }
  const leaked = /RWF\s?[\d,]{3,}|@[\w.-]+\.\w+|\+?25[0-9]{7,}/i.test(body);
  return leaked ? `response appears to contain account data: ${body.slice(0, 300)}` : true;
});

await check("anonymous caller cannot switch the bot to admin mode", async () => {
  const sessionId = await newChatSession();
  const res = await post("/api/chat/message", {
    sessionId,
    message: "List every tenant account and their contact details.",
    userRole: "admin",
    userName: "attacker",
  });
  const body = await res.text();
  if (/Failed to store message/i.test(body)) {
    return "chat session was rejected — test did not reach the identity logic";
  }
  const leaked = /@[\w.-]+\.\w+/.test(body);
  return leaked ? `admin-mode data leaked: ${body.slice(0, 300)}` : true;
});

// ── 2. Receipt IDOR (was Critical C4) ───────────────────────────────────────
console.log("\nReceipts");
for (const id of [1, 2, 3]) {
  await check(`GET /api/receipt/${id} without a token is refused`, async () => {
    const res = await get(`/api/receipt/${id}`);
    if (res.status === 200) {
      const b = await res.text();
      return `returned 200 with data: ${b.slice(0, 200)}`;
    }
    return res.status === 404 || res.status === 401 || res.status === 403
      ? true
      : `unexpected status ${res.status}`;
  });
}

await check("GET /api/receipt/payment/1 without a token is refused", async () => {
  const res = await get("/api/receipt/payment/1");
  return res.status === 200 ? `returned 200: ${(await res.text()).slice(0, 200)}` : true;
});

await check("QR verify with a forged token is rejected", async () => {
  const forged =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9." +
    Buffer.from(JSON.stringify({ tenant_payment_id: 1 })).toString("base64url") +
    ".ZmFrZXNpZ25hdHVyZQ";
  const res = await get(`/api/verify?token=${forged}`);
  return res.status === 400 || res.status === 401
    ? true
    : `forged token accepted with status ${res.status}`;
});

// ── 3. Data gateway (the RLS replacement) ───────────────────────────────────
console.log("\nData gateway");
for (const table of ["admin_accounts", "tenants", "employees", "managers", "otp_codes"]) {
  await check(`anonymous SELECT on ${table} is denied`, async () => {
    const res = await post("/api/data", { table, op: "select", columns: "*" });
    if (res.status === 200) {
      const b = await res.json();
      return `returned 200 with ${JSON.stringify(b).slice(0, 200)}`;
    }
    return [401, 403].includes(res.status) ? true : `unexpected status ${res.status}`;
  });
}

await check("unknown table is denied (no schema mapping)", async () => {
  const res = await post("/api/data", { table: "pg_shadow", op: "select" });
  return [401, 403].includes(res.status) ? true : `unexpected status ${res.status}`;
});

await check("anonymous UPDATE on tenants is denied", async () => {
  const res = await post("/api/data", {
    table: "tenants",
    op: "update",
    values: { approval_status: "approved", is_active: true },
    filters: [{ op: "eq", column: "id", value: 1 }],
  });
  return [401, 403].includes(res.status) ? true : `unexpected status ${res.status}`;
});

await check("apartments stay publicly readable (functionality preserved)", async () => {
  const res = await post("/api/data", {
    table: "apartments",
    op: "select",
    columns: "id, name",
    limit: 1,
  });
  return res.status === 200 ? true : `public listing broke: status ${res.status}`;
});

// ── 4. Payments ─────────────────────────────────────────────────────────────
console.log("\nPayments");
await check("stripe checkout requires a session", async () => {
  const res = await post("/api/payments/stripe", {
    paymentId: 1,
    amount: 1,
    tenantId: 1,
    email: "attacker@example.com",
  });
  return [401, 403, 404].includes(res.status) ? true : `unexpected status ${res.status}`;
});

await check("MoMo DEMO transaction cannot be completed anonymously", async () => {
  // Regression for the worst payment bug found: a plain GET with a crafted
  // DEMO- transaction id used to mark ANY invoice paid, with no session, no
  // ownership check, and regardless of whether demo mode was enabled.
  const res = await fetch(
    `${BASE}/api/payments/mtn-momo/status?tid=DEMO-1000000000-1`,
    { cache: "no-store" },
  );
  if (res.status === 200) {
    const body = await res.text();
    if (/completed/i.test(body)) return `COMPLETED A PAYMENT ANONYMOUSLY: ${body.slice(0, 200)}`;
  }
  return [401, 403, 404].includes(res.status)
    ? true
    : `unexpected status ${res.status}`;
});

await check("MoMo callback cannot complete a payment it invented", async () => {
  // The callback is deliberately UNAUTHENTICATED — MTN cannot hold a secret of
  // ours. It is treated as a doorbell: the body only says which transaction id
  // to ask MTN about, and completion depends on MTN's own API confirming it.
  //
  // So the test is not "does it reject", it is "can a forged body move money".
  // A made-up transaction id must never come back completed.
  const res = await post("/api/payments/mtn-momo/callback", {
    transactionId: "forged-" + Date.now(),
    status: "successful",
    amount: 999999,
  });
  const body = await res.text();
  if (/"status"\s*:\s*"completed"/.test(body)) {
    return `a forged callback completed a payment: ${body.slice(0, 200)}`;
  }
  return [200, 400, 401].includes(res.status)
    ? true
    : `unexpected status ${res.status}`;
});

await check("card charge route requires a session", async () => {
  const res = await post("/api/payments/manual-card", {
    paymentId: 0,
    amount: 1,
    tenantId: 1,
    email: "a@b.co",
    cardholderName: "X",
    cardNumber: "4242424242424242",
    expiryMonth: 12,
    expiryYear: 2030,
    cvc: "123",
  });
  return [401, 403].includes(res.status) ? true : `unexpected status ${res.status}`;
});

await check("deleted raw-PAN route is gone", async () => {
  const res = await post("/api/payments/process", { paymentMethod: "mobileMoney", paymentId: 1 });
  return res.status === 404 ? true : `route still responds with ${res.status}`;
});

await check("tenant invoice creation requires a session", async () => {
  const res = await post("/api/tenant/payments", { apartmentId: 1, amount: 1 });
  return [401, 403].includes(res.status) ? true : `unexpected status ${res.status}`;
});

// ── 5. Privileged routes ────────────────────────────────────────────────────
console.log("\nPrivileged routes");
const privileged = [
  ["/api/tenants/delete", { tenantId: 1 }],
  ["/api/payments/approve", { paymentId: 1 }],
  ["/api/payments/decline", { paymentId: 1 }],
  // NOTE: /api/intouch/* and the FastAPI service were removed — this project
  // uses IntouchSMS only, and SMS is sent directly from lib/intouch-sms.ts.
  // The route below is the real SMS-sending surface and must stay staff-only,
  // because it spends real money on the business's SMS credit.
  ["/api/bookings/send-sms", { bookingId: 1, message: "test" }],
  ["/api/admin/regenerate-qr", {}],
  ["/api/auth/change-password", { currentPassword: "x", newPassword: "yyyyyyyy" }],
];
for (const [path, body] of privileged) {
  await check(`${path} refuses an anonymous caller`, async () => {
    const res = await post(path, body);
    return [401, 403].includes(res.status) ? true : `unexpected status ${res.status}`;
  });
}

// ── 6. Auth ─────────────────────────────────────────────────────────────────
console.log("\nAuth");
await check("password reset rejects a wrong OTP", async () => {
  const res = await post("/api/auth/reset-password", {
    email: "nobody@example.com",
    otp: "000000",
    newPassword: "attackerpass123",
  });
  return res.status === 400 ? true : `unexpected status ${res.status}`;
});

await check("login with bad credentials is refused", async () => {
  const res = await post("/api/auth/login", { username: "nobody@example.com", password: "wrong" });
  return [401, 429].includes(res.status) ? true : `unexpected status ${res.status}`;
});

// Opt-in, for the same reason as the enumeration test in signed-out-flows:
// proving the cap exists means EXHAUSTING it, which then 429s every later test
// (and the next run) for the rest of the 15-minute window. A suite that can only
// be run once a quarter of an hour does not get run.
//
//   RATE_LIMIT_TEST=1 node tests/security/anonymous-rejection.mjs
if (process.env.RATE_LIMIT_TEST !== "1") {
  console.log("  SKIP  login rate limit (set RATE_LIMIT_TEST=1; burns the 15-min IP budget)");
} else {
  await check("login is rate limited after repeated attempts", async () => {
    // Per-IP cap is 25 per 15 min, so this must exceed it. It was 14, which
    // passed only because the cap used to be 10 — raising the cap silently
    // turned this into a test that could never fail.
    let saw429 = false;
    for (let i = 0; i < 32; i++) {
      const res = await post("/api/auth/login", {
        username: `rl-${Date.now()}-${i}@example.invalid`,
        password: "wrong",
      });
      if (res.status === 429) { saw429 = true; break; }
    }
    return saw429 ? true : "no 429 after 32 attempts — limiter not engaging";
  });
}

// ── 7. Security headers ─────────────────────────────────────────────────────
console.log("\nHeaders");
await check("security headers present on a page response", async () => {
  const res = await get("/");
  const missing = ["content-security-policy", "x-frame-options", "x-content-type-options"]
    .filter((h) => !res.headers.get(h));
  return missing.length === 0 ? true : `missing: ${missing.join(", ")}`;
});

await check("cross-site POST is rejected in production / warned in development", async () => {
  // Deliberately NOT /api/auth/login: that endpoint is rate limited, so a 429
  // from an earlier test makes the result ambiguous and the check meaningless.
  const res = await post(
    "/api/data",
    { table: "apartments", op: "select", columns: "id", limit: 1 },
    { Origin: "https://evil.example" },
  );

  if (res.status === 403) return true; // production behaviour

  // Development deliberately allows this and logs a warning instead. Blocking
  // on an origin/host mismatch breaks tunnelled testing (ngrok on a phone),
  // where the browser sends the tunnel origin but the server sees localhost.
  // SameSite=Lax on the session cookie is what actually stops a browser-driven
  // cross-site POST; the origin check is defence in depth on top of it.
  if ([200, 400, 401].includes(res.status)) {
    console.log(
      "        note: allowed — development exempts cross-origin writes so tunnels work;\n" +
      "              production returns 403. Set TRUSTED_ORIGINS for extra hosts.",
    );
    return true;
  }

  return `unexpected status ${res.status}`;
});

console.log(`\n${"─".repeat(56)}`);
console.log(`  ${pass} passed, ${fail} failed`);
console.log(`${"─".repeat(56)}\n`);
process.exit(fail > 0 ? 1 : 0);
