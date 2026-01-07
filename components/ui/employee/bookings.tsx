"use client"

import { useEffect, useState } from "react"
import { createBrowserClient } from "@supabase/ssr"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { CheckCircle, Clock, XCircle, Eye, Calendar } from "lucide-react"

export default function BookingsManager() {
  const [bookings, setBookings] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedBooking, setSelectedBooking] = useState<any>(null)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
  )

  useEffect(() => {
    const fetchBookings = async () => {
      try {
        const { data, error } = await supabase
          .from("bookings")
          .select("*")
          .order("created_at", { ascending: false })

        if (error) throw error
        setBookings(data || [])
      } catch (err) {
        console.error("Error fetching bookings:", err)
      } finally {
        setLoading(false)
      }
    }

    fetchBookings()
  }, [])

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "confirmed":
        return <CheckCircle className="h-5 w-5 text-green-600" />
      case "pending":
        return <Clock className="h-5 w-5 text-yellow-600" />
      case "cancelled":
        return <XCircle className="h-5 w-5 text-red-600" />
      default:
        return <Clock className="h-5 w-5 text-gray-600" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "confirmed":
        return "bg-green-100 text-green-800"
      case "pending":
        return "bg-yellow-100 text-yellow-800"
      case "cancelled":
        return "bg-red-100 text-red-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <p className="text-gray-500">Loading bookings...</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            All Bookings
          </CardTitle>
        </CardHeader>
        <CardContent>
          {bookings.length === 0 ? (
            <div className="text-center py-12">
              <Clock className="h-12 w-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">No bookings yet</p>
            </div>
          ) : (
            <div className="grid gap-4">
              {bookings.map((booking) => (
                <div
                  key={booking.id}
                  className="border rounded-lg p-4 hover:shadow-md transition-shadow"
                >
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h3 className="font-semibold text-lg">{booking.client_name}</h3>
                      <p className="text-sm text-gray-600">{booking.email}</p>
                      <p className="text-sm text-gray-600">{booking.phone_number}</p>
                    </div>
                    <Badge className={getStatusColor(booking.status)}>
                      {booking.status}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                    <div>
                      <p className="text-xs text-gray-500 uppercase">Apartment Type</p>
                      <p className="font-medium">{booking.apartment_type}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 uppercase">Check-in</p>
                      <p className="font-medium">{booking.start_date}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 uppercase">Check-out</p>
                      <p className="font-medium">{booking.end_date}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 uppercase">Booked On</p>
                      <p className="font-medium">
                        {new Date(booking.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      onClick={() => setSelectedBooking(booking)}
                      variant="outline"
                      size="sm"
                      className="flex items-center gap-1"
                    >
                      <Eye className="h-4 w-4" />
                      View Details
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Booking Details Modal */}
      {selectedBooking && (
        <Card className="border-blue-300 bg-blue-50">
          <CardHeader className="flex justify-between items-center">
            <CardTitle>Booking Details</CardTitle>
            <Button
              onClick={() => setSelectedBooking(null)}
              variant="ghost"
              size="sm"
            >
              Close
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-600">Client Name</p>
                <p className="font-semibold">{selectedBooking.client_name}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Email</p>
                <p className="font-semibold">{selectedBooking.email}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Phone</p>
                <p className="font-semibold">{selectedBooking.phone_number}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Apartment Type</p>
                <p className="font-semibold">{selectedBooking.apartment_type}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Check-in Date</p>
                <p className="font-semibold">{selectedBooking.start_date}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Check-out Date</p>
                <p className="font-semibold">{selectedBooking.end_date}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Status</p>
                <Badge className={getStatusColor(selectedBooking.status)}>
                  {selectedBooking.status}
                </Badge>
              </div>
              <div>
                <p className="text-sm text-gray-600">Booked On</p>
                <p className="font-semibold">
                  {new Date(selectedBooking.created_at).toLocaleDateString()}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}