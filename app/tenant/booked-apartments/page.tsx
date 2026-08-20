"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { dataClient } from "@/lib/data-client";
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { TenantShell } from "@/components/dashboard/TenantShell"
import { formatDate, formatDateLong } from "@/lib/utils"
import {
  AlertCircle,
  Home,
  MapPin,
  DollarSign,
  Calendar,
  CheckCircle,
  Clock,
  XCircle,
  Bed,
  Bath,
  Maximize2,
  Ticket as TicketIcon,
} from "lucide-react"
import Link from "next/link"
import { CardGridSkeleton, PageSkeleton } from "@/components/ui/loading-skeletons";

interface TenantSession {
  id: string
  full_name: string
  email: string
  phone: string
}

interface Apartment {
  id: number
  name: string
  unit_number: string
  monthly_rent: number
  price_per_month?: number
  price_per_day?: number
  bedrooms: number
  bathrooms: number
  size: number
  description?: string
  image_url?: string
}

interface Booking {
  id: number
  tenant_id: string
  apartment_id: number
  start_date: string
  end_date: string
  status: string
  rate_type?: "monthly" | "daily"
  apartment?: Apartment
}

// The tenant's ticket for an apartment: the QR receipt the receptionist scans
interface TicketInfo {
  paymentId: number
  reference: string
  qr: string | null
  isVerified: boolean
}

// Rent label + value (in Rwandan francs) based on whether the booking is daily or monthly.
function rentLabel(b: Booking): string {
  return b.rate_type === "daily" ? "Daily Rent" : "Monthly Rent"
}
function rentValue(b: Booking): string {
  const price =
    (b.rate_type === "daily" ? b.apartment?.price_per_day : b.apartment?.price_per_month) ??
    b.apartment?.monthly_rent ??
    0
  const per = b.rate_type === "daily" ? "day" : "month"
  return `RWF ${Number(price).toLocaleString()} /${per}`
}
// Always-available per-day price line (e.g. "RWF 1,600 /day"); null if not set.
function perDayValue(b: Booking): string | null {
  const d = b.apartment?.price_per_day
  if (!d) return null
  return `RWF ${Number(d).toLocaleString()} /day`
}

