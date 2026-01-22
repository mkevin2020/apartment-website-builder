"use client"

import { useState, useEffect } from "react"
import { createBrowserClient } from "@supabase/ssr"
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
}

export function OccupiedApartmentsManager() {
  const [occupiedApartments, setOccupiedApartments] = useState<OccupiedApartment[]>([])
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )

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
      
      const { data, error } = await supabase
        .from("occupied_apartments")
        .select(`
          id,
          apartment_id,
          booking_id,
          tenant_id,
          marked_by_employee_id,
          occupied_date,
          notes,
          created_at,
          apartments(id, name, type, price_per_month)
        `)
        .order("occupied_date", { ascending: false })

      if (error) {
        console.error("Fetch error:", error)
        setError(`Error fetching occupied apartments: ${error.message}`)
        setLoading(false)
        return
      }

      console.log("Occupied apartments data:", data)

      if (!data || data.length === 0) {
        console.log("No occupied apartments found")
        setOccupiedApartments([])
        setLoading(false)
        return
      }

      const formattedData = (data || []).map((item: any) => ({
        id: item.id,
        apartment_id: item.apartment_id,
        booking_id: item.booking_id,
        tenant_id: item.tenant_id,
        marked_by_employee_id: item.marked_by_employee_id,
        occupied_date: item.occupied_date,
        notes: item.notes,
        created_at: item.created_at,
        apartment_name: item.apartments?.name || "Unknown",
        apartment_type: item.apartments?.type || "N/A",
        apartment_price: item.apartments?.price_per_month || 0,
      }))

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
      // Delete from occupied_apartments
      const { error: deleteError } = await supabase
        .from("occupied_apartments")
        .delete()
        .eq("id", id)

      if (deleteError) {
        alert("Error removing occupied status: " + deleteError.message)
        setDeleting(null)
        return
      }

      // Set apartment back to available
      const { error: updateError } = await supabase
        .from("apartments")
        .update({ is_available: true })
        .eq("id", apartmentId)

      if (updateError) {
        alert("Error updating apartment availability: " + updateError.message)
        setDeleting(null)
        return
      }

      alert("Occupied status removed and apartment is now available again!")
      await fetchOccupiedApartments()
    } catch (err) {
      console.error("Error:", err)
      alert("An error occurred while removing the occupied status")
      setDeleting(null)
    }
  }

  if (loading) {
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
                    <TableHead>Apartment Name</TableHead>
                    <TableHead>Type</TableHead>
                  <TableHead>Price/Month</TableHead>
                  <TableHead>Tenant ID</TableHead>
                  <TableHead>Occupied Date</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {occupiedApartments.map((apt) => (
                  <TableRow key={apt.id}>
                    <TableCell className="font-medium">{apt.apartment_name}</TableCell>
                    <TableCell>{apt.apartment_type}</TableCell>
                    <TableCell>${apt.apartment_price}</TableCell>
                    <TableCell className="text-sm text-gray-600">{apt.tenant_id.slice(0, 8)}...</TableCell>
                    <TableCell>{new Date(apt.occupied_date).toLocaleDateString()}</TableCell>
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
