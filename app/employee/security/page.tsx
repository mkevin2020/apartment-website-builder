"use client";

import { useEffect, useState } from "react";
import { dataClient } from "@/lib/data-client";
import { EmployeeShell } from "@/components/employee/EmployeeShell";
import { StatCard, StatusBadge } from "@/components/employee/widgets";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Home, DoorOpen, LogIn, LogOut } from "lucide-react";

const supabase = dataClient();

const isToday = (d?: string) => {
  if (!d) return false;
  const x = new Date(d);
  const t = new Date();
  return x.toDateString() === t.toDateString();
};

function SecurityContent() {
  const [apartments, setApartments] = useState<any[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [{ data: apts }, { data: bks }] = await Promise.all([
        supabase.from("apartments").select("*"),
        supabase.from("bookings").select("*").order("start_date", { ascending: false }).limit(50),
      ]);
      setApartments(apts || []);
      setBookings(bks || []);
      setLoading(false);
    })();
  }, []);

  const occupied = apartments.filter((a) => !a.is_available);
  const available = apartments.filter((a) => a.is_available);
  const checkInsToday = bookings.filter((b) => isToday(b.start_date)).length;
  const checkOutsToday = bookings.filter((b) => isToday(b.end_date)).length;

  // latest booking per apartment for occupant name
  const occupantOf = (apartmentId: number) =>
    bookings.find((b) => String(b.apartment_id) === String(apartmentId));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Occupied Units" value={occupied.length} color="text-orange-600" icon={<Home className="h-7 w-7 text-orange-500" />} />
        <StatCard label="Available Units" value={available.length} color="text-green-600" icon={<DoorOpen className="h-7 w-7 text-green-500" />} />
        <StatCard label="Check-ins Today" value={checkInsToday} color="text-blue-600" icon={<LogIn className="h-7 w-7 text-blue-500" />} />
        <StatCard label="Check-outs Today" value={checkOutsToday} color="text-purple-600" icon={<LogOut className="h-7 w-7 text-purple-500" />} />
      </div>

      {/* Currently occupied */}
      <Card>
        <CardHeader><CardTitle>Currently Occupied Units</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          {loading ? <p className="text-center text-slate-500 py-8">Loading…</p> : occupied.length === 0 ? (
            <p className="text-center text-slate-500 dark:text-slate-400 py-8">No occupied units.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800 border-b dark:border-slate-700">
                <tr>
                  <th className="text-left p-3 font-medium">Apartment</th>
                  <th className="text-left p-3 font-medium">Occupant</th>
                  <th className="text-left p-3 font-medium">Check-in</th>
                  <th className="text-left p-3 font-medium">Check-out</th>
                </tr>
              </thead>
              <tbody>
                {occupied.map((a) => {
                  const b = occupantOf(a.id);
                  return (
                    <tr key={a.id} className="border-b dark:border-slate-800">
                      <td className="p-3 font-medium text-slate-900 dark:text-white">{a.name}</td>
                      <td className="p-3">{b?.client_name || "—"}</td>
                      <td className="p-3">{b?.start_date ? new Date(b.start_date).toLocaleDateString() : "—"}</td>
                      <td className="p-3">{b?.end_date ? new Date(b.end_date).toLocaleDateString() : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {/* Check-in / out activity */}
      <Card>
        <CardHeader><CardTitle>Recent Check-in / Check-out Activity</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          {bookings.length === 0 ? (
            <p className="text-center text-slate-500 dark:text-slate-400 py-8">No booking activity.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800 border-b dark:border-slate-700">
                <tr>
                  <th className="text-left p-3 font-medium">Guest</th>
                  <th className="text-left p-3 font-medium">Phone</th>
                  <th className="text-left p-3 font-medium">Check-in</th>
                  <th className="text-left p-3 font-medium">Check-out</th>
                  <th className="text-left p-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {bookings.slice(0, 15).map((b) => (
                  <tr key={b.id} className="border-b dark:border-slate-800">
                    <td className="p-3 font-medium text-slate-900 dark:text-white">{b.client_name}</td>
                    <td className="p-3">{b.phone_number || "—"}</td>
                    <td className="p-3">{b.start_date ? new Date(b.start_date).toLocaleDateString() : "—"}</td>
                    <td className="p-3">{b.end_date ? new Date(b.end_date).toLocaleDateString() : "—"}</td>
                    <td className="p-3"><StatusBadge status={b.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function SecurityDashboard() {
  return <EmployeeShell slug="security">{() => <SecurityContent />}</EmployeeShell>;
}