export default function BookedApartmentsPage() {
  const router = useRouter()
  const [tenant, setTenant] = useState<TenantSession | null>(null)
  const [bookings, setBookings] = useState<Booking[]>([])
  const [tickets, setTickets] = useState<Record<number, TicketInfo>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const missingSupabaseConfig = false
  const supabase = missingSupabaseConfig
    ? null
    : dataClient()

  useEffect(() => {
    const fetchBookedApartments = async () => {
      try {
        // Checking the client itself (not the flag) lets TypeScript narrow
        // `supabase` to non-null for the queries below.
        if (!supabase) {
          setFetchError(
            "Supabase client is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY."
          )
          setLoading(false)
          return
        }

        const tenantData = localStorage.getItem("tenant_session")
        if (!tenantData) {
          router.push("/login")
          return
        }

        const parsedTenant: TenantSession = JSON.parse(tenantData)
        setTenant(parsedTenant)

        // Fetch all bookings for this tenant
        const { data: bookingsData, error: bookingsError } = await supabase
          .from("bookings")
          .select("*")
          .eq("tenant_id", String(parsedTenant.id))
          .order("start_date", { ascending: false })

        if (bookingsError) {
          const message = bookingsError.message || JSON.stringify(bookingsError)
          console.error("Error fetching bookings:", message, bookingsError)
          setError("Failed to load bookings")
          setFetchError(`Failed to load bookings: ${message}`)
          setLoading(false)
          return
        }

        // Fetch apartment details for each booking
        if (bookingsData && bookingsData.length > 0) {
          const bookingsWithApartments = await Promise.all(
            bookingsData.map(async (booking: any) => {
              const { data: apartmentData, error: apartmentError } = await supabase
                .from("apartments")
                .select("*")
                .eq("id", booking.apartment_id)
                .single()

              if (apartmentError && apartmentError.message) {
                console.error("Error fetching apartment:", apartmentError.message)
              }

              return {
                ...booking,
                apartment: apartmentData,
              }
            })
          )
          setBookings(bookingsWithApartments)
        } else {
          setBookings([])
        }

        // A paid payment must always have its ticket — backfill any that are
        // missing (idempotent, no-op when everything already has one).
        try {
          await fetch("/api/tenant/ensure-tickets", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ tenantId: parsedTenant.id }),
          })
        } catch {
          /* non-fatal — existing tickets still load below */
        }

        // Fetch the tenant's tickets (QR receipts) and attach the newest one
        // to each apartment. Receipts link to payments, so go through those.
        const { data: payRows } = await supabase
          .from("tenant_payments")
          .select("id, apartment_id, reference_number")
          .eq("tenant_id", parsedTenant.id)
        const payById: Record<number, { id: number; apartment_id: number; reference_number: string }> = {}
        const payIds = (payRows || []).map((p: any) => {
          payById[p.id] = p
          return p.id
        })
        if (payIds.length > 0) {
          const { data: recRows } = await supabase
            .from("receipts")
            .select("tenant_payment_id, qr_code_base64, is_verified, created_at")
            .in("tenant_payment_id", payIds)
            .order("created_at", { ascending: false })
          const map: Record<number, TicketInfo> = {}
          for (const r of recRows || []) {
            const pay = payById[r.tenant_payment_id]
            if (!pay?.apartment_id || map[pay.apartment_id]) continue // newest receipt wins
            map[pay.apartment_id] = {
              paymentId: pay.id,
              reference: pay.reference_number,
              qr: r.qr_code_base64 || null,
              isVerified: !!r.is_verified,
            }
          }
          setTickets(map)
        }

        setError(null)
      } catch (err) {
        console.error("Error in fetchBookedApartments:", err)
        setError("Failed to load booked apartments")
      } finally {
        setLoading(false)
      }
    }

    fetchBookedApartments()
  }, [router])

  const getStatusIcon = (status: string) => {
    switch (status?.toLowerCase()) {
      case "confirmed":
        return <CheckCircle className="h-5 w-5 text-green-600" />
      case "pending":
        return <Clock className="h-5 w-5 text-yellow-600" />
      case "rejected":
        return <XCircle className="h-5 w-5 text-red-600" />
      default:
        return <Clock className="h-5 w-5 text-gray-600 dark:text-slate-400" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case "confirmed":
        return "bg-green-100 text-green-800"
      case "pending":
        return "bg-yellow-100 text-yellow-800"
      case "rejected":
        return "bg-red-100 text-red-800"
      default:
        return "bg-gray-100 dark:bg-slate-800 text-gray-800 dark:text-slate-100"
    }
  }

  // The apartment's ticket: QR to show at reception, check-in state, full-ticket link
  const renderTicket = (apartmentId: number) => {
    const t = tickets[apartmentId]
    if (!t) return null
    return (
      <div className="mt-4 pt-4 border-t">
        <p className="text-sm text-gray-600 dark:text-slate-400 mb-2 flex items-center gap-2">
          <TicketIcon className="h-4 w-4" />
          Your Ticket
        </p>
        <div className="flex items-center gap-4 bg-slate-50 dark:bg-slate-800/60 rounded-lg p-3">
          {t.qr && (
            <img
              src={t.qr}
              alt="Ticket QR code"
              className="w-24 h-24 rounded-md border border-slate-200 dark:border-slate-700 bg-white p-1 flex-shrink-0"
            />
          )}
          <div className="min-w-0">
            <p className="text-xs font-mono text-gray-700 dark:text-slate-300 truncate">{t.reference}</p>
            {t.isVerified ? (
              <p className="text-xs font-medium text-green-600 mt-1 flex items-center gap-1">
                <CheckCircle className="h-3.5 w-3.5" />
                Checked in at reception
              </p>
            ) : (
              <p className="text-xs font-medium text-amber-600 mt-1">
                Show this QR at reception to check in
              </p>
            )}
            <Button asChild variant="outline" size="sm" className="mt-2">
              <Link href={`/receipt?payment_id=${t.paymentId}`}>View full ticket</Link>
            </Button>
          </div>
        </div>
      </div>
    )
  }

  const isActiveBooking = (booking: Booking) => {
    const now = new Date()
    const startDate = new Date(booking.start_date)
    const endDate = new Date(booking.end_date)
    return startDate <= now && now <= endDate
  }

  if (loading) {
    // Skeleton, not a spinner: it occupies the same space the real
    // content will, so nothing shifts when the data arrives.
    return <PageSkeleton label="Loading your apartments"><CardGridSkeleton count={3} /></PageSkeleton>;
  }

  if (!tenant) {
    return null
  }

  if (fetchError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-slate-800">
        <div className="text-center max-w-md rounded-3xl border border-red-200 bg-white dark:border-red-900 dark:bg-slate-950 p-10 shadow-lg">
          <AlertCircle className="h-16 w-16 text-red-600 dark:text-red-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Unable to load bookings</h2>
          <p className="text-gray-600 dark:text-slate-400 mb-6">{fetchError}</p>
          <Button onClick={() => window.location.reload()}>Retry</Button>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-slate-800">
        <div className="text-center max-w-md">
          <AlertCircle className="h-16 w-16 text-red-600 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-800 dark:text-slate-100 mb-2">Error</h2>
          <p className="text-gray-600 dark:text-slate-400 mb-6">{error}</p>
          <Button onClick={() => window.location.reload()}>Try Again</Button>
        </div>
      </div>
    )
  }

  return (
    <TenantShell tenant={tenant} active="apartments">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">My Booked Apartments</h1>
          <p className="text-gray-600 dark:text-slate-400">View all your apartment bookings and details</p>
        </div>

        {/* Content */}
        {bookings.length === 0 ? (
          <Card>
            <CardContent className="pt-6 text-center">
              <Home className="h-16 w-16 text-gray-400 dark:text-slate-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-700 dark:text-slate-300 mb-2">No Bookings Yet</h3>
              <p className="text-gray-600 dark:text-slate-400 mb-6">You haven't booked any apartments yet.</p>
              <Button asChild className="bg-blue-600 hover:bg-blue-700">
                <Link href="/tenant/dashboard#available-apartments">Browse Apartments</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {/* Active Bookings */}
            {bookings.some((b) => isActiveBooking(b)) && (
              <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  <CheckCircle className="h-6 w-6 text-green-600" />
                  Active Bookings
                </h2>
                <div className="grid gap-6">
                  {bookings
                    .filter((b) => isActiveBooking(b))
                    .map((booking) => (
                      <Card key={booking.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                        <CardContent className="p-0">
                          <div className="grid md:grid-cols-3 gap-6 p-6">
                            {/* Apartment Image */}
                            {booking.apartment?.image_url && (
                              <div className="md:col-span-1">
                                <img
                                  src={booking.apartment.image_url}
                                  alt={booking.apartment.name}
                                  className="w-full h-48 object-cover rounded-lg"
                                />
                              </div>
                            )}

                            {/* Apartment Details */}
                            <div className={booking.apartment?.image_url ? "md:col-span-2" : "md:col-span-3"}>
                              <div className="flex items-start justify-between mb-4">
                                <div>
                                  <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-1">
                                    {booking.apartment?.name}
                                  </h3>
                                  <p className="text-gray-600 dark:text-slate-400 flex items-center gap-2">
                                    <MapPin className="h-4 w-4" />
                                    Unit: {booking.apartment?.unit_number}
                                  </p>
                                </div>
                                <div className={`px-3 py-1 rounded-full text-sm font-medium flex items-center gap-2 ${getStatusColor(booking.status)}`}>
                                  {getStatusIcon(booking.status)}
                                  {booking.status}
                                </div>
                              </div>

                              {/* Key Features */}
                              <div className="grid grid-cols-3 gap-4 mb-4 py-4 border-y">
                                <div className="text-center">
                                  <Bed className="h-5 w-5 text-gray-400 dark:text-slate-500 mx-auto mb-2" />
                                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                                    {booking.apartment?.bedrooms}
                                  </p>
                                  <p className="text-xs text-gray-600 dark:text-slate-400">Bedrooms</p>
                                </div>
                                <div className="text-center">
                                  <Bath className="h-5 w-5 text-gray-400 dark:text-slate-500 mx-auto mb-2" />
                                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                                    {booking.apartment?.bathrooms}
                                  </p>
                                  <p className="text-xs text-gray-600 dark:text-slate-400">Bathrooms</p>
                                </div>
                                <div className="text-center">
                                  <Maximize2 className="h-5 w-5 text-gray-400 dark:text-slate-500 mx-auto mb-2" />
                                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                                    {booking.apartment?.size}
                                  </p>
                                  <p className="text-xs text-gray-600 dark:text-slate-400">Sqft</p>
                                </div>
                              </div>

                              {/* Booking Info */}
                              <div className="grid md:grid-cols-2 gap-6 mb-4">
                                <div>
                                  <p className="text-sm text-gray-600 dark:text-slate-400 flex items-center gap-2 mb-1">
                                    <Calendar className="h-4 w-4" />
                                    Move-in Date
                                  </p>
                                  <p className="text-lg font-semibold text-gray-900 dark:text-white">
                                    {formatDateLong(booking.start_date)}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-sm text-gray-600 dark:text-slate-400 flex items-center gap-2 mb-1">
                                    <Calendar className="h-4 w-4" />
                                    Move-out Date
                                  </p>
                                  <p className="text-lg font-semibold text-gray-900 dark:text-white">
                                    {formatDateLong(booking.end_date)}
                                  </p>
                                </div>
                              </div>

                              {/* Monthly Rent */}
                              <div className="bg-blue-50 p-4 rounded-lg">
                                <p className="text-sm text-blue-600 mb-1 flex items-center gap-2">
                                  <DollarSign className="h-4 w-4" />
                                  {rentLabel(booking)}
                                </p>
                                <p className="text-2xl font-bold text-blue-900">
                                  {rentValue(booking)}
                                </p>
                                {perDayValue(booking) && (
                                  <p className="text-sm text-blue-700 mt-1">
                                    Per day: {perDayValue(booking)}
                                  </p>
                                )}
                              </div>

                              {/* Description */}
                              {booking.apartment?.description && (
                                <div className="mt-4 pt-4 border-t">
                                  <p className="text-sm text-gray-600 dark:text-slate-400 mb-2">Description</p>
                                  <p className="text-gray-700 dark:text-slate-300">{booking.apartment.description}</p>
                                </div>
                              )}

                              {/* Ticket for this apartment */}
                              {renderTicket(booking.apartment_id)}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                </div>
              </div>
            )}

            {/* Upcoming Bookings */}
            {bookings.some((b) => new Date(b.start_date) > new Date()) && (
              <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  <Clock className="h-6 w-6 text-yellow-600" />
                  Upcoming Bookings
                </h2>
                <div className="grid gap-6">
                  {bookings
                    .filter((b) => new Date(b.start_date) > new Date())
                    .map((booking) => (
                      <Card key={booking.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                        <CardContent className="p-6">
                          <div className="flex items-start justify-between mb-4">
                            <div>
                              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-1">
                                {booking.apartment?.name}
                              </h3>
                              <p className="text-gray-600 dark:text-slate-400 flex items-center gap-2">
                                <MapPin className="h-4 w-4" />
                                Unit: {booking.apartment?.unit_number}
                              </p>
                            </div>
                            <div className={`px-3 py-1 rounded-full text-sm font-medium flex items-center gap-2 ${getStatusColor(booking.status)}`}>
                              {getStatusIcon(booking.status)}
                              {booking.status}
                            </div>
                          </div>
                          <div className="grid md:grid-cols-3 gap-4 mb-4">
                            <div>
                              <p className="text-sm text-gray-600 dark:text-slate-400 flex items-center gap-2 mb-1">
                                <Calendar className="h-4 w-4" />
                                Move-in Date
                              </p>
                              <p className="font-semibold">
                                {formatDate(booking.start_date)}
                              </p>
                            </div>
                            <div>
                              <p className="text-sm text-gray-600 dark:text-slate-400 flex items-center gap-2 mb-1">
                                <DollarSign className="h-4 w-4" />
                                {rentLabel(booking)}
                              </p>
                              <p className="font-semibold">{rentValue(booking)}</p>
                              {perDayValue(booking) && (
                                <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                                  Per day: {perDayValue(booking)}
                                </p>
                              )}
                            </div>
                            <div>
                              <p className="text-sm text-gray-600 dark:text-slate-400 mb-1">Bedrooms</p>
                              <p className="font-semibold">{booking.apartment?.bedrooms} BR</p>
                            </div>
                          </div>

                          {/* Ticket for this apartment */}
                          {renderTicket(booking.apartment_id)}
                        </CardContent>
                      </Card>
                    ))}
                </div>
              </div>
            )}

            {/* Past Bookings */}
            {bookings.some((b) => new Date(b.end_date) < new Date()) && (
              <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  <CheckCircle className="h-6 w-6 text-gray-600 dark:text-slate-400" />
                  Past Bookings
                </h2>
                <div className="grid gap-6">
                  {bookings
                    .filter((b) => new Date(b.end_date) < new Date())
                    .map((booking) => (
                      <Card key={booking.id} className="overflow-hidden opacity-75 hover:shadow-lg transition-shadow">
                        <CardContent className="p-6">
                          <div className="flex items-start justify-between mb-4">
                            <div>
                              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-1">
                                {booking.apartment?.name}
                              </h3>
                              <p className="text-gray-600 dark:text-slate-400 flex items-center gap-2">
                                <MapPin className="h-4 w-4" />
                                Unit: {booking.apartment?.unit_number}
                              </p>
                            </div>
                            <div className={`px-3 py-1 rounded-full text-sm font-medium flex items-center gap-2 ${getStatusColor(booking.status)}`}>
                              {getStatusIcon(booking.status)}
                              {booking.status}
                            </div>
                          </div>
                          <div className="grid md:grid-cols-3 gap-4 mb-4">
                            <div>
                              <p className="text-sm text-gray-600 dark:text-slate-400 flex items-center gap-2 mb-1">
                                <Calendar className="h-4 w-4" />
                                Move-out Date
                              </p>
                              <p className="font-semibold">
                                {formatDate(booking.end_date)}
                              </p>
                            </div>
                            <div>
                              <p className="text-sm text-gray-600 dark:text-slate-400 flex items-center gap-2 mb-1">
                                <DollarSign className="h-4 w-4" />
                                {rentLabel(booking)}
                              </p>
                              <p className="font-semibold">{rentValue(booking)}</p>
                              {perDayValue(booking) && (
                                <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                                  Per day: {perDayValue(booking)}
                                </p>
                              )}
                            </div>
                            <div>
                              <p className="text-sm text-gray-600 dark:text-slate-400 mb-1">Bedrooms</p>
                              <p className="font-semibold">{booking.apartment?.bedrooms} BR</p>
                            </div>
                          </div>

                          {/* Ticket for this apartment */}
                          {renderTicket(booking.apartment_id)}
                        </CardContent>
                      </Card>
                    ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Back to Dashboard */}
        <div className="mt-8">
          <Button asChild variant="outline">
            <Link href="/tenant/dashboard">Back to Dashboard</Link>
          </Button>
        </div>
    </TenantShell>
  )
}
