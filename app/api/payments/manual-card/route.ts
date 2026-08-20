import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';
import { requireSession, errorResponse, HttpError } from '@/lib/auth/session';
import { loadOwnedPayment, assertPayable } from '@/lib/auth/payment-access';
import { jwtSecret } from '@/lib/auth/secrets';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '');

// Helper to create a Stripe token from card data
async function createCardToken(cardData: {
  cardNumber: string;
  expiryMonth: number;
  expiryYear: number;
  cvc: string;
}): Promise<string> {
  // In test mode, map test card numbers to Stripe test tokens
  const testCardMap: { [key: string]: string } = {
    '4242424242424242': 'tok_visa',
    '4000000000000002': 'tok_chargeDeclined',
    '5555555555554444': 'tok_mastercard',
    '378282246310005': 'tok_amex',
  };

  // Check if this is a test card
  if (process.env.STRIPE_SECRET_KEY?.includes('test')) {
    const testToken = testCardMap[cardData.cardNumber];
    if (testToken) {
      return testToken;
    }
    
    // For test mode with unmapped cards, throw error
    throw new Error(
      'In test mode, please use one of the Stripe test cards: ' +
      '4242 4242 4242 4242 (Visa), ' +
      '5555 5555 5555 4444 (Mastercard), or ' +
      '3782 822463 10005 (Amex)'
    );
  }

  // For production, we need to use raw HTTP request to Stripe API
  // First check if raw card data APIs are enabled
  const stripeKey = process.env.STRIPE_SECRET_KEY || '';
  
  try {
    // Make raw HTTP request to Stripe tokens API
    const response = await fetch('https://api.stripe.com/v1/tokens', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${stripeKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        'card[number]': cardData.cardNumber,
        'card[exp_month]': cardData.expiryMonth.toString(),
        'card[exp_year]': cardData.expiryYear.toString(),
        'card[cvc]': cardData.cvc,
      }).toString(),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Failed to create Stripe token');
    }

    const tokenData = await response.json();
    return tokenData.id;
  } catch (error: any) {
    throw new Error(
      `Token creation failed: ${error.message}. ` +
      'Please ensure "Access to raw card data APIs" is enabled in your Stripe Dashboard: ' +
      'https://support.stripe.com/questions/enabling-access-to-raw-card-data-apis'
    );
  }
}


/**
 * Create a validated invoice for a free-standing "advance" payment.
 *
 * This replaces the old behaviour where `paymentId = 0` meant "charge whatever
 * `amount` the browser sent". The tenant id comes from the signed session, the
 * apartment must be one the caller currently holds, and the amount is bounded —
 * so the row this returns is a price the SERVER decided.
 */
async function createAdvanceInvoice(
  request: NextRequest,
  body: { amount?: unknown; apartmentId?: unknown; referenceNumber?: unknown },
): Promise<{ id: number; amount: number; reference_number: string }> {
  const session = await requireSession(request);

  const requested = Number(body.amount);
  if (!Number.isFinite(requested) || requested <= 0 || requested > 100_000_000) {
    throw new HttpError(400, 'Enter a valid payment amount.');
  }
  // RWF has no minor unit — reject fractional francs rather than silently
  // rounding someone's money.
  const advanceAmount = Math.round(requested);

  const apartmentId = Number(body.apartmentId);
  if (!Number.isInteger(apartmentId) || apartmentId <= 0) {
    throw new HttpError(400, 'Choose which apartment this payment is for.');
  }

  // The caller must actually hold this apartment.
  const { data: held } = await supabase
    .from('bookings')
    .select('id')
    .eq('tenant_id', String(session.sub))
    .eq('apartment_id', apartmentId)
    .not('status', 'in', '(cancelled,rejected,declined)')
    .limit(1);

  if (!held || held.length === 0) {
    throw new HttpError(403, 'You can only pay for an apartment you currently hold.');
  }

  const today = new Date().toISOString().split('T')[0];
  const referenceNumber = `ADV-${new Date().getFullYear()}-${Math.floor(
    Math.random() * 900000 + 100000,
  )}`;

  const { data: invoice, error } = await supabase
    .from('tenant_payments')
    .insert({
      tenant_id: session.sub,
      apartment_id: apartmentId,
      amount: advanceAmount,
      payment_date: today,
      due_date: today,
      status: 'pending',
      reference_number: referenceNumber,
    })
    .select('id, amount, reference_number')
    .single();

  if (error || !invoice) {
    console.error('advance invoice creation failed:', error);
    throw new HttpError(500, 'Could not start this payment. Please try again.');
  }

  return invoice as { id: number; amount: number; reference_number: string };
}

