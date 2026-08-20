"use client";

import { useEffect, useState } from "react";
import { dataClient } from "@/lib/data-client";
import { EmployeeShell } from "@/components/employee/EmployeeShell";
import { StatCard } from "@/components/employee/widgets";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles, CheckCircle2, ClipboardList } from "lucide-react";

const supabase = dataClient();

// Cleaning is tracked per day in localStorage (no schema change needed).
const todayKey = () => `cleaning_done_${new Date().toISOString().slice(0, 10)}`;

function CleaningContent() {
  const [apartments, setApartments] = useState<any[]>([]);
  const [done, setDone] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("apartments").select("*").order("name");
      setApartments(data || []);
      setLoading(false);
    })();
    try {
      setDone(JSON.parse(localStorage.getItem(todayKey()) || "{}"));
    } catch {
      setDone({});
    }
  }, []);

  const toggle = (id: number) => {
    setDone((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      localStorage.setItem(todayKey(), JSON.stringify(next));
      return next;
    });
  };

  const cleaned = apartments.filter((a) => done[a.id]).length;
  const pending = apartments.length - cleaned;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <StatCard label="Total Units" value={apartments.length} icon={<ClipboardList className="h-7 w-7 text-cyan-500" />} />
        <StatCard label="Cleaned Today" value={cleaned} color="text-green-600" icon={<CheckCircle2 className="h-7 w-7 text-green-500" />} />
        <StatCard label="Pending" value={pending} color="text-orange-600" icon={<Sparkles className="h-7 w-7 text-orange-500" />} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-cyan-500" /> Today&apos;s Cleaning Checklist
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-center text-slate-500 py-8">Loading…</p>
          ) : apartments.length === 0 ? (
            <p className="text-center text-slate-500 dark:text-slate-400 py-8">No apartments found.</p>
          ) : (
            <div className="space-y-2">
              {apartments.map((a) => {
                const isDone = !!done[a.id];
                return (
                  <div
                    key={a.id}
                    className={`flex items-center justify-between rounded-xl border p-4 transition-colors ${
                      isDone
                        ? "border-green-200 bg-green-50 dark:border-green-900/40 dark:bg-green-900/20"
                        : "border-slate-200 dark:border-slate-700"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => toggle(a.id)}
                        className={`w-6 h-6 rounded-md border-2 flex items-center justify-center ${
                          isDone ? "bg-green-500 border-green-500 text-white" : "border-slate-300 dark:border-slate-600"
                        }`}
                        aria-label="Toggle cleaned"
                      >
                        {isDone && <CheckCircle2 className="h-4 w-4" />}
                      </button>
                      <div>
                        <p className={`font-medium ${isDone ? "line-through text-slate-400" : "text-slate-900 dark:text-white"}`}>
                          {a.name}
                        </p>
                        <p className="text-xs text-slate-400">
                          {a.type || "Apartment"} · {a.is_available ? "Vacant" : "Occupied"}
                        </p>
                      </div>
                    </div>
                    <Button size="sm" variant={isDone ? "outline" : "default"} onClick={() => toggle(a.id)}>
                      {isDone ? "Undo" : "Mark Cleaned"}
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
          <p className="text-xs text-slate-400 mt-4">
            Checklist resets daily. Progress is saved on this device.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export default function CleaningDashboard() {
  return <EmployeeShell slug="cleaning">{() => <CleaningContent />}</EmployeeShell>;
}
