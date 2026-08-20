"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Printer, ArrowLeft } from "lucide-react";
import { formatDate } from "@/lib/utils";
import Link from "next/link";
import { InvoiceReceipt } from "@/components/InvoiceReceipt";
import { DocumentSkeleton } from "@/components/ui/loading-skeletons";

interface Receipt {
  id: string;
  amount_paid: number;
  currency: string;
  payment_intent_id: string;
  status: string;
  qr_code_base64: string;
  created_at: string;
  user_email: string;
}

interface Booking {
  id: number;
  tenant_id: string;
  apartment_id: number;
  start_date: string;
  end_date: string;
  status: string;
  client_name?: string;
  apartment?: {
    name: string;
    price_per_month: number;
  };
}

export default function ReceiptPage() {
  const params = useParams();
  const bookingId = params.booking_id as string;

  const [loading, setLoading] = useState(true);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [booking, setBooking] = useState<Booking | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchReceiptDetails = async () => {
      try {
        if (!bookingId) return;

        // Fetched through the receipt API rather than by querying receipts,
        // bookings and tenant_payments from the browser.
        //
        // Two reasons. Those tables are no longer readable without a session,
        // so the direct queries returned nothing and the page showed "Receipt
        // not found" for receipts that exist. And the API is where the access
        // rule lives: a QR token minted for this exact record, or a session
        // that owns it, or staff — anything else gets an identical 404, so the
        // id cannot be used to probe for other people's receipts.
        //
        // The link from the payments page carries a tenant_payment id, so the
        // payment endpoint is tried first and the booking one is the fallback
        // for older, booking-linked receipts.
        const token = new URLSearchParams(window.location.search).get("token");
        const suffix = token ? `?token=${encodeURIComponent(token)}` : "";

        const endpoints = [
          `/api/receipt/payment/${encodeURIComponent(bookingId)}${suffix}`,
          `/api/receipt/${encodeURIComponent(bookingId)}${suffix}`,
        ];

        let payload: any = null;
        for (const url of endpoints) {
          const res = await fetch(url, { cache: "no-store" });
          if (res.ok) {
            payload = await res.json();
            break;
          }
        }

        if (!payload?.receipt) {
          setError("Receipt not found, or you do not have access to it.");
          setLoading(false);
          return;
        }

        setReceipt(payload.receipt);

        const apt = payload.apartment;
        const apartment = apt
          ? { name: apt.name, price_per_month: apt.price_per_month }
          : undefined;

        if (payload.booking) {
          // Booking-linked receipt.
          setBooking({ ...payload.booking, apartment });
        } else if (payload.tenant_payment) {
          // Payment-linked receipt: shape it like a booking for the view below.
          const p = payload.tenant_payment;
          setBooking({
            id: p.id,
            tenant_id: p.tenant_id,
            apartment_id: p.apartment_id,
            start_date: p.due_date,
            end_date: p.due_date,
            status: p.status,
            client_name: payload.receipt.user_email || "Valued Tenant",
            apartment: apartment
              ? { name: `Apt ${apartment.name}`, price_per_month: apartment.price_per_month }
              : undefined,
          });
        } else {
          setError("Receipt found, but its booking details are missing.");
        }
      } catch (err: any) {
        setError(err.message || "Failed to load receipt information.");
      } finally {
        setLoading(false);
      }
    };

    fetchReceiptDetails();
  }, [bookingId]);

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    // Skeleton, not a spinner: it occupies the same space the real
    // content will, so nothing shifts when the data arrives.
    return <DocumentSkeleton />;
  }

  if (error || !receipt || !booking) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-6">
        <Card className="max-w-md w-full border-t-4 border-t-red-500 shadow-xl">
          <CardHeader className="text-center">
            <CardTitle className="text-xl text-red-600">Error Loading Receipt</CardTitle>
          </CardHeader>
          <CardContent className="text-center text-gray-600 pb-8">
            {error || "An unknown error occurred."}
          </CardContent>
        </Card>
      </div>
    );
  }

  const samePeriod = booking.start_date === booking.end_date;
  const apartmentLabel = booking.apartment?.name || `Apartment #${booking.apartment_id}`;
  const itemDescription = samePeriod
    ? `Rent — ${apartmentLabel}`
    : `Rent — ${apartmentLabel} (${formatDate(booking.start_date)} to ${formatDate(booking.end_date)})`;

  return (
    <div className="min-h-screen bg-neutral-800 py-12 px-4 sm:px-6 print:bg-white print:py-0">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Navigation / Actions (Hidden during print) */}
        <div className="flex items-center justify-between print:hidden">
          <Link href="/tenant/dashboard" className="text-neutral-300 hover:text-white transition flex items-center gap-2 font-medium">
            <ArrowLeft className="w-4 h-4" /> Back to Dashboard
          </Link>
          <Button onClick={handlePrint} variant="outline" className="gap-2 bg-white">
            <Printer className="w-4 h-4" /> Download PDF / Print
          </Button>
        </div>

        <InvoiceReceipt
          invoiceNumber={receipt.id.substring(0, 8).toUpperCase()}
          referenceNumber={String(booking.id)}
          date={receipt.created_at}
          dueDate={samePeriod ? undefined : booking.end_date}
          billedToName={booking.client_name || "Valued Tenant"}
          billedToEmail={receipt.user_email}
          qrCodeBase64={receipt.qr_code_base64}
          transactionId={receipt.payment_intent_id}
          currency={receipt.currency}
          items={[
            {
              description: itemDescription,
              rate: receipt.amount_paid,
              unit: "Payment",
              subtotal: receipt.amount_paid,
            },
          ]}
        />
      </div>
    </div>
  );
}
