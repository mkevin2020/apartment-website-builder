'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, CheckCircle, Loader } from 'lucide-react';

interface MTNMoMoPaymentWidgetProps {
  paymentId: number;
  amount: number;
  tenantId: string;
  onSuccess?: (transactionId: string) => void;
  onError?: (error: string) => void;
}

export function MTNMoMoPaymentWidget({
  paymentId,
  amount,
  tenantId,
  onSuccess,
  onError,
}: MTNMoMoPaymentWidgetProps) {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [transactionId, setTransactionId] = useState('');
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<string>('');

  // Auto-check payment status every 3 seconds
  useEffect(() => {
    if (!transactionId) return;

    const interval = setInterval(() => {
      checkPaymentStatus();
    }, 3000);

    return () => clearInterval(interval);
  }, [transactionId]);

  const handleInitiatePayment = async () => {
    if (!phoneNumber.trim()) {
      setError('Please enter your phone number');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/payments/mtn-momo', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          paymentId,
          phoneNumber,
          amount,
          tenantId,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to initiate payment');
      }

      const data = await response.json();
      setTransactionId(data.transactionId);
      setSuccess(true);
      setPaymentStatus('pending');

      if (onSuccess) {
        onSuccess(data.transactionId);
      }
    } catch (err: any) {
      const errorMsg = err.message || 'Failed to initiate payment';
      setError(errorMsg);
      if (onError) {
        onError(errorMsg);
      }
    } finally {
      setLoading(false);
    }
  };

  const checkPaymentStatus = async () => {
    if (!transactionId) return;

    try {
      setCheckingStatus(true);
      const response = await fetch(
        `/api/payments/mtn-momo?transactionId=${transactionId}&paymentId=${paymentId}`
      );

      if (!response.ok) {
        throw new Error('Failed to check status');
      }

      const data = await response.json();
      setPaymentStatus(data.status);

      // Stop checking if payment is complete
      if (data.status === 'SUCCESSFUL') {
        setSuccess(true);
      }
    } catch (err) {
      console.error('Status check error:', err);
    } finally {
      setCheckingStatus(false);
    }
  };

  const handleManualCheckStatus = async () => {
    await checkPaymentStatus();
  };

  if (success && paymentStatus === 'SUCCESSFUL') {
    return (
      <Card className="w-full border-green-200 bg-green-50">
        <CardContent className="pt-6">
          <div className="flex items-center gap-3">
            <CheckCircle className="h-6 w-6 text-green-600" />
            <div>
              <p className="font-semibold text-green-900">Payment Successful!</p>
              <p className="text-sm text-green-700">
                Transaction ID: {transactionId}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span>Pay with MTN MoMo</span>
          <span className="text-sm font-normal text-gray-500">
            Amount: {amount.toLocaleString()} XOF
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <div className="flex gap-2 rounded-lg border border-red-200 bg-red-50 p-3">
            <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {success && paymentStatus !== 'SUCCESSFUL' && (
          <div className="space-y-3 rounded-lg border border-blue-200 bg-blue-50 p-3">
            <p className="text-sm font-medium text-blue-900">
              💬 Please check your phone and confirm the payment when prompted
            </p>
            <p className="text-xs text-blue-700">
              Status: <span className="font-semibold">{paymentStatus || 'Pending'}</span>
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={handleManualCheckStatus}
              disabled={checkingStatus}
              className="w-full"
            >
              {checkingStatus && <Loader className="h-4 w-4 animate-spin mr-2" />}
              Check Status Now
            </Button>
          </div>
        )}

        {!success ? (
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">Phone Number</label>
              <Input
                type="tel"
                placeholder="e.g., +256789123456 or 0789123456"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                disabled={loading}
                className="mt-1"
              />
              <p className="text-xs text-gray-500 mt-1">
                Enter your MTN MoMo phone number
              </p>
            </div>

            <Button
              onClick={handleInitiatePayment}
              disabled={loading || !phoneNumber.trim()}
              className="w-full"
              size="lg"
            >
              {loading && <Loader className="h-4 w-4 animate-spin mr-2" />}
              {loading ? 'Processing...' : 'Request Payment'}
            </Button>
          </div>
        ) : null}

        {transactionId && (
          <div className="text-xs text-gray-500 border-t pt-3">
            <p>Transaction ID: {transactionId}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
