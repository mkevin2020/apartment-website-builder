import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { loadOwnedPayment, assertPayable } from "@/lib/auth/payment-access";
import { errorResponse } from "@/lib/auth/session";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || ""
);

const PAYPAL_BASE = (process.env.PAYPAL_ENV === "live")
  ? "https://api-m.paypal.com"
  : "https://api-m.sandbox.paypal.com";

async function getAccessToken() {
  const client = process.env.PAYPAL_CLIENT_ID || "";
  const secret = process.env.PAYPAL_CLIENT_SECRET || "";
  const res = await fetch(`${PAYPAL_BASE}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${client}:${secret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  const data = await res.json();
  return data.access_token as string;
}

export async function POST(request: NextRequest) {
  try {
    const { paymentId } = await request.json();

    if (!paymentId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Confirms the caller owns this invoice, and gives us the authoritative row.
    const { payment, session } = await loadOwnedPayment(request, paymentId);
    assertPayable(payment);
    const tenantId = payment.tenant_id ?? session.sub;

    const accessToken = await getAccessToken();
    const currency = process.env.PAYPAL_CURRENCY || process.env.NEXT_PUBLIC_PAYPAL_CURRENCY || "USD";

    // Amounts are stored in RWF, which PayPal doesn't support — convert to USD
    // at a fixed rate. PayPal requires a minimum charge of 0.01.
    const rate = parseFloat(process.env.PAYPAL_RWF_TO_USD_RATE || "1450");
    // Price from the stored row, never the request body — otherwise a tenant
    // could post amount: 1 and settle a full invoice for one franc.
    const usdValue = Math.max(Number(payment.amount) / rate, 0.01).toFixed(2);

    const orderRes = await fetch(`${PAYPAL_BASE}/v2/checkout/orders`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        intent: "CAPTURE",
        purchase_units: [
          {
            amount: {
              currency_code: currency,
              value: usdValue,
            },
            reference_id: String(paymentId),
            description: `Apartment payment - ${payment.reference_number} (${payment.amount} RWF)`,
          },
        ],
      }),
    });

    const orderData = await orderRes.json();
    if (!orderRes.ok) {
      console.error("PayPal create order failed:", orderData);
      return NextResponse.json({ error: orderData }, { status: 500 });
    }

    // Update status to processing (best-effort)
    await supabase
      .from("tenant_payments")
      .update({ status: "processing", paypal_order_id: orderData.id })
      .eq("id", paymentId);

    return NextResponse.json({ orderID: orderData.id });
  } catch (err) {
    return errorResponse(err);
  }
}
