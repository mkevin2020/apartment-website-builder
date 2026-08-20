import { createClient } from "@supabase/supabase-js"
import jwt from "jsonwebtoken"
import { jwtSecret } from "@/lib/auth/secrets"
// qrcode ships no TypeScript types — load it via require
// eslint-disable-next-line @typescript-eslint/no-var-requires
const QRCode = require("qrcode")

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || "",
)

interface ReceiptInput {
  tenantPaymentId: number
  apartmentId?: number | null
  email?: string | null
  amount: number
  currency?: string
  transactionId?: string | null
}

/**
 * Create a QR receipt for a completed payment.
 * Idempotent: if a receipt already exists for this tenant_payment_id, it does nothing.
 * Best-effort: never throws — returns { created, skipped, error }.
 */
export async function generateReceiptForPayment(input: ReceiptInput): Promise<{
  created: boolean
  skipped?: boolean
  error?: string
}> {
  try {
    // Already have a receipt for this payment? Skip (idempotent).
    const { data: existing } = await supabase
      .from("receipts")
      .select("id")
      .eq("tenant_payment_id", input.tenantPaymentId)
      .limit(1)

    if (existing && existing.length > 0) {
      return { created: false, skipped: true }
    }

    // Signed verification token embedded in the QR code
    const secret = jwtSecret()
    const verifyToken = jwt.sign(
      {
        tenant_payment_id: input.tenantPaymentId,
        apartment_id: input.apartmentId,
        timestamp: Date.now(),
      },
      secret,
      // A receipt must stay verifiable for as long as a guest might present it,
      // so this is deliberately long rather than short. The exposure it carries
      // is now small: /api/verify returns proof-of-payment only, and reveals
      // identity solely to signed-in staff. Shorten via RECEIPT_TOKEN_TTL if
      // your retention policy requires it.
      { expiresIn: (process.env.RECEIPT_TOKEN_TTL || "365d") as jwt.SignOptions["expiresIn"] },
    )

    const base = process.env.NEXT_PUBLIC_BASE_URL || ""
    const verificationUrl = `${base}/verify?token=${verifyToken}`
    const qrCodeBase64 = await QRCode.toDataURL(verificationUrl)

    const { error } = await supabase.from("receipts").insert({
      tenant_payment_id: input.tenantPaymentId,
      booking_id: null, // payment receipts aren't tied to a booking; FK requires null or a real booking id
      user_email: input.email || "unknown@example.com",
      apartment_id: input.apartmentId,
      amount_paid: input.amount,
      currency: input.currency || "rwf",
      payment_intent_id: input.transactionId || `txn-${input.tenantPaymentId}`, // NOT NULL column
      verify_token: verifyToken, // NOT NULL column — token encoded in the QR
      status: "PAID",
      qr_code_base64: qrCodeBase64,
    })

    if (error) {
      console.error("Failed to insert receipt:", error.message)
      return { created: false, error: error.message }
    }

    return { created: true }
  } catch (err: any) {
    console.error("generateReceiptForPayment error:", err)
    return { created: false, error: err?.message || String(err) }
  }
}
