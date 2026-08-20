"""
Regression test: one email in two account tables must never silently pick a portal.

Background: mugishakevin73@gmail.com existed in BOTH employees and tenants. The
login route walked the tables in order and stopped at the first whose password
verified, so the tenant portal was unreachable with that address. This proves
the route now asks instead of guessing.

Creates two throwaway accounts sharing one email and one password, exercises the
login route, then DELETES them. Nothing belonging to a real user is touched.
"""
import io, json, urllib.request, urllib.error, subprocess, sys

import os
BASE = os.environ.get("BASE", "http://localhost:3000")
EMAIL = "zz-logintest@example.invalid"
PASSWORD = "TestPassw0rd!2026"

env = {}
for line in io.open("d:/ciel/apartment-website-builder (1)/.env.local", encoding="utf-8-sig"):
    line = line.strip()
    if line and not line.startswith("#") and "=" in line:
        k, v = line.split("=", 1)
        env[k.strip()] = v.strip()

URL, KEY = env["NEXT_PUBLIC_SUPABASE_URL"], env["SUPABASE_SERVICE_ROLE_KEY"]
H = {"apikey": KEY, "Authorization": f"Bearer {KEY}", "Content-Type": "application/json"}


def rest(method, path, body=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(f"{URL}/rest/v1/{path}", data=data, headers={**H, "Prefer": "return=representation"}, method=method)
    try:
        with urllib.request.urlopen(req, timeout=25) as r:
            raw = r.read().decode()
            return json.loads(raw) if raw.strip() else []
    except urllib.error.HTTPError as e:
        return {"__error": e.read().decode()[:300], "__code": e.code}


def login(payload):
    req = urllib.request.Request(
        f"{BASE}/api/auth/login",
        data=json.dumps(payload).encode(),
        headers={"Content-Type": "application/json", "Origin": BASE},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return r.status, json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        try:
            return e.code, json.loads(body)
        except Exception:
            return e.code, {"raw": body[:200]}


# bcrypt hash of PASSWORD, generated with the app's own bcryptjs
hashed = subprocess.run(
    ["node", "-e", f"const b=require('bcryptjs');process.stdout.write(b.hashSync('{PASSWORD}',10))"],
    capture_output=True, text=True, cwd="d:/ciel/apartment-website-builder (1)",
).stdout.strip()
assert hashed.startswith("$2"), f"could not hash: {hashed!r}"

created = []
try:
    print("Creating two throwaway accounts sharing one email…\n")

    emp = rest("POST", "employees", [{
        "username": "zz-logintest-staff", "email": EMAIL, "password": hashed,
        "full_name": "Login Test Staff", "status": "active", "department": "IT",
    }])
    if isinstance(emp, dict):
        print("  employees insert failed:", emp.get("__error")); sys.exit(1)
    created.append(("employees", emp[0]["id"]))
    print(f"  employees#{emp[0]['id']}")

    ten = rest("POST", "tenants", [{
        "username": "zz-logintest-tenant", "email": EMAIL, "password": hashed,
        "full_name": "Login Test Tenant", "approval_status": "approved", "is_active": True,
    }])
    if isinstance(ten, dict):
        print("  tenants insert failed:", ten.get("__error")); sys.exit(1)
    created.append(("tenants", ten[0]["id"]))
    print(f"  tenants#{ten[0]['id']}\n")

    ok = True

    # A 429 here means the per-IP login budget is exhausted from earlier runs,
    # not that the fix regressed. Say so plainly instead of reporting a failure
    # that sends someone hunting for a bug that is not there.
    probe_status, _ = login({"username": EMAIL, "password": "probe"})
    if probe_status == 429:
        print("SKIPPED: rate limited (per-IP login budget exhausted).")
        print("Wait ~15 minutes, or restart the dev server, then re-run.")
        sys.exit(0)

    # ── 1. Ambiguous login must ASK, not guess ──────────────────────────────
    status, body = login({"username": EMAIL, "password": PASSWORD})
    print(f"1. Ambiguous login          -> HTTP {status}")
    if status == 300 and body.get("needsChoice"):
        labels = [c["label"] for c in body.get("choices", [])]
        print(f"   asks which account: {labels}")
        if sorted(labels) != ["Staff", "Tenant"]:
            print("   FAIL: unexpected choices"); ok = False
    else:
        print(f"   FAIL: expected 300 needsChoice, got {json.dumps(body)[:200]}"); ok = False

    # ── 2. Choosing tenant reaches the TENANT portal ────────────────────────
    status, body = login({"username": EMAIL, "password": PASSWORD, "accountType": "tenant"})
    print(f"\n2. Choose Tenant            -> HTTP {status}")
    print(f"   role={body.get('role')} redirect={body.get('redirect')}")
    if not (status == 200 and body.get("role") == "tenant" and body.get("redirect") == "/tenant/dashboard"):
        print("   FAIL: did not reach the tenant portal"); ok = False

    # ── 3. Choosing staff reaches the EMPLOYEE portal ───────────────────────
    status, body = login({"username": EMAIL, "password": PASSWORD, "accountType": "employee"})
    print(f"\n3. Choose Staff             -> HTTP {status}")
    print(f"   role={body.get('role')} redirect={body.get('redirect')}")
    if not (status == 200 and body.get("role") == "employee"):
        print("   FAIL: did not reach the staff portal"); ok = False

    # ── 4. Wrong password still refused ─────────────────────────────────────
    status, body = login({"username": EMAIL, "password": "wrong-" + PASSWORD})
    print(f"\n4. Wrong password           -> HTTP {status}")
    if status != 401:
        print("   FAIL: expected 401"); ok = False

    # ── 5. Choosing an account the password does NOT match is refused ───────
    status, body = login({"username": EMAIL, "password": "wrong", "accountType": "tenant"})
    print(f"5. Wrong password + choice  -> HTTP {status}")
    if status != 401:
        print("   FAIL: accountType must not bypass the password"); ok = False

    # ── 6. The trimmed profile must not carry PII ───────────────────────────
    status, body = login({"username": EMAIL, "password": PASSWORD, "accountType": "tenant"})
    leaked = [k for k in ("password", "id_number", "national_id", "address",
                          "approval_status", "is_active")
              if k in (body.get("session") or {})]
    print(f"\n6. Session payload fields   -> {sorted((body.get('session') or {}).keys())}")
    if leaked:
        print(f"   FAIL: leaked {leaked}"); ok = False

    print("\n" + "=" * 56)
    print("  ALL CHECKS PASSED" if ok else "  SOME CHECKS FAILED")
    print("=" * 56)

finally:
    print("\nCleaning up throwaway accounts…")
    for table, rid in created:
        rest("DELETE", f"{table}?id=eq.{rid}")
        print(f"  deleted {table}#{rid}")
    # Belt and braces: nothing with that address may survive.
    for table in ("employees", "tenants"):
        left = rest("GET", f"{table}?select=id&email=eq.{EMAIL}")
        print(f"  {table} rows remaining with test email: {len(left) if isinstance(left, list) else '?'}")
