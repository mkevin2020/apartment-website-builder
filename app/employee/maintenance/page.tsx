"use client";

import { useEffect, useState } from "react";
import { dataClient } from "@/lib/data-client";
import { EmployeeShell } from "@/components/employee/EmployeeShell";
import { StatCard, StatusBadge } from "@/components/employee/widgets";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Wrench, Clock, CheckCircle2, Loader2 } from "lucide-react";

const supabase = dataClient();

function MaintenanceContent() {
  const [requests, setRequests] = useState<any[]>([]);
  const [apartmentNames, setApartmentNames] = useState<Record<number, string>>({});
  const [tenantNames, setTenantNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  const fetchRequests = async () => {
    const { data } = await supabase
      .from("maintenance_requests")
      .select("*")
      .order("created_at", { ascending: false });
    const reqs = data || [];
    setRequests(reqs);

    // Resolve apartment + tenant names so the maintenance staff see WHICH apartment
    // and WHO reported it — not just raw IDs.
    const aptIds = Array.from(new Set(reqs.map((r: any) => r.apartment_id).filter(Boolean)));
    const tenantIds = Array.from(new Set(reqs.map((r: any) => r.tenant_id).filter(Boolean)));

    if (aptIds.length) {
      const { data: apts } = await supabase
        .from("apartments")
        .select("id, name, unit_number")
        .in("id", aptIds);
      const map: Record<number, string> = {};
      (apts || []).forEach((a: any) => {
        map[a.id] = a.unit_number ? `${a.name} (Unit ${a.unit_number})` : a.name;
      });
      setApartmentNames(map);
    }

    if (tenantIds.length) {
      const { data: tenants } = await supabase
        .from("tenants")
        .select("id, full_name")
        .in("id", tenantIds);
      const map: Record<string, string> = {};
      (tenants || []).forEach((t: any) => {
        map[t.id] = t.full_name;
      });
      setTenantNames(map);
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  const setStatus = async (id: string, status: string) => {
    await supabase.from("maintenance_requests").update({ status }).eq("id", id);
    fetchRequests();
  };

  const norm = (s: string) => (s || "").toLowerCase();
  const open = requests.filter((r) => norm(r.status) === "pending").length;
  const inProgress = requests.filter((r) => norm(r.status) === "in-progress").length;
  const done = requests.filter((r) => ["completed", "resolved"].includes(norm(r.status))).length;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <StatCard label="Open" value={open} color="text-yellow-600" icon={<Clock className="h-7 w-7 text-yellow-500" />} />
        <StatCard label="In Progress" value={inProgress} color="text-blue-600" icon={<Loader2 className="h-7 w-7 text-blue-500" />} />
        <StatCard label="Resolved" value={done} color="text-green-600" icon={<CheckCircle2 className="h-7 w-7 text-green-500" />} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wrench className="h-5 w-5 text-amber-500" /> Maintenance Requests
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-center text-slate-500 py-8">Loading…</p>
          ) : requests.length === 0 ? (
            <p className="text-center text-slate-500 dark:text-slate-400 py-8">No maintenance requests right now. 🎉</p>
          ) : (
            <div className="space-y-3">
              {requests.map((r) => (
                <div key={r.id} className="border border-slate-200 dark:border-slate-700 rounded-xl p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-slate-900 dark:text-white">
                        {r.issue_type || r.title || r.issue || r.category || "Maintenance request"}
                      </p>
                      {r.apartment_id && (
                        <p className="text-sm font-medium text-amber-600 dark:text-amber-400 mt-0.5">
                          🏠 {apartmentNames[r.apartment_id] || `Apartment #${r.apartment_id}`}
                        </p>
                      )}
                      {(r.description || r.details) && (
                        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">{r.description || r.details}</p>
                      )}
                      <p className="text-xs text-slate-400 mt-2">
                        {r.priority ? `Priority: ${String(r.priority).toUpperCase()} · ` : ""}
                        {r.tenant_id && tenantNames[r.tenant_id] ? `Reported by ${tenantNames[r.tenant_id]} · ` : ""}
                        {r.created_at ? new Date(r.created_at).toLocaleString() : ""}
                      </p>
                    </div>
                    <StatusBadge status={r.status || "pending"} />
                  </div>
                  <div className="flex flex-wrap gap-2 mt-3">
                    <Button size="sm" variant="outline" onClick={() => setStatus(r.id, "pending")}>Mark Pending</Button>
                    <Button size="sm" className="bg-blue-600 hover:bg-blue-700" onClick={() => setStatus(r.id, "in-progress")}>Start Work</Button>
                    <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={() => setStatus(r.id, "completed")}>Mark Resolved</Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function MaintenanceDashboard() {
  return <EmployeeShell slug="maintenance">{() => <MaintenanceContent />}</EmployeeShell>;
}
