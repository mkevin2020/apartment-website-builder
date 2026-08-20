"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RefreshCw, UserCheck, UserX, Clock, Users, ShieldCheck, ShieldAlert, QrCode } from "lucide-react";

type Row = {
  employeeId: number;
  name: string;
  department: string;
  position: string;
  clockIn: string | null;
  clockOut: string | null;
  status: "present" | "late" | "absent";
  method: string | null;
  verified: boolean;
};

type Summary = { total: number; present: number; late: number; absent: number; verified: number };

function kigaliToday() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Kigali",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

const time = (iso: string | null) =>
  iso ? new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—";

function hours(inIso: string | null, outIso: string | null) {
  if (!inIso || !outIso) return "—";
  const ms = new Date(outIso).getTime() - new Date(inIso).getTime();
  if (ms <= 0) return "—";
  const h = Math.floor(ms / 3_600_000);
  const m = Math.round((ms % 3_600_000) / 60_000);
  return `${h}h ${m}m`;
}

const badge = (status: string) =>
  status === "present"
    ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
    : status === "late"
      ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400"
      : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";

export function AttendanceManager() {
  const [date, setDate] = useState(kigaliToday());
  const [rows, setRows] = useState<Row[]>([]);
  const [summary, setSummary] = useState<Summary>({ total: 0, present: 0, late: 0, absent: 0, verified: 0 });
  const [loading, setLoading] = useState(true);

  const load = async (d: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/attendance/list?date=${d}`, { cache: "no-store" });
      const data = await res.json();
      setRows(data.rows || []);
      setSummary(data.summary || { total: 0, present: 0, late: 0, absent: 0, verified: 0 });
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(date);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  const stats = [
    { label: "Present", value: summary.present, icon: UserCheck, color: "text-green-600", bg: "bg-green-50 dark:bg-green-900/20" },
    { label: "Verified (at office)", value: summary.verified, icon: ShieldCheck, color: "text-indigo-600", bg: "bg-indigo-50 dark:bg-indigo-900/20" },
    { label: "Late", value: summary.late, icon: Clock, color: "text-amber-600", bg: "bg-amber-50 dark:bg-amber-900/20" },
    { label: "Absent", value: summary.absent, icon: UserX, color: "text-red-600", bg: "bg-red-50 dark:bg-red-900/20" },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <Card key={s.label} className="border-0 shadow-sm">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-600 dark:text-slate-400 font-medium">{s.label}</p>
                    <p className="text-3xl font-bold text-slate-900 dark:text-white mt-1">{s.value}</p>
                  </div>
                  <div className={`p-3 rounded-lg ${s.bg}`}>
                    <Icon className={`h-6 w-6 ${s.color}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className="border-0 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between gap-3 flex-wrap">
          <CardTitle>Employee Attendance</CardTitle>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={() => window.open("/attendance/display", "_blank")}
              className="gap-2 bg-indigo-600 hover:bg-indigo-700"
            >
              <QrCode className="h-4 w-4" />
              Show Office QR
            </Button>
            <Input
              type="date"
              value={date}
              max={kigaliToday()}
              onChange={(e) => setDate(e.target.value)}
              className="h-9 w-auto"
            />
            <Button variant="outline" size="sm" onClick={() => load(date)} disabled={loading} className="gap-2">
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800 border-b dark:border-slate-700">
                <tr>
                  <th className="text-left p-3 font-medium">Employee</th>
                  <th className="text-left p-3 font-medium">Department</th>
                  <th className="text-left p-3 font-medium">Clock In</th>
                  <th className="text-left p-3 font-medium">Clock Out</th>
                  <th className="text-left p-3 font-medium">Hours</th>
                  <th className="text-left p-3 font-medium">Status</th>
                  <th className="text-left p-3 font-medium">Verified</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={7} className="text-center text-slate-500 py-8">Loading…</td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center text-slate-500 py-8">No employees found.</td>
                  </tr>
                ) : (
                  rows.map((r) => (
                    <tr key={r.employeeId} className="border-b dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                      <td className="p-3 font-medium text-slate-900 dark:text-white">
                        {r.name}
                        {r.position && <span className="block text-xs text-slate-500">{r.position}</span>}
                      </td>
                      <td className="p-3 capitalize">{r.department}</td>
                      <td className="p-3">{time(r.clockIn)}</td>
                      <td className="p-3">{time(r.clockOut)}</td>
                      <td className="p-3">{hours(r.clockIn, r.clockOut)}</td>
                      <td className="p-3">
                        <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium capitalize ${badge(r.status)}`}>
                          {r.status}
                        </span>
                      </td>
                      <td className="p-3">
                        {r.status === "absent" ? (
                          <span className="text-slate-400 text-xs">—</span>
                        ) : r.verified ? (
                          <span className="inline-flex items-center gap-1 text-green-700 dark:text-green-400 text-xs font-medium">
                            <ShieldCheck className="h-4 w-4" /> Verified
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400 text-xs font-medium" title="Logged in, but did not scan the office code">
                            <ShieldAlert className="h-4 w-4" /> Unverified
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
