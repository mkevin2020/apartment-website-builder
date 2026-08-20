'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  CheckCircle,
  CreditCard,
  Lock,
  ShieldCheck,
} from 'lucide-react';
import { formatDate, formatCurrency } from '@/lib/utils';
import { PaymentCheckoutModal } from '@/components/PaymentCheckoutModal';

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
  const [checkoutOpen, setCheckoutOpen] = useState(false);

  if (pendingPayments.length === 0) {
    return (
      <Card className="border-slate-200 dark:border-slate-800 dark:bg-slate-950">
        <CardHeader>
          <CardTitle className="text-base font-semibold text-slate-900 dark:text-white">
            Payments
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="w-12 h-12 rounded-full bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 flex items-center justify-center mb-3">
              <CheckCircle className="h-6 w-6 text-green-600 dark:text-green-400" />
            </div>
            <p className="text-slate-900 dark:text-white font-medium">All payments are up to date</p>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">You have no pending payments</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const selectedPayment = pendingPayments.find(p => p.id === selectedPaymentId);
  const totalDue = pendingPayments.reduce((sum, p) => sum + p.amount, 0);

  const handlePaymentClick = (paymentId: number) => {
    setSelectedPaymentId(paymentId);
  };

  return (
    <Card className="border-slate-200 dark:border-slate-800 dark:bg-slate-950 shadow-sm">
      <CardHeader className="border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base font-semibold text-slate-900 dark:text-white">
            <CreditCard className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            Make a Payment
          </CardTitle>
          <div className="text-right">
            <p className="text-xs text-slate-500 dark:text-slate-400">Total due</p>
            <p className="text-lg font-bold text-slate-900 dark:text-white">
              RWF {formatCurrency(totalDue)}
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-6 space-y-6">
        {/* Payments List */}
        <div className="space-y-2">
          <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
            Select an invoice to pay
            <span className="text-slate-400 dark:text-slate-500 font-normal ml-2">
              {pendingPayments.length} pending
            </span>
          </p>
          {pendingPayments.map((payment) => (
            <button
              key={payment.id}
              onClick={() => handlePaymentClick(payment.id)}
              className={`w-full p-4 rounded-xl border transition-colors text-left ${
                selectedPaymentId === payment.id
                  ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-900/20 dark:border-blue-500'
                  : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-slate-900 dark:text-white truncate">
                    Invoice {payment.reference_number}
                  </p>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                    Due {formatDate(payment.due_date)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-slate-900 dark:text-white">
                    RWF {formatCurrency(payment.amount)}
                  </p>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full mt-1 inline-block ${
                    payment.status.toLowerCase() === 'overdue'
                      ? 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                      : 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                  }`}>
                    {payment.status}
                  </span>
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* Pay button — opens the checkout dialog (MTN MoMo or Card) */}
        {selectedPayment && (
          <div className="pt-5 border-t border-slate-100 dark:border-slate-800 space-y-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500 dark:text-slate-400">Amount to pay</span>
              <span className="text-lg font-bold text-slate-900 dark:text-white">
                RWF {formatCurrency(selectedPayment.amount)}
              </span>
            </div>

            <Button
              onClick={() => setCheckoutOpen(true)}
              className="w-full h-11 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm transition-colors"
            >
              <Lock className="h-4 w-4 mr-2" />
              Pay RWF {formatCurrency(selectedPayment.amount)}
            </Button>

            <div className="flex items-center justify-center gap-1.5 text-xs text-slate-400 dark:text-slate-500">
              <ShieldCheck className="h-3.5 w-3.5" />
              <span>Pay with MTN MoMo or card (secured by Stripe)</span>
            </div>
          </div>
        )}
      </CardContent>

      {selectedPayment && (
        <PaymentCheckoutModal
          open={checkoutOpen}
          onClose={() => setCheckoutOpen(false)}
          payment={selectedPayment}
          tenantId={tenantId}
          onSuccess={() => {
            setCheckoutOpen(false);
            setSelectedPaymentId(null);
            if (onPaymentSuccess) onPaymentSuccess();
            else window.location.reload(); // refresh the dashboard's pending list
          }}
        />
      )}
    </Card>
  );
}
