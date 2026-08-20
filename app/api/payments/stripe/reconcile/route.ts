import { NextRequest, NextResponse } from "next/server"
import Stripe from "stripe"
import { completeTenantPayment } from "@/lib/complete-payment"
import { requireSession, errorResponse } from "@/lib/auth/session"
import { enforceRateLimit } from "@/lib/auth/rate-limit"

export const dynamic = "force-dynamic"

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
  apiVersion: "2026-02-25.clover" as any,
})

// Self-healing reconciliation: find payments still stuck on processing/pending and,
// if Stripe confirms the checkout was actually paid, mark them completed.
// This covers the case where the verify-on-return step never ran (tunnel down,
// tenant closed the tab, webhook not delivered, etc.).
async function reconcile() {
  // 1) Build a map of paid checkout sessions keyed by tenant_payment_id
  const sessions = await stripe.checkout.sessions.list({ limit: 100 })
  const paid: Record<string, string> = {}
  for (const s of sessions.data) {
    const pid = s.metadata?.tenant_payment_id
    if (pid && s.payment_status === "paid") {
      paid[pid] = typeof s.payment_intent === "string" ? s.payment_intent : s.id
    }
  }

  if (Object.keys(paid).length === 0) return { updated: 0, emailed: 0 }

  // 2) For every payment Stripe says is paid, finalize it (complete + receipt + email).
  //    completeTenantPayment is idempotent: it only flips status / emails on the first time.
  let updated = 0
  let emailed = 0
  for (const [pidStr, txn] of Object.entries(paid)) {
    const result = await completeTenantPayment(parseInt(pidStr), txn)
    if (result.newlyCompleted) updated++
    if (result.emailed) emailed++
  }

  return { updated, emailed }
}

export async function GET(_request: NextRequest) {
  try {
    // Any signed-in user may trigger the sweep (the tenant payment-history page
    // calls it on load), but it is an expensive Stripe-wide pass, so it is
    // capped per caller rather than left open to anonymous traffic.
    await requireSession(_request)
    await enforceRateLimit(_request, "stripe-reconcile", 10, 10 * 60)

    const result = await reconcile()
    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    return errorResponse(error)
  }
}

export async function POST(request: NextRequest) {
  return GET(request)
}
