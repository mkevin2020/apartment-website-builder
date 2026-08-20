import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { completeTenantPayment } from '@/lib/complete-payment';
import { claimEvent, completeEvent } from '@/lib/provider-events';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2026-02-25.clover' as any,
});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

/**
 * Stripe Webhook Handler for Payment Verification & Receipt Generation
 *
 * - Validates the Stripe signature before processing
 * - On checkout.session.completed, marks the payment/booking complete and
 *   generates a QR receipt (idempotently, via the shared helper)
 */
export async function POST(request: NextRequest) {
  const body = await request.text();
  const sig = request.headers.get('stripe-signature') || '';
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || '';

  if (!webhookSecret) {
    console.error('STRIPE_WEBHOOK_SECRET not configured');
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 });
  }

  try {
    // 1. Verify the Stripe webhook signature
    const event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
    console.log(`[STRIPE WEBHOOK] Event type: ${event.type}`);

    // 2. Claim the event before doing any work.
    //
    // Stripe retries a webhook for up to three days, so the same event can
    // arrive several times — and two deliveries can be in flight at once. The
    // previous guard was completeTenantPayment() reading the payment's status,
    // which is a read-then-write that both deliveries can pass, producing two
    // receipts and two confirmation emails. The (provider, event_id) primary
    // key settles it: only the first claim proceeds.
    const claimed = await claimEvent('stripe', event.id, { eventType: event.type });
    if (!claimed) {
      return NextResponse.json({ received: true, duplicate: true });
    }

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;

      const bookingId = session.metadata?.booking_id;
      const tenantPaymentId = session.metadata?.tenant_payment_id;
      const paymentIntentId =
        typeof session.payment_intent === 'string' ? session.payment_intent : session.id;

      try {
        // ---- Booking payment ----
        if (bookingId) {
          const { error: bookingError } = await supabase
            .from('bookings')
            .update({ status: 'confirmed' })
            .eq('id', parseInt(bookingId));
          if (bookingError) throw new Error(`Failed to update booking: ${bookingError.message}`);
          console.log(`[STRIPE WEBHOOK] Booking ${bookingId} confirmed`);
        }

        // ---- Tenant payment ----
        if (tenantPaymentId) {
          const pid = parseInt(tenantPaymentId);
          // Complete the payment + generate receipt + email (idempotent, shared by all paths)
          const result = await completeTenantPayment(pid, paymentIntentId);
          console.log(
            `[STRIPE WEBHOOK] Tenant payment ${pid} finalized (newlyCompleted=${result.newlyCompleted}, emailed=${result.emailed})`,
          );
        }

        if (!bookingId && !tenantPaymentId) {
          console.error('[STRIPE WEBHOOK] Missing booking_id or tenant_payment_id in metadata');
          return NextResponse.json({ received: true, error: 'No payment id in metadata' });
        }

        await completeEvent('stripe', event.id, {
          status: 'processed',
          target: tenantPaymentId
            ? `tenant_payments:${tenantPaymentId}`
            : bookingId
              ? `bookings:${bookingId}`
              : undefined,
        });

        return NextResponse.json({ received: true, bookingId, tenantPaymentId });
      } catch (error) {
        console.error('[STRIPE WEBHOOK] Error processing payment:', error);
        await completeEvent('stripe', event.id, {
          status: 'failed',
          error: error instanceof Error ? error.message : String(error),
        });
        // 200 with a flag: Stripe retries on non-2xx, and the claim above would
        // then suppress the retry. The failure is recorded for reconciliation.
        return NextResponse.json({ received: true, error: 'processing failed' });
      }
    }

    if (event.type === 'charge.failed') {
      const charge = event.data.object as Stripe.Charge;
      console.error('[STRIPE WEBHOOK] Charge failed:', charge.id);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('[STRIPE WEBHOOK] Signature verification failed:', error);
    return NextResponse.json(
      { error: 'Webhook signature verification failed' },
      { status: 400 }
    );
  }
}
