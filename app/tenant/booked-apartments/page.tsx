"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { createBrowserClient } from "@supabase/ssr"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import TenantHeader from "@/components/TenantHeader"
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
} from "lucide-react"
import Link from "next/link"

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
  apartment?: Apartment
}

export default function BookedApartmentsPage() {
  const router = useRouter()
  const [tenant, setTenant] = useState<TenantSession | null>(null)
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  useEffect(() => {
    const fetchBookedApartments = async () => {
      try {
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

        if (bookingsError && bookingsError.message) {
          console.error("Error fetching bookings:", bookingsError.message)
          setError("Failed to load bookings")
          setLoading(false)
          return
        }

        // Fetch apartment details for each booking
        if (bookingsData && bookingsData.length > 0) {
          const bookingsWithApartments = await Promise.all(
            bookingsData.map(async (booking) => {
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
        return <Clock className="h-5 w-5 text-gray-600" />
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
        return "bg-gray-100 text-gray-800"
    }
  }

  const isActiveBooking = (booking: Booking) => {
    const now = new Date()
    const startDate = new Date(booking.start_date)
    const endDate = new Date(booking.end_date)
    return startDate <= now && now <= endDate
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading booked apartments...</p>
        </div>
      </div>
    )
  }

  if (!tenant) {
    return null
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center max-w-md">
          <AlertCircle className="h-16 w-16 text-red-600 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Error</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <Button onClick={() => window.location.reload()}>Try Again</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <TenantHeader tenant={tenant} />

      <main className="container mx-auto px-4 py-8">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">My Booked Apartments</h1>
          <p className="text-gray-600">View all your apartment bookings and details</p>
        </div>

        {/* Content */}
        {bookings.length === 0 ? (
          <Card>
            <CardContent className="pt-6 text-center">
              <Home className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-700 mb-2">No Bookings Yet</h3>
              <p className="text-gray-600 mb-6">You haven't booked any apartments yet.</p>
              <Button asChild className="bg-blue-600 hover:bg-blue-700">
                <Link href="/booking">Browse Apartments</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {/* Active Bookings */}
            {bookings.some((b) => isActiveBooking(b)) && (
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-2">
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
                                  <h3 className="text-xl font-bold text-gray-900 mb-1">
                                    {booking.apartment?.name}
                                  </h3>
                                  <p className="text-gray-600 flex items-center gap-2">
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
                                  <Bed className="h-5 w-5 text-gray-400 mx-auto mb-2" />
                                  <p className="text-2xl font-bold text-gray-900">
                                    {booking.apartment?.bedrooms}
                                  </p>
                                  <p className="text-xs text-gray-600">Bedrooms</p>
                                </div>
                                <div className="text-center">
                                  <Bath className="h-5 w-5 text-gray-400 mx-auto mb-2" />
                                  <p className="text-2xl font-bold text-gray-900">
                                    {booking.apartment?.bathrooms}
                                  </p>
                                  <p className="text-xs text-gray-600">Bathrooms</p>
                                </div>
                                <div className="text-center">
                                  <Maximize2 className="h-5 w-5 text-gray-400 mx-auto mb-2" />
                                  <p className="text-2xl font-bold text-gray-900">
                                    {booking.apartment?.size}
                                  </p>
                                  <p className="text-xs text-gray-600">Sqft</p>
                                </div>
                              </div>

                              {/* Booking Info */}
                              <div className="grid md:grid-cols-2 gap-6 mb-4">
                                <div>
                                  <p className="text-sm text-gray-600 flex items-center gap-2 mb-1">
                                    <Calendar className="h-4 w-4" />
                                    Move-in Date
                                  </p>
                                  <p className="text-lg font-semibold text-gray-900">
                                    {new Date(booking.start_date).toLocaleDateString("en-US", {
                                      year: "numeric",
                                      month: "long",
                                      day: "numeric",
                                    })}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-sm text-gray-600 flex items-center gap-2 mb-1">
                                    <Calendar className="h-4 w-4" />
                                    Move-out Date
                                  </p>
                                  <p className="text-lg font-semibold text-gray-900">
                                    {new Date(booking.end_date).toLocaleDateString("en-US", {
                                      year: "numeric",
                                      month: "long",
                                      day: "numeric",
                                    })}
                                  </p>
                                </div>
                              </div>

                              {/* Monthly Rent */}
                              <div className="bg-blue-50 p-4 rounded-lg">
                                <p className="text-sm text-blue-600 mb-1 flex items-center gap-2">
                                  <DollarSign className="h-4 w-4" />
                                  Monthly Rent
                                </p>
                                <p className="text-2xl font-bold text-blue-900">
                                  ${booking.apartment?.monthly_rent}
                                </p>
                              </div>

                              {/* Description */}
                              {booking.apartment?.description && (
                                <div className="mt-4 pt-4 border-t">
                                  <p className="text-sm text-gray-600 mb-2">Description</p>
                                  <p className="text-gray-700">{booking.apartment.description}</p>
                                </div>
                              )}
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
                <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-2">
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
                              <h3 className="text-xl font-bold text-gray-900 mb-1">
                                {booking.apartment?.name}
                              </h3>
                              <p className="text-gray-600 flex items-center gap-2">
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
                              <p className="text-sm text-gray-600 flex items-center gap-2 mb-1">
                                <Calendar className="h-4 w-4" />
                                Move-in Date
                              </p>
                              <p className="font-semibold">
                                {new Date(booking.start_date).toLocaleDateString()}
                              </p>
                            </div>
                            <div>
                              <p className="text-sm text-gray-600 flex items-center gap-2 mb-1">
                                <DollarSign className="h-4 w-4" />
                                Monthly Rent
                              </p>
                              <p className="font-semibold">${booking.apartment?.monthly_rent}</p>
                            </div>
                            <div>
                              <p className="text-sm text-gray-600 mb-1">Bedrooms</p>
                              <p className="font-semibold">{booking.apartment?.bedrooms} BR</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                </div>
              </div>
            )}

            {/* Past Bookings */}
            {bookings.some((b) => new Date(b.end_date) < new Date()) && (
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <CheckCircle className="h-6 w-6 text-gray-600" />
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
                              <h3 className="text-xl font-bold text-gray-900 mb-1">
                                {booking.apartment?.name}
                              </h3>
                              <p className="text-gray-600 flex items-center gap-2">
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
                              <p className="text-sm text-gray-600 flex items-center gap-2 mb-1">
                                <Calendar className="h-4 w-4" />
                                Move-out Date
                              </p>
                              <p className="font-semibold">
                                {new Date(booking.end_date).toLocaleDateString()}
                              </p>
                            </div>
                            <div>
                              <p className="text-sm text-gray-600 flex items-center gap-2 mb-1">
                                <DollarSign className="h-4 w-4" />
                                Monthly Rent
                              </p>
                              <p className="font-semibold">${booking.apartment?.monthly_rent}</p>
                            </div>
                            <div>
                              <p className="text-sm text-gray-600 mb-1">Bedrooms</p>
                              <p className="font-semibold">{booking.apartment?.bedrooms} BR</p>
                            </div>
                          </div>
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
      </main>
    </div>
  )
}
