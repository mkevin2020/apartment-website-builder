"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RefreshCw, Wallet, Clock, AlertTriangle, Mail, Phone } from "lucide-react";

type Row = {
  tenantId: string;
  tenant: string;
  email: string | null;
  phone: string | null;
  apartment: string;
  bookingId: number | null;
  startDate: string | null;
  endDate: string | null;
  total: number;
  paid: number;
  outstanding: number;
  pendingAmount: number;
  pendingCount: number;
  kind: "pending" | "balance";
};

const money = (n: number) => `RWF ${Number(n || 0).toLocaleString()}`;

// Tenants who still owe money: either a payment is in flight (pending/processing)
// or they paid the upfront deposit and never cleared the remaining balance.
export function OutstandingPaymentsManager() {
  const [rows, setRows] = useState<Row[]>([]);
  const [depositRate, setDepositRate] = useState(0.4);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "pending" | "balance">("all");

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/manager/outstanding", { cache: "no-store" });
      const data = await res.json();
      setRows(data.rows || []);
      if (data.depositRate) setDepositRate(data.depositRate);
    } catch {
      /* leave the previous rows on screen rather than blanking the table */
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  // Headline figures, derived from the rows themselves so they can never drift
  // from the table underneath. Always over ALL rows, not the active filter.
  //
  // Deliberately NOT wrapped in useMemo and NOT passed through the money()
  // helper: under Next 16 + React 19 auto-memoization both of those kept
  // serving the first-render result ("RWF 0") after the data arrived. A plain
  // reduce in the render body recomputes every render, which is what we need
  // (and costs nothing on a list this size).
  let outstandingTotal = 0;
  let pendingTotal = 0;
  for (const r of rows) {
    outstandingTotal += Number(r.outstanding) || 0;
    pendingTotal += Number(r.pendingAmount) || 0;
  }

  const shown = useMemo(
    () => (filter === "all" ? rows : rows.filter((r) => r.kind === filter)),
    [rows, filter]
  );

  const remainderPct = Math.round((1 - depositRate) * 100);

  const tabs: { id: typeof filter; label: string; count: number }[] = [
    { id: "all", label: "All", count: rows.length },
    { id: "pending", label: "Payment pending", count: rows.filter((r) => r.kind === "pending").length },
    { id: "balance", label: `Balance unpaid (${remainderPct}%)`, count: rows.filter((r) => r.kind === "balance").length },
  ];

  return (
    <Card className="border-slate-200 dark:border-slate-800 rounded-2xl">
      <CardHeader className="flex flex-row items-center justify-between gap-3 flex-wrap">
        <CardTitle className="text-base flex items-center gap-2">
          <Wallet className="h-4 w-4 text-emerald-600" /> Outstanding Payments
        </CardTitle>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-1.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </CardHeader>

      <CardContent>
        {/* Summary */}
        <div className="grid gap-3 sm:grid-cols-2 mb-5">
          <div className="rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-900/20 p-4">
            <p className="text-xs font-medium text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5" /> Total still owed
            </p>
            <p className="text-2xl font-bold text-amber-900 dark:text-amber-200 mt-1">RWF {outstandingTotal.toLocaleString()}</p>
          </div>
          <div className="rounded-xl border border-blue-200 dark:border-blue-900/50 bg-blue-50 dark:bg-blue-900/20 p-4">
            <p className="text-xs font-medium text-blue-700 dark:text-blue-400 flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" /> Payments in progress
            </p>
            <p className="text-2xl font-bold text-blue-900 dark:text-blue-200 mt-1">RWF {pendingTotal.toLocaleString()}</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2 mb-4">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setFilter(t.id)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold border transition-colors ${
                filter === t.id
                  ? "bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 border-slate-900 dark:border-slate-100"
                  : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"
              }`}
            >
              {t.label} ({t.count})
            </button>
          ))}
        </div>

        {loading && rows.length === 0 ? (
          <p className="text-center text-sm text-slate-400 py-10">Loading…</p>
        ) : shown.length === 0 ? (
          <p className="text-center text-sm text-slate-400 py-10">
            No tenant owes money here 🎉
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800 border-b dark:border-slate-700">
                <tr className="text-left text-slate-600 dark:text-slate-300">
                  <th className="px-4 py-2.5 font-semibold">Tenant</th>
                  <th className="px-4 py-2.5 font-semibold">Apartment</th>
                  <th className="px-4 py-2.5 font-semibold">Stay</th>
                  <th className="px-4 py-2.5 font-semibold text-right">Total</th>
                  <th className="px-4 py-2.5 font-semibold text-right">Paid</th>
                  <th className="px-4 py-2.5 font-semibold text-right">Still owed</th>
                  <th className="px-4 py-2.5 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((r) => (
                  <tr
                    key={`${r.tenantId}-${r.bookingId}`}
                    className="border-b last:border-0 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                  >
                    <td className="px-4 py-3">
                      <p className="font-semibold text-slate-900 dark:text-white">{r.tenant}</p>
                      {r.email && (
                        <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                          <Mail className="h-3 w-3" /> {r.email}
                        </p>
                      )}
                      {r.phone && (
                        <p className="text-xs text-slate-500 flex items-center gap-1">
                          <Phone className="h-3 w-3" /> {r.phone}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{r.apartment}</td>
                    <td className="px-4 py-3 text-xs text-slate-500">
                      {r.startDate || "—"}
                      {r.endDate ? ` → ${r.endDate}` : ""}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-700 dark:text-slate-300">{money(r.total)}</td>
                    <td className="px-4 py-3 text-right text-emerald-700 dark:text-emerald-400">{money(r.paid)}</td>
                    <td className="px-4 py-3 text-right font-bold text-amber-700 dark:text-amber-400">
                      {money(r.outstanding)}
                    </td>
                    <td className="px-4 py-3">
                      {r.kind === "pending" ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 px-2.5 py-1 text-xs font-semibold">
                          <Clock className="h-3 w-3" />
                          {r.pendingCount} pending · {money(r.pendingAmount)}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 px-2.5 py-1 text-xs font-semibold">
                          <AlertTriangle className="h-3 w-3" />
                          Remaining {remainderPct}% unpaid
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
