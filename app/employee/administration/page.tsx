"use client";

import { useEffect, useState } from "react";
import { dataClient } from "@/lib/data-client";
import { EmployeeShell } from "@/components/employee/EmployeeShell";
import { StatCard, StatusBadge } from "@/components/employee/widgets";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar, Users, MessageSquare, Clock } from "lucide-react";

const supabase = dataClient();

function AdminContent() {
  const [bookings, setBookings] = useState<any[]>([]);
  const [tenants, setTenants] = useState<any[]>([]);
  const [feedback, setFeedback] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const [{ data: bks }, { data: tns }, { data: fb }] = await Promise.all([
        supabase.from("bookings").select("*").order("created_at", { ascending: false }),
        supabase.from("tenants").select("*").eq("approval_status", "approved").order("created_at", { ascending: false }),
        supabase.from("client_feedback").select("*").order("created_at", { ascending: false }).limit(20),
      ]);
      setBookings(bks || []);
      setTenants(tns || []);
      setFeedback(fb || []);
    })();
  }, []);

  const pendingBookings = bookings.filter((b) => (b.status || "").toLowerCase() === "pending").length;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total Bookings" value={bookings.length} icon={<Calendar className="h-7 w-7 text-emerald-500" />} />
        <StatCard label="Pending Bookings" value={pendingBookings} color="text-yellow-600" icon={<Clock className="h-7 w-7 text-yellow-500" />} />
        <StatCard label="Active Tenants" value={tenants.length} color="text-blue-600" icon={<Users className="h-7 w-7 text-blue-500" />} />
        <StatCard label="Feedback" value={feedback.length} color="text-purple-600" icon={<MessageSquare className="h-7 w-7 text-purple-500" />} />
      </div>

      <Tabs defaultValue="bookings" className="space-y-4">
        <TabsList>
          <TabsTrigger value="bookings">Bookings</TabsTrigger>
          <TabsTrigger value="tenants">Tenants</TabsTrigger>
          <TabsTrigger value="feedback">Feedback</TabsTrigger>
        </TabsList>

        <TabsContent value="bookings">
          <Card>
            <CardHeader><CardTitle>Bookings</CardTitle></CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 dark:bg-slate-800 border-b dark:border-slate-700">
                  <tr>
                    <th className="text-left p-3 font-medium">Guest</th>
                    <th className="text-left p-3 font-medium">Email</th>
                    <th className="text-left p-3 font-medium">Check-in</th>
                    <th className="text-left p-3 font-medium">Check-out</th>
                    <th className="text-left p-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {bookings.length === 0 ? (
                    <tr><td colSpan={5} className="p-6 text-center text-slate-500 dark:text-slate-400">No bookings</td></tr>
                  ) : bookings.map((b) => (
                    <tr key={b.id} className="border-b dark:border-slate-800">
                      <td className="p-3 font-medium text-slate-900 dark:text-white">{b.client_name}</td>
                      <td className="p-3">{b.email}</td>
                      <td className="p-3">{b.start_date ? new Date(b.start_date).toLocaleDateString() : "—"}</td>
                      <td className="p-3">{b.end_date ? new Date(b.end_date).toLocaleDateString() : "—"}</td>
                      <td className="p-3"><StatusBadge status={b.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tenants">
          <Card>
            <CardHeader><CardTitle>Active Tenants</CardTitle></CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 dark:bg-slate-800 border-b dark:border-slate-700">
                  <tr>
                    <th className="text-left p-3 font-medium">Name</th>
                    <th className="text-left p-3 font-medium">Email</th>
                    <th className="text-left p-3 font-medium">Phone</th>
                  </tr>
                </thead>
                <tbody>
                  {tenants.length === 0 ? (
                    <tr><td colSpan={3} className="p-6 text-center text-slate-500 dark:text-slate-400">No tenants</td></tr>
                  ) : tenants.map((t) => (
                    <tr key={t.id} className="border-b dark:border-slate-800">
                      <td className="p-3 font-medium text-slate-900 dark:text-white">{t.full_name}</td>
                      <td className="p-3">{t.email}</td>
                      <td className="p-3">{t.phone || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="feedback">
          <Card>
            <CardHeader><CardTitle>Client Feedback</CardTitle></CardHeader>
            <CardContent>
              {feedback.length === 0 ? (
                <p className="text-center text-slate-500 dark:text-slate-400 py-8">No feedback yet.</p>
              ) : (
                <div className="space-y-3">
                  {feedback.map((f) => (
                    <div key={f.id} className="border border-slate-200 dark:border-slate-700 rounded-xl p-4">
                      <div className="flex items-center justify-between">
                        <p className="font-medium text-slate-900 dark:text-white">{f.name || "Anonymous"}</p>
                        {f.rating ? <span className="text-amber-500 text-sm">{"★".repeat(Number(f.rating))}</span> : null}
                      </div>
                      <p className="text-xs text-slate-400">{f.email}</p>
                      <p className="text-sm text-slate-600 dark:text-slate-300 mt-2">{f.message}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function AdministrationDashboard() {
  return <EmployeeShell slug="administration">{() => <AdminContent />}</EmployeeShell>;
}
