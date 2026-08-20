import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { errorResponse } from '@/lib/auth/session';
import { authorizeBookingReceipt } from '@/lib/auth/receipt-access';
import { recordAudit } from '@/lib/audit';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

/**
 * GET /api/receipt/:bookingId
 *
 * Fetch receipt data by booking ID.
 *
 * Access (see lib/auth/receipt-access.ts): a valid QR token minted for THIS
 * booking, or the signed-in guest whose email is on the booking, or staff.
 * The token was previously optional, so omitting it returned the booking's
 * client name, email and phone number to any caller who guessed an id.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ bookingId: string }> }
) {
  try {
    const bookingIdStr = (await params).bookingId;
    const bookingId = parseInt(bookingIdStr, 10);

    if (!Number.isInteger(bookingId) || bookingId <= 0) {
      return NextResponse.json({ error: 'Invalid booking ID' }, { status: 400 });
    }

    const grant = await authorizeBookingReceipt(request, bookingId);

    // Fetch receipt from database
    const { data: receipt, error: receiptError } = await supabase
      .from('receipts')
      .select('*')
      .eq('booking_id', bookingId)
      .single();

    if (receiptError || !receipt) {
      console.error('[RECEIPT API] Receipt not found for booking:', receiptError);
      return NextResponse.json(
        { error: 'Receipt not found' },
        { status: 404 }
      );
    }

    // 4. Fetch booking details for context
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select('*')
      .eq('id', bookingId)
      .single();

    if (bookingError) {
      console.error('[RECEIPT API] Booking not found:', bookingError);
      return NextResponse.json(
        { error: 'Booking not found' },
        { status: 404 }
      );
    }

    // 5. Fetch apartment details
    const { data: apartment, error: apartmentError } = await supabase
      .from('apartments')
      .select('name, type, bedrooms, bathrooms, price_per_month')
      .eq('id', receipt.apartment_id)
      .single();

    if (apartmentError) {
      console.error('[RECEIPT API] Apartment not found:', apartmentError);
      return NextResponse.json(
        { error: 'Apartment not found' },
        { status: 404 }
      );
    }

    // 6. Return receipt with all details
    const responseData = {
      receipt: {
        id: receipt.id,
        booking_id: receipt.booking_id,
        user_email: receipt.user_email,
        amount_paid: receipt.amount_paid,
        currency: receipt.currency,
        status: receipt.status,
        payment_intent_id: receipt.payment_intent_id,
        qr_code_base64: receipt.qr_code_base64,
        is_verified: receipt.is_verified,
        verified_at: receipt.verified_at,
        created_at: receipt.created_at,
      },
      booking: {
        id: booking.id,
        client_name: booking.client_name,
        email: booking.email,
        phone_number: booking.phone_number,
        start_date: booking.start_date,
        end_date: booking.end_date,
        status: booking.status,
        apartment_type: apartment.type,
      },
      apartment: {
        name: apartment.name,
        type: apartment.type,
        bedrooms: apartment.bedrooms,
        bathrooms: apartment.bathrooms,
        price_per_month: apartment.price_per_month,
      },
    };

    await recordAudit(
      {
        action: 'receipt.viewed',
        target: `bookings:${bookingId}`,
        metadata: { via: grant.via, receipt_id: receipt.id },
      },
      { req: request, session: grant.session }
    );

    return NextResponse.json(responseData);
  } catch (error) {
    // Keeps the helper's 404 (used for both "missing" and "not yours") intact
    // and collapses anything else into a generic 500.
    return errorResponse(error);
  }
}
