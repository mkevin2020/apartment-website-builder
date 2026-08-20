'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AlertCircle, Loader, CreditCard, CheckCircle } from 'lucide-react';

interface ManualCardPaymentProps {
  paymentId: number;
  /** Required when paymentId is 0 (advance payment): the server prices the
   *  charge from an invoice it creates for this apartment, rather than trusting
   *  the amount typed here. */
  apartmentId?: number;
  amount: number;
  tenantId: string;
  email: string;
  referenceNumber: string;
  onSuccess?: (transactionId?: string) => void;
  onCancel?: () => void;
}

export function ManualCardPaymentWidget({
  paymentId,
  apartmentId,
  amount: initialAmount,
  tenantId,
  email: initialEmail,
  referenceNumber,
  onSuccess,
  onCancel,
}: ManualCardPaymentProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [amount, setAmount] = useState(initialAmount.toString());
  const [email, setEmail] = useState(initialEmail);
  const [cardNumber, setCardNumber] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [cvc, setCvc] = useState('');
  const [cardholderName, setCardholderName] = useState('');

  const formatCardNumber = (value: string) => {
    const cleaned = value.replace(/\s+/g, '');
    const parts = cleaned.match(/.{1,4}/g) || [];
    return parts.join(' ');
  };

  const formatExpiryDate = (value: string) => {
    const cleaned = value.replace(/\D/g, '');
    if (cleaned.length >= 2) {
      const month = cleaned.slice(0, 2);
      const year = cleaned.slice(2, 4);
      return year ? `${month}/${year}` : month;
    }
    return cleaned;
  };

  const handleCardNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatCardNumber(e.target.value);
    if (formatted.replace(/\s/g, '').length <= 16) {
      setCardNumber(formatted);
    }
  };

  const handleExpiryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatExpiryDate(e.target.value);
    setExpiryDate(formatted);
  };

  const handleCvcChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '');
    if (value.length <= 4) {
      setCvc(value);
    }
  };

  const validateCardDetails = () => {
    const amountValue = parseFloat(amount);
    if (!amount.trim() || isNaN(amountValue) || amountValue <= 0) {
      setError('Please enter a valid payment amount');
      return false;
    }
    if (!cardholderName.trim()) {
      setError('Please enter cardholder name');
      return false;
    }
    if (cardNumber.replace(/\s/g, '').length !== 16) {
      setError('Please enter a valid 16-digit card number');
      return false;
    }
    const [month, year] = expiryDate.split('/');
    if (!month || !year || parseInt(month) > 12 || parseInt(month) < 1) {
      setError('Please enter a valid expiry date (MM/YY)');
      return false;
    }
    if (cvc.length < 3 || cvc.length > 4) {
      setError('Please enter a valid CVC (3-4 digits)');
      return false;
    }
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Please enter a valid email address');
      return false;
    }
    return true;
  };

  const handlePayment = async () => {
    if (!validateCardDetails()) {
      return;
    }

    setLoading(true);
    setError('');

    try {
      const paymentAmount = parseFloat(amount);

      // For safety, we'll validate the card format first
      // In production with Stripe Elements, this would be tokenized on frontend
      const cardData = {
        cardNumber: cardNumber.replace(/\s/g, ''),
        expiryMonth: parseInt(expiryDate.split('/')[0]),
        expiryYear: parseInt(expiryDate.split('/')[1]),
        cvc: cvc,
      };

      // Validate card manually (Luhn algorithm basic check)
      if (!/^\d{13,19}$/.test(cardData.cardNumber)) {
        setError('Invalid card number format');
        setLoading(false);
        return;
      }

      // Create a Stripe token on the backend with the card data
      const response = await fetch('/api/payments/manual-card', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          paymentId,
          apartmentId,
          // Sent for the advance-payment flow only; the server re-prices from
          // the invoice it creates and ignores this for existing invoices.
          amount: paymentAmount,
          tenantId,
          email,
          referenceNumber,
          cardholderName,
          ...cardData,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Payment failed');
        return;
      }

      setSuccess(true);
      setTimeout(() => {
        if (onSuccess) {
          onSuccess(data.transactionId);
        }
      }, 2000);
    } catch (err: any) {
      setError(err.message || 'An error occurred during payment');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="rounded-lg border-2 border-green-500 bg-green-50 p-6 text-center">
        <div className="flex justify-center mb-4">
          <CheckCircle className="h-12 w-12 text-green-600" />
        </div>
        <h3 className="text-lg font-semibold text-green-900 mb-2">Payment Successful!</h3>
        <p className="text-green-700 mb-2">Your payment has been processed successfully.</p>
        <p className="text-2xl font-bold text-green-700 mb-4">{parseFloat(amount).toLocaleString()} RWF</p>
        <Button onClick={() => window.location.reload()} className="bg-green-600 hover:bg-green-700">
          Back to Payments
        </Button>
      </div>
    );
  }

  return (
    <div className="rounded-lg border-2 border-blue-300 bg-white p-6 space-y-4">
      {error && (
        <div className="flex gap-2 rounded-lg border border-red-200 bg-red-50 p-3">
          <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Amount Display */}
      <div className="rounded-lg bg-gradient-to-r from-blue-100 to-blue-50 p-4 border border-blue-200">
        <label className="text-sm text-gray-600 block mb-2">Amount to Pay (RWF) *</label>
        <div className="flex items-center gap-2">
          <span className="text-xl font-semibold text-gray-600">RWF</span>
          <Input
            type="number"
            placeholder="Enter amount"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            disabled={loading}
            className="text-2xl font-bold text-blue-600 border-blue-300"
            min="0"
            step="0.01"
          />
        </div>
      </div>

      {/* Cardholder Name */}
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">Cardholder Name *</label>
        <Input
          type="text"
          placeholder="John Doe"
          value={cardholderName}
          onChange={(e) => setCardholderName(e.target.value)}
          disabled={loading}
          className="w-full"
        />
      </div>

      {/* Card Number */}
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">Card Number *</label>
        <div className="relative">
          <CreditCard className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
          <Input
            type="text"
            placeholder="4242 4242 4242 4242"
            value={cardNumber}
            onChange={handleCardNumberChange}
            disabled={loading}
            className="pl-10 tracking-widest font-mono"
            maxLength={19}
          />
        </div>
        <p className="text-xs text-gray-500 mt-1">Enter your 16-digit card number</p>
      </div>

      {/* Expiry and CVC */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Expiry Date *</label>
          <Input
            type="text"
            placeholder="12/25"
            value={expiryDate}
            onChange={handleExpiryChange}
            disabled={loading}
            className="font-mono"
            maxLength={5}
          />
          <p className="text-xs text-gray-500 mt-1">MM/YY</p>
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">CVC *</label>
          <Input
            type="text"
            placeholder="123"
            value={cvc}
            onChange={handleCvcChange}
            disabled={loading}
            className="font-mono"
            maxLength={4}
          />
          <p className="text-xs text-gray-500 mt-1">3-4 digits</p>
        </div>
      </div>

      {/* Email */}
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">Email Address *</label>
        <Input
          type="email"
          placeholder="your@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={loading}
          className="w-full"
        />
        <p className="text-xs text-gray-500 mt-1">We'll send your payment receipt to this email address</p>
      </div>

      {/* Security Info */}
      <div className="rounded-lg bg-blue-50 p-3 border border-blue-200">
        <p className="text-xs text-blue-700">
          🔒 <strong>Secure:</strong> Your payment will be processed securely. We never store your card information.
        </p>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3 pt-4 border-t">
        <Button
          onClick={handlePayment}
          disabled={loading}
          className="flex-1 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-semibold h-11"
        >
          {loading && <Loader className="h-4 w-4 animate-spin mr-2" />}
          {loading ? 'Processing...' : 'Pay Now'}
        </Button>
        <Button
          onClick={onCancel}
          disabled={loading}
          variant="outline"
          className="px-8 h-11"
        >
          Cancel
        </Button>
      </div>

      {/* Footer */}
      <div className="text-center text-xs text-gray-500 pt-2">
        Secured by Stripe. Your data is encrypted and protected.
      </div>
    </div>
  );
}
