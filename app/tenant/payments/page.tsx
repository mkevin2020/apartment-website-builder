'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MTNMoMoPaymentWidget } from '@/components/MTNMoMoPaymentWidget';
import { createClient } from '@supabase/supabase-js';
import { Loader, AlertCircle } from 'lucide-react';

interface Payment {
  id: number;
  apartment_id: number;
  amount: number;
  status: string;
  payment_date: string;
  due_date: string;
  reference_number: string;
  transaction_id?: string;
  payment_method?: string;
}

interface Apartment {
  id: number;
  building_number: string;
  floor_number: number;
  apartment_number: string;
}

export default function TenantPaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [apartments, setApartments] = useState<{ [key: number]: Apartment }>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedPaymentId, setSelectedPaymentId] = useState<number | null>(null);
  const [tenantId, setTenantId] = useState<string>('');

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  );

  useEffect(() => {
    fetchPayments();
  }, []);

  const fetchPayments = async () => {
    try {
      setLoading(true);
      
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.id) {
        setError('Not authenticated');
        return;
      }

      setTenantId(user.id);

      // Fetch payments for this tenant
      const { data: paymentsData, error: paymentsError } = await supabase
        .from('tenant_payments')
        .select('*')
        .eq('tenant_id', parseInt(user.id))
        .order('due_date', { ascending: false });

      if (paymentsError) throw paymentsError;

      setPayments(paymentsData || []);

      // Fetch apartment details
      if (paymentsData && paymentsData.length > 0) {
        const apartmentIds = [...new Set(paymentsData.map(p => p.apartment_id))];
        const { data: apartmentsData } = await supabase
          .from('apartments')
          .select('id, building_number, floor_number, apartment_number')
          .in('id', apartmentIds);

        if (apartmentsData) {
          const apartmentMap = apartmentsData.reduce((acc, apt) => {
            acc[apt.id] = apt;
            return acc;
          }, {} as { [key: number]: Apartment });
          setApartments(apartmentMap);
        }
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch payments');
    } finally {
      setLoading(false);
    }
  };

  const handlePaymentSuccess = (transactionId: string) => {
    // Refresh payments after successful payment
    setTimeout(() => {
      fetchPayments();
    }, 3000);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getStatusBadge = (status: string) => {
    const statusStyles: { [key: string]: string } = {
      pending: 'bg-yellow-100 text-yellow-800',
      completed: 'bg-green-100 text-green-800',
      failed: 'bg-red-100 text-red-800',
      cancelled: 'bg-gray-100 text-gray-800',
    };

    return statusStyles[status.toLowerCase()] || 'bg-gray-100 text-gray-800';
  };

  if (loading) {
    return (
      <div className="container mx-auto py-8 flex justify-center items-center min-h-screen">
        <div className="flex flex-col items-center gap-4">
          <Loader className="h-8 w-8 animate-spin text-blue-600" />
          <p>Loading your payments...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Payment Management</h1>
        <p className="text-gray-600">View and pay your apartment rent</p>
      </div>

      {error && (
        <div className="flex gap-2 mb-6 rounded-lg border border-red-200 bg-red-50 p-4">
          <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0" />
          <p className="text-red-700">{error}</p>
        </div>
      )}

      {selectedPaymentId && (
        <div className="mb-8 p-4 bg-blue-50 rounded-lg border border-blue-200">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold">Complete Payment</h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedPaymentId(null)}
            >
              Close
            </Button>
          </div>
          {payments.find(p => p.id === selectedPaymentId) && (
            <MTNMoMoPaymentWidget
              paymentId={selectedPaymentId}
              amount={payments.find(p => p.id === selectedPaymentId)?.amount || 0}
              tenantId={tenantId}
              onSuccess={handlePaymentSuccess}
            />
          )}
        </div>
      )}

      <div className="grid gap-6">
        {payments.length === 0 ? (
          <Card>
            <CardContent className="pt-6 text-center">
              <p className="text-gray-500">No payments found</p>
            </CardContent>
          </Card>
        ) : (
          payments.map((payment) => {
            const apartment = apartments[payment.apartment_id];
            const isPending = payment.status === 'pending';

            return (
              <Card key={payment.id}>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-lg">
                        {apartment
                          ? `${apartment.building_number} - Floor ${apartment.floor_number}, Apt ${apartment.apartment_number}`
                          : `Apartment ${payment.apartment_id}`}
                      </CardTitle>
                      <p className="text-sm text-gray-500 mt-1">
                        Reference: {payment.reference_number}
                      </p>
                    </div>
                    <span
                      className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusBadge(
                        payment.status
                      )}`}
                    >
                      {payment.status.charAt(0).toUpperCase() +
                        payment.status.slice(1)}
                    </span>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <p className="text-sm text-gray-600">Amount</p>
                      <p className="text-2xl font-bold">
                        {payment.amount.toLocaleString()} XOF
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Due Date</p>
                      <p className="text-lg font-semibold">
                        {formatDate(payment.due_date)}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
                    <div className="border-t pt-3">
                      <p className="text-gray-600">Payment Date</p>
                      <p>{payment.payment_date && formatDate(payment.payment_date)}</p>
                    </div>
                    <div className="border-t pt-3">
                      <p className="text-gray-600">Method</p>
                      <p>{payment.payment_method || 'Not paid yet'}</p>
                    </div>
                  </div>

                  {isPending && (
                    <Button
                      onClick={() => setSelectedPaymentId(payment.id)}
                      className="w-full mt-4"
                    >
                      Pay Now with MTN MoMo
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* Summary Stats */}
      {payments.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-gray-600">Total Due</p>
              <p className="text-2xl font-bold">
                {payments
                  .filter(p => p.status === 'pending')
                  .reduce((sum, p) => sum + p.amount, 0)
                  .toLocaleString()}{' '}
                XOF
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-gray-600">Total Paid</p>
              <p className="text-2xl font-bold">
                {payments
                  .filter(p => p.status === 'completed')
                  .reduce((sum, p) => sum + p.amount, 0)
                  .toLocaleString()}{' '}
                XOF
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-gray-600">Pending Payments</p>
              <p className="text-2xl font-bold">
                {payments.filter(p => p.status === 'pending').length}
              </p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
