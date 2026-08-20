"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PaymentCheckoutModal } from "@/components/PaymentCheckoutModal";
import { Loader, AlertCircle, CreditCard, Landmark, ArrowRight, History, CheckCircle2, Clock } from "lucide-react";
import { TenantShell } from "@/components/dashboard/TenantShell";
import { ListSkeleton, PageSkeleton, StatsSkeleton } from "@/components/ui/loading-skeletons";

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
  check_in_date?: string;
  check_out_date?: string;
}

/**
 * Mirrors the real `apartments` table. The previous version declared
 * building_number / floor_number / apartment_number, none of which exist in the
 * schema — so `apartment?.name` (the column that IS there) was a type error,
 * hidden by typescript.ignoreBuildErrors.
 */
interface Apartment {
  id: number;
  name: string | null;
  type: string | null;
  price_per_month: number | null;
  price_per_day: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  size_sqm: number | null;
}

export default function TenantPaymentsPage() {
  const router = useRouter();
  const [tenant, setTenant] = useState<any>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [apartments, setApartments] = useState<{ [key: number]: Apartment }>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedPaymentId, setSelectedPaymentId] = useState<number | null>(null);

  // Custom "Make a Payment" flow
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [tenantApartments, setTenantApartments] = useState<any[]>([]);
  const [customApartmentId, setCustomApartmentId] = useState<string>("");
  const [customAmount, setCustomAmount] = useState<string>("");
  // True once the amount came from the tenant typing it, or from an explicit
  // ?amount= in the URL. While false the amount tracks the chosen apartment's
  // price; once true we never overwrite what they intended to pay.
  const [amountTouched, setAmountTouched] = useState(false);
  // Pay for a whole month, or day by day for a short stay.
  const [rateType, setRateType] = useState<"monthly" | "daily">("monthly");
  const [days, setDays] = useState<string>("1");
  const [creatingPayment, setCreatingPayment] = useState(false);
  const [customError, setCustomError] = useState("");
  const [autoOpenPay, setAutoOpenPay] = useState(false);
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    fetchPayments();
  }, [router]);

  // Open the "Make a Payment" form directly when arriving via ?action=pay (e.g. dashboard quick action)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("action") === "pay") {
      setAutoOpenPay(true);
      setShowCustomForm(true);
      // "Accept & Pay" from the notification passes the exact amount AND apartment,
      // so the tenant doesn't have to pick the apartment or retype the amount.
      const amt = params.get("amount");
      if (amt && !isNaN(Number(amt)) && Number(amt) > 0) {
        setCustomAmount(amt);
        setAmountTouched(true); // an exact amount was requested — don't overwrite it
      }
      const aptId = params.get("apartment_id");
      if (aptId && !isNaN(Number(aptId))) {
        setCustomApartmentId(aptId);
      }
    }
  }, []);

  // Keep the amount in step with the selected apartment's monthly price.
  //
  // This has to be an effect, not just the <select> onChange: arriving with
  // ?apartment_id=3 preselects the apartment, so onChange never fires and the
  // amount stayed empty. It also re-runs when the tenant switches apartments,
  // so the price follows the selection instead of keeping the previous one.
  useEffect(() => {
    if (amountTouched || !customApartmentId) return;
    const apt = tenantApartments.find((a) => a.id === parseInt(customApartmentId));
    if (!apt) return; // list may not have loaded yet — this re-runs when it does

    if (rateType === "daily") {
      const perDay = Number(apt.price_per_day) || 0;
      const n = Math.max(1, parseInt(days) || 1);
      if (perDay > 0) setCustomAmount(String(Math.round(perDay * n)));
      return;
    }

    const price = apt.price_per_month;
    if (price != null && Number(price) > 0) setCustomAmount(String(price));
  }, [customApartmentId, tenantApartments, amountTouched, rateType, days]);

  // When returning from Stripe checkout, verify the session and clear the pending status
  // (fallback that works even if the webhook didn't reach the server)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get("session_id");
    if (params.get("status") === "success" && sessionId) {
      setVerifying(true);
      fetch(`/api/payments/stripe?session_id=${encodeURIComponent(sessionId)}`)
        .then((r) => r.json())
        .then((res) => {
          if (res?.paid) setError("");
        })
        .catch((e) => console.error("Verify failed:", e))
        .finally(() => {
          // Clean the URL so a refresh doesn't re-trigger, then reload payments
          window.history.replaceState({}, "", "/tenant/payments");
          setVerifying(false);
          fetchPayments();
        });
    }
  }, []);

  // Auto-select first pending payment when payments load
  useEffect(() => {
    if (autoOpenPay) return; // user explicitly asked to start a new payment
    if (payments.length > 0 && !selectedPaymentId) {
      const pendingPayments = payments.filter((p) => p.status === "pending");
      if (pendingPayments.length > 0) {
        setSelectedPaymentId(pendingPayments[0].id);
      }
    }
  }, [payments, autoOpenPay]);

  const fetchPayments = async () => {
    try {
      setLoading(true);

      const tenantData = localStorage.getItem("tenant_session");
      if (!tenantData) {
        setTimeout(() => {
          router.push("/login");
        }, 1500);
        setError("Not authenticated");
        return;
      }

      const parsedTenant = JSON.parse(tenantData);
      setTenant(parsedTenant);

      // All reads go through the API route, which scopes them to the signed
      // session cookie. Querying Supabase from the browser with the anon key
      // was the last thing keeping Row Level Security switched off, and it also
      // meant the tenant id came from localStorage rather than from a signature.
      const urlAptId = new URLSearchParams(window.location.search).get("apartment_id");
      const res = await fetch(
        `/api/tenant/payments${urlAptId ? `?apartment_id=${encodeURIComponent(urlAptId)}` : ""}`,
        { cache: "no-store" },
      );

      if (res.status === 401 || res.status === 403) {
        setTimeout(() => {
          router.push("/login");
        }, 1500);
        setError("Not authenticated");
        return;
      }
      if (!res.ok) throw new Error("Failed to fetch payments");

      const { payments: paymentsData, apartments: apartmentMap, tenantApartments: aptData } =
        await res.json();

      setPayments(paymentsData || []);
      setApartments(apartmentMap || {});
      if (aptData) setTenantApartments(aptData);
    } catch (err: any) {
      setError(err.message || "Failed to fetch payments");
    } finally {
      setLoading(false);
    }
  };

  // Create a pending invoice on the fly, then hand it to the Stripe widget
  const handleStartCustomPayment = async () => {
    setCustomError("");

    if (!customApartmentId) {
      setCustomError("Please select an apartment");
      return;
    }
    const amountNum = parseFloat(customAmount);
    if (!amountNum || amountNum <= 0) {
      setCustomError("Please enter a valid amount");
      return;
    }

    setCreatingPayment(true);
    try {
      // Created server-side: the tenant id comes from the signed session and
      // the apartment is checked against the caller's own bookings. Inserting
      // from the browser let any tenant_id and amount be supplied directly.
      const createRes = await fetch("/api/tenant/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apartmentId: parseInt(customApartmentId),
          amount: amountNum,
        }),
      });

      const createBody = await createRes.json();
      if (!createRes.ok) throw new Error(createBody?.error || "Failed to create payment");
      const newPayment = createBody.payment;

      // Add to local list, hydrate apartment name, and open the Stripe widget
      const apt = tenantApartments.find((a) => a.id === parseInt(customApartmentId));
      if (apt) setApartments((prev) => ({ ...prev, [apt.id]: apt }));
      setPayments((prev) => [newPayment, ...prev]);
      setShowCustomForm(false);
      setCustomAmount("");
      setCustomApartmentId("");
      setSelectedPaymentId(newPayment.id);
    } catch (err: any) {
      setCustomError(err.message || "Failed to create payment");
    } finally {
      setCreatingPayment(false);
    }
  };

  const handlePaymentSuccess = (transactionId?: string) => {
    setSelectedPaymentId(null);
    setTimeout(() => {
      fetchPayments();
    }, 2000);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const getApartmentDisplayName = (apartmentId: number) => {
    const apt: any = apartments[apartmentId];
    if (apt) {
      if (apt.name) return apt.name;
      if (apt.building_number) return `${apt.building_number} - Unit ${apt.apartment_number}`;
    }
    return `Apartment ${apartmentId}`;
  };

  if (loading) {
    // Skeleton, not a spinner: it occupies the same space the real
    // content will, so nothing shifts when the data arrives.
    return <PageSkeleton label="Loading your payments"><StatsSkeleton count={3} /><ListSkeleton rows={5} /></PageSkeleton>;
  }

  const selectedPayment = payments.find((p) => p.id === selectedPaymentId);

  return (
    <TenantShell tenant={tenant} active="payments">
        {/* Header */}
        <div className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl md:text-5xl font-extrabold text-slate-900 dark:text-white mb-2 tracking-tight">Payments</h1>
            <p className="text-slate-600 dark:text-slate-400 text-lg">Manage your rent and apartment dues securely.</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-sm font-medium px-4 py-2 bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400 rounded-full border border-blue-200 dark:border-blue-800">
              <Landmark className="h-4 w-4" />
              <span>Secure 256-bit Encryption</span>
            </div>
            {!selectedPaymentId && !showCustomForm && (
              <Button
                onClick={() => { setShowCustomForm(true); setCustomError(""); }}
                className="h-10 px-5 rounded-full bg-blue-600 hover:bg-blue-700 text-white font-semibold"
              >
                <CreditCard className="h-4 w-4 mr-2" />
                Make a Payment
              </Button>
            )}
          </div>
        </div>

        {/* Verifying payment banner */}
        {verifying && (
          <div className="mb-8 rounded-2xl border border-blue-200 dark:border-blue-900/50 bg-blue-50 dark:bg-blue-900/20 p-5 shadow-sm">
            <div className="flex gap-3 items-center">
              <Loader className="h-5 w-5 text-blue-600 dark:text-blue-400 animate-spin flex-shrink-0" />
              <p className="text-blue-700 dark:text-blue-300 font-semibold">Confirming your payment…</p>
            </div>
          </div>
        )}

        {/* Error Alert */}
        {error && (
          <div className="mb-8 rounded-2xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-900/20 p-5 shadow-sm">
            <div className="flex gap-3 items-center">
              <AlertCircle className="h-6 w-6 text-red-600 dark:text-red-400 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-red-700 dark:text-red-300 font-semibold">{error}</p>
              </div>
              <Button
                onClick={() => router.push("/login")}
                variant="outline"
                className="text-red-700 border-red-300 hover:bg-red-100 dark:border-red-800 dark:hover:bg-red-900/40"
              >
                Go to Login
              </Button>
            </div>
          </div>
        )}

        {/* Summary Stats */}
        {payments.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
            <Card className="border-none shadow-md bg-white dark:bg-slate-950/50 transition-colors">
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center">
                    <Clock className="h-6 w-6 text-amber-600 dark:text-amber-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Total Due</p>
                    <p className="text-2xl font-bold text-slate-900 dark:text-white">
                      RWF {payments.filter((p) => p.status === "pending").reduce((sum, p) => sum + p.amount, 0).toLocaleString()}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-none shadow-md bg-white dark:bg-slate-950/50 transition-colors">
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-green-50 dark:bg-green-900/20 flex items-center justify-center">
                    <CheckCircle2 className="h-6 w-6 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Total Paid</p>
                    <p className="text-2xl font-bold text-slate-900 dark:text-white">
                      RWF {payments.filter((p) => p.status === "completed").reduce((sum, p) => sum + p.amount, 0).toLocaleString()}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-none shadow-md bg-white dark:bg-slate-950/50 transition-colors">
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center">
                    <Landmark className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Pending Invoices</p>
                    <p className="text-2xl font-bold text-slate-900 dark:text-white">
                      {payments.filter((p) => p.status === "pending").length} <span className="text-base font-normal text-slate-500">bills</span>
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Pending Payments Section */}
        <div className="mb-12">
          {payments.filter((p) => p.status === "pending").length > 0 && (
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-6">
              <p className="text-sm text-blue-900 dark:text-blue-300">
                <strong>Select an invoice below</strong> to complete your payment with our secure form
              </p>
            </div>
          )}
        </div>

        <div className="grid lg:grid-cols-12 gap-8">
          {/* Payment Form Section - Always displayable */}
          <div className={selectedPaymentId && selectedPayment ? "lg:col-span-8" : "lg:col-span-12"}>
            {selectedPaymentId && selectedPayment ? (
              // Checkout dialog with MTN MoMo + Card (Stripe) options
              <PaymentCheckoutModal
                open={true}
                onClose={() => setSelectedPaymentId(null)}
                payment={selectedPayment}
                tenantId={tenant?.id?.toString() || ""}
                onSuccess={handlePaymentSuccess}
              />
            ) : showCustomForm ? (
              <Card className="border-slate-200 dark:border-slate-800 dark:bg-slate-950 shadow-md">
                <CardHeader>
                  <CardTitle className="text-xl text-slate-900 dark:text-white">Make a Payment</CardTitle>
                </CardHeader>
                <CardContent className="space-y-5">
                  {/* Apartment select */}
                  <div className="space-y-1.5">
                    <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                      Apartment <span className="text-red-500">*</span>
                    </label>
                    {tenantApartments.length > 0 ? (
                      <select
                        value={customApartmentId}
                        onChange={(e) => setCustomApartmentId(e.target.value)}
                        className="w-full h-11 px-3 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="" disabled>Choose your apartment…</option>
                        {tenantApartments.map((apt) => (
                          <option key={apt.id} value={apt.id}>
                            {apt.name}{apt.type ? ` — ${apt.type}` : ""}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <p className="text-sm text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
                        No apartments found on your account. Please book an apartment first.
                      </p>
                    )}
                  </div>

                  {/* Pay for a full month, or day by day for a short stay */}
                  {(() => {
                    const selectedApt = tenantApartments.find(
                      (a) => a.id === parseInt(customApartmentId)
                    );
                    const perMonth = Number(selectedApt?.price_per_month) || 0;
                    const perDay = Number(selectedApt?.price_per_day) || 0;
                    return (
                      <div className="space-y-1.5">
                        <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                          Pay by
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                          {([
                            { id: "monthly" as const, label: "Per month", price: perMonth, suffix: "/month" },
                            { id: "daily" as const, label: "Day by day", price: perDay, suffix: "/day" },
                          ]).map((opt) => (
                            <button
                              key={opt.id}
                              type="button"
                              onClick={() => {
                                setRateType(opt.id);
                                // Switching the basis recalculates the amount, unless
                                // the tenant has deliberately typed their own figure.
                                setAmountTouched(false);
                              }}
                              className={`rounded-xl border px-3 py-2.5 text-left transition-colors ${
                                rateType === opt.id
                                  ? "border-blue-600 bg-blue-50 dark:bg-blue-900/30 ring-1 ring-blue-500"
                                  : "border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800"
                              }`}
                            >
                              <span className="block text-sm font-semibold text-slate-900 dark:text-white">
                                {opt.label}
                              </span>
                              <span className="block text-xs text-slate-500 dark:text-slate-400">
                                {opt.price > 0
                                  ? `RWF ${opt.price.toLocaleString()}${opt.suffix}`
                                  : "price not set"}
                              </span>
                            </button>
                          ))}
                        </div>

                        {rateType === "daily" && (
                          <div className="pt-2 space-y-1.5">
                            <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                              Number of days
                            </label>
                            <Input
                              type="number"
                              min="1"
                              value={days}
                              onChange={(e) => {
                                setDays(e.target.value);
                                setAmountTouched(false); // recompute from days × daily rate
                              }}
                              className="h-11 rounded-xl border-slate-300 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                            />
                            {perDay > 0 && (
                              <p className="text-xs text-slate-500 dark:text-slate-400">
                                {Math.max(1, parseInt(days) || 1)} × RWF {perDay.toLocaleString()} ={" "}
                                <span className="font-semibold text-slate-700 dark:text-slate-200">
                                  RWF {(Math.max(1, parseInt(days) || 1) * perDay).toLocaleString()}
                                </span>
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {/* Amount */}
                  <div className="space-y-1.5">
                    <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                      Amount (RWF) <span className="text-red-500">*</span>
                    </label>
                    <Input
                      type="number"
                      min="1"
                      placeholder="e.g. 50000"
                      value={customAmount}
                      onChange={(e) => {
                        setCustomAmount(e.target.value);
                        setAmountTouched(true);
                      }}
                      className="h-11 rounded-xl border-slate-300 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                    />
                  </div>

                  {customError && (
                    <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-3 flex gap-2.5 items-start">
                      <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />
                      <p className="text-sm text-red-700 dark:text-red-400">{customError}</p>
                    </div>
                  )}

                  <div className="flex gap-3 pt-1">
                    <Button
                      onClick={handleStartCustomPayment}
                      disabled={creatingPayment || tenantApartments.length === 0}
                      className="flex-1 h-11 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold"
                    >
                      {creatingPayment ? (
                        <><Loader className="h-4 w-4 mr-2 animate-spin" />Preparing…</>
                      ) : (
                        <>Continue to Payment<ArrowRight className="h-4 w-4 ml-2" /></>
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => { setShowCustomForm(false); setCustomError(""); }}
                      disabled={creatingPayment}
                      className="h-11"
                    >
                      Cancel
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card className="border-2 border-dashed border-slate-300 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50">
                <CardContent className="pt-12 pb-12 text-center">
                  <CreditCard className="h-12 w-12 text-slate-400 dark:text-slate-600 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-300 mb-2">
                    {payments.length === 0 ? "No invoices yet" : "Select a Payment"}
                  </h3>
                  <p className="text-slate-600 dark:text-slate-400 max-w-md mx-auto mb-6">
                    {payments.length === 0
                      ? "You don't have any invoices yet. Start a payment below to pay your rent securely with Stripe."
                      : payments.filter((p) => p.status === "pending").length === 0
                      ? "All your payments are up to date! You can still make an advance payment below."
                      : "Click on an invoice to the right to start your payment, or make a new payment below."}
                  </p>
                  <Button
                    onClick={() => { setShowCustomForm(true); setCustomError(""); }}
                    className="h-11 px-6 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold"
                  >
                    <CreditCard className="h-4 w-4 mr-2" />
                    Make a Payment
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Payments List Section */}
          <div className={selectedPaymentId ? "lg:col-span-4" : "lg:col-span-12"}>
            <div className="flex items-center gap-2 mb-4">
              <CreditCard className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
                {payments.filter((p) => p.status === "pending").length > 0 ? "Pending Invoices" : "All Invoices"}
              </h2>
            </div>

            {payments.length === 0 ? (
              <Card className="border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 border-dashed">
                <CardContent className="pt-10 pb-10 text-center">
                  <History className="h-12 w-12 text-slate-300 dark:text-slate-700 mx-auto mb-4" />
                  <p className="text-slate-600 dark:text-slate-400 font-medium">No invoices yet</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {payments
                  .sort((a, b) => {
                    // Sort pending first, then by due date
                    if (a.status === "pending" && b.status !== "pending") return -1;
                    if (a.status !== "pending" && b.status === "pending") return 1;
                    return new Date(b.due_date).getTime() - new Date(a.due_date).getTime();
                  })
                  .map((payment) => (
                    <button
                      key={payment.id}
                      onClick={() => setSelectedPaymentId(payment.id)}
                      className={`w-full text-left transition-all duration-200 p-5 rounded-xl border-2 flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                        selectedPaymentId === payment.id
                          ? "bg-blue-50 border-blue-500 shadow-md dark:bg-slate-900 dark:border-blue-500"
                          : payment.status === "pending"
                          ? "bg-white dark:bg-slate-800 border-orange-200 hover:border-orange-300 hover:shadow-sm dark:bg-slate-950 dark:border-orange-800/40 dark:hover:border-orange-700"
                          : "bg-white dark:bg-slate-800 border-slate-200 hover:border-slate-300 hover:shadow-sm dark:bg-slate-950 dark:border-slate-800 dark:hover:border-slate-700"
                      }`}
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-slate-900 dark:text-white text-lg">
                            {getApartmentDisplayName(payment.apartment_id)}
                          </p>
                          {payment.status === "pending" && (
                            <span className="text-xs font-semibold px-2 py-1 bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400 rounded-full">
                              Pending
                            </span>
                          )}
                          {payment.status === "completed" && (
                            <span className="text-xs font-semibold px-2 py-1 bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 rounded-full">
                              Paid
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <Clock className="h-4 w-4 text-orange-500" />
                          <p className="text-sm font-medium text-orange-600 dark:text-orange-400">
                            {payment.status === "pending" ? "Due" : "Paid"}: {formatDate(payment.status === "pending" ? payment.due_date : payment.payment_date || payment.due_date)}
                          </p>
                        </div>
                      </div>
                      <div className="sm:text-right">
                        <p className="text-sm text-slate-500 dark:text-slate-400">Amount</p>
                          <p className="text-2xl font-extrabold text-slate-900 dark:text-white">
                            RWF {payment.amount.toLocaleString()}
                          </p>
                        </div>
                      </button>
                    ))}
                </div>
            )}
          </div>
        </div>

        {/* No Pending Payments */}
        {payments.filter((p) => p.status === "pending").length === 0 && payments.length > 0 && (
          <div className="mb-12 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-8">
            <div className="flex items-center gap-4">
              <CheckCircle2 className="h-12 w-12 text-green-600 dark:text-green-400" />
              <div>
                <h2 className="text-2xl font-bold text-green-900 dark:text-green-300 mb-1">All caught up!</h2>
                <p className="text-green-800 dark:text-green-400">You have no pending payments at this time.</p>
              </div>
            </div>
          </div>
        )}

        {/* Payment History */}
        {payments.length > 0 && (
          <div className="mt-12">
            <div className="flex items-center gap-2 mb-6">
              <History className="h-6 w-6 text-slate-500 dark:text-slate-400" />
              <h3 className="text-2xl font-bold text-slate-900 dark:text-white">Payment History</h3>
            </div>

            <div className="grid gap-4">
              {payments.map((payment) => {
                const apartment = apartments[payment.apartment_id];

                return (
                  <Card key={payment.id} className="border-slate-200 dark:border-slate-800 dark:bg-slate-950 hover:shadow-md transition-shadow">
                    <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800">
                      <div className="flex justify-between items-start gap-4">
                        <div>
                          <CardTitle className="text-base text-slate-900 dark:text-white">
                            {apartment?.name || `Apartment ${payment.apartment_id}`}
                          </CardTitle>
                          <p className="text-xs text-slate-500 mt-1 font-mono">Ref: {payment.reference_number}</p>
                        </div>
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider whitespace-nowrap ${
                            payment.status === "pending"
                              ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400"
                              : payment.status === "completed"
                              ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                              : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                          }`}
                        >
                          {payment.status}
                        </span>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-4 space-y-4">
                      <div className="flex justify-between items-end">
                        <div>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Total Amount</p>
                          <p className="text-lg font-bold text-slate-900 dark:text-white">RWF {payment.amount.toLocaleString()}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Due Date</p>
                          <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                            {formatDate(payment.due_date)}
                          </p>
                        </div>
                      </div>

                      {payment.payment_date && (
                        <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center text-sm">
                          <div>
                            <span className="text-slate-500">Paid on</span>
                            <span className="font-medium text-slate-900 dark:text-white ml-2">
                              {formatDate(payment.payment_date)} via {payment.payment_method || "Card"}
                            </span>
                          </div>
                          {payment.status === "completed" && (
                            <Button size="sm" variant="outline" asChild className="h-8">
                              <a href={`/receipt/${payment.id}`} target="_blank" rel="noopener noreferrer">
                                View Receipt
                              </a>
                            </Button>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        )}
    </TenantShell>
  );
}
