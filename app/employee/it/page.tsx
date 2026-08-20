"use client";

import { useEffect, useState, useCallback } from "react";
import { dataClient } from "@/lib/data-client";
import { EmployeeShell } from "@/components/employee/EmployeeShell";
import { StatCard, StatusBadge } from "@/components/employee/widgets";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Building, Users, UserCog, Shield, Calendar, CreditCard, CheckCircle2, KeyRound, Power } from "lucide-react";

const supabase = dataClient();

type AccountTable = "employees" | "managers" | "tenants";

function ITContent() {
  const [counts, setCounts] = useState({ apartments: 0, tenants: 0, employees: 0, managers: 0, bookings: 0, payments: 0 });
  const [staff, setStaff] = useState<any[]>([]);
  const [tenants, setTenants] = useState<any[]>([]);
  const [healthy, setHealthy] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const tables = ["apartments", "tenants", "employees", "managers", "bookings", "tenant_payments"];
    const results = await Promise.all(
      tables.map((t) => supabase.from(t).select("*", { count: "exact", head: true }))
    );
    setCounts({
      apartments: results[0].count || 0,
      tenants: results[1].count || 0,
      employees: results[2].count || 0,
      managers: results[3].count || 0,
      bookings: results[4].count || 0,
      payments: results[5].count || 0,
    });
    if (results.some((r) => r.error)) setHealthy(false);

    const [{ data: emps }, { data: mgrs }, { data: tns }] = await Promise.all([
      supabase.from("employees").select("id, full_name, username, email, department, position, status"),
      supabase.from("managers").select("id, full_name, username, email, department, status"),
      supabase.from("tenants").select("id, full_name, username, email, phone, is_active, approval_status"),
    ]);
    setStaff([
      ...(emps || []).map((e: any) => ({ ...e, _table: "employees" as AccountTable, role: "Employee" })),
      ...(mgrs || []).map((m: any) => ({ ...m, _table: "managers" as AccountTable, role: "Manager", position: m.department })),
    ]);
    setTenants((tns || []).map((t: any) => ({ ...t, _table: "tenants" as AccountTable })));
  }, []);

  useEffect(() => {
    load().catch(() => setHealthy(false));
  }, [load]);

  const resetPassword = async (table: AccountTable, id: number, name: string) => {
    if (!confirm(`Reset password for ${name}? A new temporary password will be generated.`)) return;
    setBusy(`${table}-${id}`);
    try {
      const res = await fetch("/api/it/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ table, id, action: "reset-password" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      alert(`New temporary password for ${name}:\n\n${data.tempPassword}\n\nShare it with the user — they can change it after logging in.`);
    } catch (err: any) {
      alert("Failed to reset password: " + (err?.message || "Unknown error"));
    } finally {
      setBusy(null);
    }
  };

  const setStatus = async (table: AccountTable, id: number, active: boolean) => {
    setBusy(`${table}-${id}`);
    try {
      const res = await fetch("/api/it/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ table, id, action: "set-status", active }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      await load();
    } catch (err: any) {
      alert("Failed to update status: " + (err?.message || "Unknown error"));
    } finally {
      setBusy(null);
    }
  };

  const isActive = (row: any) =>
    row._table === "tenants" ? !!row.is_active : (row.status || "active") === "active";

  const AccountRow = ({ row, extra }: { row: any; extra?: React.ReactNode }) => {
    const active = isActive(row);
    const key = `${row._table}-${row.id}`;
    return (
      <tr className="border-b dark:border-slate-800">
        <td className="p-3 font-medium text-slate-900 dark:text-white">{row.full_name}</td>
        <td className="p-3 font-mono text-xs">{row._table === "tenants" ? row.email : row.username || row.email}</td>
        {extra}
        <td className="p-3"><StatusBadge status={active ? "active" : "inactive"} /></td>
        <td className="p-3">
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" disabled={busy === key}
              onClick={() => resetPassword(row._table, row.id, row.full_name)}>
              <KeyRound className="h-3.5 w-3.5 mr-1" /> Reset Password
            </Button>
            <Button size="sm" disabled={busy === key}
              className={active ? "bg-red-600 hover:bg-red-700" : "bg-green-600 hover:bg-green-700"}
              onClick={() => setStatus(row._table, row.id, !active)}>
              <Power className="h-3.5 w-3.5 mr-1" /> {active ? "Deactivate" : "Activate"}
            </Button>
          </div>
        </td>
      </tr>
    );
  };

  return (
    <div className="space-y-6">
      {/* Platform health */}
      <Card>
        <CardContent className="p-5 flex items-center gap-3">
          <div className={`w-3 h-3 rounded-full ${healthy ? "bg-green-500 animate-pulse" : "bg-red-500"}`} />
          <div>
            <p className="font-semibold text-slate-900 dark:text-white">
              Platform status: {healthy ? "All systems operational" : "Issues detected"}
            </p>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Database {healthy ? "reachable" : "unreachable"} · checked {new Date().toLocaleTimeString()}
            </p>
          </div>
          {healthy && <CheckCircle2 className="h-6 w-6 text-green-500 ml-auto" />}
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <StatCard label="Apartments" value={counts.apartments} icon={<Building className="h-7 w-7 text-violet-500" />} />
        <StatCard label="Tenants" value={counts.tenants} icon={<Users className="h-7 w-7 text-blue-500" />} />
        <StatCard label="Employees" value={counts.employees} icon={<UserCog className="h-7 w-7 text-indigo-500" />} />
        <StatCard label="Managers" value={counts.managers} icon={<Shield className="h-7 w-7 text-emerald-500" />} />
        <StatCard label="Bookings" value={counts.bookings} icon={<Calendar className="h-7 w-7 text-amber-500" />} />
        <StatCard label="Payments" value={counts.payments} icon={<CreditCard className="h-7 w-7 text-pink-500" />} />
      </div>

      {/* Account management */}
      <Tabs defaultValue="staff" className="space-y-4">
        <TabsList>
          <TabsTrigger value="staff">Staff Accounts</TabsTrigger>
          <TabsTrigger value="tenants">Tenant Accounts</TabsTrigger>
        </TabsList>

        <TabsContent value="staff">
          <Card>
            <CardHeader><CardTitle>Staff Accounts ({staff.length})</CardTitle></CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 dark:bg-slate-800 border-b dark:border-slate-700">
                  <tr>
                    <th className="text-left p-3 font-medium">Name</th>
                    <th className="text-left p-3 font-medium">Username</th>
                    <th className="text-left p-3 font-medium">Role / Dept</th>
                    <th className="text-left p-3 font-medium">Status</th>
                    <th className="text-left p-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {staff.length === 0 ? (
                    <tr><td colSpan={5} className="p-6 text-center text-slate-500 dark:text-slate-400">No accounts</td></tr>
                  ) : staff.map((row) => (
                    <AccountRow key={`${row._table}-${row.id}`} row={row}
                      extra={<td className="p-3">{row.role}{row.position ? ` · ${row.position}` : ""}{row.department ? ` · ${row.department}` : ""}</td>} />
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tenants">
          <Card>
            <CardHeader><CardTitle>Tenant Accounts ({tenants.length})</CardTitle></CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 dark:bg-slate-800 border-b dark:border-slate-700">
                  <tr>
                    <th className="text-left p-3 font-medium">Name</th>
                    <th className="text-left p-3 font-medium">Email</th>
                    <th className="text-left p-3 font-medium">Phone</th>
                    <th className="text-left p-3 font-medium">Status</th>
                    <th className="text-left p-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {tenants.length === 0 ? (
                    <tr><td colSpan={5} className="p-6 text-center text-slate-500 dark:text-slate-400">No tenant accounts</td></tr>
                  ) : tenants.map((row) => (
                    <AccountRow key={`${row._table}-${row.id}`} row={row}
                      extra={<td className="p-3">{row.phone || "—"}</td>} />
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function ITDashboard() {
  return <EmployeeShell slug="it">{() => <ITContent />}</EmployeeShell>;
}
