'use client';

import { useState } from 'react';
import { 
  Lock, 
  CheckCircle2, 
  AlertCircle, 
  Loader, 
  CreditCard as CreditCardIcon,
  Eye,
  EyeOff,
  Info,
  Smartphone,
  ChevronDown,
  Check,
  ArrowRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

interface ModernPaymentFormProps {
  apartmentName: string;
  bookingDates: {
    checkIn: string;
    checkOut: string;
  };
  totalAmount: number;
  breakdown?: {
    rent: number;
    serviceFee: number;
    taxes: number;
  };
  referenceNumber: string;
  tenantEmail: string;
  tenantName: string;
  tenantPhone: string;
  onSubmit: (paymentData: PaymentFormData) => Promise<void>;
  onCancel?: () => void;
  isLoading?: boolean;
}

export interface PaymentFormData {
  cardNumber: string;
  expiryDate: string;
  cvv: string;
  cardholderName: string;
  email: string;
  phone: string;
  billingAddress?: string;
  city?: string;
  zipCode?: string;
  country?: string;
  paymentMethod: 'card' | 'mobileMoney';
  mobileMoneyProvider?: 'mtn' | 'airtel';
  mobileMoneyNumber?: string;
}

type CardType = 'visa' | 'mastercard' | 'amex' | 'unknown';

export function ModernPaymentForm({
  apartmentName,
  bookingDates,
  totalAmount,
  breakdown,
  referenceNumber,
  tenantEmail,
  tenantName,
  tenantPhone,
  onSubmit,
  onCancel,
  isLoading = false,
}: ModernPaymentFormProps) {
  // Form state
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'mobileMoney'>('card');
  const [cardNumber, setCardNumber] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [cvv, setCvv] = useState('');
  const [cvvFocused, setCvvFocused] = useState(false);
  const [cardholderName, setCardholderName] = useState(tenantName || '');
  const [email, setEmail] = useState(tenantEmail || '');
  const [phone, setPhone] = useState(tenantPhone || '');
  
  // Mobile money state
  const [mobileMoneyProvider, setMobileMoneyProvider] = useState<'mtn' | 'airtel'>('mtn');
  const [mobileMoneyNumber, setMobileMoneyNumber] = useState('');

  // Billing address state (collapsible)
  const [showBillingAddress, setShowBillingAddress] = useState(false);
  const [billingAddress, setBillingAddress] = useState('');
  const [city, setCity] = useState('');
  const [zipCode, setZipCode] = useState('');
  const [country, setCountry] = useState('Rwanda');

  // UI state
  const [showCvv, setShowCvv] = useState(false);
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [success, setSuccess] = useState(false);

  // Validation
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  // Card type detection
  const getCardType = (card: string): CardType => {
    const num = card.replace(/\s/g, '');
    if (/^4/.test(num)) return 'visa';
    if (/^5[1-5]/.test(num)) return 'mastercard';
    if (/^3[47]/.test(num)) return 'amex';
    return 'unknown';
  };

  const cardType = getCardType(cardNumber);

  // Formatting functions
  const formatCardNumber = (value: string): string => {
    const cleaned = value.replace(/\s+/g, '');
    if (cleaned.length > 16) return cardNumber;
    const parts = cleaned.match(/.{1,4}/g) || [];
    return parts.join(' ');
  };

  const formatExpiryDate = (value: string): string => {
    const cleaned = value.replace(/\D/g, '');
    if (cleaned.length === 0) return '';
    if (cleaned.length <= 2) return cleaned;
    const month = cleaned.slice(0, 2);
    const year = cleaned.slice(2, 4);
    return `${month}/${year}`;
  };

  const formatCvv = (value: string): string => {
    return value.replace(/\D/g, '').slice(0, 4);
  };

  const formatPhoneNumber = (value: string): string => {
    const cleaned = value.replace(/\D/g, '');
    return cleaned;
  };

  // Validation functions
  const validateCardNumber = (card: string): boolean => {
    const num = card.replace(/\s/g, '');
    return num.length === 16 && /^\d+$/.test(num);
  };

  const validateExpiryDate = (expiry: string): boolean => {
    const [month, year] = expiry.split('/');
    if (!month || !year) return false;
    
    const monthNum = parseInt(month);
    const yearNum = parseInt(year);
    
    if (monthNum < 1 || monthNum > 12) return false;
    
    const currentYear = new Date().getFullYear() % 100;
    const currentMonth = new Date().getMonth() + 1;
    
    if (yearNum < currentYear) return false;
    if (yearNum === currentYear && monthNum < currentMonth) return false;
    
    return true;
  };

  const validateCvv = (cvvValue: string): boolean => {
    return /^\d{3,4}$/.test(cvvValue);
  };

  const validateEmail = (emailValue: string): boolean => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailValue);
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (paymentMethod === 'card') {
      if (!validateCardNumber(cardNumber)) {
        newErrors.cardNumber = 'Enter a valid 16-digit card number';
      }
      if (!validateExpiryDate(expiryDate)) {
        newErrors.expiryDate = 'Enter a valid expiry date (MM/YY)';
      }
      if (!validateCvv(cvv)) {
        newErrors.cvv = 'Enter a valid CVV (3-4 digits)';
      }
    } else {
      if (!mobileMoneyNumber.replace(/\D/g, '')) {
        newErrors.mobileMoneyNumber = `Enter a valid ${mobileMoneyProvider.toUpperCase()} number`;
      }
    }

    if (!cardholderName.trim()) {
      newErrors.cardholderName = 'Name is required';
    }
    if (!validateEmail(email)) {
      newErrors.email = 'Enter a valid email address';
    }
    if (!phone.replace(/\D/g, '') || phone.replace(/\D/g, '').length < 10) {
      newErrors.phone = 'Enter a valid phone number';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    try {
      await onSubmit({
        cardNumber: cardNumber.replace(/\s/g, ''),
        expiryDate,
        cvv,
        cardholderName,
        email,
        phone: phone.replace(/\D/g, ''),
        billingAddress,
        city,
        zipCode,
        country,
        paymentMethod,
        mobileMoneyProvider,
        mobileMoneyNumber: mobileMoneyNumber.replace(/\D/g, ''),
      });
      setSuccess(true);
    } catch (error) {
      console.error('Payment error:', error);
    }
  };

  const handleFieldBlur = (field: string) => {
    setTouched({ ...touched, [field]: true });
  };

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 flex items-center justify-center p-4">
        <Card className="w-full max-w-md border-none shadow-2xl">
          <CardContent className="pt-12 pb-12 text-center space-y-4">
            <div className="w-16 h-16 mx-auto bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
              <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-400" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Payment Successful!</h2>
            <p className="text-slate-600 dark:text-slate-400">
              Your payment has been processed. A confirmation has been sent to {email}
            </p>
            <Button 
              onClick={() => window.location.href = '/tenant/payments'}
              className="w-full bg-green-600 hover:bg-green-700 text-white mt-6"
            >
              Return to Payments
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto">
        
        {/* Header Section */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className="w-10 h-10 bg-blue-600 dark:bg-blue-500 rounded-full flex items-center justify-center">
              <Lock className="h-5 w-5 text-white" />
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 dark:text-white">
              Secure Payment
            </h1>
          </div>
          <p className="text-slate-600 dark:text-slate-400 text-sm">
            🔒 Your payment is encrypted and secure
          </p>
        </div>

        {/* Payment Summary Card */}
        <Card className="mb-8 border-none shadow-lg bg-white dark:bg-slate-900">
          <CardHeader className="space-y-4 pb-4 border-b border-slate-200 dark:border-slate-800">
            <div>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
                {apartmentName}
              </h2>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Booking Reference: <span className="font-mono font-semibold">{referenceNumber}</span>
              </p>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Check-in</p>
                <p className="text-sm font-semibold text-slate-900 dark:text-white">
                  {new Date(bookingDates.checkIn).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Check-out</p>
                <p className="text-sm font-semibold text-slate-900 dark:text-white">
                  {new Date(bookingDates.checkOut).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </p>
              </div>
            </div>
          </CardHeader>

          <CardContent className="pt-6">
            {/* Amount Display */}
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 rounded-xl p-6 mb-6">
              <p className="text-sm font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide mb-2">
                Total Amount Due
              </p>
              <div className="flex items-baseline gap-2">
                <span className="text-xl font-semibold text-slate-600 dark:text-slate-400">RWF</span>
                <span className="text-4xl font-bold text-slate-900 dark:text-white">
                  {totalAmount.toLocaleString()}
                </span>
              </div>
            </div>

            {/* Breakdown Toggle */}
            {breakdown && (
              <button
                onClick={() => setShowBreakdown(!showBreakdown)}
                className="w-full flex items-center justify-between py-3 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors"
              >
                <span className="text-sm font-semibold uppercase tracking-wide">Breakdown</span>
                <ChevronDown 
                  className={`h-4 w-4 transition-transform ${showBreakdown ? 'rotate-180' : ''}`}
                />
              </button>
            )}

            {breakdown && showBreakdown && (
              <div className="space-y-3 py-4 border-t border-slate-200 dark:border-slate-700">
                <div className="flex justify-between">
                  <span className="text-slate-600 dark:text-slate-400">Rent</span>
                  <span className="font-semibold text-slate-900 dark:text-white">
                    RWF {breakdown.rent.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600 dark:text-slate-400">Service Fee</span>
                  <span className="font-semibold text-slate-900 dark:text-white">
                    RWF {breakdown.serviceFee.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600 dark:text-slate-400">Taxes</span>
                  <span className="font-semibold text-slate-900 dark:text-white">
                    RWF {breakdown.taxes.toLocaleString()}
                  </span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Payment Method Selection */}
        <div className="mb-8">
          <label className="block text-sm font-semibold text-slate-900 dark:text-white mb-4 uppercase tracking-wide">
            Payment Method
          </label>
          <div className="grid grid-cols-2 gap-4">
            {/* Card Payment Option */}
            <button
              onClick={() => setPaymentMethod('card')}
              className={`relative p-4 rounded-xl border-2 transition-all ${
                paymentMethod === 'card'
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                  : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-blue-300'
              }`}
            >
              <div className="flex items-center gap-3">
                <CreditCardIcon className={`h-5 w-5 ${paymentMethod === 'card' ? 'text-blue-600' : 'text-slate-400'}`} />
                <div className="text-left">
                  <p className="font-semibold text-slate-900 dark:text-white text-sm">Card</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Visa, Mastercard</p>
                </div>
              </div>
              {paymentMethod === 'card' && (
                <Check className="absolute top-3 right-3 h-5 w-5 text-blue-600" />
              )}
            </button>

            {/* Mobile Money Option */}
            <button
              onClick={() => setPaymentMethod('mobileMoney')}
              className={`relative p-4 rounded-xl border-2 transition-all ${
                paymentMethod === 'mobileMoney'
                  ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                  : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-purple-300'
              }`}
            >
              <div className="flex items-center gap-3">
                <Smartphone className={`h-5 w-5 ${paymentMethod === 'mobileMoney' ? 'text-purple-600' : 'text-slate-400'}`} />
                <div className="text-left">
                  <p className="font-semibold text-slate-900 dark:text-white text-sm">Mobile Money</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">MTN, Airtel</p>
                </div>
              </div>
              {paymentMethod === 'mobileMoney' && (
                <Check className="absolute top-3 right-3 h-5 w-5 text-purple-600" />
              )}
            </button>
          </div>
        </div>

        {/* Main Form Card */}
        <Card className="border-none shadow-xl bg-white dark:bg-slate-900 overflow-hidden">
          <form onSubmit={handleSubmit} className="space-y-6 p-6 sm:p-8">
            
            {/* Card Payment Form */}
            {paymentMethod === 'card' && (
              <div className="space-y-6">
                {/* Card Image Placeholder */}
                <div className="relative h-32 bg-gradient-to-br from-slate-200 to-slate-300 dark:from-slate-800 dark:to-slate-700 rounded-xl overflow-hidden flex items-end justify-between p-4 sm:p-6">
                  {/* Card chip */}
                  <div className="w-12 h-8 bg-yellow-500 rounded opacity-70"></div>
                  
                  {/* Card number display */}
                  <div className="text-right">
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Card Number</p>
                    <p className="font-mono text-sm sm:text-base font-semibold text-slate-700 dark:text-slate-300">
                      {cardNumber || '•••• •••• •••• ••••'}
                    </p>
                  </div>

                  {/* Card type icon */}
                  {cardType !== 'unknown' && (
                    <div className="absolute top-3 right-3 text-xs font-bold uppercase text-slate-600 dark:text-slate-400">
                      {cardType}
                    </div>
                  )}
                </div>

                {/* Card Number */}
                <div>
                  <label className="block text-sm font-semibold text-slate-900 dark:text-white mb-2">
                    Card Number
                  </label>
                  <div className="relative">
                    <Input
                      type="text"
                      placeholder="1234 5678 9012 3456"
                      value={cardNumber}
                      onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
                      onBlur={() => handleFieldBlur('cardNumber')}
                      className={`text-lg tracking-wider font-mono ${
                        touched.cardNumber && errors.cardNumber
                          ? 'border-red-500 focus:ring-red-500'
                          : 'border-slate-300 dark:border-slate-600'
                      } bg-slate-50 dark:bg-slate-800 dark:text-white`}
                      maxLength={19}
                    />
                  </div>
                  {touched.cardNumber && errors.cardNumber && (
                    <p className="text-red-600 dark:text-red-400 text-xs mt-1 flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" /> {errors.cardNumber}
                    </p>
                  )}
                </div>

                {/* Expiry & CVV */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-slate-900 dark:text-white mb-2">
                      Expiry Date
                    </label>
                    <Input
                      type="text"
                      placeholder="MM/YY"
                      value={expiryDate}
                      onChange={(e) => setExpiryDate(formatExpiryDate(e.target.value))}
                      onBlur={() => handleFieldBlur('expiryDate')}
                      className={`font-mono text-lg ${
                        touched.expiryDate && errors.expiryDate
                          ? 'border-red-500 focus:ring-red-500'
                          : 'border-slate-300 dark:border-slate-600'
                      } bg-slate-50 dark:bg-slate-800 dark:text-white`}
                      maxLength={5}
                    />
                    {touched.expiryDate && errors.expiryDate && (
                      <p className="text-red-600 dark:text-red-400 text-xs mt-1 flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" /> {errors.expiryDate}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-900 dark:text-white mb-2 flex items-center gap-2">
                      CVV
                      <div className="group relative">
                        <Info className="h-4 w-4 text-slate-400 cursor-help" />
                        <div className="hidden group-hover:block absolute right-0 top-6 w-48 bg-slate-900 dark:bg-slate-800 text-white text-xs rounded p-2 z-10">
                          3 or 4-digit security code on the back of your card
                        </div>
                      </div>
                    </label>
                    <div className="relative">
                      <Input
                        type={showCvv ? 'text' : 'password'}
                        placeholder="•••"
                        value={cvv}
                        onChange={(e) => setCvv(formatCvv(e.target.value))}
                        onFocus={() => setCvvFocused(true)}
                        onBlur={() => {
                          setCvvFocused(false);
                          handleFieldBlur('cvv');
                        }}
                        className={`font-mono text-lg pr-10 ${
                          touched.cvv && errors.cvv
                            ? 'border-red-500 focus:ring-red-500'
                            : 'border-slate-300 dark:border-slate-600'
                        } bg-slate-50 dark:bg-slate-800 dark:text-white`}
                        maxLength={4}
                      />
                      <button
                        type="button"
                        onClick={() => setShowCvv(!showCvv)}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                      >
                        {showCvv ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    {touched.cvv && errors.cvv && (
                      <p className="text-red-600 dark:text-red-400 text-xs mt-1 flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" /> {errors.cvv}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Mobile Money Form */}
            {paymentMethod === 'mobileMoney' && (
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-semibold text-slate-900 dark:text-white mb-2">
                    Mobile Money Provider
                  </label>
                  <div className="grid grid-cols-2 gap-4">
                    {['mtn', 'airtel'].map((provider) => (
                      <button
                        key={provider}
                        type="button"
                        onClick={() => setMobileMoneyProvider(provider as 'mtn' | 'airtel')}
                        className={`p-3 rounded-lg border-2 font-semibold transition-all ${
                          mobileMoneyProvider === provider
                            ? provider === 'mtn'
                              ? 'border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700'
                              : 'border-red-500 bg-red-50 dark:bg-red-900/20 text-red-700'
                            : 'border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        {provider === 'mtn' ? 'MTN MoMo' : 'Airtel Money'}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-900 dark:text-white mb-2">
                    Phone Number
                  </label>
                  <Input
                    type="tel"
                    placeholder="250xxxxxxxxx"
                    value={mobileMoneyNumber}
                    onChange={(e) => setMobileMoneyNumber(formatPhoneNumber(e.target.value))}
                    onBlur={() => handleFieldBlur('mobileMoneyNumber')}
                    className={`text-lg ${
                      touched.mobileMoneyNumber && errors.mobileMoneyNumber
                        ? 'border-red-500 focus:ring-red-500'
                        : 'border-slate-300 dark:border-slate-600'
                    } bg-slate-50 dark:bg-slate-800 dark:text-white`}
                  />
                  {touched.mobileMoneyNumber && errors.mobileMoneyNumber && (
                    <p className="text-red-600 dark:text-red-400 text-xs mt-1 flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" /> {errors.mobileMoneyNumber}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Billing Information Section */}
            <div className="border-t border-slate-200 dark:border-slate-700 pt-6">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-4 uppercase tracking-wide">
                Billing Information
              </h3>

              <div className="space-y-4">
                {/* Cardholder Name */}
                <div>
                  <label className="block text-sm font-semibold text-slate-900 dark:text-white mb-2">
                    Full Name
                  </label>
                  <Input
                    type="text"
                    placeholder="John Doe"
                    value={cardholderName}
                    onChange={(e) => setCardholderName(e.target.value)}
                    onBlur={() => handleFieldBlur('cardholderName')}
                    className={`${
                      touched.cardholderName && errors.cardholderName
                        ? 'border-red-500 focus:ring-red-500'
                        : 'border-slate-300 dark:border-slate-600'
                    } bg-slate-50 dark:bg-slate-800 dark:text-white`}
                  />
                  {touched.cardholderName && errors.cardholderName && (
                    <p className="text-red-600 dark:text-red-400 text-xs mt-1 flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" /> {errors.cardholderName}
                    </p>
                  )}
                </div>

                {/* Email */}
                <div>
                  <label className="block text-sm font-semibold text-slate-900 dark:text-white mb-2">
                    Email Address
                  </label>
                  <Input
                    type="email"
                    placeholder="john@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onBlur={() => handleFieldBlur('email')}
                    className={`${
                      touched.email && errors.email
                        ? 'border-red-500 focus:ring-red-500'
                        : 'border-slate-300 dark:border-slate-600'
                    } bg-slate-50 dark:bg-slate-800 dark:text-white`}
                  />
                  {touched.email && errors.email && (
                    <p className="text-red-600 dark:text-red-400 text-xs mt-1 flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" /> {errors.email}
                    </p>
                  )}
                </div>

                {/* Phone */}
                <div>
                  <label className="block text-sm font-semibold text-slate-900 dark:text-white mb-2">
                    Phone Number
                  </label>
                  <Input
                    type="tel"
                    placeholder="+250 xxx xxx xxx"
                    value={phone}
                    onChange={(e) => setPhone(formatPhoneNumber(e.target.value))}
                    onBlur={() => handleFieldBlur('phone')}
                    className={`${
                      touched.phone && errors.phone
                        ? 'border-red-500 focus:ring-red-500'
                        : 'border-slate-300 dark:border-slate-600'
                    } bg-slate-50 dark:bg-slate-800 dark:text-white`}
                  />
                  {touched.phone && errors.phone && (
                    <p className="text-red-600 dark:text-red-400 text-xs mt-1 flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" /> {errors.phone}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Billing Address Collapsible */}
            <div className="border-t border-slate-200 dark:border-slate-700 pt-6">
              <button
                type="button"
                onClick={() => setShowBillingAddress(!showBillingAddress)}
                className="w-full flex items-center justify-between py-2 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors"
              >
                <span className="text-sm font-semibold uppercase tracking-wide">Billing Address (Optional)</span>
                <ChevronDown 
                  className={`h-4 w-4 transition-transform ${showBillingAddress ? 'rotate-180' : ''}`}
                />
              </button>

              {showBillingAddress && (
                <div className="mt-4 space-y-4 pt-4">
                  <Input
                    type="text"
                    placeholder="Street Address"
                    value={billingAddress}
                    onChange={(e) => setBillingAddress(e.target.value)}
                    className="bg-slate-50 dark:bg-slate-800 dark:text-white border-slate-300 dark:border-slate-600"
                  />
                  {/* City & Country */}
                  <div className="grid grid-cols-2 gap-4">
                    <Input
                      type="text"
                      placeholder="City"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      className="bg-slate-50 dark:bg-slate-800 dark:text-white border-slate-300 dark:border-slate-600"
                    />
                    <Input
                      type="text"
                      placeholder="Zip Code"
                      value={zipCode}
                      onChange={(e) => setZipCode(e.target.value)}
                      className="bg-slate-50 dark:bg-slate-800 dark:text-white border-slate-300 dark:border-slate-600"
                    />
                  </div>
                  <Input
                    type="text"
                    placeholder="Country"
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    className="bg-slate-50 dark:bg-slate-800 dark:text-white border-slate-300 dark:border-slate-600"
                  />
                </div>
              )}
            </div>

            {/* Security & Trust Indicators */}
            <div className="border-t border-slate-200 dark:border-slate-700 pt-6 space-y-4">
              <div className="flex items-center gap-3 bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                <Lock className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                <div className="text-sm">
                  <p className="font-semibold text-blue-900 dark:text-blue-300">Secured by Stripe</p>
                  <p className="text-xs text-blue-700 dark:text-blue-400">We do not store your card details</p>
                </div>
              </div>

              <div className="flex items-center justify-between py-3 px-4 bg-slate-100 dark:bg-slate-800 rounded-lg">
                <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wide">
                  Accepted Methods
                </span>
                <div className="flex gap-2">
                  <div className="w-8 h-5 bg-blue-600 rounded text-xs text-white flex items-center justify-center font-bold">V</div>
                  <div className="w-8 h-5 bg-orange-600 rounded text-xs text-white flex items-center justify-center font-bold">M</div>
                  <div className="w-8 h-5 bg-slate-700 rounded text-xs text-white flex items-center justify-center font-bold">A</div>
                </div>
              </div>
            </div>

            {/* Submit Button */}
            <div className="flex gap-3 pt-4">
              {onCancel && (
                <Button
                  type="button"
                  onClick={onCancel}
                  variant="outline"
                  className="flex-1 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800"
                  disabled={isLoading}
                >
                  Cancel
                </Button>
              )}
              <Button
                type="submit"
                disabled={isLoading}
                className="flex-1 bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-700 text-white font-semibold h-12 text-base flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <>
                    <Loader className="h-5 w-5 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    Complete Payment
                    <ArrowRight className="h-5 w-5" />
                  </>
                )}
              </Button>
            </div>
          </form>
        </Card>

        {/* Footer Trust Text */}
        <p className="text-center text-xs text-slate-500 dark:text-slate-400 mt-6">
          🔐 Your payment information is encrypted and secure. We comply with industry-leading security standards.
        </p>
      </div>
    </div>
  );
}
