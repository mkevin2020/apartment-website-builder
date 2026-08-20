import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { completeTenantPayment } from "@/lib/complete-payment";
import { loadOwnedPayment } from "@/lib/auth/payment-access";
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
    const { orderID, paymentId } = await request.json();

    if (!orderID || !paymentId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Capturing marks an invoice paid — the caller must own it.
    await loadOwnedPayment(request, paymentId);

    const accessToken = await getAccessToken();
    const capRes = await fetch(`${PAYPAL_BASE}/v2/checkout/orders/${orderID}/capture`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    });

    const capData = await capRes.json();
    if (!capRes.ok) {
      console.error("PayPal capture failed:", capData);
      return NextResponse.json({ error: "Payment capture failed." }, { status: 502 });
    }

    // Try to derive a transaction id
    const captureId =
      capData.purchase_units?.[0]?.payments?.captures?.[0]?.id || orderID;

    // Complete the payment in our system (idempotent)
    await completeTenantPayment(parseInt(paymentId), captureId, "paypal");

    // Best-effort: store paypal capture id on the payment row
    await supabase
      .from("tenant_payments")
      .update({ transaction_id: captureId, paypal_capture_id: captureId, status: "completed" })
      .eq("id", paymentId);

    // Return only what the UI needs — the raw PayPal payload carries payer
    // details and internal ids the browser has no use for.
    return NextResponse.json({ captured: true, captureId, status: capData.status });
  } catch (err) {
    return errorResponse(err);
  }
}
