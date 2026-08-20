"use client"

import { useState, useEffect } from "react"
import { dataClient } from "@/lib/data-client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { AlertCircle, Trash2 } from "lucide-react"

interface OccupiedApartment {
  id: number
  apartment_id: number
  booking_id: number
  tenant_id: string
  marked_by_employee_id: number
  occupied_date: string
  notes?: string
  created_at: string
  apartment_name?: string
  apartment_type?: string
  apartment_price?: number
  booked_by_name?: string
  booked_by_email?: string
}

export function OccupiedApartmentsManager() {
  const [occupiedApartments, setOccupiedApartments] = useState<OccupiedApartment[]>([])
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  const supabase = dataClient()

  useEffect(() => {
    fetchOccupiedApartments()
    // Refresh every 5 seconds
    const interval = setInterval(() => {
      fetchOccupiedApartments()
    }, 5000)
    return () => clearInterval(interval)
  }, [])

  const fetchOccupiedApartments = async () => {
    try {
      setLoading(true)
      setError(null)

      // Occupied = apartments that are no longer available (the real source of truth)
      const { data: apts, error: aptErr } = await supabase
        .from("apartments")
        .select("id, name, type, price_per_month")
        .eq("is_available", false)

      if (aptErr) {
        setError(`Error fetching occupied apartments: ${aptErr.message}`)
        setLoading(false)
        return
      }

      if (!apts || apts.length === 0) {
        setOccupiedApartments([])
        setLoading(false)
        return
      }

      // Find who booked each occupied apartment (most recent booking)
      const aptIds = apts.map((a: any) => a.id)
      const { data: bks } = await supabase
        .from("bookings")
        .select("apartment_id, client_name, email, start_date, created_at")
        .in("apartment_id", aptIds)
        .order("created_at", { ascending: false })

      const latestByApt: Record<number, any> = {}
      ;(bks || []).forEach((b: any) => {
        if (!latestByApt[b.apartment_id]) latestByApt[b.apartment_id] = b
      })

      const formattedData = apts.map((a: any) => {
        const b = latestByApt[a.id]
        return {
          id: a.id,
          apartment_id: a.id,
          booking_id: 0,
          tenant_id: "",
          marked_by_employee_id: 0,
          occupied_date: b?.start_date || "",
          notes: "",
          created_at: "",
          apartment_name: a.name || "Unknown",
          apartment_type: a.type || "N/A",
          apartment_price: a.price_per_month || 0,
          booked_by_name: b?.client_name || "—",
          booked_by_email: b?.email || "",
        }
      })

      setOccupiedApartments(formattedData)
    } catch (err) {
      console.error("Exception:", err)
      setError(`Exception: ${err}`)
    } finally {
      setLoading(false)
    }
  }

  const handleRemoveOccupied = async (id: number, apartmentId: number) => {
    if (!window.confirm("Are you sure you want to remove this occupied status and make the apartment available again?")) {
      return
    }

    setDeleting(id)
    try {
      // Free the apartment (the source of truth for occupancy)
      const { error: updateError } = await supabase
        .from("apartments")
        .update({ is_available: true })
        .eq("id", apartmentId)

      if (updateError) {
        alert("Error updating apartment availability: " + updateError.message)
        setDeleting(null)
        return
      }

      // Clean up any legacy occupied_apartments rows for this apartment
      await supabase.from("occupied_apartments").delete().eq("apartment_id", apartmentId)

      alert("Apartment is now available again!")
      await fetchOccupiedApartments()
    } catch (err) {
      console.error("Error:", err)
      alert("An error occurred while updating the apartment")
      setDeleting(null)
    }
  }

  // Only take over the card on the FIRST load. This refetches every 5s, and
  // showing the spinner on every poll made the whole list disappear and rebuild
  // itself twelve times a minute.
  if (loading && occupiedApartments.length === 0) {
    return (
      <Card>
        <CardContent className="pt-12 text-center pb-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading occupied apartments...</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Occupied Apartments ({occupiedApartments.length})</CardTitle>
      </CardHeader>
      <CardContent>
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-red-900 font-medium">Error Loading Data</p>
              <p className="text-red-800 text-sm">{error}</p>
            </div>
          </div>
        )}
        {occupiedApartments.length === 0 ? (
          <div className="text-center py-8">
            <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-600 text-lg">No occupied apartments at the moment</p>
            <Button 
              onClick={() => fetchOccupiedApartments()} 
              variant="outline" 
              className="mt-4"
            >
              Refresh
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex justify-end">
              <Button 
                onClick={() => fetchOccupiedApartments()} 
                variant="outline"
                size="sm"
              >
                Refresh
              </Button>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Booked By</TableHead>
                    <TableHead>Apartment Name</TableHead>
                    <TableHead>Type</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Occupied Date</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {occupiedApartments.map((apt) => (
                  <TableRow key={apt.id}>
                    <TableCell className="font-medium">
                      {apt.booked_by_name}
                      {apt.booked_by_email && (
                        <span className="block text-xs text-gray-500">{apt.booked_by_email}</span>
                      )}
                    </TableCell>
                    <TableCell>{apt.apartment_name}</TableCell>
                    <TableCell>{apt.apartment_type}</TableCell>
                    <TableCell className="font-semibold">RWF {Number(apt.apartment_price).toLocaleString()}</TableCell>
                    <TableCell>{apt.occupied_date ? new Date(apt.occupied_date).toLocaleDateString() : "—"}</TableCell>
                    <TableCell className="text-sm text-gray-600">{apt.notes || "-"}</TableCell>
                    <TableCell>
                      <Button
                        variant="destructive"
                        size="sm"
                        disabled={deleting === apt.id}
                        onClick={() => handleRemoveOccupied(apt.id, apt.apartment_id)}
                        className="gap-2"
                      >
                        <Trash2 className="h-4 w-4" />
                        Remove
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
