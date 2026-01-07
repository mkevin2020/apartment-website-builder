"use client"

import { useState, useEffect } from "react"
import { createBrowserClient } from "@supabase/ssr"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { SiteHeader } from "@/components/site-header"
import { SiteFooter } from "@/components/site-footer"

interface Apartment {
  id: number
  name: string
  type: string
  bedrooms: number
  bathrooms: number
  price_per_month: number
  description?: string
}

export default function BookingPage() {
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [apartments, setApartments] = useState<Apartment[]>([])
  const [apartmentsLoading, setApartmentsLoading] = useState(true)
  const [formData, setFormData] = useState({
    client_name: "",
    client_email: "",
    client_phone: "",
    apartment_id: "",
    move_in_date: "",
    move_out_date: "",
  })

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )

  // Fetch available apartments on component mount
  useEffect(() => {
    const fetchApartments = async () => {
      try {
        const { data, error } = await supabase
          .from("apartments")
          .select("*")
          .eq("is_available", true)
          .order("name")

        if (error) {
          console.error("Error fetching apartments:", error)
        } else {
          setApartments(data || [])
        }
      } catch (err) {
        console.error("Exception fetching apartments:", err)
      } finally {
        setApartmentsLoading(false)
      }
    }

    fetchApartments()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const bookingData = {
        client_name: formData.client_name,
        email: formData.client_email,
        phone_number: formData.client_phone,
        apartment_id: parseInt(formData.apartment_id),
        start_date: formData.move_in_date,
        end_date: formData.move_out_date,
        status: "pending",
      }

      console.log("Submitting booking:", bookingData)

      const { error } = await supabase.from("bookings").insert([bookingData])

      if (error) {
        console.error("Booking error:", error)
        alert("Error submitting booking: " + error.message)
        setLoading(false)
        return
      }

      alert("Booking submitted successfully!")
      setSuccess(true)
      setFormData({
        client_name: "",
        client_email: "",
        client_phone: "",
        apartment_id: "",
        move_in_date: "",
        move_out_date: "",
      })

      setTimeout(() => setSuccess(false), 3000)
    } catch (err) {
      console.error("Error:", err)
      alert("An error occurred")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />

      <main className="container mx-auto px-4 py-12">
        <div className="max-w-2xl mx-auto">
          <Card>
            <CardHeader>
              <CardTitle>Book an Apartment</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Select Apartment</label>
                  {apartmentsLoading ? (
                    <p className="text-gray-500 p-2">Loading apartments...</p>
                  ) : apartments.length > 0 ? (
                    <select
                      className="w-full p-2 border rounded"
                      value={formData.apartment_id}
                      onChange={(e) => setFormData({ ...formData, apartment_id: e.target.value })}
                      required
                    >
                      <option value="">Select an apartment</option>
                      {apartments.map((apt) => (
                        <option key={apt.id} value={apt.id}>
                          {apt.name} - {apt.bedrooms} BR / {apt.bathrooms} BA - ${apt.price_per_month}/mo
                        </option>
                      ))}
                    </select>
                  ) : (
                    <p className="text-red-500 p-2">No apartments available for booking</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Full Name</label>
                  <Input
                    type="text"
                    placeholder="Your name"
                    value={formData.client_name}
                    onChange={(e) => setFormData({ ...formData, client_name: e.target.value })}
                    required
                  />
                </div> 

                <div>
                  <label className="block text-sm font-medium mb-2">Email</label>
                  <Input
                    type="email"
                    placeholder="Your email"
                    value={formData.client_email}
                    onChange={(e) => setFormData({ ...formData, client_email: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Phone Number</label>
                  <Input
                    type="tel"
                    placeholder="Your phone"
                    value={formData.client_phone}
                    onChange={(e) => setFormData({ ...formData, client_phone: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Move-in Date</label>
                  <Input
                    type="date"
                    value={formData.move_in_date}
                    onChange={(e) => setFormData({ ...formData, move_in_date: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Move-out Date</label>
                  <Input
                    type="date"
                    value={formData.move_out_date}
                    onChange={(e) => setFormData({ ...formData, move_out_date: e.target.value })}
                    required
                  />
                </div>

                {success && <p className="text-green-600">Booking submitted successfully!</p>}

                <Button type="submit" disabled={loading} className="w-full">
                  {loading ? "Submitting..." : "Submit Booking"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </main>

      <SiteFooter />
    </div>
  )
}
