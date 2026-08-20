import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { createClient } from '@supabase/supabase-js';
import { jwtSecret } from '@/lib/auth/secrets';
import { getSession, errorResponse } from '@/lib/auth/session';
import { enforceRateLimit } from '@/lib/auth/rate-limit';

// ─────────────────────────────────────────────────────────────────────────────
// Public QR receipt verification — the endpoint a printed receipt points at.
//
// Anyone holding the physical receipt can scan it, so this stays reachable
// without a session. Three things were wrong with that arrangement:
//
//   1. HARDCODED SECRET. This file did
//        process.env.JWT_SECRET || 'fallback-secret-phrase-replace-me'
//      It was the last survivor of the pattern lib/auth/secrets.ts exists to
//      remove. Any deployment without JWT_SECRET set signed and accepted tokens
//      under a constant published in the repository — so anyone reading the
//      source could mint a receipt that verifies as genuine.
//
//   2. PII TO AN ANONYMOUS SCANNER. The response carried the tenant's full name
//      and email address. A receipt dropped in the street, or a QR photographed
//      over someone's shoulder, disclosed who they are and how to reach them.
//      An anonymous scanner now gets only what proves the receipt is real:
//      validity, amount, currency, reference, date, apartment. Identity is
//      returned only to signed-in staff, who are the people with a reason to
//      match a receipt to a person at the desk.
//
//   3. NO RATE LIMIT. Signature forgery is not feasible, but the endpoint was
//      free to hammer.
// ─────────────────────────────────────────────────────────────────────────────

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

const STAFF_ROLES = new Set(['admin', 'manager', 'employee']);

interface ReceiptClaims {
  tenant_payment_id?: number;
  booking_id?: number;
  apartment_id?: number;
  timestamp?: number;
}

export async function GET(request: NextRequest) {
  try {
    await enforceRateLimit(request, 'receipt-verify', 60, 10 * 60);

    const token = request.nextUrl.searchParams.get('token');
    if (!token) {
      return NextResponse.json({ error: 'Token is required' }, { status: 400 });
    }

    // Staff see the identity fields; everyone else sees proof-of-payment only.
    const session = await getSession(request);
    const isStaff = !!session && STAFF_ROLES.has(session.role);

    let decoded: ReceiptClaims;
    try {
      decoded = jwt.verify(token, jwtSecret()) as ReceiptClaims;
    } catch {
      // Forged, tampered or expired — one message for all three.
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 400 });
    }

    // ---- Tenant payment receipt (the path our payment receipts use) ----
    if (decoded.tenant_payment_id) {
      const pid = decoded.tenant_payment_id;

      const { data: receipts } = await supabase
        .from('receipts')
        .select('*')
        .eq('tenant_payment_id', pid)
        .limit(1);

      const receipt = receipts?.[0];
      if (!receipt) {
        return NextResponse.json({ error: 'Receipt not found' }, { status: 404 });
      }

      const { data: payment } = await supabase
        .from('tenant_payments')
        .select('*, tenants(full_name, email), apartments(name)')
        .eq('id', pid)
        .single();

      const apartmentName = (payment as any)?.apartments?.name;

      return NextResponse.json({
        valid: true,
        receipt: {
          id: receipt.id,
          status: receipt.status,
          amount_paid: receipt.amount_paid,
          currency: receipt.currency,
          created_at: receipt.created_at,
          reference_number: payment?.reference_number || String(pid),
          // Identity and payment-processor references are staff-only.
          ...(isStaff
            ? {
                user_email: receipt.user_email,
                payment_intent_id: receipt.payment_intent_id,
              }
            : {}),
        },
        booking: {
          id: payment?.id ?? pid,
          status: payment?.status ?? receipt.status,
          apartment_name:
            apartmentName || `Apartment #${payment?.apartment_id ?? decoded.apartment_id ?? ''}`,
          start_date: payment?.due_date ?? receipt.created_at,
          end_date: payment?.due_date ?? receipt.created_at,
          ...(isStaff
            ? { client_name: (payment as any)?.tenants?.full_name || receipt.user_email }
            : {}),
        },
      });
    }

    // ---- Booking receipt (legacy path) ----
    if (decoded.booking_id) {
      const { data: receipt } = await supabase
        .from('receipts')
        .select('*')
        .eq('booking_id', decoded.booking_id)
        .limit(1)
        .single();

      if (!receipt) {
        return NextResponse.json({ error: 'Receipt not found' }, { status: 404 });
      }

      // bookings.apartment_id has no FK to apartments, so a PostgREST embed
      // (`apartments!apartment_id(...)`) errors with PGRST200. Look the
      // apartment up separately.
      const { data: booking } = await supabase
        .from('bookings')
        .select('*')
        .eq('id', decoded.booking_id)
        .single();

      let apt: any = null;
      if ((booking as any)?.apartment_id != null) {
        const { data: aptRow } = await supabase
          .from('apartments')
          .select('name, price_per_month')
          .eq('id', (booking as any).apartment_id)
          .single();
        apt = aptRow || null;
      }

      return NextResponse.json({
        valid: true,
        receipt: {
          id: receipt.id,
          status: receipt.status,
          amount_paid: receipt.amount_paid,
          currency: receipt.currency,
          created_at: receipt.created_at,
          reference_number: String(decoded.booking_id),
          ...(isStaff
            ? {
                user_email: receipt.user_email,
                payment_intent_id: receipt.payment_intent_id,
              }
            : {}),
        },
        booking: {
          id: booking?.id ?? decoded.booking_id,
          status: booking?.status ?? receipt.status,
          apartment_name: apt?.name || `Apartment #${decoded.apartment_id ?? ''}`,
          start_date: booking?.start_date ?? receipt.created_at,
          end_date: booking?.end_date ?? receipt.created_at,
          ...(isStaff
            ? { client_name: booking?.client_name || receipt.user_email }
            : {}),
        },
      });
    }

    return NextResponse.json(
      { error: 'Token has no payment or booking reference' },
      { status: 400 }
    );
  } catch (error) {
    return errorResponse(error);
  }
}
