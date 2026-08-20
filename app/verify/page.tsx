"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { InvoiceReceipt } from "@/components/InvoiceReceipt";
import { formatDate } from "@/lib/utils";
import { DocumentSkeleton } from "@/components/ui/loading-skeletons";

// Define the API response type
interface VerificationResult {
  valid: boolean;
  receipt: {
    id: string;
    status: string;
    amount_paid: number;
    currency: string;
    created_at: string;
    payment_intent_id: string;
    user_email: string;
    qr_code_base64?: string;
    reference_number?: string;
  };
  booking: {
    id: number;
    status: string;
    apartment_name: string;
    client_name: string;
    start_date: string;
    end_date: string;
  };
}

function VerificationContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setError("No verification token provided.");
      setLoading(false);
      return;
    }

    const verifyToken = async () => {
      try {
        const res = await fetch(`/api/verify?token=${encodeURIComponent(token)}`);
        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || "Verification failed");
        }

        setResult(data as VerificationResult);
      } catch (err: any) {
        setError(err.message || "An error occurred during verification.");
      } finally {
        setLoading(false);
      }
    };

    verifyToken();
  }, [token]);

  if (loading) {
    // Skeleton, not a spinner: it occupies the same space the real
    // content will, so nothing shifts when the data arrives.
    return <DocumentSkeleton />;
  }

  if (error || !result) {
    return (
      <Card className="w-full max-w-md mx-auto shadow-xl border-t-4 border-t-red-500">
        <CardHeader className="text-center space-y-2">
          <div className="flex justify-center mb-2">
            <XCircle className="w-16 h-16 text-red-500" />
          </div>
          <CardTitle className="text-2xl font-bold text-gray-900">Invalid Receipt</CardTitle>
          <CardDescription className="text-base">
            {error || "This scan is invalid or the receipt could not be found."}
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const { receipt, booking } = result;
  const samePeriod = booking.start_date === booking.end_date;
  const period = samePeriod
    ? ""
    : ` (${formatDate(booking.start_date)} to ${formatDate(booking.end_date)})`;

  return (
    <div className="w-full max-w-3xl mx-auto space-y-5">
      {/* Verification status banner */}
      <div className="bg-white border-l-4 border-l-green-500 shadow-lg px-6 py-4 flex items-center gap-4 max-w-3xl mx-auto">
        <CheckCircle2 className="w-8 h-8 text-green-600 flex-shrink-0" />
        <div>
          <p className="font-bold text-neutral-900">Receipt Verified — Payment is Valid</p>
          <p className="text-sm text-neutral-500">
            Confirmed authentic by Cielo Vista on {formatDate(receipt.created_at)}
          </p>
        </div>
      </div>

      {/* The same invoice document shown on the site and in the email */}
      <InvoiceReceipt
        invoiceNumber={receipt.id.substring(0, 8).toUpperCase()}
        referenceNumber={receipt.reference_number || String(booking.id)}
        date={receipt.created_at}
        dueDate={samePeriod ? undefined : booking.end_date}
        billedToName={booking.client_name}
        billedToEmail={receipt.user_email}
        qrCodeBase64={receipt.qr_code_base64}
        transactionId={receipt.payment_intent_id}
        currency={receipt.currency}
        isVerified
        items={[
          {
            description: `Rent — ${booking.apartment_name}${period}`,
            rate: receipt.amount_paid,
            unit: "Payment",
            subtotal: receipt.amount_paid,
          },
        ]}
      />
    </div>
  );
}

export default function VerificationPage() {
  return (
    <div className="min-h-screen bg-neutral-800 py-10 px-4 sm:px-6 flex flex-col items-center font-sans tracking-tight">
      <div className="w-full max-w-3xl mx-auto mb-6 text-center">
        <h1 className="text-xl font-bold text-white">Cielo Vista</h1>
        <p className="text-xs text-neutral-400 mt-1">Receipt Verification</p>
      </div>

      <Suspense fallback={<Loader2 className="w-8 h-8 animate-spin text-white mx-auto" />}>
        <VerificationContent />
      </Suspense>
    </div>
  );
}
