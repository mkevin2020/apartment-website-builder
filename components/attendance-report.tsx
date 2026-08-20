"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ClipboardCheck, Printer, RotateCcw, TrendingUp, Clock, UserX } from "lucide-react";

type Row = {
  employeeId: number;
  name: string;
  department: string;
  position: string;
  expected: number;
  attended: number;
  present: number;
  late: number;
  absent: number;
  verified: number;
  hours: number;
  rate: number;
  punctuality: number;
  lastSeen: string | null;
};

type Totals = {
  employees: number;
  expected: number;
  attended: number;
  late: number;
  absent: number;
  hours: number;
  rate: number;
};

const EMPTY: Totals = { employees: 0, expected: 0, attended: 0, late: 0, absent: 0, hours: 0, rate: 0 };

// Kigali is UTC+2, no DST.
const kigaliToday = () => new Date(Date.now() + 2 * 3600 * 1000).toISOString().slice(0, 10);
const daysAgo = (n: number) =>
  new Date(Date.now() + 2 * 3600 * 1000 - n * 86400000).toISOString().slice(0, 10);

const rateTone = (rate: number) =>
  rate >= 80
    ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"
    : rate >= 50
      ? "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
      : "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300";

// How reliably each employee turns up over a date range: expected working days
// (from their schedule), how many they actually attended, lateness and hours.
export function AttendanceReport() {
  const [from, setFrom] = useState(daysAgo(29));
  const [to, setTo] = useState(kigaliToday());
  const [rows, setRows] = useState<Row[]>([]);
  const [totals, setTotals] = useState<Totals>(EMPTY);
  const [usedSchedule, setUsedSchedule] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async (f = from, t = to) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/attendance/report?from=${f}&to=${t}`, { cache: "no-store" });
      const data = await res.json();
      if (data.error) {
        setError(data.error);
        return;
      }
      setRows(data.rows || []);
      setTotals(data.totals || EMPTY);
      setUsedSchedule(!!data.usedSchedule);
    } catch {
      setError("Could not load the attendance report.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const printReport = () => {
    const esc = (s: any) =>
      String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const win = window.open("", "_blank", "width=1000,height=700");
    if (!win) return;
    const body = rows
      .map(
        (r) => `<tr>
          <td class="name">${esc(r.name)}<div class="pos">${esc(r.department)}</div></td>
          <td>${r.expected}</td><td>${r.attended}</td><td>${r.late}</td>
          <td class="${r.absent > 0 ? "bad" : ""}">${r.absent}</td>
          <td><b>${r.rate}%</b></td><td>${r.hours}</td>
          <td>${esc(r.lastSeen || "never")}</td>
        </tr>`
      )
      .join("");
    win.document.write(`<!doctype html><html><head><title>Attendance Report</title><style>
      body { font-family: Arial, sans-serif; padding: 24px; color: #0f172a; }
      h1 { font-size: 20px; margin-bottom: 4px; }
      .sub { color: #64748b; font-size: 12px; margin-bottom: 16px; }
      .cards { display: flex; gap: 12px; margin-bottom: 18px; flex-wrap: wrap; }
      .card { border: 1px solid #cbd5e1; border-radius: 8px; padding: 10px 14px; min-width: 120px; }
      .card .l { color: #64748b; font-size: 11px; text-transform: uppercase; }
      .card .v { font-size: 18px; font-weight: bold; }
      table { border-collapse: collapse; width: 100%; font-size: 13px; }
      th, td { border: 1px solid #cbd5e1; padding: 8px 10px; text-align: center; }
      th { background: #f1f5f9; }
      td.name { text-align: left; font-weight: bold; }
      td.name .pos { font-weight: normal; color: #64748b; font-size: 11px; }
      td.bad { background: #fee2e2; color: #b91c1c; font-weight: bold; }
      @media print { body { padding: 0; } }
    </style></head><body>
      <h1>Cielo Vista — Attendance Report</h1>
      <div class="sub">${esc(from)} to ${esc(to)} · generated ${esc(new Date().toLocaleString())}</div>
      <div class="cards">
        <div class="card"><div class="l">Attendance</div><div class="v">${totals.rate}%</div></div>
        <div class="card"><div class="l">Days attended</div><div class="v">${totals.attended} / ${totals.expected}</div></div>
        <div class="card"><div class="l">Late arrivals</div><div class="v">${totals.late}</div></div>
        <div class="card"><div class="l">Absences</div><div class="v">${totals.absent}</div></div>
        <div class="card"><div class="l">Hours logged</div><div class="v">${totals.hours}</div></div>
      </div>
      <table>
        <thead><tr><th>Employee</th><th>Expected</th><th>Attended</th><th>Late</th><th>Absent</th><th>Rate</th><th>Hours</th><th>Last seen</th></tr></thead>
        <tbody>${body || '<tr><td colspan="8">No data</td></tr>'}</tbody>
      </table>
      <script>window.onload = () => window.print()</script>
    </body></html>`);
    win.document.close();
  };

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-3">
        <CardTitle className="flex items-center gap-2">
          <ClipboardCheck className="h-5 w-5 text-indigo-600" />
          Attendance Report
        </CardTitle>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="date"
            value={from}
            max={to}
            onChange={(e) => setFrom(e.target.value)}
            className="rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent px-2 py-1.5 text-sm"
          />
          <span className="text-slate-400 text-sm">to</span>
          <input
            type="date"
            value={to}
            min={from}
            max={kigaliToday()}
            onChange={(e) => setTo(e.target.value)}
            className="rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent px-2 py-1.5 text-sm"
          />
          <Button size="sm" onClick={() => load()} disabled={loading} className="bg-indigo-600 hover:bg-indigo-700 text-white">
            <RotateCcw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} /> Apply
          </Button>
          <Button variant="outline" size="sm" onClick={printReport} disabled={loading || rows.length === 0}>
            <Printer className="h-4 w-4 mr-1" /> Print
          </Button>
        </div>
      </CardHeader>

      <CardContent>
        {/* Quick ranges */}
        <div className="flex flex-wrap gap-2 mb-5">
          {[
            { label: "Last 7 days", f: daysAgo(6) },
            { label: "Last 30 days", f: daysAgo(29) },
            { label: "Last 90 days", f: daysAgo(89) },
          ].map((q) => (
            <button
              key={q.label}
              onClick={() => {
                const t = kigaliToday();
                setFrom(q.f);
                setTo(t);
                load(q.f, t);
              }}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold border transition-colors ${
                from === q.f && to === kigaliToday()
                  ? "bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 border-slate-900 dark:border-slate-100"
                  : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"
              }`}
            >
              {q.label}
            </button>
          ))}
        </div>

        {/* Summary */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 mb-5">
          <div className="rounded-xl border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50 dark:bg-emerald-900/20 p-4">
            <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
              <TrendingUp className="h-3.5 w-3.5" /> Overall attendance
            </p>
            <p className="text-2xl font-bold text-emerald-900 dark:text-emerald-200 mt-1">{totals.rate}%</p>
            <p className="text-xs text-emerald-700/70 dark:text-emerald-400/70 mt-0.5">
              {totals.attended} of {totals.expected} expected days
            </p>
          </div>
          <div className="rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-900/20 p-4">
            <p className="text-xs font-medium text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" /> Late arrivals
            </p>
            <p className="text-2xl font-bold text-amber-900 dark:text-amber-200 mt-1">{totals.late}</p>
          </div>
          <div className="rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-900/20 p-4">
            <p className="text-xs font-medium text-red-700 dark:text-red-400 flex items-center gap-1.5">
              <UserX className="h-3.5 w-3.5" /> Absences
            </p>
            <p className="text-2xl font-bold text-red-900 dark:text-red-200 mt-1">{totals.absent}</p>
          </div>
          <div className="rounded-xl border border-blue-200 dark:border-blue-900/50 bg-blue-50 dark:bg-blue-900/20 p-4">
            <p className="text-xs font-medium text-blue-700 dark:text-blue-400">Hours logged</p>
            <p className="text-2xl font-bold text-blue-900 dark:text-blue-200 mt-1">{totals.hours}</p>
          </div>
        </div>

        {!usedSchedule && (
          <p className="mb-4 text-xs text-slate-500">
            No work schedule found — expected days assume Monday–Saturday.
          </p>
        )}

        {loading && rows.length === 0 ? (
          <p className="text-center text-sm text-slate-400 py-10">Loading…</p>
        ) : error ? (
          <p className="text-center text-sm text-red-600 py-10">{error}</p>
        ) : rows.length === 0 ? (
          <p className="text-center text-sm text-slate-400 py-10">No employees found</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800 border-b dark:border-slate-700">
                <tr className="text-left text-slate-600 dark:text-slate-300">
                  <th className="p-3 font-semibold">Employee</th>
                  <th className="p-3 font-semibold text-center">Expected</th>
                  <th className="p-3 font-semibold text-center">Attended</th>
                  <th className="p-3 font-semibold text-center">Late</th>
                  <th className="p-3 font-semibold text-center">Absent</th>
                  <th className="p-3 font-semibold">Attendance</th>
                  <th className="p-3 font-semibold text-center">Hours</th>
                  <th className="p-3 font-semibold">Last seen</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.employeeId} className="border-b last:border-0 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <td className="p-3">
                      <p className="font-semibold text-slate-900 dark:text-white">{r.name}</p>
                      <p className="text-xs text-slate-500">{r.position || r.department}</p>
                    </td>
                    <td className="p-3 text-center text-slate-600 dark:text-slate-300">{r.expected}</td>
                    <td className="p-3 text-center font-medium text-emerald-700 dark:text-emerald-400">{r.attended}</td>
                    <td className="p-3 text-center text-amber-700 dark:text-amber-400">{r.late}</td>
                    <td className="p-3 text-center text-red-700 dark:text-red-400">{r.absent}</td>
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-20 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                          <div
                            className={`h-full ${r.rate >= 80 ? "bg-emerald-500" : r.rate >= 50 ? "bg-amber-500" : "bg-red-500"}`}
                            style={{ width: `${Math.min(100, r.rate)}%` }}
                          />
                        </div>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${rateTone(r.rate)}`}>{r.rate}%</span>
                      </div>
                    </td>
                    <td className="p-3 text-center text-slate-600 dark:text-slate-300">{r.hours}</td>
                    <td className="p-3 text-xs text-slate-500">{r.lastSeen || "never"}</td>
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
