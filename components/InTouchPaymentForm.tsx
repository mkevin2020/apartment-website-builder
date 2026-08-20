"use client";

import { useState } from "react";
import { intouchPayService } from "@/lib/intouch-pay";
import { useToast } from "@/hooks/use-toast";

interface IntouchPaymentFormProps {
  tenantId: string;
  apartmentId: string;
  tenantName: string;
  tenantPhone: string;
  amount: number;
  month: string;
  onPaymentSuccess?: (transactionId: string) => void;
}

/**
 * Example component using IntouchPay service
 * Shows how to request payment and send SMS confirmation
 */
export function IntouchPaymentForm({
  tenantId,
  apartmentId,
  tenantName,
  tenantPhone,
  amount,
  month,
  onPaymentSuccess,
}: IntouchPaymentFormProps) {
  const [loading, setLoading] = useState(false);
  const [transactionId, setTransactionId] = useState<string | null>(null);
  const { toast } = useToast();

  const handlePaymentRequest = async () => {
    try {
      setLoading(true);

      // Step 1: Request payment
      console.log("Requesting payment...");
      const paymentResult = await intouchPayService.requestPayment({
        amount,
        phone_number: tenantPhone,
        tenant_id: tenantId,
        apartment_id: apartmentId,
        month,
        description: `Apartment rent for ${apartmentId}`,
        send_sms: true,
      });

      console.log("Payment request result:", paymentResult);
      setTransactionId(paymentResult.transaction_id);

      toast({
        title: "Payment Request Sent",
        description: `Payment link sent to ${tenantPhone}`,
      });

      // Step 2: Send confirmation SMS (optional)
      try {
        await intouchPayService.sendPaymentConfirmationSMS({
          phone_number: tenantPhone,
          tenant_name: tenantName,
          amount,
          apartment: apartmentId,
          month,
          reference_id: paymentResult.transaction_id,
        });
      } catch (smsError) {
        console.error("SMS confirmation failed:", smsError);
        // Don't fail the whole flow if SMS fails
      }

      if (onPaymentSuccess) {
        onPaymentSuccess(paymentResult.transaction_id);
      }
    } catch (error) {
      console.error("Payment request failed:", error);
      toast({
        title: "Payment Failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCheckStatus = async () => {
    if (!transactionId) {
      toast({
        title: "Error",
        description: "No transaction to check",
        variant: "destructive",
      });
      return;
    }

    try {
      const status = await intouchPayService.checkPaymentStatus(
        transactionId,
        transactionId
      );
      console.log("Payment status:", status);
      toast({
        title: "Payment Status",
        description: JSON.stringify(status, null, 2),
      });
    } catch (error) {
      console.error("Status check failed:", error);
      toast({
        title: "Status Check Failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-4 border rounded-lg p-4">
      <h3 className="font-semibold">IntouchPay Payment</h3>

      <div className="space-y-2 text-sm">
        <div>
          <span className="font-medium">Tenant:</span> {tenantName}
        </div>
        <div>
          <span className="font-medium">Apartment:</span> {apartmentId}
        </div>
        <div>
          <span className="font-medium">Month:</span> {month}
        </div>
        <div>
          <span className="font-medium">Amount:</span> RWF {amount.toLocaleString()}
        </div>
        <div>
          <span className="font-medium">Phone:</span> {tenantPhone}
        </div>
      </div>

      {transactionId && (
        <div className="text-sm bg-green-50 border border-green-200 rounded p-2">
          <span className="font-medium">Transaction ID:</span> {transactionId}
        </div>
      )}

      <div className="flex gap-2">
        <button
          onClick={handlePaymentRequest}
          disabled={loading}
          className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium py-2 px-4 rounded"
        >
          {loading ? "Processing..." : "Request Payment"}
        </button>

        {transactionId && (
          <button
            onClick={handleCheckStatus}
            disabled={loading}
            className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-medium py-2 px-4 rounded"
          >
            Check Status
          </button>
        )}
      </div>
    </div>
  );
}
