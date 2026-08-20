// Signed-out flows that must KEEP WORKING.
//
// Locking the database down is only half the job: the other half is not
// breaking the pages that legitimately run without a session. Every case here
// is one that broke when client-side Supabase access was removed, and was
// reported as "this account doesn't exist" or a blank screen.
//
// A security fix that silently disables the forgot-password flow is not a fix.

const BASE = process.env.BASE || "http://localhost:3000";
let pass = 0, fail = 0;

async function check(name, fn) {
  try {
    const r = await fn();
    if (r === true) { console.log(`  PASS  ${name}`); pass++; }
    else { console.log(`  FAIL  ${name}\n          ${r}`); fail++; }
  } catch (e) { console.log(`  ERROR ${name}\n          ${e.message}`); fail++; }
}

const post = (path, body) =>
  fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

console.log(`\nSigned-out flow suite -> ${BASE}\n`);

// ── Account lookup: the "this account doesn't exist" regression ─────────────
console.log("Forgot password");

// Discover a real address to test with, so this suite works on any dataset.
let knownEmail = process.env.TEST_EMAIL || null;
if (!knownEmail) {
  const { createClient } = await import("@supabase/supabase-js");
  const { readFileSync } = await import("node:fs");
  const env = {};
  for (const line of readFileSync("./.env.local", "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#") || !t.includes("=")) continue;
    const i = t.indexOf("=");
    env[t.slice(0, i).trim()] = t.slice(i + 1).trim().replace(/^["']|["']$/g, "");
  }
  const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
  const { data } = await sb.from("tenants").select("email").not("email", "is", null).limit(1);
  knownEmail = data?.[0]?.email || null;
}

if (!knownEmail) {
  console.log("  SKIP  no tenant email available to test with");
} else {
  await check(`an existing address (${knownEmail}) is found while signed out`, async () => {
    const res = await post("/api/auth/locate-account", { email: knownEmail });
    if (res.status === 429) return "rate limited — rerun in a few minutes";
    if (res.status !== 200) return `status ${res.status}`;
    const b = await res.json();
    return b.found === true && b.accountType
      ? true
      : `existing account reported as missing: ${JSON.stringify(b)}`;
  });
}

await check("an unknown address is reported as not found", async () => {
  const res = await post("/api/auth/locate-account", {
    email: `nobody-${Date.now()}@example.invalid`,
  });
  if (res.status === 429) return "rate limited — rerun in a few minutes";
  if (res.status !== 200) return `status ${res.status}`;
  const b = await res.json();
  return b.found === false ? true : `unknown address reported as found: ${JSON.stringify(b)}`;
});

// ── Public pages must still render ──────────────────────────────────────────
console.log("\nPublic pages render");
for (const [name, path] of [
  ["home", "/"],
  ["apartments listing", "/apartments"],
  ["login", "/login"],
  ["tenant register", "/tenant/register"],
  ["forgot password (router)", "/forgot-password"],
  ["tenant forgot password", "/tenant/forgot-password"],
  ["employee forgot password", "/employee/forgot-password"],
  ["manager forgot password", "/manager/forgot-password"],
  ["contact", "/contact"],
  ["feedback", "/feedback"],
]) {
  await check(`${name} returns 200`, async () => {
    const res = await fetch(`${BASE}${path}`);
    return res.status === 200 ? true : `status ${res.status}`;
  });
}

// The tenant-only login page was removed (/login authenticates all four roles).
// Old bookmarks, emails and printed links must not 404.
await check("/tenant/login redirects to the universal login", async () => {
  const res = await fetch(`${BASE}/tenant/login`, { redirect: "manual" });
  if (![301, 302, 307, 308].includes(res.status)) {
    return `expected a redirect, got ${res.status}`;
  }
  const location = res.headers.get("location") || "";
  return location.endsWith("/login") ? true : `redirects to "${location}" instead of /login`;
});


// ── Public data that must stay readable ────────────────────────────────────
console.log("\nPublic data");
await check("apartment listings load without a session", async () => {
  const res = await post("/api/data", {
    table: "apartments",
    op: "select",
    columns: "id, name, price_per_month",
    limit: 5,
  });
  if (res.status !== 200) return `status ${res.status} — the public listing is broken`;
  const b = await res.json();
  return Array.isArray(b.data) ? true : `unexpected shape: ${JSON.stringify(b).slice(0, 150)}`;
});

await check("visitors can still open a chat session", async () => {
  const res = await post("/api/chat/session", { userRole: "visitor", userName: "flowtest" });
  return res.status === 200 ? true : `status ${res.status}`;
});

// Opt-in, and last.
//
// This test exhausts the per-IP budget (15 lookups per 10 minutes) to prove the
// cap exists. The side effect is that every OTHER assertion in this file then
// fails with 429 for the rest of the window — including on the next run, which
// makes the suite look broken when it is not. A test that can only be run once
// every ten minutes does not get run.
//
// So it is off unless asked for:  RATE_LIMIT_TEST=1 node tests/security/signed-out-flows.mjs
console.log("\nEnumeration control");
if (process.env.RATE_LIMIT_TEST !== "1") {
  console.log("  SKIP  rate-limit exhaustion (set RATE_LIMIT_TEST=1 to run; burns the 10-min budget)");
} else {
  await check("account lookup is rate limited", async () => {
    let saw429 = false;
    for (let i = 0; i < 25; i++) {
      const res = await post("/api/auth/locate-account", { email: `probe${i}@example.invalid` });
      if (res.status === 429) { saw429 = true; break; }
    }
    return saw429 ? true : "no 429 after 25 lookups — enumeration is uncapped";
  });
}

console.log(`\n${"─".repeat(56)}`);
console.log(`  ${pass} passed, ${fail} failed`);
console.log(`${"─".repeat(56)}\n`);
process.exit(fail > 0 ? 1 : 0);
