import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { errorResponse } from '@/lib/auth/session';
import { authorizePaymentReceipt } from '@/lib/auth/receipt-access';
import { recordAudit } from '@/lib/audit';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

/**
 * GET /api/receipt/payment/[paymentId]
 *
 * Fetch receipt for a tenant payment.
 *
 * Access (see lib/auth/receipt-access.ts): a valid QR token minted for THIS
 * payment, or a signed-in tenant who owns it, or staff. The token used to be
 * optional, which made this an unauthenticated PII dump by id.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ paymentId: string }> }
) {
  try {
    // Next.js 16: params is a Promise and must be awaited
    const { paymentId: paymentIdStr } = await params;
    const paymentId = parseInt(paymentIdStr, 10);

    if (!Number.isInteger(paymentId) || paymentId <= 0) {
      return NextResponse.json(
        { error: 'Invalid payment ID' },
        { status: 400 }
      );
    }

    const grant = await authorizePaymentReceipt(request, paymentId);

    // Fetch receipt linked to tenant payment. Some data sets may return zero or
    // multiple rows, so use a list query and take the first matching receipt.
    const { data: receiptRows, error: receiptError } = await supabase
      .from('receipts')
      .select('*')
      .eq('tenant_payment_id', paymentId)
      .order('created_at', { ascending: false });

    const receiptData = receiptRows?.[0] || null;

    if (receiptError || !receiptData) {
      console.warn('[RECEIPT API] Receipt not found for payment:', paymentId, receiptError);
      return NextResponse.json(
        { error: 'Receipt not found' },
        { status: 404 }
      );
    }

    // Fetch tenant payment details
    const { data: paymentData, error: paymentError } = await supabase
      .from('tenant_payments')
      .select('*')
      .eq('id', paymentId)
      .single();

    if (paymentError) {
      console.error('[RECEIPT API] Error fetching payment:', paymentError);
      throw paymentError;
    }

    // Fetch apartment details (best-effort — receipt still renders without it)
    let apartmentData = null;
    if (paymentData?.apartment_id) {
      const { data: apt } = await supabase
        .from('apartments')
        .select('name, type, bedrooms, bathrooms, price_per_month')
        .eq('id', paymentData.apartment_id)
        .single();
      apartmentData = apt;
    }

    await recordAudit(
      {
        action: 'receipt.viewed',
        target: `tenant_payments:${paymentId}`,
        metadata: { via: grant.via, receipt_id: receiptData.id },
      },
      { req: request, session: grant.session }
    );

    // Build response with receipt, payment and apartment details
    const response = {
      receipt: receiptData,
      tenant_payment: paymentData,
      apartment: apartmentData,
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    // Keeps the helper's 404 (used for both "missing" and "not yours") intact
    // and collapses anything else into a generic 500.
    return errorResponse(error);
  }
}
