"use client";

import { useEffect, useState } from "react";
import { dataClient } from "@/lib/data-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CalendarClock, Printer, Save, RotateCcw, Lock, UserCog } from "lucide-react";

const WEEKDAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;

type DaySchedule = {
  start_time: string; // "08:00"
  end_time: string; // "17:00"
  is_off: boolean;
};

type WeekSchedule = Record<string, DaySchedule>; // keyed by weekday

interface EmployeeScheduleManagerProps {
  /** Employees see the roster but cannot change it — only the manager can. */
  readOnly?: boolean;
  /** Highlights this employee's row so they can find themselves quickly. */
  highlightEmployeeId?: number;
}

// Per-employee, per-day working hours in a weekly grid.
// Manager (default): every cell is editable and changes save in one batch.
// readOnly: the same grid rendered as plain text — used on the employee
// dashboards so staff can see the roster without being able to edit it.
// "Print" produces the weekly roster to hand out or pin on the wall.
export function EmployeeScheduleManager({
  readOnly = false,
  highlightEmployeeId,
}: EmployeeScheduleManagerProps = {}) {
  const [employees, setEmployees] = useState<any[]>([]);
  const [schedules, setSchedules] = useState<Record<number, WeekSchedule>>({});
  const [dirty, setDirty] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [lastChange, setLastChange] = useState<{ name: string; at: string } | null>(null);

  const supabase = dataClient();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const { data: emps, error: empError } = await supabase
        .from("employees")
        .select("id, full_name, position, department, status")
        .neq("status", "inactive")
        .order("full_name");
      if (empError) throw empError;

      // select("*") rather than naming columns, so this still works before
      // scripts/028 adds the updated_by_* attribution columns.
      const { data: rows, error: schedError } = await supabase
        .from("employee_schedules")
        .select("*");
      if (schedError) {
        setLoadError(
          "The schedule table is missing. Run scripts/027-employee-schedules.sql in the Supabase SQL Editor, then reload."
        );
        setEmployees(emps || []);
        return;
      }

      const byEmployee: Record<number, WeekSchedule> = {};
      for (const emp of emps || []) {
        const week: WeekSchedule = {};
        for (const day of WEEKDAYS) {
          const row = (rows || []).find(
            (r: any) => r.employee_id === emp.id && r.weekday === day
          );
          week[day] = {
            start_time: (row?.start_time || "08:00").slice(0, 5),
            end_time: (row?.end_time || "17:00").slice(0, 5),
            is_off: row?.is_off ?? day === "Sunday",
          };
        }
        byEmployee[emp.id] = week;
      }

      // Who touched the roster most recently (shown to managers and staff alike).
      // Absent until scripts/028 has been run — then the line simply appears.
      let latest: { name: string; at: string } | null = null;
      for (const r of (rows || []) as any[]) {
        if (!r.updated_by_name || !r.updated_at) continue;
        if (!latest || r.updated_at > latest.at) {
          latest = { name: r.updated_by_name, at: r.updated_at };
        }
      }
      setLastChange(latest);

      setEmployees(emps || []);
      setSchedules(byEmployee);
      setDirty(new Set());
    } catch (err: any) {
      console.error("Error loading schedule:", err);
      setLoadError("Failed to load the schedule. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const updateCell = (employeeId: number, day: string, patch: Partial<DaySchedule>) => {
    if (readOnly) return; // employees can view the roster, only the manager edits it
    setSchedules((prev) => ({
      ...prev,
      [employeeId]: {
        ...prev[employeeId],
        [day]: { ...prev[employeeId][day], ...patch },
      },
    }));
    setDirty((prev) => new Set(prev).add(`${employeeId}|${day}`));
  };

  const saveChanges = async () => {
    if (readOnly || dirty.size === 0) return;
    setSaving(true);
    try {
      // Whoever is signed in gets stamped on the change, so staff can see which
      // manager altered the roster rather than it changing silently.
      let who: { name: string; id: number | null; role: string } = {
        name: "A manager",
        id: null,
        role: "manager",
      };
      try {
        const raw =
          localStorage.getItem("manager_session") || localStorage.getItem("admin_session");
        if (raw) {
          const u = JSON.parse(raw);
          who = {
            name: u.full_name || u.username || "A manager",
            id: u.id ?? null,
            role: localStorage.getItem("manager_session") ? "manager" : "admin",
          };
        }
      } catch {
        /* fall back to the generic label */
      }

      const base = Array.from(dirty).map((key) => {
        const [employeeId, day] = key.split("|");
        const cell = schedules[Number(employeeId)][day];
        return {
          employee_id: Number(employeeId),
          weekday: day,
          start_time: cell.start_time,
          end_time: cell.end_time,
          is_off: cell.is_off,
          updated_at: new Date().toISOString(),
        };
      });

      const withWho = base.map((r) => ({
        ...r,
        updated_by_name: who.name,
        updated_by_id: who.id,
        updated_by_role: who.role,
      }));

      let { error } = await supabase
        .from("employee_schedules")
        .upsert(withWho, { onConflict: "employee_id,weekday" });

      // scripts/028 not run yet → the attribution columns don't exist. Save the
      // schedule anyway; the roster matters more than knowing who changed it.
      if (error && /updated_by|column|schema cache/i.test(error.message || "")) {
        console.warn(
          "Schedule attribution columns missing — run scripts/028-schedule-updated-by.sql. Saving without them."
        );
        ({ error } = await supabase
          .from("employee_schedules")
          .upsert(base, { onConflict: "employee_id,weekday" }));
      }

      if (error) throw error;
      setLastChange({ name: who.name, at: new Date().toISOString() });
      setDirty(new Set());
    } catch (err: any) {
      console.error("Error saving schedule:", err);
      alert("Failed to save the schedule: " + (err?.message || "unknown error"));
    } finally {
      setSaving(false);
    }
  };

  // Printable weekly roster (same pattern as the manager reports).
  const printSchedule = () => {
    const esc = (s: any) =>
      String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const win = window.open("", "_blank", "width=1000,height=700");
    if (!win) return;
    const rowsHtml = employees
      .map((emp) => {
        const week = schedules[emp.id];
        if (!week) return "";
        const cells = WEEKDAYS.map((day) => {
          const c = week[day];
          return c.is_off
            ? `<td class="off">OFF</td>`
            : `<td>${esc(c.start_time)} – ${esc(c.end_time)}</td>`;
        }).join("");
        return `<tr><td class="name">${esc(emp.full_name)}<div class="pos">${esc(
          emp.position || ""
        )}</div></td>${cells}</tr>`;
      })
      .join("");
    win.document.write(`<!doctype html><html><head><title>Weekly Work Schedule</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 24px; color: #0f172a; }
        h1 { font-size: 20px; margin-bottom: 4px; }
        .sub { color: #64748b; font-size: 12px; margin-bottom: 16px; }
        table { border-collapse: collapse; width: 100%; font-size: 13px; }
        th, td { border: 1px solid #cbd5e1; padding: 8px 10px; text-align: center; }
        th { background: #f1f5f9; }
        td.name { text-align: left; font-weight: bold; }
        td.name .pos { font-weight: normal; color: #64748b; font-size: 11px; }
        td.off { background: #fee2e2; color: #b91c1c; font-weight: bold; }
        @media print { body { padding: 0; } }
      </style></head><body>
      <h1>Cielo Vista — Weekly Work Schedule</h1>
      <div class="sub">Generated on ${esc(new Date().toLocaleString())}</div>
      <table>
        <thead><tr><th>Employee</th>${WEEKDAYS.map((d) => `<th>${d}</th>`).join("")}</tr></thead>
        <tbody>${rowsHtml}</tbody>
      </table>
      <script>window.onload = () => window.print()</script>
      </body></html>`);
    win.document.close();
  };

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-3">
        <CardTitle className="flex items-center gap-2">
          <CalendarClock className="h-5 w-5 text-blue-600" />
          Work Schedule
          {readOnly && (
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2.5 py-1 text-xs font-semibold">
              <Lock className="h-3 w-3" /> View only
            </span>
          )}
        </CardTitle>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchData} disabled={loading || saving}>
            <RotateCcw className="h-4 w-4 mr-1" /> Reload
          </Button>
          <Button variant="outline" size="sm" onClick={printSchedule} disabled={loading || !!loadError}>
            <Printer className="h-4 w-4 mr-1" /> Print
          </Button>
          {/* Saving is the manager's alone — the button isn't rendered for staff. */}
          {!readOnly && (
            <Button
              size="sm"
              onClick={saveChanges}
              disabled={saving || dirty.size === 0}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              <Save className="h-4 w-4 mr-1" />
              {saving ? "Saving…" : dirty.size > 0 ? `Save Changes (${dirty.size})` : "Saved"}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {/* Who last changed the roster — so a change never appears out of nowhere.
            Only rendered once scripts/028 has stamped a name on a row. */}
        {lastChange && (
          <div className="mb-4 flex items-start gap-2 rounded-xl border border-blue-200 dark:border-blue-900/50 bg-blue-50 dark:bg-blue-900/20 px-4 py-2.5">
            <UserCog className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-blue-900 dark:text-blue-200">
              Last changed by <span className="font-semibold">{lastChange.name}</span>
              <span className="text-blue-700/70 dark:text-blue-300/70">
                {" · "}
                {new Date(lastChange.at).toLocaleString()}
              </span>
            </p>
          </div>
        )}

        {loading ? (
          <div className="p-6 text-center text-slate-500">Loading schedule…</div>
        ) : loadError ? (
          <div className="p-6 text-center text-red-600">{loadError}</div>
        ) : employees.length === 0 ? (
          <div className="p-6 text-center text-slate-500">No employees found</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800 border-b">
                  <th className="text-left p-3 font-medium sticky left-0 bg-slate-50 dark:bg-slate-800">
                    Employee
                  </th>
                  {WEEKDAYS.map((day) => (
                    <th key={day} className="p-3 font-medium text-center min-w-[130px]">
                      {day}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {employees.map((emp) => {
                  const week = schedules[emp.id];
                  if (!week) return null;
                  const isMe = highlightEmployeeId != null && emp.id === highlightEmployeeId;
                  return (
                    <tr
                      key={emp.id}
                      className={`border-b align-top ${
                        isMe ? "bg-blue-50/70 dark:bg-blue-900/20" : ""
                      }`}
                    >
                      <td
                        className={`p-3 font-medium sticky left-0 ${
                          isMe ? "bg-blue-50 dark:bg-blue-900/30" : "bg-white dark:bg-slate-950"
                        }`}
                      >
                        {emp.full_name}
                        {isMe && (
                          <span className="ml-2 rounded-full bg-blue-600 text-white px-2 py-0.5 text-[10px] font-bold align-middle">
                            YOU
                          </span>
                        )}
                        <div className="text-xs font-normal text-slate-500">
                          {emp.position || emp.department || ""}
                        </div>
                      </td>
                      {WEEKDAYS.map((day) => {
                        const cell = week[day];

                        // Read-only: plain text, no inputs and nothing clickable.
                        if (readOnly) {
                          return (
                            <td key={day} className="p-2 text-center">
                              {cell.is_off ? (
                                <span className="inline-block w-full rounded-lg bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 font-semibold text-xs py-3">
                                  OFF
                                </span>
                              ) : (
                                <span className="inline-block w-full rounded-lg bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-200 text-xs py-3 font-medium">
                                  {cell.start_time} – {cell.end_time}
                                </span>
                              )}
                            </td>
                          );
                        }

                        return (
                          <td key={day} className="p-2 text-center">
                            {cell.is_off ? (
                              <button
                                onClick={() => updateCell(emp.id, day, { is_off: false })}
                                title="Click to make this a working day"
                                className="w-full rounded-lg bg-red-100 text-red-700 font-semibold text-xs py-3 hover:bg-red-200 transition-colors"
                              >
                                OFF
                              </button>
                            ) : (
                              <div className="space-y-1">
                                <input
                                  type="time"
                                  value={cell.start_time}
                                  onChange={(e) =>
                                    updateCell(emp.id, day, { start_time: e.target.value })
                                  }
                                  className="w-full rounded border border-slate-200 dark:border-slate-700 bg-transparent px-1 py-0.5 text-xs text-center"
                                />
                                <input
                                  type="time"
                                  value={cell.end_time}
                                  onChange={(e) =>
                                    updateCell(emp.id, day, { end_time: e.target.value })
                                  }
                                  className="w-full rounded border border-slate-200 dark:border-slate-700 bg-transparent px-1 py-0.5 text-xs text-center"
                                />
                                <button
                                  onClick={() => updateCell(emp.id, day, { is_off: true })}
                                  className="text-[10px] text-slate-400 hover:text-red-600"
                                >
                                  set off
                                </button>
                              </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
