"use client"

import { useState, useEffect } from "react"
import { dataClient } from "@/lib/data-client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { AlertCircle, RefreshCw, Eye, X, User, Mail, Phone, Home, Calendar, DollarSign } from "lucide-react"

interface BookingRow {
  id: number
  client_name: string
  email: string
  phone_number: string
  apartment_id: number
  start_date: string
  end_date: string
  status: string
  tenant_id: number | string | null
}

// A booking made by a logged-in tenant has a tenant_id; a guest booking does not.
const bookingType = (b: BookingRow): "Tenant" | "Guest" =>
  b.tenant_id != null && String(b.tenant_id).trim() !== "" ? "Tenant" : "Guest"

interface BookedApartmentsTableProps {
  limit?: number
  title?: string
}

export function BookedApartmentsTable({ limit = 50, title = "Booked Apartments" }: BookedApartmentsTableProps) {
  const [bookings, setBookings] = useState<BookingRow[]>([])
  const [apartments, setApartments] = useState<Record<number, { name: string; type: string; price_per_month: number }>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<BookingRow | null>(null)
  const [filter, setFilter] = useState<"all" | "Tenant" | "Guest">("all")

  const supabase = dataClient()

  const fetchData = async () => {
    try {
      setLoading(true)
      setError(null)

      const { data: bookingData, error: bookingError } = await supabase
        .from("bookings")
        .select("id, client_name, email, phone_number, apartment_id, start_date, end_date, status, tenant_id")
        .order("created_at", { ascending: false })
        .limit(limit)

      if (bookingError) throw bookingError

      setBookings(bookingData || [])

      // Look up apartment names/prices for the booked apartment ids
      const apartmentIds = [...new Set((bookingData || []).map((b: any) => b.apartment_id).filter(Boolean))]
      if (apartmentIds.length > 0) {
        const { data: aptData } = await supabase
          .from("apartments")
          .select("id, name, type, price_per_month")
          .in("id", apartmentIds)

        const map: Record<number, { name: string; type: string; price_per_month: number }> = {}
        ;(aptData || []).forEach((a: any) => {
          map[a.id] = { name: a.name, type: a.type, price_per_month: a.price_per_month }
        })
        setApartments(map)
      }
    } catch (err: any) {
      setError(err?.message || "Failed to load booked apartments")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const apartmentName = (b: BookingRow) => apartments[b.apartment_id]?.name || apartments[b.apartment_id]?.type || `Apartment #${b.apartment_id}`
  const amount = (b: BookingRow) => apartments[b.apartment_id]?.price_per_month || 0

  const visibleBookings = filter === "all" ? bookings : bookings.filter((b) => bookingType(b) === filter)

  const statusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case "confirmed":
        return "bg-green-100 text-green-800"
      case "cancelled":
        return "bg-red-100 text-red-800"
      default:
        return "bg-yellow-100 text-yellow-800"
    }
  }

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <CardTitle>
          {title} ({visibleBookings.length})
        </CardTitle>
        <div className="flex items-center gap-2">
          {/* Guest / Tenant filter */}
          <div className="flex rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden text-sm">
            {(["all", "Tenant", "Guest"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 font-medium transition-colors ${
                  filter === f
                    ? "bg-blue-600 text-white"
                    : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                }`}
              >
                {f === "all" ? "All" : f === "Tenant" ? "Tenants" : "Guests"}
              </button>
            ))}
          </div>
          <Button onClick={fetchData} variant="outline" size="sm" className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
            <p className="text-red-800 text-sm">{error}</p>
          </div>
        )}

        {loading ? (
          <div className="py-10 text-center text-slate-500">Loading…</div>
        ) : visibleBookings.length === 0 ? (
          <div className="py-10 text-center text-slate-500">
            <AlertCircle className="h-10 w-10 text-slate-400 mx-auto mb-3" />
            No {filter === "all" ? "booked apartments" : filter === "Tenant" ? "tenant bookings" : "guest bookings"} yet
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Booked By</TableHead>
                  <TableHead>Apartment</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Check-in</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleBookings.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell>
                      <span
                        className={`inline-block px-2.5 py-1 rounded-full text-xs font-semibold ${
                          bookingType(b) === "Tenant"
                            ? "bg-blue-100 text-blue-800"
                            : "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {bookingType(b)}
                      </span>
                    </TableCell>
                    <TableCell className="font-medium">
                      {b.client_name}
                      {b.email && <span className="block text-xs text-slate-500">{b.email}</span>}
                    </TableCell>
                    <TableCell>{apartmentName(b)}</TableCell>
                    <TableCell className="font-semibold">RWF {Number(amount(b)).toLocaleString()}</TableCell>
                    <TableCell>{b.start_date ? new Date(b.start_date).toLocaleDateString() : "—"}</TableCell>
                    <TableCell>
                      <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${statusColor(b.status)}`}>
                        {b.status}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setSelected(b)}>
                        <Eye className="h-4 w-4" />
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      {/* Client Details Modal */}
      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setSelected(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-gradient-to-r from-blue-600 to-indigo-600">
              <h3 className="text-white font-bold text-lg">Client Details</h3>
              <button onClick={() => setSelected(null)} className="text-white/80 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-500">Booked as:</span>
                <span
                  className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${
                    bookingType(selected) === "Tenant" ? "bg-blue-100 text-blue-800" : "bg-slate-100 text-slate-700"
                  }`}
                >
                  {bookingType(selected)}
                </span>
              </div>
              <DetailRow icon={<User className="h-4 w-4" />} label="Client Name" value={selected.client_name} />
              <DetailRow icon={<Mail className="h-4 w-4" />} label="Email" value={selected.email || "—"} />
              <DetailRow icon={<Phone className="h-4 w-4" />} label="Phone" value={selected.phone_number || "—"} />
              <DetailRow icon={<Home className="h-4 w-4" />} label="Apartment" value={apartmentName(selected)} />
              <DetailRow
                icon={<DollarSign className="h-4 w-4" />}
                label="Amount"
                value={`RWF ${Number(amount(selected)).toLocaleString()}`}
              />
              <DetailRow
                icon={<Calendar className="h-4 w-4" />}
                label="Check-in"
                value={selected.start_date ? new Date(selected.start_date).toLocaleDateString() : "—"}
              />
              <DetailRow
                icon={<Calendar className="h-4 w-4" />}
                label="Check-out"
                value={selected.end_date ? new Date(selected.end_date).toLocaleDateString() : "—"}
              />
              <div className="flex items-center gap-2 pt-2">
                <span className="text-sm text-slate-500">Status:</span>
                <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${statusColor(selected.status)}`}>
                  {selected.status}
                </span>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-700">
              <Button variant="outline" className="w-full" onClick={() => setSelected(null)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </Card>
  )
}

function DetailRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="text-blue-600 dark:text-blue-400 mt-0.5">{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
        <p className="text-sm font-semibold text-slate-900 dark:text-white break-words">{value}</p>
      </div>
    </div>
  )
}
