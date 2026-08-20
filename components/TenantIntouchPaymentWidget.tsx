"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { sanitizePhone } from "@/lib/utils";
import {
  AlertCircle,
  Loader,
  CreditCard,
  CheckCircle,
  Phone,
  DollarSign,
} from "lucide-react";
import { intouchPayService } from "@/lib/intouch-pay";
import { useToast } from "@/hooks/use-toast";

interface TenantIntouchPaymentWidgetProps {
  paymentId: number;
  amount: number;
  tenantId: string;
  tenantName: string;
  tenantPhone: string;
  apartmentId: string;
  month: string;
  referenceNumber: string;
  onSuccess?: (transactionId?: string) => void;
  onCancel?: () => void;
}

export function TenantIntouchPaymentWidget({
  paymentId,
  amount,
  tenantId,
  tenantName,
  tenantPhone: initialPhone,
  apartmentId,
  month,
  referenceNumber,
  onSuccess,
  onCancel,
}: TenantIntouchPaymentWidgetProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [phone, setPhone] = useState(initialPhone);
  const [success, setSuccess] = useState(false);
  const [transactionId, setTransactionId] = useState<string | null>(null);
  const { toast } = useToast();

  const validatePhone = (phoneNumber: string): boolean => {
    // Accept phone with or without country code
    const phoneRegex = /^(\+250|250|0)?[789]\d{8}$/;
    return phoneRegex.test(phoneNumber.replace(/\s+/g, ""));
  };

  const formatPhone = (phoneNumber: string): string => {
    // Format to international format +250...
    let cleaned = phoneNumber.replace(/\D/g, "");

    if (cleaned.startsWith("250")) {
      return `+${cleaned}`;
    }
    if (cleaned.startsWith("0")) {
      return `+250${cleaned.substring(1)}`;
    }
    if (cleaned.length === 9) {
      return `+250${cleaned}`;
    }
    if (!cleaned.startsWith("+")) {
      return `+${cleaned}`;
    }
    return `+${cleaned}`;
  };

  const handleIntouchPayment = async () => {
    // Validate phone
    if (!phone.trim()) {
      setError("Please enter your phone number");
      return;
    }

    if (!validatePhone(phone)) {
      setError("Please enter a valid Rwandan phone number");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const formattedPhone = formatPhone(phone);

      // Request payment
      const result = await intouchPayService.requestPayment({
        amount,
        phone_number: formattedPhone,
        tenant_id: tenantId,
        apartment_id: apartmentId,
        month,
        description: `Apartment rent for ${apartmentId} - ${month}`,
        send_sms: true,
      });

      setTransactionId(result.transaction_id);

      // Show success message
      setSuccess(true);
      toast({
        title: "Payment Request Sent!",
        description: `Payment link has been sent to ${formattedPhone}. Follow the link to complete payment.`,
      });

      // Try to send confirmation SMS
      try {
        await intouchPayService.sendPaymentConfirmationSMS({
          phone_number: formattedPhone,
          tenant_name: tenantName,
          amount,
          apartment: apartmentId,
          month,
          reference_id: result.transaction_id,
        });
      } catch (smsError) {
        console.warn("Confirmation SMS failed:", smsError);
        // Don't fail the flow if SMS fails
      }

      if (onSuccess) {
        onSuccess(result.transaction_id);
      }

      // Auto-refresh after 5 seconds
      setTimeout(() => {
        window.location.reload();
      }, 5000);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Payment request failed";
      setError(errorMessage);
      toast({
        title: "Payment Failed",
        description: errorMessage,
        variant: "destructive",
      });
      setLoading(false);
    }
  };

  if (success && transactionId) {
    return (
      <div className="space-y-4">
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex gap-3">
          <CheckCircle className="h-6 w-6 text-green-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-green-800">
              Payment Request Sent Successfully!
            </p>
            <p className="text-sm text-green-700 mt-1">
              A payment link has been sent to {phone}. Please follow the link to
              complete your payment.
            </p>
            <p className="text-xs text-green-600 mt-2 font-mono">
              Ref: {transactionId}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 border rounded-lg p-6 bg-white dark:bg-slate-800">
      <div className="flex items-center gap-2 mb-4">
        <CreditCard className="h-5 w-5 text-blue-600" />
        <h3 className="font-semibold text-lg">Pay with IntouchPay</h3>
      </div>

      {/* Payment Summary */}
      <div className="bg-slate-50 dark:bg-slate-700 rounded-lg p-4 space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-slate-600 dark:text-slate-400">Tenant:</span>
          <span className="font-medium">{tenantName}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-600 dark:text-slate-400">Apartment:</span>
          <span className="font-medium">{apartmentId}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-600 dark:text-slate-400">Month:</span>
          <span className="font-medium">{month}</span>
        </div>
        <div className="border-t border-slate-200 dark:border-slate-600 pt-2 mt-2 flex justify-between">
          <span className="font-semibold text-slate-700 dark:text-slate-300">
            Amount Due:
          </span>
          <span className="font-bold text-blue-600 text-lg">
            RWF {amount.toLocaleString()}
          </span>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex gap-3">
          <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-red-800">{error}</p>
          </div>
        </div>
      )}

      {/* Phone Input */}
      <div className="space-y-2">
        <label className="text-sm font-medium flex items-center gap-2">
          <Phone className="h-4 w-4" />
          Phone Number (Rwandan)
        </label>
        <Input
          type="tel"
          placeholder="+250 798 123 456 or 0798 123 456"
          value={phone}
          inputMode="tel"
          onChange={(e) => setPhone(sanitizePhone(e.target.value))}
          disabled={loading}
          className="dark:bg-slate-700 dark:border-slate-600"
        />
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Format: +250XXX or 0XXX (Rwandan numbers only)
        </p>
      </div>

      {/* Buttons */}
      <div className="flex gap-3 pt-2">
        <Button
          onClick={handleIntouchPayment}
          disabled={loading || !phone.trim()}
          className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400"
        >
          {loading ? (
            <>
              <Loader className="h-4 w-4 mr-2 animate-spin" />
              Processing...
            </>
          ) : (
            <>
              <DollarSign className="h-4 w-4 mr-2" />
              Request Payment Link
            </>
          )}
        </Button>

        {onCancel && (
          <Button
            onClick={onCancel}
            variant="outline"
            disabled={loading}
            className="dark:border-slate-600"
          >
            Cancel
          </Button>
        )}
      </div>

      {/* Info */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
        <p className="text-xs text-blue-800 dark:text-blue-300">
          💡 <span className="font-semibold">How it works:</span> We'll send a
          payment link to your phone number. Click the link to complete your
          payment securely.
        </p>
      </div>
    </div>
  );
}
