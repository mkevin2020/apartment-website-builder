"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { dataClient } from "@/lib/data-client";
import { TenantShell } from "@/components/dashboard/TenantShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle, CreditCard, Download, Eye, QrCode } from "lucide-react";
import { safeJsonResponse } from "@/lib/safe-fetch-json";
import { PageSkeleton, TableSkeleton } from "@/components/ui/loading-skeletons";

interface Payment {
  id: number;
  amount: number;
  status: string;
  due_date: string;
  reference_number: string;
  created_at?: string;
  refund_status?: string;
}

interface Receipt {
  id: string;
  qr_code_base64: string;
  amount_paid: number;
  currency: string;
  created_at: string;
}

export default function PaymentHistoryPage() {
  const router = useRouter();
  const [tenant, setTenant] = useState<any>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [receipts, setReceipts] = useState<Record<string, Receipt>>({});
  const [loading, setLoading] = useState(true);
  const [selectedQR, setSelectedQR] = useState<string | null>(null);
  const [requesting, setRequesting] = useState<number | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const missingSupabaseConfig = false;
  const supabase = missingSupabaseConfig
    ? null
    : dataClient();

  useEffect(() => {
    const fetchPayments = async () => {
      const tenantData = localStorage.getItem("tenant_session");
      if (!tenantData) {
        router.push("/login");
        return;
      }

      // Checking the client itself (not the flag) lets TypeScript narrow
      // `supabase` to non-null for the queries below.
      if (!supabase) {
        setFetchError(
          "Supabase client is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY."
        );
        setLoading(false);
        return;
      }

      const parsedTenant = JSON.parse(tenantData);
      setTenant(parsedTenant);

      // Self-heal: complete any payments that were actually paid on Stripe but got
      // stuck on "processing" (e.g. the return-to-site verify step never ran).
      try {
        await fetch("/api/payments/stripe/reconcile", { cache: "no-store" });
      } catch (e) {
        console.warn("Reconcile call failed (non-fatal):", e);
      }

      // Fetch payments with receipt info.
      // NOTE: there are two FKs between tenant_payments and receipts, so the embed
      // must name the relationship explicitly (receipts.tenant_payment_id -> tenant_payments.id),
      // otherwise PostgREST errors with PGRST201 (ambiguous) and returns nothing.
      const { data: paymentData, error } = await supabase
        .from("tenant_payments")
        .select(
          "*, receipts:receipts!receipts_tenant_payment_id_fkey(id, qr_code_base64, amount_paid, currency, created_at)"
        )
        .eq("tenant_id", parsedTenant.id)
        .order("due_date", { ascending: false });

      if (error) {
        const message = error?.message || JSON.stringify(error) || "Unknown Supabase error";
        console.error("Error loading payment history:", message, error);
        setFetchError(`Failed to load payment history: ${message}`);
        setLoading(false);
        return;
      }

      if (paymentData) {
        setPayments(paymentData as any);

        // Build receipts map. The embed returns an array (one-to-many); take the first receipt.
        const receiptsMap: Record<string, Receipt> = {};
        paymentData.forEach((payment: any) => {
          const rec = Array.isArray(payment.receipts)
            ? payment.receipts[0]
            : payment.receipts;
          if (rec) {
            receiptsMap[payment.id] = rec;
          }
        });
        setReceipts(receiptsMap);
      }

      setLoading(false);
    };

    fetchPayments();
  }, [router, supabase]);

  const getStatusBadge = (status: string) => {
    const styles = {
      completed: "bg-green-100 text-green-800",
      pending: "bg-yellow-100 text-yellow-800",
      processing: "bg-blue-100 text-blue-800",
      failed: "bg-red-100 text-red-800",
    };
    return styles[status as keyof typeof styles] || styles.pending;
  };

  const calculateTotal = () => {
    return payments
      .filter((p) => p.status === "completed")
      .reduce((sum, p) => sum + parseFloat(p.amount?.toString() || "0"), 0);
  };

  const handleViewReceipt = (paymentId: number) => {
    // Open the receipt page directly. The server-side receipt route resolves the
    // receipt even when the browser-side embedded query did not populate it.
    router.push(`/receipt?payment_id=${paymentId}`);
  };

  const requestRefund = async (paymentId: number) => {
    if (!confirm("Request a refund for this payment? A manager will review it (refunds are processed 2 days after payment).")) return;
    setRequesting(paymentId);
    try {
      const res = await fetch("/api/payments/refund/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to request refund");
      setPayments((prev) =>
        prev.map((p) => (p.id === paymentId ? { ...p, refund_status: "requested" } : p))
      );
      alert("Refund requested. You'll be emailed once it's processed.");
    } catch (e: any) {
      alert("Could not request refund: " + (e?.message || "Unknown error"));
    } finally {
      setRequesting(null);
    }
  };

  if (loading) {
    // Skeleton, not a spinner: it occupies the same space the real
    // content will, so nothing shifts when the data arrives.
    return <PageSkeleton label="Loading your payment history"><TableSkeleton rows={8} cols={5} /></PageSkeleton>;
  }

  if (fetchError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-slate-800">
        <div className="text-center max-w-md rounded-3xl border border-red-200 bg-white dark:border-red-900 dark:bg-slate-950 p-10 shadow-lg">
          <AlertCircle className="h-16 w-16 text-red-600 dark:text-red-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Payment history cannot load</h2>
          <p className="text-gray-600 dark:text-slate-400 mb-6">{fetchError}</p>
          <Button onClick={() => window.location.reload()}>Retry</Button>
        </div>
      </div>
    );
  }

  if (!tenant) return null;

  return (
    <TenantShell tenant={tenant} active="history">
        <h1 className="text-3xl font-bold mb-8 flex items-center gap-2">
          <CreditCard className="h-8 w-8" />
          Payment History
        </h1>

        {/* Summary Cards */}
        <div className="grid md:grid-cols-3 gap-4 mb-8">
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-gray-600 dark:text-slate-400">Total Paid</p>
              <p className="text-2xl font-bold text-green-600">
                RWF {calculateTotal().toLocaleString()}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-gray-600 dark:text-slate-400">Total Payments</p>
              <p className="text-2xl font-bold">
                {payments.filter((p) => p.status === "completed").length}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-gray-600 dark:text-slate-400">Receipts Available</p>
              <p className="text-2xl font-bold text-blue-600">
                {Object.keys(receipts).length}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Payments Table */}
        <Card>
          <CardHeader>
            <CardTitle>Payment Transactions</CardTitle>
          </CardHeader>
          <CardContent>
            {payments.length === 0 ? (
              <p className="text-gray-500 dark:text-slate-400 text-center py-8">No payments found</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-4 font-semibold">Reference</th>
                      <th className="text-left py-3 px-4 font-semibold">Amount</th>
                      <th className="text-left py-3 px-4 font-semibold">Due Date</th>
                      <th className="text-left py-3 px-4 font-semibold">Status</th>
                      <th className="text-left py-3 px-4 font-semibold">Receipt</th>
                      <th className="text-center py-3 px-4 font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payments.map((payment) => (
                      <tr key={payment.id} className="border-b hover:bg-gray-50 dark:hover:bg-slate-800">
                        <td className="py-4 px-4 font-mono text-sm">
                          {payment.reference_number}
                        </td>
                        <td className="py-4 px-4 font-semibold">
                          RWF {parseFloat(payment.amount?.toString() || "0").toLocaleString()}
                        </td>
                        <td className="py-4 px-4">
                          {new Date(payment.due_date).toLocaleDateString()}
                        </td>
                        <td className="py-4 px-4">
                          <span
                            className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusBadge(
                              payment.status
                            )}`}
                          >
                            {payment.status.charAt(0).toUpperCase() +
                              payment.status.slice(1)}
                          </span>
                        </td>
                        <td className="py-4 px-4">
                          {receipts[payment.id] ? (
                            <div className="flex items-center gap-2">
                              <div className="flex-1">
                                <div className="text-xs text-green-600 font-medium">
                                  ✓ Generated
                                </div>
                                <div className="text-xs text-gray-500 dark:text-slate-400">
                                  {new Date(
                                    receipts[payment.id]?.created_at
                                  ).toLocaleDateString()}
                                </div>
                              </div>
                              <QrCode className="h-4 w-4 text-blue-600" />
                            </div>
                          ) : (
                            <span className="text-gray-400 dark:text-slate-500 text-sm">Pending</span>
                          )}
                        </td>
                        <td className="py-4 px-4">
                          <div className="flex items-center justify-center gap-2">
                            <Button
                              onClick={() => handleViewReceipt(payment.id)}
                              disabled={payment.status !== "completed"}
                              variant="outline"
                              size="sm"
                              className="gap-1"
                            >
                              <Eye className="h-4 w-4" />
                              View Receipt
                            </Button>
                            {payment.status === "completed" && (
                              payment.refund_status === "refunded" ? (
                                <span className="text-xs font-medium text-slate-500">Refunded</span>
                              ) : payment.refund_status === "requested" ? (
                                <span className="text-xs font-medium text-amber-600">Refund requested</span>
                              ) : (
                                <Button
                                  onClick={() => requestRefund(payment.id)}
                                  disabled={requesting === payment.id}
                                  variant="outline"
                                  size="sm"
                                  className="gap-1 text-red-600 border-red-200 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-900/20"
                                >
                                  {requesting === payment.id ? "Requesting…" : "Request Refund"}
                                </Button>
                              )
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
    </TenantShell>
  );
}