'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Download, AlertCircle, Loader, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { InvoiceReceipt } from '@/components/InvoiceReceipt';
import { safeJsonResponse } from '@/lib/safe-fetch-json';
import { DocumentSkeleton } from "@/components/ui/loading-skeletons";

interface ReceiptData {
  receipt: {
    id: string;
    booking_id?: number;
    tenant_payment_id?: number;
    user_email: string;
    amount_paid: number;
    currency: string;
    status: string;
    payment_intent_id: string;
    qr_code_base64: string;
    is_verified: boolean;
    verified_at: string | null;
    created_at: string;
  };
  booking?: {
    id: number;
    client_name: string;
    email: string;
    phone_number: string;
    start_date: string;
    end_date: string;
    status: string;
    apartment_type: string;
  };
  apartment?: {
    name: string;
    type: string;
    bedrooms: number;
    bathrooms: number;
    price_per_month: number;
  };
  tenant_payment?: {
    id: number;
    reference_number: string;
    tenant_id: number;
    apartment_id: number;
    due_date: string;
    status: string;
  };
}

function ReceiptContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const bookingId = searchParams.get('booking_id');
  const paymentId = searchParams.get('payment_id');

  const [receiptData, setReceiptData] = useState<ReceiptData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchReceipt = async () => {
      try {
        if (!bookingId && !paymentId && !token) {
          setError('No receipt information provided');
          setLoading(false);
          return;
        }

        let url: string;

        // Build URL based on what parameter we have
        if (bookingId) {
          url = new URL(`/api/receipt/${bookingId}`, window.location.origin).toString();
        } else if (paymentId) {
          url = new URL(`/api/receipt/payment/${paymentId}`, window.location.origin).toString();
        } else if (token) {
          const decodedElement = token.split('.')[0];
          url = new URL(`/api/receipt/${decodedElement}`, window.location.origin).toString();
        } else {
          throw new Error('Invalid request');
        }

        // Add token if available
        if (token) {
          const separator = url.includes('?') ? '&' : '?';
          url += separator + 'token=' + token;
        }

        const response = await fetch(url);

        if (!response.ok) {
          throw new Error(
            response.status === 404
              ? 'Receipt not found'
              : 'Failed to load receipt'
          );
        }

        const data: ReceiptData = await safeJsonResponse<ReceiptData>(response, 'Unable to load receipt');
        setReceiptData(data);
      } catch (err) {
        console.error('Error fetching receipt:', err);
        setError(err instanceof Error ? err.message : 'Failed to load receipt');
      } finally {
        setLoading(false);
      }
    };

    fetchReceipt();
  }, [bookingId, paymentId, token]);

  if (loading) {
    // Skeleton, not a spinner: it occupies the same space the real
    // content will, so nothing shifts when the data arrives.
    return <DocumentSkeleton />;
  }

  if (error) {
    return (
      <div className="min-h-screen bg-neutral-800 flex items-center justify-center p-4">
        <Card className="w-full max-w-md border-red-200">
          <div className="flex flex-col items-center justify-center p-8 space-y-4">
            <AlertCircle className="w-8 h-8 text-red-600" />
            <h2 className="text-lg font-semibold text-gray-800">Error</h2>
            <p className="text-red-600 text-center">{error}</p>
            <Button
              onClick={() => window.history.back()}
              variant="outline"
              className="mt-4"
            >
              Go Back
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  if (!receiptData) {
    return null;
  }

  const { receipt, booking, apartment, tenant_payment } = receiptData;

  const apartmentLabel = apartment?.name || 'Apartment';
  const period = booking
    ? ` (${new Date(booking.start_date).toLocaleDateString()} to ${new Date(booking.end_date).toLocaleDateString()})`
    : '';

  return (
    <div className="min-h-screen bg-neutral-800 py-10 px-4 print:bg-white print:py-0">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Actions (hidden when printing) */}
        <div className="flex items-center justify-between print:hidden">
          <button
            onClick={() => window.history.back()}
            className="text-neutral-300 hover:text-white transition flex items-center gap-2 font-medium text-sm"
          >
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
          <Button onClick={() => window.print()} variant="outline" className="gap-2 bg-white">
            <Download className="w-4 h-4" /> Download PDF / Print
          </Button>
        </div>

        <InvoiceReceipt
          invoiceNumber={receipt.id.substring(0, 8).toUpperCase()}
          referenceNumber={tenant_payment?.reference_number || String(booking?.id ?? receipt.id)}
          date={receipt.created_at}
          dueDate={tenant_payment?.due_date || booking?.end_date}
          billedToName={booking?.client_name || receipt.user_email}
          billedToEmail={booking?.email || receipt.user_email}
          billedToPhone={booking?.phone_number}
          qrCodeBase64={receipt.qr_code_base64}
          transactionId={receipt.payment_intent_id}
          currency={receipt.currency}
          isVerified={receipt.is_verified}
          items={[
            {
              description: `Rent — ${apartmentLabel}${period}`,
              rate: receipt.amount_paid,
              unit: 'Payment',
              subtotal: receipt.amount_paid,
            },
          ]}
        />

        <p className="text-center text-neutral-500 text-xs print:hidden">
          This receipt is generated automatically. Please keep it for your records.
        </p>
      </div>
    </div>
  );
}

export default function ReceiptPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center text-gray-500">
          Loading receipt…
        </div>
      }
    >
      <ReceiptContent />
    </Suspense>
  );
}
