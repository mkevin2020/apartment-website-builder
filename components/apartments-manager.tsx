"use client"

import { useState, useEffect } from "react"
import { createBrowserClient } from "@supabase/ssr"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

export function ApartmentsManager() {
  const [apartments, setApartments] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [formData, setFormData] = useState({
    name: "",
    type: "",
    description: "",
    bedrooms: 1,
    bathrooms: 1,
    size_sqm: 50,
    price_per_month: "",
    image_url: "",
  })

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )

  useEffect(() => {
    fetchApartments()
  }, [])

  const fetchApartments = async () => {
    try {
      const { data, error } = await supabase.from("apartments").select("*")
      if (error) {
        console.error("Fetch error:", error)
        return
      }
      setApartments(data || [])
    } catch (err) {
      console.error("Exception:", err)
    }
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    try {
      const filename = `${Date.now()}-${file.name}`
      console.log("Uploading to bucket: apartments, file:", filename)
      
      const { error: uploadError, data: uploadData } = await supabase.storage
        .from("apartments")
        .upload(filename, file)

      if (uploadError) {
        console.error("Upload error details:", uploadError)
        alert("Error uploading image: " + uploadError.message)
        setUploading(false)
        return
      }

      console.log("Upload successful, data:", uploadData)

      const { data } = supabase.storage
        .from("apartments")
        .getPublicUrl(filename)

      console.log("Public URL:", data.publicUrl)
      setFormData({ ...formData, image_url: data.publicUrl })
      alert("Image uploaded successfully!")
    } catch (err) {
      console.error("Upload exception:", err)
      alert("Error: " + err)
    } finally {
      setUploading(false)
    }
  }

  const handleAddApartment = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const dataToInsert = {
        name: formData.name,
        type: formData.type,
        description: formData.description,
        bedrooms: parseInt(formData.bedrooms.toString()) || 1,
        bathrooms: parseInt(formData.bathrooms.toString()) || 1,
        size_sqm: parseInt(formData.size_sqm.toString()) || 50,
        price_per_month: parseFloat(formData.price_per_month) || 0,
        image_url: formData.image_url,
        is_available: true,
      }

      console.log("Inserting apartment:", dataToInsert)

      const { error } = await supabase.from("apartments").insert([dataToInsert])

      if (error) {
        console.error("Insert error:", error)
        alert("Error: " + error.message)
        setLoading(false)
        return
      }

      alert("Apartment added successfully!")
      resetForm()
      await fetchApartments()
    } catch (err) {
      console.error("Exception:", err)
      alert("Error: " + err)
    } finally {
      setLoading(false)
    }
  }

  const handleEditApartment = (apartment: any) => {
    setEditingId(apartment.id)
    setFormData({
      name: apartment.name,
      type: apartment.type,
      description: apartment.description,
      bedrooms: apartment.bedrooms,
      bathrooms: apartment.bathrooms,
      size_sqm: apartment.size_sqm,
      price_per_month: apartment.price_per_month.toString(),
      image_url: apartment.image_url || "",
    })
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  const handleUpdateApartment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingId) return

    setLoading(true)

    try {
      const dataToUpdate = {
        name: formData.name,
        type: formData.type,
        description: formData.description,
        bedrooms: parseInt(formData.bedrooms.toString()) || 1,
        bathrooms: parseInt(formData.bathrooms.toString()) || 1,
        size_sqm: parseInt(formData.size_sqm.toString()) || 50,
        price_per_month: parseFloat(formData.price_per_month) || 0,
        image_url: formData.image_url,
      }

      const { error } = await supabase
        .from("apartments")
        .update(dataToUpdate)
        .eq("id", editingId)

      if (error) {
        alert("Error: " + error.message)
        setLoading(false)
        return
      }

      alert("Apartment updated successfully!")
      resetForm()
      await fetchApartments()
    } catch (err) {
      console.error("Exception:", err)
      alert("Error: " + err)
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteApartment = async (id: number) => {
    if (!confirm("Delete this apartment?")) return

    try {
      const { error } = await supabase.from("apartments").delete().eq("id", id)
      if (error) {
        alert("Error: " + error.message)
        return
      }
      alert("Apartment deleted!")
      await fetchApartments()
    } catch (err) {
      console.error("Error:", err)
    }
  }

  const resetForm = () => {
    setEditingId(null)
    setFormData({
      name: "",
      type: "",
      description: "",
      bedrooms: 1,
      bathrooms: 1,
      size_sqm: 50,
      price_per_month: "",
      image_url: "",
    })
  }

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <CardTitle>{editingId ? "Edit Apartment" : "Add New Apartment"}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={editingId ? handleUpdateApartment : handleAddApartment} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Input
                placeholder="Apartment Name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
              <Input
                placeholder="Type (Studio, 1BR, 2BR)"
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                required
              />
              <Input
                placeholder="Bedrooms"
                type="number"
                value={formData.bedrooms}
                onChange={(e) => setFormData({ ...formData, bedrooms: parseInt(e.target.value) || 1 })}
              />
              <Input
                placeholder="Bathrooms"
                type="number"
                value={formData.bathrooms}
                onChange={(e) => setFormData({ ...formData, bathrooms: parseInt(e.target.value) || 1 })}
              />
              <Input
                placeholder="Size (sqm)"
                type="number"
                value={formData.size_sqm}
                onChange={(e) => setFormData({ ...formData, size_sqm: parseInt(e.target.value) || 50 })}
              />
              <Input
                placeholder="Price per Month"
                type="number"
                value={formData.price_per_month}
                onChange={(e) => setFormData({ ...formData, price_per_month: e.target.value })}
                required
              />
            </div>
            
            <textarea
              placeholder="Description"
              className="w-full p-2 border rounded"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            />

            <div>
              <label className="block text-sm font-medium mb-2">Upload Image</label>
              <input
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                disabled={uploading}
                className="w-full p-2 border rounded"
              />
              {uploading && <p className="text-sm text-blue-600 mt-1">Uploading...</p>}
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Or paste Image URL</label>
              <Input
                placeholder="https://example.com/image.jpg"
                value={formData.image_url}
                onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
              />
              
              {formData.image_url && (
                <div className="mt-2">
                  <p className="text-sm text-green-600">Preview:</p>
                  <img src={formData.image_url} alt="Preview" className="w-32 h-24 object-cover rounded mt-1" />
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <Button type="submit" disabled={loading || uploading} className="flex-1">
                {loading ? "Processing..." : editingId ? "Update Apartment" : "Add Apartment"}
              </Button>
              {editingId && (
                <Button type="button" variant="outline" onClick={resetForm}>
                  Cancel
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>All Apartments ({apartments.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Image</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Bedrooms</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {apartments.map((apt) => (
                  <TableRow key={apt.id}>
                    <TableCell>
                      {apt.image_url && (
                        <img src={apt.image_url} alt={apt.name} className="w-16 h-12 object-cover rounded" />
                      )}
                    </TableCell>
                    <TableCell>{apt.name}</TableCell>
                    <TableCell>{apt.type}</TableCell>
                    <TableCell>{apt.bedrooms}</TableCell>
                    <TableCell>${apt.price_per_month}</TableCell>
                    <TableCell className="space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEditApartment(apt)}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDeleteApartment(apt.id)}
                      >
                        Delete
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
