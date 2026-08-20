import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { completeTenantPayment } from '@/lib/complete-payment';
import { loadOwnedPayment, assertPayable } from '@/lib/auth/payment-access';
import { errorResponse } from '@/lib/auth/session';

// Inline card payments (Stripe Elements in the CieloPay dialog).
// POST creates a PaymentIntent for a pending tenant payment; PUT verifies the
// intent succeeded (server-side, never trusting the browser) and marks the
// payment completed.

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const { paymentId, email } = await req.json();
    if (!paymentId) {
      return NextResponse.json({ error: 'paymentId is required' }, { status: 400 });
    }

    // Confirms the caller owns this invoice. The charged amount comes from the
    // stored row (as it already did) — the client's `amount` and `tenantId`
    // are ignored entirely.
    const { payment, session } = await loadOwnedPayment(req, paymentId);
    assertPayable(payment);
    const tenantId = payment.tenant_id ?? session.sub;

    const intent = await stripe.paymentIntents.create({
      // RWF is a zero-decimal currency — do NOT multiply by 100
      amount: Math.round(payment.amount),
      currency: 'rwf',
      description: `Apartment Payment - Reference: ${payment.reference_number}`,
      receipt_email: email || undefined,
      metadata: {
        tenant_payment_id: String(paymentId),
        tenant_id: String(tenantId || ''),
        reference_number: payment.reference_number,
      },
    });

    await supabase
      .from('tenant_payments')
      .update({
        status: 'processing',
        payment_method: 'card',
        transaction_id: intent.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', paymentId);

    return NextResponse.json({ clientSecret: intent.client_secret });
  } catch (err) {
    return errorResponse(err);
  }
}

// Confirm: the browser reports the intent finished; we verify with Stripe
// directly before marking the invoice paid.
export async function PUT(req: NextRequest) {
  try {
    const { paymentIntentId, paymentId } = await req.json();
    if (!paymentIntentId || !paymentId) {
      return NextResponse.json({ error: 'paymentIntentId and paymentId are required' }, { status: 400 });
    }

    // Marking an invoice paid — the caller must own it.
    await loadOwnedPayment(req, paymentId);

    const intent = await stripe.paymentIntents.retrieve(paymentIntentId);
    if (intent.status !== 'succeeded') {
      return NextResponse.json({ error: `Payment not completed (${intent.status})` }, { status: 409 });
    }
    if (intent.metadata?.tenant_payment_id !== String(paymentId)) {
      return NextResponse.json({ error: 'Payment mismatch' }, { status: 409 });
    }

    // Shared completion: marks paid + generates the QR receipt + emails it.
    // The email typed at checkout (stored on the intent) receives the receipt.
    const result = await completeTenantPayment(
      Number(paymentId),
      paymentIntentId,
      'card',
      intent.receipt_email || undefined
    );

    return NextResponse.json({ status: 'completed', emailed: result.emailed });
  } catch (err) {
    return errorResponse(err);
  }
}
