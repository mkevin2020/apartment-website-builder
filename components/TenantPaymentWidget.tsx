'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  AlertCircle, 
  CheckCircle, 
  Loader, 
  CreditCard,
  DollarSign,
  Phone,
  Clock
} from 'lucide-react';

interface Payment {
  id: number;
  apartment_id: number;
  amount: number;
  status: string;
  due_date: string;
  reference_number: string;
}

interface TenantPaymentWidgetProps {
  pendingPayments: Payment[];
  tenantId: string;
  onPaymentSuccess?: () => void;
}

export function TenantPaymentWidget({
  pendingPayments,
  tenantId,
  onPaymentSuccess,
}: TenantPaymentWidgetProps) {
  const [selectedPaymentId, setSelectedPaymentId] = useState<number | null>(null);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [transactionId, setTransactionId] = useState('');
  const [paymentStatus, setPaymentStatus] = useState<string>('');
  const [checkingStatus, setCheckingStatus] = useState(false);

  if (pendingPayments.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-600" />
            Payments
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="text-center">
              <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-3" />
              <p className="text-gray-600 font-medium">All payments are up to date!</p>
              <p className="text-sm text-gray-500 mt-1">You have no pending payments</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const selectedPayment = pendingPayments.find(p => p.id === selectedPaymentId);
  const totalDue = pendingPayments.reduce((sum, p) => sum + p.amount, 0);

  const handlePaymentClick = (paymentId: number) => {
    setSelectedPaymentId(paymentId);
    setError('');
    setSuccess(false);
    setTransactionId('');
  };

  const handleInitiatePayment = async () => {
    if (!phoneNumber.trim()) {
      setError('Please enter your phone number');
      return;
    }

    if (!selectedPaymentId) {
      setError('Please select a payment');
      return;
    }

    if (!selectedPayment) {
      setError('Payment not found');
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
          paymentId: selectedPaymentId,
          phoneNumber,
          amount: selectedPayment.amount,
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
      
      // Auto-check status every 3 seconds
      checkPaymentStatusInterval(data.transactionId, selectedPaymentId);

      if (onPaymentSuccess) {
        onPaymentSuccess();
      }
    } catch (err: any) {
      const errorMsg = err.message || 'Failed to initiate payment';
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const checkPaymentStatusInterval = (txnId: string, paymentId: number) => {
    let attempts = 0;
    const maxAttempts = 40; // Check for 2 minutes (40 * 3 seconds)

    const interval = setInterval(async () => {
      attempts++;
      if (attempts > maxAttempts) {
        clearInterval(interval);
        setPaymentStatus('timeout');
        return;
      }

      try {
        const response = await fetch(
          `/api/payments/mtn-momo?transactionId=${txnId}&paymentId=${paymentId}`
        );

        if (!response.ok) {
          throw new Error('Failed to check status');
        }

        const data = await response.json();
        setPaymentStatus(data.status);

        if (data.status === 'SUCCESSFUL' || data.status === 'paid') {
          clearInterval(interval);
          setSuccess(true);
          setError('');
          // Remove the payment from the list
          setTimeout(() => {
            window.location.reload();
          }, 2000);
        } else if (data.status === 'FAILED' || data.status === 'failed') {
          clearInterval(interval);
          setError('Payment failed. Please try again.');
          setSuccess(false);
        }
      } catch (err) {
        console.error('Error checking payment status:', err);
      }
    }, 3000);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="h-5 w-5 text-blue-600" />
          Pending Payments
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Total Due Summary */}
        <div className="bg-gradient-to-r from-yellow-50 to-orange-50 p-4 rounded-lg border border-yellow-200">
          <p className="text-sm font-medium text-gray-600 mb-1">Total Amount Due</p>
          <p className="text-3xl font-bold text-orange-600">
            {totalDue.toLocaleString()} XOF
          </p>
          <p className="text-xs text-gray-500 mt-2">
            {pendingPayments.length} payment{pendingPayments.length !== 1 ? 's' : ''} pending
          </p>
        </div>

        {/* Payments List */}
        <div className="space-y-2">
          <p className="text-sm font-semibold text-gray-700 mb-3">Select Payment to Pay</p>
          {pendingPayments.map((payment) => (
            <button
              key={payment.id}
              onClick={() => handlePaymentClick(payment.id)}
              className={`w-full p-3 rounded-lg border-2 transition-all text-left ${
                selectedPaymentId === payment.id
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <p className="font-medium text-gray-900">
                    Payment #{payment.reference_number}
                  </p>
                  <p className="text-sm text-gray-500 mt-1">
                    Due: {new Date(payment.due_date).toLocaleDateString()}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-blue-600">
                    {payment.amount.toLocaleString()} XOF
                  </p>
                  <span className={`text-xs font-semibold px-2 py-1 rounded mt-1 inline-block ${
                    payment.status.toLowerCase() === 'overdue'
                      ? 'bg-red-100 text-red-700'
                      : 'bg-yellow-100 text-yellow-700'
                  }`}>
                    {payment.status}
                  </span>
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* Payment Form */}
        {selectedPayment && !success && (
          <div className="pt-4 border-t space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Phone className="inline h-4 w-4 mr-1" />
                Phone Number (MTN Network)
              </label>
              <Input
                type="tel"
                placeholder="250XXXXXXXXX or +250XXXXXXXXX"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                disabled={loading}
                className="w-full"
              />
              <p className="text-xs text-gray-500 mt-1">
                Enter your MTN phone number to receive payment prompt
              </p>
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex gap-2">
                <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            <Button
              onClick={handleInitiatePayment}
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 h-auto"
            >
              {loading ? (
                <>
                  <Loader className="h-4 w-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <DollarSign className="h-4 w-4 mr-2" />
                  Pay {selectedPayment.amount.toLocaleString()} XOF
                </>
              )}
            </Button>
            <p className="text-xs text-gray-500 text-center">
              Secure payment via MTN MoMo
            </p>
          </div>
        )}

        {/* Success State */}
        {success && (
          <div className="space-y-4">
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-start gap-3">
                <div className="flex-1">
                  <p className="font-semibold text-blue-900 mb-2">Payment Initiated</p>
                  <p className="text-sm text-blue-700 mb-3">
                    Check your phone for the MTN MoMo payment prompt. The payment will be confirmed automatically.
                  </p>
                  <div className="space-y-2 text-sm">
                    <p className="text-blue-600">
                      <strong>Transaction ID:</strong> {transactionId}
                    </p>
                    <p className="text-blue-600 flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      <strong>Status:</strong> {paymentStatus || 'Pending...'}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {paymentStatus !== 'SUCCESSFUL' && paymentStatus !== 'paid' && (
              <div className="flex items-center justify-center py-4">
                <Loader className="h-5 w-5 text-blue-600 animate-spin mr-2" />
                <p className="text-sm text-gray-600">Waiting for payment confirmation...</p>
              </div>
            )}

            {(paymentStatus === 'SUCCESSFUL' || paymentStatus === 'paid') && (
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg space-y-3">
                <div className="flex items-center gap-2 text-green-700 font-semibold">
                  <CheckCircle className="h-5 w-5" />
                  Payment Successful!
                </div>
                <p className="text-sm text-green-600">
                  Your payment has been received. You will receive a confirmation email shortly.
                </p>
              </div>
            )}

            <Button
              onClick={() => {
                setSelectedPaymentId(null);
                setPhoneNumber('');
                setSuccess(false);
                setError('');
                setTransactionId('');
                setPaymentStatus('');
              }}
              variant="outline"
              className="w-full"
            >
              {paymentStatus === 'SUCCESSFUL' || paymentStatus === 'paid'
                ? 'Make Another Payment'
                : 'Back'}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
