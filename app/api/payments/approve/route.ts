import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendReceiptEmail } from "@/lib/receipt-email";
import { generateReceiptForPayment } from "@/lib/generate-receipt";
import { sendIntouchSMS } from "@/lib/intouch-sms";
import { requireRole, ADMIN_OR_MANAGER, errorResponse } from "@/lib/auth/session";
import { parseJson, idSchema, z } from "@/lib/auth/validate";
import { recordAudit } from "@/lib/audit";

// Staff (manager/admin) approves a pending tenant payment:
// marks it completed and emails the tenant a payment confirmation.
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    // Approving a payment moves money and issues a receipt — staff only.
    const session = await requireRole(request, ADMIN_OR_MANAGER);

    const { paymentId } = await parseJson(
      request,
      z.object({ paymentId: idSchema }),
    );

    // Load the payment with tenant + apartment info
    const { data: payment, error: fetchError } = await supabase
      .from("tenant_payments")
      .select("*, tenants(full_name, email, phone), apartments(name)")
      .eq("id", paymentId)
      .single();

    if (fetchError || !payment) {
      return NextResponse.json({ error: "Payment not found" }, { status: 404 });
    }

    // Mark the payment completed
    const { error: updateError } = await supabase
      .from("tenant_payments")
      .update({
        status: "completed",
        payment_method: payment.payment_method || "manual",
        updated_at: new Date().toISOString(),
      })
      .eq("id", paymentId);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    // Generate the QR receipt (idempotent) so "View Receipt" works for manual approvals too
    const transactionId = payment.transaction_id || `manual-${paymentId}`;
    await generateReceiptForPayment({
      tenantPaymentId: Number(paymentId),
      apartmentId: payment.apartment_id,
      email: (payment as any).tenants?.email,
      amount: Number(payment.amount) || 0,
      currency: "rwf",
      transactionId,
    });

    // Fetch the QR to embed in the receipt email
    const { data: recRow } = await supabase
      .from("receipts")
      .select("qr_code_base64")
      .eq("tenant_payment_id", paymentId)
      .limit(1);
    const qrCodeBase64 = recRow?.[0]?.qr_code_base64 || undefined;

    // Email the tenant a payment confirmation (best-effort)
    const email = (payment as any).tenants?.email;
    let emailed = false;
    if (email) {
      try {
        await sendReceiptEmail({
          to: email,
          customerName: (payment as any).tenants?.full_name,
          amount: payment.amount,
          currency: "RWF",
          referenceNumber: payment.reference_number,
          transactionId,
          apartmentName: (payment as any).apartments?.name,
          paymentDate: new Date().toISOString(),
          receiptUrl: `${process.env.NEXT_PUBLIC_BASE_URL}/receipt?payment_id=${paymentId}`,
          qrCodeBase64,
        });
        emailed = true;
      } catch (emailErr) {
        console.error("Failed to send payment approval email:", emailErr);
      }
    }

    // Also text the tenant that their payment was accepted (IntouchSMS, best-effort).
    let smsSent = false;
    const phone = (payment as any).tenants?.phone;
    if (phone) {
      try {
        const name = (payment as any).tenants?.full_name || "there";
        const amount = Number(payment.amount) || 0;
        const result = await sendIntouchSMS(
          phone,
          `Cielo Vista: Hi ${name}, your payment of RWF ${amount.toLocaleString()} has been ACCEPTED. ` +
            `Ref: ${payment.reference_number}. Thank you!`
        );
        smsSent = !!result.success && !result.disabled;
      } catch (smsErr) {
        console.error("Failed to send payment approval SMS:", smsErr);
      }
    }

    await recordAudit(
      {
        action: "payment.approved",
        target: `tenant_payments:${paymentId}`,
        metadata: {
          amount: payment.amount,
          reference_number: payment.reference_number,
          transaction_id: transactionId,
          emailed,
          sms_sent: smsSent,
        },
      },
      { req: request, session }
    );

    return NextResponse.json({ success: true, emailed, smsSent });
  } catch (error) {
    return errorResponse(error);
  }
}
