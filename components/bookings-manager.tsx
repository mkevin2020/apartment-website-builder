"use client"

import { useState, useEffect } from "react"
import { dataClient } from "@/lib/data-client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"

function formatSupabaseError(error: any) {
  if (!error) return "Unknown Supabase error"
  if (typeof error === "string") return error
  try {
    return JSON.stringify(error, Object.getOwnPropertyNames(error), 2)
  } catch {
    return String(error)
  }
}

export function BookingsManager() {
  const [bookings, setBookings] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState<number | null>(null)
  const supabase = dataClient()

  useEffect(() => {
    fetchBookings()
  }, [])

  const fetchBookings = async () => {
    try {
      if (false) {
        console.error("Supabase env vars are missing", {
          hasUrl: true,
          hasAnonKey: true,
        })
        setLoading(false)
        return
      }

      // Deliberately NOT a PostgREST embed. `bookings.apartment_id` has no
      // foreign key to `apartments` in this database, so
      // `apartments!apartment_id(...)` fails with PGRST200 and the whole list
      // comes back empty. We join the two ourselves instead, which works
      // whether or not the constraint is ever added.
      const { data, error } = await supabase
        .from("bookings")
        .select("*")
        .order("created_at", { ascending: false })

      if (error) {
        console.error("Fetch error:", formatSupabaseError(error), error)
        setLoading(false)
        return
      }

      const rows = data || []
      const aptIds = Array.from(
        new Set(rows.map((b: any) => b.apartment_id).filter((id: any) => id != null))
      )

      let aptById = new Map<string, any>()
      if (aptIds.length > 0) {
        const { data: apts } = await supabase
          .from("apartments")
          .select("id, name, type")
          .in("id", aptIds)
        aptById = new Map((apts || []).map((a: any) => [String(a.id), a]))
      }

      // Shape it exactly like the old embed did, so the table below is unchanged.
      setBookings(
        rows.map((b: any) => ({
          ...b,
          apartments: aptById.get(String(b.apartment_id)) || null,
        }))
      )
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

      // When a booking is accepted (confirmed), text the person who booked.
      if (newStatus === "confirmed") {
        const b = bookings.find((x) => x.id === id)
        if (b?.phone_number) {
          fetch("/api/bookings/send-sms", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              phone_number: b.phone_number,
              client_name: b.client_name,
              message:
                `Hello ${b.client_name || "there"}! Great news — your apartment booking at ` +
                `Cielo Vista has been ACCEPTED and confirmed. We look forward to hosting you!`,
            }),
          }).catch(() => {})
        }
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
                    <TableCell>{booking.apartments?.type || booking.apartments?.name || `#${booking.apartment_id}`}</TableCell>
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
