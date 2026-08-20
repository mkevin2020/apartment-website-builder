'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AlertCircle, Loader, CheckCircle, Lock, ShieldCheck } from 'lucide-react';

interface StripePaymentProps {
  paymentId: number;
  amount: number;
  tenantId: string;
  email: string;
  referenceNumber: string;
  apartmentName?: string;
  onSuccess?: (transactionId?: string) => void;
  onCancel?: () => void;
}

export function StripePaymentWidget({
  paymentId,
  amount,
  tenantId,
  email: initialEmail,
  referenceNumber,
  apartmentName,
  onSuccess,
  onCancel,
}: StripePaymentProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [email, setEmail] = useState(initialEmail);
  const [success, setSuccess] = useState(false);

  const handleStripePayment = async () => {
    if (!email.trim()) {
      setError('Please enter your email address');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Please enter a valid email address');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/payments/stripe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentId, amount, tenantId, email }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to initiate payment');
      }

      const data = await response.json();
      setSuccess(true);
      if (onSuccess) onSuccess(data.sessionId);

      if (data.url) {
        setTimeout(() => {
          window.location.href = data.url;
        }, 1200);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Payment failed');
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-10 flex flex-col items-center gap-4 text-center shadow-sm">
        <div className="w-14 h-14 rounded-full bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 flex items-center justify-center">
          <CheckCircle className="h-7 w-7 text-green-600 dark:text-green-400" />
        </div>
        <div>
          <p className="font-semibold text-slate-900 dark:text-white text-lg">Redirecting to secure checkout</p>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Please wait while we take you to Stripe to complete your payment.
          </p>
        </div>
        <Loader className="h-5 w-5 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-slate-900 dark:text-white">Payment details</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Review your invoice and continue to checkout</p>
        </div>
        <div className="hidden sm:flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-full px-3 py-1.5">
          <Lock className="h-3 w-3" />
          <span>Encrypted</span>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Invoice summary */}
        <dl className="space-y-3">
          {apartmentName && (
            <div className="flex items-center justify-between text-sm">
              <dt className="text-slate-500 dark:text-slate-400">Apartment</dt>
              <dd className="font-medium text-slate-900 dark:text-white text-right">{apartmentName}</dd>
            </div>
          )}
          <div className="flex items-center justify-between text-sm">
            <dt className="text-slate-500 dark:text-slate-400">Reference</dt>
            <dd className="font-mono text-slate-700 dark:text-slate-300">{referenceNumber}</dd>
          </div>
          <div className="flex items-center justify-between text-sm">
            <dt className="text-slate-500 dark:text-slate-400">Payment method</dt>
            <dd className="font-medium text-slate-900 dark:text-white">Card via Stripe</dd>
          </div>
          <div className="border-t border-slate-100 dark:border-slate-800 pt-3 flex items-center justify-between">
            <dt className="text-sm font-semibold text-slate-900 dark:text-white">Total due</dt>
            <dd className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
              RWF {amount.toLocaleString()}
            </dd>
          </div>
        </dl>

        {/* Email field */}
        <div className="space-y-1.5">
          <label htmlFor="receipt-email" className="text-sm font-medium text-slate-700 dark:text-slate-300">
            Receipt email
          </label>
          <Input
            id="receipt-email"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => { setEmail(e.target.value); setError(''); }}
            disabled={loading}
            className="h-11 border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:text-white rounded-lg focus-visible:ring-blue-500"
          />
          <p className="text-xs text-slate-500 dark:text-slate-400">Your receipt will be sent to this address.</p>
        </div>

        {/* Error */}
        {error && (
          <div className="rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-900/20 p-3 flex gap-2.5 items-start">
            <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
          </div>
        )}

        {/* Actions */}
        <div className="space-y-2">
          <Button
            onClick={handleStripePayment}
            disabled={loading || !email.trim()}
            className="w-full h-11 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm disabled:opacity-50 transition-colors"
          >
            {loading ? (
              <>
                <Loader className="h-4 w-4 mr-2 animate-spin" />
                Preparing checkout…
              </>
            ) : (
              <>
                <Lock className="h-4 w-4 mr-2" />
                Pay RWF {amount.toLocaleString()}
              </>
            )}
          </Button>
          {onCancel && (
            <Button
              onClick={onCancel}
              disabled={loading}
              variant="ghost"
              className="w-full h-10 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 text-sm font-medium"
            >
              Cancel
            </Button>
          )}
        </div>
      </div>

      {/* Trust footer */}
      <div className="px-6 py-4 bg-slate-50 dark:bg-slate-900/60 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
          <ShieldCheck className="h-3.5 w-3.5" />
          <span>Secured by Stripe · Card details are never stored</span>
        </div>
        <div className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-400 dark:text-slate-500 tracking-wide">
          <span className="border border-slate-200 dark:border-slate-700 rounded px-1.5 py-0.5">VISA</span>
          <span className="border border-slate-200 dark:border-slate-700 rounded px-1.5 py-0.5">MASTERCARD</span>
          <span className="border border-slate-200 dark:border-slate-700 rounded px-1.5 py-0.5">AMEX</span>
        </div>
      </div>
    </div>
  );
}
