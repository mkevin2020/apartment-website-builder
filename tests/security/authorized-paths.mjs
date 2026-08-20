// Authorized-path tests: prove the fixes did not simply break the app, and that
// object-level scoping actually holds for a real signed-in tenant.
import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const BASE = process.env.BASE || "http://localhost:3000";
const ENV_PATH = "./.env.local";

const env = {};
for (const line of readFileSync(ENV_PATH, "utf8").split(/\r?\n/)) {
  const t = line.trim();
  if (!t || t.startsWith("#") || !t.includes("=")) continue;
  const i = t.indexOf("=");
  env[t.slice(0, i).trim()] = t.slice(i + 1).trim().replace(/^["']|["']$/g, "");
}

const b64url = (buf) =>
  Buffer.from(buf).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

function mintSession({ sub, role, name, email }) {
  const now = Math.floor(Date.now() / 1000);
  const payload = { sub, role, name, email, dept: null, iat: now, jti: crypto.randomUUID(), exp: now + 3600 };
  const body = b64url(JSON.stringify(payload));
  const sig = createHmac("sha256", env.SESSION_SECRET).update(body).digest();
  return `${body}.${b64url(sig)}`;
}

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

let pass = 0, fail = 0;
async function check(name, fn) {
  try {
    const r = await fn();
    if (r === true) { console.log(`  PASS  ${name}`); pass++; }
    else { console.log(`  FAIL  ${name}\n          ${r}`); fail++; }
  } catch (e) { console.log(`  ERROR ${name}\n          ${e.message}`); fail++; }
}

// Find two distinct tenants to test scoping between.
const { data: tenants } = await supabase.from("tenants").select("id, full_name, email").limit(2);
if (!tenants || tenants.length < 1) {
  console.log("No tenants in the database — cannot run authorized tests.");
  process.exit(0);
}
const me = tenants[0];
const other = tenants[1] || null;

console.log(`\nAuthorized-path suite -> ${BASE}`);
console.log(`  acting as tenant id=${me.id}`);
if (other) console.log(`  other tenant id=${other.id}\n`); else console.log("  (only one tenant; cross-tenant test skipped)\n");

const cookie = `cv_session=${mintSession({ sub: me.id, role: "tenant", name: me.full_name, email: me.email })}`;

const post = (path, body, extra = {}) =>
  fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie, ...extra },
    body: JSON.stringify(body),
  });

console.log("Session validity");
await check("minted session is accepted by /api/auth/me", async () => {
  const res = await fetch(`${BASE}/api/auth/me`, { headers: { Cookie: cookie } });
  if (res.status !== 200) return `status ${res.status} — session not accepted`;
  const b = await res.json();
  return String(b?.id ?? b?.session?.sub ?? b?.sub) === String(me.id) && b?.authenticated === true
    ? true
    : `identity mismatch: ${JSON.stringify(b).slice(0, 200)}`;
});

console.log("\nFunctionality preserved");
await check("tenant can read their OWN payments through the gateway", async () => {
  const res = await post("/api/data", { table: "tenant_payments", op: "select", columns: "*" });
  if (res.status !== 200) return `status ${res.status} — legitimate read broke`;
  return true;
});

await check("tenant payments API returns their dashboard data", async () => {
  const res = await fetch(`${BASE}/api/tenant/payments`, { headers: { Cookie: cookie } });
  if (res.status !== 200) return `status ${res.status}`;
  const b = await res.json();
  return Array.isArray(b.payments) ? true : `unexpected shape: ${JSON.stringify(b).slice(0, 200)}`;
});

console.log("\nObject-level scoping (IDOR)");
await check("gateway forces tenant scope — no other tenant's rows returned", async () => {
  const res = await post("/api/data", { table: "tenant_payments", op: "select", columns: "id, tenant_id" });
  const b = await res.json();
  const rows = b.data || [];
  const foreign = rows.filter((r) => String(r.tenant_id) !== String(me.id));
  return foreign.length === 0
    ? true
    : `${foreign.length} row(s) belonging to other tenants leaked: ${JSON.stringify(foreign.slice(0, 3))}`;
});

if (other) {
  await check("explicitly filtering for ANOTHER tenant returns nothing", async () => {
    const res = await post("/api/data", {
      table: "tenant_payments",
      op: "select",
      columns: "id, tenant_id",
      filters: [{ op: "eq", column: "tenant_id", value: other.id }],
    });
    const b = await res.json();
    const rows = b.data || [];
    return rows.length === 0 ? true : `leaked ${rows.length} row(s) of tenant ${other.id}`;
  });

  await check("tenant cannot read another tenant's profile row", async () => {
    const res = await post("/api/data", {
      table: "tenants",
      op: "select",
      columns: "id, full_name, email",
      filters: [{ op: "eq", column: "id", value: other.id }],
    });
    const b = await res.json();
    const rows = Array.isArray(b.data) ? b.data : b.data ? [b.data] : [];
    const leaked = rows.filter((r) => String(r.id) === String(other.id));
    return leaked.length === 0 ? true : `leaked another tenant's record: ${JSON.stringify(leaked[0])}`;
  });
}

console.log("\nColumn protection");
await check("password column is never returned, even to the owner", async () => {
  const res = await post("/api/data", { table: "tenants", op: "select", columns: "*" });
  const b = await res.json();
  const rows = Array.isArray(b.data) ? b.data : b.data ? [b.data] : [];
  const withPw = rows.filter((r) => r && Object.prototype.hasOwnProperty.call(r, "password"));
  return withPw.length === 0 ? true : `password present in ${withPw.length} row(s)`;
});

await check("mass assignment blocked — cannot self-approve", async () => {
  const res = await post("/api/data", {
    table: "tenants",
    op: "update",
    values: { approval_status: "approved", is_active: true, password: "hijacked" },
    filters: [{ op: "eq", column: "id", value: me.id }],
  });
  // Every field sent is non-writable, so the gateway should refuse outright.
  if (res.status === 400) return true;
  if (res.status === 200) {
    const { data } = await supabase.from("tenants").select("password").eq("id", me.id).single();
    return data?.password === "hijacked" ? "PASSWORD WAS OVERWRITTEN" : true;
  }
  return `unexpected status ${res.status}`;
});

console.log("\nPrivilege escalation");
await check("tenant cannot reach an admin-only route", async () => {
  const res = await post("/api/tenants/delete", { tenantId: other?.id ?? 999999 });
  return res.status === 403 ? true : `unexpected status ${res.status}`;
});

await check("tenant cannot read admin_accounts", async () => {
  const res = await post("/api/data", { table: "admin_accounts", op: "select", columns: "*" });
  return res.status === 403 ? true : `unexpected status ${res.status}`;
});

console.log(`\n${"─".repeat(56)}`);
console.log(`  ${pass} passed, ${fail} failed`);
console.log(`${"─".repeat(56)}\n`);
process.exit(fail > 0 ? 1 : 0);
