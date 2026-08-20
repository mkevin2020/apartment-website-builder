import { createClient } from "@supabase/supabase-js"
import { generateReceiptForPayment } from "./generate-receipt"
import { sendReceiptEmail } from "./receipt-email"
import { sendIntouchSMS } from "./intouch-sms"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || "",
)


export async function completeTenantPayment(
  paymentId: number,
  transactionId: string,
  paymentMethod: string = "stripe",
  // Receipt email typed at checkout (if any) — wins over the account email.
  overrideEmail?: string,
): Promise<{ ok: boolean; newlyCompleted: boolean; emailed: boolean; reason?: string }> {
  // Load payment with tenant + apartment so we can build the receipt and email
  const { data: payment } = await supabase
    .from("tenant_payments")
    .select("*, tenants(full_name, email, phone), apartments(name)")
    .eq("id", paymentId)
    .single()

  if (!payment) return { ok: false, newlyCompleted: false, emailed: false, reason: "not found" }

  const wasCompleted = payment.status === "completed"

  // 1. Mark completed (only if needed)
  if (!wasCompleted) {
    const { error } = await supabase
      .from("tenant_payments")
      .update({
        status: "completed",
        transaction_id: transactionId,
        payment_method: paymentMethod,
        updated_at: new Date().toISOString(),
      })
      .eq("id", paymentId)
    if (error) {
      console.error("completeTenantPayment: status update failed:", error.message)
      return { ok: false, newlyCompleted: false, emailed: false, reason: error.message }
    }
  }

  // 2. Ensure a QR receipt exists (idempotent)
  const email = overrideEmail || (payment as any).tenants?.email
  const receiptResult = await generateReceiptForPayment({
    tenantPaymentId: paymentId,
    apartmentId: payment.apartment_id,
    email,
    amount: Number(payment.amount) || 0,
    currency: "rwf",
    transactionId,
  })

  // Fetch the QR so we can embed it in the receipt email
  const { data: receiptRow } = await supabase
    .from("receipts")
    .select("qr_code_base64")
    .eq("tenant_payment_id", paymentId)
    .limit(1)
  const qrCodeBase64 = receiptRow?.[0]?.qr_code_base64 || undefined

  // 3. Email the receipt. We attempt it when the payment is newly completed,
  //    and we also retry it when a receipt already exists so a previous SMTP failure
  //    does not leave the tenant without the receipt/ticket email.
  let emailed = false
  const shouldSendReceiptEmail = Boolean(email) && (!wasCompleted || receiptResult.created || receiptResult.skipped === true)
  if (shouldSendReceiptEmail) {
    try {
      const base = process.env.NEXT_PUBLIC_BASE_URL || ""
      await sendReceiptEmail({
        to: email,
        customerName: (payment as any).tenants?.full_name,
        amount: Number(payment.amount) || 0,
        currency: "RWF",
        referenceNumber: payment.reference_number,
        transactionId,
        apartmentName: (payment as any).apartments?.name,
        paymentDate: new Date().toISOString(),
        receiptUrl: `${base}/receipt?payment_id=${paymentId}`,
        qrCodeBase64,
      })
      emailed = true
    } catch (e) {
      console.error("completeTenantPayment: receipt email failed:", e)
    }
  }

  // 4. SMS the ticket/receipt number to the tenant's phone (IntouchSMS) — first completion only.
  //    Safe no-op until the IntouchSMS API key is configured.
  const phone = (payment as any).tenants?.phone
  if (!wasCompleted && phone) {
    try {
      const name = (payment as any).tenants?.full_name || "there"
      const apt = (payment as any).apartments?.name || "your apartment"
      const amount = Number(payment.amount) || 0
      await sendIntouchSMS(
        phone,
        `Cielo Vista: Hi ${name}, your payment of RWF ${amount.toLocaleString()} for ${apt} is confirmed. ` +
          `Your ticket number is ${payment.reference_number}. Show it at reception for check-in.`,
      )
    } catch (e) {
      console.error("completeTenantPayment: ticket SMS failed:", e)
    }
  }

  return { ok: true, newlyCompleted: !wasCompleted, emailed }
}
