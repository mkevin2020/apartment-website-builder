"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RefreshCw, RotateCcw, Lock, Clock } from "lucide-react";

type RefundRow = {
  id: number;
  tenant: string;
  email: string | null;
  apartment: string;
  amount: number;
  reference: string;
  requestedAt: string | null;
  eligible: boolean;
  eligibleAt: string;
  hoursLeft: number;
};

export function RefundRequestsManager() {
  const [rows, setRows] = useState<RefundRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState<number | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/payments/refund/list", { cache: "no-store" });
      const data = await res.json();
      setRows(data.rows || []);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const processRefund = async (id: number) => {
    if (!confirm("Process this refund? The money will be refunded to the customer on Stripe and they'll be emailed.")) return;
    setWorking(id);
    try {
      const res = await fetch("/api/payments/refund/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentId: id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to process refund");
      setRows((prev) => prev.filter((r) => r.id !== id));
      alert(
        `Refund processed.${data.stripeRefunded ? " Money refunded on Stripe." : ""}${
          data.emailed ? " Customer emailed." : ""
        }`,
      );
    } catch (e: any) {
      alert("Could not process refund: " + (e?.message || "Unknown error"));
    } finally {
      setWorking(null);
    }
  };

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Refund Requests ({rows.length})</CardTitle>
        <Button variant="outline" size="sm" onClick={load} disabled={loading} className="gap-2">
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800 border-b dark:border-slate-700">
              <tr>
                <th className="text-left p-3 font-medium">Customer</th>
                <th className="text-left p-3 font-medium">Apartment</th>
                <th className="text-left p-3 font-medium">Amount</th>
                <th className="text-left p-3 font-medium">Reference</th>
                <th className="text-left p-3 font-medium">Requested</th>
                <th className="text-left p-3 font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="text-center text-slate-500 py-8">Loading…</td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center text-slate-500 py-8">No refund requests.</td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id} className="border-b dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <td className="p-3">
                      <div className="font-medium text-slate-900 dark:text-white">{r.tenant}</div>
                      {r.email && <div className="text-xs text-slate-500">{r.email}</div>}
                    </td>
                    <td className="p-3">{r.apartment}</td>
                    <td className="p-3 font-semibold">RWF {r.amount.toLocaleString()}</td>
                    <td className="p-3 font-mono text-xs">{r.reference}</td>
                    <td className="p-3 text-xs text-slate-500">
                      {r.requestedAt ? new Date(r.requestedAt).toLocaleString() : "—"}
                    </td>
                    <td className="p-3">
                      {r.eligible ? (
                        <Button
                          size="sm"
                          onClick={() => processRefund(r.id)}
                          disabled={working === r.id}
                          className="gap-1.5 bg-green-600 hover:bg-green-700"
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                          {working === r.id ? "Processing…" : "Process Refund"}
                        </Button>
                      ) : (
                        <span
                          className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-600 dark:text-amber-400"
                          title={`Eligible on ${new Date(r.eligibleAt).toLocaleString()}`}
                        >
                          <Lock className="h-3.5 w-3.5" />
                          Locked · <Clock className="h-3 w-3" /> ~{r.hoursLeft}h
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-slate-400">
          Refunds unlock <strong>2 days after the payment</strong>. Processing refunds the money on Stripe and emails the customer.
        </p>
      </CardContent>
    </Card>
  );
}