export async function POST(request: NextRequest) {
  try {
    // Charges a card against an invoice — the caller must own that invoice.
    await requireSession(request);

    const body = await request.json();
    const {
      paymentId,
      amount,
      tenantId,
      email,
      referenceNumber,
      cardholderName,
      cardNumber,
      expiryMonth,
      expiryYear,
      cvc,
    } = body;

    // Validate required fields (paymentId can be 0 for manual/advance payments)
    if (paymentId === undefined || paymentId === null || !amount || !tenantId || !email || !cardholderName || !cardNumber || !expiryMonth || !expiryYear || !cvc) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // ── Price the charge SERVER-SIDE, always ────────────────────────────────
    //
    // Previously `paymentId = 0` (a free-standing advance payment) fell through
    // to `Number(amount)` straight from the request body, so the browser chose
    // what it was charged. The advance-payment feature is preserved, but the
    // invoice is now created on the server first and the charge is priced from
    // that row — the same rule the invoice path already followed.
    let chargeAmount: number;
    let settledPaymentId: number;

    if (Number(paymentId) > 0) {
      const { payment } = await loadOwnedPayment(request, paymentId);
      assertPayable(payment);
      chargeAmount = Number(payment.amount);
      settledPaymentId = Number(payment.id);
    } else {
      // Advance payment: mint a validated invoice for this tenant, then charge
      // that. createAdvanceInvoice bounds the amount and verifies the caller
      // actually holds the apartment.
      const invoice = await createAdvanceInvoice(request, body);
      chargeAmount = Number(invoice.amount);
      settledPaymentId = Number(invoice.id);
    }

    if (!Number.isFinite(chargeAmount) || chargeAmount <= 0) {
      return NextResponse.json(
        { error: 'This payment has no valid amount and cannot be charged.' },
        { status: 409 }
      );
    }

    // RWF is a ZERO-DECIMAL currency: Stripe's smallest unit for RWF is the
    // franc itself. This previously did `Math.round(chargeAmount * 100)`, which
    // charged one hundred times the invoice — 45,000 RWF became 4,500,000 RWF.
    // (app/api/payments/stripe/route.ts already had this right.)
    const amountForStripe = Math.round(chargeAmount);

    try {
      // Create a Stripe token from the card data
      // This is safer than using raw payment methods
      const cardToken = await createCardToken({
        cardNumber,
        expiryMonth,
        expiryYear,
        cvc,
      });

      // Create charge using the token (legacy but secure approach)
      const charge = await stripe.charges.create({
        amount: amountForStripe,
        currency: 'rwf',
        source: cardToken, // Use token instead of raw card data
        description: `${cardholderName} - Apartment rent payment (Ref: ${referenceNumber})`,
        receipt_email: email,
        metadata: {
          paymentId: String(settledPaymentId),
          tenantId,
          referenceNumber,
          cardholderName,
          payerEmail: email,
        },
      });

      // Verify charge was successful
      if (charge.status !== 'succeeded') {
        return NextResponse.json(
          { error: `Payment failed with status: ${charge.status}` },
          { status: 400 }
        );
      }

      // Update payment record in database (skip if in demo mode)
      // Only update payment record if it's a real payment (not demo or manual advance payment)
      if (settledPaymentId && settledPaymentId !== 9999) {
        const { data: paymentRecord, error: paymentError } = await supabase
          .from('tenant_payments')
          .update({
            payment_method: 'card',
            transaction_id: charge.id,
            status: 'completed',
            payment_date: new Date().toISOString(),
          })
          .eq('id', settledPaymentId)
          .eq('tenant_id', tenantId) // Ensure tenant_id matches for security
          .select()
          .single();

        if (paymentError) {
          console.error('Supabase error details:', paymentError);
          return NextResponse.json(
            { 
              error: 'Failed to update payment record',
              details: paymentError.message 
            },
            { status: 500 }
          );
        } else if (paymentRecord) {
             try {
                // Generate QR Code and receipt for tenant
                const jwtParams = {
                  tenant_payment_id: settledPaymentId,
                  apartment_id: paymentRecord.apartment_id,
                  timestamp: Date.now()
                };
                
                const jwt = require('jsonwebtoken');
                const verifyToken = jwt.sign(jwtParams, jwtSecret(), { expiresIn: '365d' });
                
                const QRCode = require('qrcode');
                const verificationUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/verify?token=${verifyToken}`;
                const qrCodeBase64 = await QRCode.toDataURL(verificationUrl);
                
                await supabase.from('receipts').insert({
                   tenant_payment_id: settledPaymentId,
                   booking_id: settledPaymentId, // Fallback mapping 
                   user_email: email,
                   apartment_id: paymentRecord.apartment_id,
                   amount_paid: amount,
                   currency: 'rwf',
                   payment_intent_id: charge.id,
                   status: 'PAID',
                   qr_code_base64: qrCodeBase64,
                });
             } catch (receiptError) {
                console.error("Error generating receipt QR:", receiptError);
             }
        }
      } else if (paymentId === 0) {
        console.log('[Manual Payment] Processing advance/manual payment without existing invoice');
      } else {
        console.log('[Demo Mode] Skipping database update for demo payment');
      }

      // Log the card payment (allow NULL for payment_id on advance payments)
      try {
        const logData: any = {
          tenant_id: tenantId,
          transaction_id: charge.id,
          amount,
          card_last_four: charge.payment_method_details?.card?.last4 || 'unknown',
          cardholder_name: cardholderName,
          email,
          status: 'completed',
          created_at: new Date().toISOString(),
        };
        
        // Only include payment_id if it's a valid reference
        if (settledPaymentId && settledPaymentId !== 9999) {
          logData.payment_id = settledPaymentId;
        }
        
        await supabase
          .from('card_payment_logs')
          .insert(logData);
      } catch (err) {
        console.error('Error logging payment:', err);
      }

      console.log(`[Stripe Payment] Charge succeeded - ID: ${charge.id}, Amount: ${amount} RWF`);

      return NextResponse.json({
        success: true,
        transactionId: charge.id,
        message: 'Payment processed successfully through Stripe',
        amount,
        paymentMethod: 'stripe_card',
      });
    } catch (stripeError: any) {
      console.error('Stripe error:', stripeError);
      return NextResponse.json(
        { 
          error: stripeError.message || 'Stripe payment failed',
          code: stripeError.code,
        },
        { status: 400 }
      );
    }
  } catch (error) {
    // errorResponse keeps the 400/403/409 raised by createAdvanceInvoice and
    // loadOwnedPayment intact, and collapses anything unexpected into a generic
    // 500 rather than echoing the driver message back to the browser.
    return errorResponse(error);
  }
}
