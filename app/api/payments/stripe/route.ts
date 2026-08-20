import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { completeTenantPayment } from '@/lib/complete-payment';
import { loadOwnedPayment, assertPayable } from '@/lib/auth/payment-access';
import { errorResponse } from '@/lib/auth/session';
import { parseJson, z, idSchema, emailSchema } from '@/lib/auth/validate';
import { recordAudit } from '@/lib/audit';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2026-02-25.clover' as any,
});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

const checkoutSchema = z.object({
  paymentId: idSchema,
  // `amount` and `tenantId` are accepted for backwards compatibility with older
  // callers but are deliberately IGNORED — both are read from the stored row
  // below. A browser must never be able to set the price it is charged.
  amount: z.unknown().optional(),
  tenantId: z.unknown().optional(),
  email: emailSchema.optional(),
});

export async function POST(request: NextRequest) {
  try {
    const { paymentId, email } = await parseJson(request, checkoutSchema);

    // Authorisation + ownership in one step: staff may act on any payment, a
    // tenant only on their own, guests are rejected. Replaces the previous
    // behaviour where an unauthenticated caller could drive any invoice by id.
    const { payment, session } = await loadOwnedPayment(request, paymentId);
    assertPayable(payment);

    // Price from the database, never from the request body. Previously
    // `unit_amount` came straight from the client, so a tenant could open a
    // checkout for 1 RWF against a 500,000 RWF invoice and have the webhook
    // mark the whole thing paid.
    const amount = Number(payment.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json(
        { error: 'This payment has no valid amount and cannot be charged.' },
        { status: 409 }
      );
    }

    // Likewise the receipt address: fall back to the session's own email rather
    // than trusting an arbitrary one, so a checkout cannot be used to mail
    // another tenant's payment details to an attacker-chosen inbox.
    const receiptEmail = session.role === 'tenant' ? session.email || email : email;

    // Send the tenant back to the origin they paid from — the session lives in that
    // origin's localStorage, so redirecting to a different domain (e.g. ngrok while
    // browsing localhost) would look like a logout.
    const baseUrl =
      request.headers.get('origin') || process.env.NEXT_PUBLIC_BASE_URL || request.nextUrl.origin;

    // Create Stripe checkout session. Named `checkoutSession` so it cannot be
    // confused with the caller's auth session above.
    const checkoutSession = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'rwf',
            product_data: {
              name: `Apartment Payment - Reference: ${payment.reference_number}`,
              description: `Payment for apartment ${payment.apartment_id}`,
            },
            // RWF is a zero-decimal currency — do NOT multiply by 100
            unit_amount: Math.round(amount),
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${baseUrl}/tenant/payments?session_id={CHECKOUT_SESSION_ID}&status=success`,
      cancel_url: `${baseUrl}/tenant/payments?status=cancelled`,
      metadata: {
        tenant_payment_id: String(payment.id),
        // From the stored row, not the request body.
        tenant_id: payment.tenant_id != null ? String(payment.tenant_id) : '',
        apartment_id: payment.apartment_id?.toString() || '',
        customer_email: receiptEmail || '',
        reference_number: payment.reference_number,
      },
      ...(receiptEmail ? { customer_email: receiptEmail } : {}),
    });

    // Update payment status (always works — only uses existing columns)
    const { error: statusError } = await supabase
      .from('tenant_payments')
      .update({ status: 'processing' })
      .eq('id', paymentId);

    if (statusError) {
      console.error('Failed to update payment status:', statusError);
    }

    // Best-effort: store the Stripe session id for tracking.
    // Won't break checkout if the column hasn't been added yet (see scripts/021-add-stripe-columns-to-tenant-payments.sql)
    const { error: sessionIdError } = await supabase
      .from('tenant_payments')
      .update({ stripe_session_id: checkoutSession.id })
      .eq('id', payment.id);

    if (sessionIdError) {
      console.warn(
        'Could not store stripe_session_id (run scripts/021 to enable session tracking):',
        sessionIdError.message
      );
    }

    await recordAudit(
      {
        action: 'payment.checkout.created',
        target: `tenant_payments:${payment.id}`,
        metadata: {
          provider: 'stripe',
          amount,
          currency: 'rwf',
          reference_number: payment.reference_number,
          stripe_session_id: checkoutSession.id,
        },
      },
      { req: request, session },
    );

    return NextResponse.json({
      sessionId: checkoutSession.id,
      url: checkoutSession.url,
      clientSecret: checkoutSession.client_secret,
    });
  } catch (error) {
    // errorResponse keeps 401/403/404/409 from the helpers intact and collapses
    // anything unexpected into a generic 500, so Stripe/driver internals and
    // table names stop reaching the browser.
    return errorResponse(error);
  }
}

// Verify a checkout session when the tenant returns from Stripe (fallback that does not
// depend on webhook delivery). Marks the payment completed if Stripe confirms it is paid.
export async function GET(request: NextRequest) {
  const sessionId = request.nextUrl.searchParams.get('session_id');

  if (!sessionId) {
    return NextResponse.json({ error: 'Missing session_id' }, { status: 400 });
  }

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    const paymentId = session.metadata?.tenant_payment_id;

    if (session.payment_status !== 'paid' || !paymentId) {
      return NextResponse.json({ paid: false, status: session.payment_status });
    }

    const transactionId =
      typeof session.payment_intent === 'string' ? session.payment_intent : session.id;

    // Complete the payment + generate receipt + email (idempotent — shared by all paths)
    const result = await completeTenantPayment(parseInt(paymentId), transactionId);

    return NextResponse.json({
      paid: true,
      updated: result.newlyCompleted,
      status: 'completed',
      emailed: result.emailed,
    });
  } catch (error) {
    console.error('Stripe verify error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Verification failed' },
      { status: 500 }
    );
  }
}

// Handle webhook events from Stripe
export async function PUT(request: NextRequest) {
  const body = await request.text();
  const sig = request.headers.get('stripe-signature') || '';

  try {
    const event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET || ''
    );

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;

      if (session.metadata?.tenant_payment_id) {
        const paymentIdStr = session.metadata.tenant_payment_id;
        const transactionId = typeof session.payment_intent === 'string' ? session.payment_intent : session.id;

        // Complete the payment + generate receipt + email (idempotent, shared by all paths)
        await completeTenantPayment(parseInt(paymentIdStr), transactionId);
      }
    }

    if (event.type === 'checkout.session.expired') {
      const session = event.data.object as Stripe.Checkout.Session;

      if (session.metadata?.tenant_payment_id) {
        const { error } = await supabase
          .from('tenant_payments')
          .update({
            status: 'pending',
          })
          .eq('id', parseInt(session.metadata.tenant_payment_id));

        if (error) {
          console.error('Failed to update payment status:', error);
        }
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json(
      { error: 'Webhook failed' },
      { status: 400 }
    );
  }
}
