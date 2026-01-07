"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
import TenantHeader from "@/components/TenantHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CreditCard, Download } from "lucide-react";

export default function PaymentHistoryPage() {
  const router = useRouter();
  const [tenant, setTenant] = useState<any>(null);
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    const fetchPayments = async () => {
      const tenantData = localStorage.getItem("tenant_session");
      if (!tenantData) {
        router.push("/login");
        return;
      }

      const parsedTenant = JSON.parse(tenantData);
      setTenant(parsedTenant);

      const { data } = await supabase
        .from("payment_history")
        .select("*")
        .eq("tenant_id", parsedTenant.id)
        .order("payment_date", { ascending: false });

      if (data) setPayments(data);
      setLoading(false);
    };

    fetchPayments();
  }, [router, supabase]);

  const getStatusBadge = (status: string) => {
    const colors = {
      completed: "text-green-600 bg-green-50",
      pending: "text-yellow-600 bg-yellow-50",
      failed: "text-red-600 bg-red-50",
    };
    return colors[status as keyof typeof colors] || colors.pending;
  };

  const calculateTotal = () => {
    return payments
      .filter((p) => p.status === "completed")
      .reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p>Loading payments...</p>
        </div>
      </div>
    );
  }

  if (!tenant) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      <TenantHeader tenant={tenant} />

      <main className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8 flex items-center gap-2">
          <CreditCard className="h-8 w-8" />
          Payment History
        </h1>

        {/* Summary Cards */}
        <div className="grid md:grid-cols-3 gap-4 mb-8">
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-gray-600">Total Paid</p>
              <p className="text-2xl font-bold text-green-600">
                ${calculateTotal().toFixed(2)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-gray-600">Total Payments</p>
              <p className="text-2xl font-bold">
                {payments.filter((p) => p.status === "completed").length}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-gray-600">Pending</p>
              <p className="text-2xl font-bold text-yellow-600">
                {payments.filter((p) => p.status === "pending").length}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Payment Table */}
        <Card>
          <CardHeader>
            <CardTitle>Payment Records</CardTitle>
          </CardHeader>
          <CardContent>
            {payments.length === 0 ? (
              <p className="text-gray-500 text-center py-8">
                No payment records found
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-4 font-semibold">Date</th>
                      <th className="text-left py-3 px-4 font-semibold">
                        Amount
                      </th>
                      <th className="text-left py-3 px-4 font-semibold">
                        Method
                      </th>
                      <th className="text-left py-3 px-4 font-semibold">
                        Status
                      </th>
                      <th className="text-right py-3 px-4 font-semibold">
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {payments.map((payment) => (
                      <tr
                        key={payment.id}
                        className="border-b hover:bg-gray-50 transition"
                      >
                        <td className="py-3 px-4">
                          {new Date(payment.payment_date).toLocaleDateString()}
                        </td>
                        <td className="py-3 px-4 font-semibold">
                          ${parseFloat(payment.amount || 0).toFixed(2)}
                        </td>
                        <td className="py-3 px-4 text-sm">
                          {payment.payment_method || "N/A"}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`inline-block text-xs font-semibold px-2 py-1 rounded ${getStatusBadge(
                              payment.status
                            )}`}
                          >
                            {payment.status.charAt(0).toUpperCase() +
                              payment.status.slice(1)}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button className="text-blue-600 hover:text-blue-800 flex items-center justify-end gap-1">
                            <Download className="h-4 w-4" />
                            Receipt
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}