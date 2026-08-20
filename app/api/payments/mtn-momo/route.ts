import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";
import { loadOwnedPayment } from "@/lib/auth/payment-access";
import { errorResponse } from "@/lib/auth/session";

// MTN MoMo rent payments via the MTN developer portal (developers.mtn.com,
// MADAPI "Payments V1", base https://api.mtn.com/v1).
//
// The real call is implemented below. New apps on that portal cannot execute
// payments until MTN activates the product for the account ("no API product
// match" errors). Until that happens, MTN_MOMO_DEMO_MODE=true simulates the
// confirmation flow so the feature can be demonstrated end-to-end.

const BASE_URL = process.env.MTN_MOMO_BASE_URL || "https://api.mtn.com";
const CONSUMER_KEY = process.env.MTN_MOMO_CONSUMER_KEY;
const CONSUMER_SECRET = process.env.MTN_MOMO_CONSUMER_SECRET;
const DEMO_MODE = process.env.MTN_MOMO_DEMO_MODE === "true";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// OAuth tokens last ~1h; cache one for the server process.
let cachedToken: { token: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt - 60_000) {
    return cachedToken.token;
  }
  const res = await fetch(`${BASE_URL}/v1/oauth/access_token?grant_type=client_credentials`, {
    method: "POST",
    headers: {
      Authorization: "Basic " + Buffer.from(`${CONSUMER_KEY}:${CONSUMER_SECRET}`).toString("base64"),
      "Content-Type": "application/x-www-form-urlencoded",
      "Content-Length": "0",
    },
  });
  if (!res.ok) throw new Error(`MTN token request failed (${res.status})`);
  const data = await res.json();
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + Number(data.expires_in || 3599) * 1000,
  };
  return data.access_token;
}

export async function POST(req: NextRequest) {
  try {
    const { paymentId, phone, email } = await req.json();

    if (!paymentId || !phone) {
      return NextResponse.json({ error: "paymentId and phone are required" }, { status: 400 });
    }
    const msisdn = String(phone).replace(/[^0-9]/g, "");
    if (msisdn.length < 9) {
      return NextResponse.json({ error: "Enter a valid MTN phone number" }, { status: 400 });
    }

    // Confirms the payment exists AND belongs to the caller.
    const { payment: paymentRow } = await loadOwnedPayment(req, paymentId, {
      columns: "id, amount, status, tenant_id",
    });
    // Charge the stored amount — never a figure supplied by the browser.
    const amount = Number(paymentRow.amount);
    if (!["pending", "processing"].includes(paymentRow.status)) {
      return NextResponse.json({ error: `Payment is already ${paymentRow.status}` }, { status: 409 });
    }

    const transactionId = randomUUID();

    // ---- Real MTN call ----------------------------------------------------
    let mtnAccepted = false;
    let mtnError: string | null = null;
    if (CONSUMER_KEY && CONSUMER_SECRET) {
      try {
        const token = await getAccessToken();
        const res = await fetch(`${BASE_URL}/v1/payments`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            countryCode: "RW",
            transactionId,
          },
          body: JSON.stringify({
            amount: { amount: String(amount), units: "RWF" },
            payer: {
              payerIdType: "MSISDN",
              payerId: msisdn,
              payerNote: "Cielo Vista rent payment",
            },
            transactionType: "Payment",
            description: `Cielo Vista rent payment #${paymentId}`,
            externalTransactionId: String(paymentId),
            callbackURL: `${process.env.NEXT_PUBLIC_BASE_URL || ""}/api/payments/mtn-momo/callback`,
          }),
        });
        if (res.ok) {
          mtnAccepted = true;
        } else {
          const body = await res.text();
          mtnError = `MTN responded ${res.status}: ${body.slice(0, 300)}`;
        }
      } catch (err: any) {
        mtnError = err?.message || "MTN request failed";
      }
    } else {
      mtnError = "MTN consumer key/secret not configured";
    }

    // ---- Demo fallback ----------------------------------------------------
    // Simulates the "confirm on your phone" flow when MTN hasn't activated
    // the account for payment execution yet.
    // Explicitly a string: randomUUID() returns a narrow `${string}-${string}-...`
    // template type, but the demo fallback below assigns a DEMO-... id instead.
    let tid: string = transactionId;
    if (!mtnAccepted) {
      if (!DEMO_MODE) {
        console.error("MTN MoMo initiation failed:", mtnError);
        return NextResponse.json(
          { error: "MTN MoMo is not available right now. Please try card payment instead." },
          { status: 502 }
        );
      }
      tid = `DEMO-${Date.now()}-${paymentId}`;
    }

    // Track the in-flight transaction on the payment row.
    const { error: updateError } = await supabase
      .from("tenant_payments")
      .update({
        status: "processing",
        payment_method: "mtn_momo",
        transaction_id: tid,
        updated_at: new Date().toISOString(),
      })
      .eq("id", paymentId);
    if (updateError) {
      return NextResponse.json({ error: "Failed to record the transaction" }, { status: 500 });
    }

    return NextResponse.json({
      transactionId: tid,
      simulated: !mtnAccepted,
      message: "Payment requested. Ask the customer to confirm on their phone.",
    });
  } catch (err) {
    return errorResponse(err);
  }
}
