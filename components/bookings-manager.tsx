"use client"

import { useState, useEffect } from "react"
import { createBrowserClient } from "@supabase/ssr"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"

export function BookingsManager() {
  const [bookings, setBookings] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState<number | null>(null)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )

  useEffect(() => {
    fetchBookings()
  }, [])

  const fetchBookings = async () => {
    try {
      console.log("Fetching bookings...")

      const { data, error } = await supabase
        .from("bookings")
        .select("*")
        .order("created_at", { ascending: false })

      console.log("Bookings data:", { data, error })

      if (error) {
        console.error("Fetch error:", error)
        setLoading(false)
        return
      }

      setBookings(data || [])
    } catch (err) {
      console.error("Exception:", err)
    } finally {
      setLoading(false)
    }
  }

  const handleStatusChange = async (id: number, newStatus: string) => {
    try {
      const { error } = await supabase
        .from("bookings")
        .update({ status: newStatus })
        .eq("id", id)

      if (error) {
        alert("Error updating status: " + error.message)
        return
      }

      alert("Status updated!")
      await fetchBookings()
    } catch (err) {
      console.error("Error:", err)
    }
  }

  const handleDeleteBooking = async (id: number) => {
    if (!window.confirm("Are you sure you want to delete this booking? This action cannot be undone.")) {
      return
    }

    setDeleting(id)
    try {
      const { error } = await supabase
        .from("bookings")
        .delete()
        .eq("id", id)

      if (error) {
        alert("Error deleting booking: " + error.message)
        setDeleting(null)
        return
      }

      alert("Booking deleted successfully!")
      await fetchBookings()
    } catch (err) {
      console.error("Error:", err)
      alert("An error occurred while deleting the booking")
      setDeleting(null)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>All Bookings ({bookings.length})</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p>Loading bookings...</p>
        ) : bookings.length === 0 ? (
          <p className="text-gray-500">No bookings yet</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Client Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Apartment Type</TableHead>
                  <TableHead>Move-in Date</TableHead>
                  <TableHead>Move-out Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bookings.map((booking) => (
                  <TableRow key={booking.id}>
                    <TableCell>{booking.client_name}</TableCell>
                    <TableCell>{booking.email}</TableCell>
                    <TableCell>{booking.phone_number}</TableCell>
                    <TableCell>{booking.apartment_type}</TableCell>
                    <TableCell>{new Date(booking.start_date).toLocaleDateString()}</TableCell>
                    <TableCell>{new Date(booking.end_date).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <span className={`px-2 py-1 rounded text-sm ${
                        booking.status === "confirmed" ? "bg-green-100 text-green-800" :
                        booking.status === "rejected" ? "bg-red-100 text-red-800" :
                        "bg-yellow-100 text-yellow-800"
                      }`}>
                        {booking.status}
                      </span>
                    </TableCell>
                    <TableCell className="space-x-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleStatusChange(booking.id, "confirmed")}
                      >
                        Confirm
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleStatusChange(booking.id, "rejected")}
                      >
                        Reject
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleDeleteBooking(booking.id)}
                        disabled={deleting === booking.id}
                      >
                        {deleting === booking.id ? "Deleting..." : "Delete"}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
