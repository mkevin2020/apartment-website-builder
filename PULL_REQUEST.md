# Security hardening + design foundation

Full-stack security audit with fixes, plus the first layer of the visual
redesign. Five commits, scoped so each is readable on its own.

**Build:** ✅ passing, and now genuinely type-checks (`ignoreBuildErrors` removed)
**Tests:** ✅ 57 security checks passing — `pnpm test:security`

---

## ⚠️ This PR does not finish the job

**None of the SQL migrations have been run.** Until `scripts/031` is applied,
the public anon key still reads `admin_accounts` including the `password`
column. Verified live against the running project, not theorised.

Merging this changes the application code. It does not change the database.

---

## The findings that mattered

### Payments

| | |
|---|---|
| **100× overcharge** | `manual-card` multiplied RWF by 100 before charging. RWF is zero-decimal, so a 45,000 invoice charged **4,500,000**. The Stripe checkout route already had this right. |
| **Client-priced charge** | The same route took `amount` from the request body when `paymentId` was `0`. Advance payments are preserved — the invoice is now created server-side and the charge priced from that row. |
| **Missing MoMo callback** | The `callbackURL` registered with MTN pointed at a route that **did not exist**. Every callback 404'd, so payment confirmation rested entirely on the browser polling. |
| **Anonymous payment completion** | `GET /api/payments/mtn-momo/status?tid=DEMO-<epoch>-<any-id>` marked **any** invoice paid — no session, no ownership check, regardless of demo mode. |
| **Raw PAN handling** | A legacy route accepted card number and CVV unauthenticated, putting the app in PCI-DSS SAQ-D scope. Deleted with its only callers. |

### Auth

- **Password reset ran in the browser** with the anon key. The OTP check was client-side JavaScript, so it was advisory — any account could be taken over without ever holding a code.
- **A hardcoded fallback secret** in `/api/verify`: `process.env.JWT_SECRET || 'fallback-secret-…'`. Any deployment missing that variable verified receipts against a constant published in this repo. The same endpoint returned the tenant's name and email to **any anonymous scanner**.
- **Login was order-dependent.** It walked four account tables and stopped at the first whose password verified, so one email in two tables made the outcome depend on table order. It now resolves across every table and asks which portal.
- **Logout didn't end the session** — the stateless token stayed valid for its full 8 hours. Now revoked by `jti`.

### Data access

52 components queried Supabase directly with the **anon key that ships in the browser bundle**. All now route through a policy gateway (`lib/data-policy.ts` → `/api/data`) that forces row scope per role and strips columns the caller may not see or write.

The **chatbot** took `userRole` and `userId` from the request body with no session check, then read that tenant's name, phone, payment history and maintenance tickets into the model context and recited them back — enumerable by id, to an anonymous caller.

---

## Design foundation

Palette grounded in the hills around Kigali — deep green primary, warm stone
neutrals, one burnt-amber accent reserved for money. The theme was previously
`oklch(0.205 0 0)`: zero chroma, no brand colour at all.

Only token **values** changed; every shadcn variable name keeps its meaning, so
components inherit it with no edits. Typefaces (Fraunces + Public Sans) are
self-hosted via `next/font`. Twelve full-page spinners became skeletons that
mirror the real layout.

**Not done:** 2,569 raw palette utilities (`text-slate-400` etc.) across 91
files still bypass the tokens, so the app is currently mixed.

---

## Review notes

Things worth a second opinion:

1. **`lib/data-policy.ts` is the security boundary.** A table absent from it is denied. Adding one grants access — please scrutinise that file hardest.
2. **The MoMo callback signature check is a deliberate stub.** I don't know MADAPI's scheme and won't invent one; a fabricated check looks like protection while accepting anything. It rejects unverified callbacks by default.
3. **The CSRF origin check is dev-permissive.** Blocking on origin/host mismatch breaks tunnelled phone testing (ngrok sends the tunnel origin, the server sees localhost). Production stays strict.
4. **24 `: any` annotations** were added to satisfy `noImplicitAny` after removing `ignoreBuildErrors`. They're honest — the gateway returns untyped rows — but per-table generics would be better.

## Deployment order

1. Revoke the Supabase PAT that was exposed during this work
2. `scripts/031` — closes the live password-hash exposure, breaks nothing
3. `030`, `033`, `034` — additive
4. `032` — **run section 1a alone first** and resolve reported booking overlaps
5. `036` — same, resolve the two identifier collisions first
6. `035`, then `029` stages A→D
7. Set `INTERNAL_API_KEY` on Vercel **and** the FastAPI host, `APP_ENV=production` on the service
8. Rotate `JWT_SECRET`, then `POST /api/admin/regenerate-qr` with `{"resign":true}`

🤖 Generated with [Claude Code](https://claude.com/claude-code)
