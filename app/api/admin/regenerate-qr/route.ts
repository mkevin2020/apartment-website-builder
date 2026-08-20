import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import jwt from "jsonwebtoken"
import { requireRole, errorResponse } from "@/lib/auth/session"
import { jwtSecret } from "@/lib/auth/secrets"
import { recordAudit } from "@/lib/audit"
// qrcode ships no TypeScript types — load it via require
// eslint-disable-next-line @typescript-eslint/no-var-requires
const QRCode = require("qrcode")

export const dynamic = "force-dynamic"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || "",
)

/**
 * Regenerate receipt QR codes.
 *
 * Two modes:
 *
 *   default        Redraw the QR image against the current NEXT_PUBLIC_BASE_URL.
 *                  The verify_token is left alone. Use after the ngrok or
 *                  production URL changes.
 *
 *   resign: true   ALSO mint a fresh verify_token with the current JWT_SECRET.
 *                  This is the repair step after rotating that secret.
 *
 * Why `resign` exists
 * -------------------
 * app/api/verify/route.ts used to fall back to a hardcoded secret when
 * JWT_SECRET was unset, so tokens minted under it are forgeable and the secret
 * has to be rotated. But rotating it invalidates every receipt QR already
 * issued — the signatures no longer verify, and a guest turning up with a
 * printed receipt is turned away.
 *
 * Re-signing closes that gap: same receipt, same claims, new signature. Run it
 * once, immediately after rotating JWT_SECRET.
 */
export async function POST(req: NextRequest) {
  try {
    // Rewrites every receipt QR in the system — admins only.
    const session = await requireRole(req, ["admin"])

    const base = process.env.NEXT_PUBLIC_BASE_URL
    if (!base) {
      return NextResponse.json(
        { error: "NEXT_PUBLIC_BASE_URL is not set on the server." },
        { status: 500 },
      )
    }

    let resign = false
    try {
      const body = await req.json()
      resign = body?.resign === true
    } catch {
      // No body — default mode.
    }

    // tenant_payment_id / booking_id / apartment_id are the claims a token
    // carries, so they are needed to re-mint one.
    const { data: receipts, error } = await supabase
      .from("receipts")
      .select("id, verify_token, tenant_payment_id, booking_id, apartment_id")

    if (error) {
      console.error("regenerate-qr: could not load receipts:", error.message)
      return NextResponse.json({ error: "Could not load receipts." }, { status: 500 })
    }

    let updated = 0
    let resigned = 0
    let skipped = 0

    for (const rec of receipts || []) {
      let token = rec.verify_token

      if (resign) {
        // Rebuild the claims from the stored row rather than trusting the old
        // token — it may have been signed with a secret we no longer accept,
        // so it cannot be verified to read its contents.
        const claims: Record<string, unknown> = { timestamp: Date.now() }
        if (rec.tenant_payment_id != null) claims.tenant_payment_id = rec.tenant_payment_id
        if (rec.booking_id != null) {
          claims.booking_id = rec.booking_id
          // The booking path additionally requires this type claim.
          claims.type = "receipt_verification"
        }
        if (rec.apartment_id != null) claims.apartment_id = rec.apartment_id

        if (claims.tenant_payment_id == null && claims.booking_id == null) {
          // Nothing to key the receipt on — leave it untouched rather than
          // issuing a token that verifies to nothing.
          skipped++
          continue
        }

        token = jwt.sign(claims, jwtSecret(), {
          expiresIn: (process.env.RECEIPT_TOKEN_TTL || "365d") as jwt.SignOptions["expiresIn"],
        })
        resigned++
      }

      if (!token) {
        skipped++
        continue
      }

      const qr = await QRCode.toDataURL(`${base}/verify?token=${token}`)

      const update: Record<string, unknown> = { qr_code_base64: qr }
      if (resign) update.verify_token = token

      const { error: upErr } = await supabase
        .from("receipts")
        .update(update)
        .eq("id", rec.id)

      if (upErr) {
        console.error(`regenerate-qr: receipt ${rec.id} failed:`, upErr.message)
      } else {
        updated++
      }
    }

    await recordAudit(
      {
        action: "account.updated",
        target: "receipts:*",
        metadata: { operation: "regenerate-qr", resign, updated, resigned, skipped },
      },
      { req, session },
    )

    return NextResponse.json({ ok: true, updated, resigned, skipped, baseUrl: base })
  } catch (err) {
    return errorResponse(err)
  }
}
