"use client"

import { useState, useEffect } from "react"
import { dataClient } from "@/lib/data-client";
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

function formatSupabaseError(error: any) {
  if (!error) return "Unknown Supabase error"
  if (typeof error === "string") return error
  try {
    return JSON.stringify(error, Object.getOwnPropertyNames(error), 2)
  } catch {
    return String(error)
  }
}

export function ApartmentsManager() {
  const [apartments, setApartments] = useState<any[]>([])
  const [bookings, setBookings] = useState<any[]>([])
  const [detailsApt, setDetailsApt] = useState<any | null>(null)
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [uploadingVideo, setUploadingVideo] = useState(false)
  const MAX_PHOTOS = 8
  const [formData, setFormData] = useState({
    name: "",
    type: "",
    description: "",
    bedrooms: 1,
    bathrooms: 1,
    size_sqm: 50,
    price_per_month: "",
    price_per_day: "",
    image_url: "",
    image_urls: [] as string[],
    video_url: "",
  })
  const supabase = dataClient()

  useEffect(() => {
    fetchApartments()
    fetchBookings()
  }, [])

  const fetchApartments = async () => {
    try {
      if (false) {
        console.error("Supabase env vars are missing", {
          hasUrl: true,
          hasAnonKey: true,
        })
        return
      }

      const { data, error } = await supabase.from("apartments").select("*")
      if (error) {
        console.error("Fetch error:", formatSupabaseError(error), error)
        return
      }
      setApartments(data || [])
    } catch (err) {
      console.error("Exception:", err)
    }
  }

  const fetchBookings = async () => {
    try {
      if (false) {
        console.error("Supabase env vars are missing", {
          hasUrl: true,
          hasAnonKey: true,
        })
        return
      }

      const { data, error } = await supabase
        .from("bookings")
        .select("*")
        .order("start_date", { ascending: false })

      if (error) {
        console.error("Fetch error:", formatSupabaseError(error), error)
        return
      }

      setBookings(data || [])
    } catch (err) {
      console.error("Error fetching bookings:", err)
    }
  }

  // Latest booking for an apartment = its current occupant
  const occupantOf = (apartmentId: number) =>
    bookings.find((b) => String(b.apartment_id) === String(apartmentId))

  // Insert (editingId null) or update a row. If the gallery columns (image_urls/video_url)
  // don't exist in the DB yet, retry without them so the apartment still saves.
  const insertOrUpdateResilient = async (
    data: Record<string, any>,
    editId: number | null,
  ): Promise<{ message: string } | null> => {
    const run = async (payload: Record<string, any>) => {
      if (editId) {
        return await supabase.from("apartments").update(payload).eq("id", editId)
      }
      return await supabase.from("apartments").insert([payload])
    }

    let { error } = await run(data)
    if (error && /image_urls|video_url/i.test(error.message)) {
      const { image_urls: _a, video_url: _b, ...withoutGallery } = data
      void _a
      void _b
      ;({ error } = await run(withoutGallery))
    }
    return error
  }

  const uploadOne = async (file: File): Promise<string> => {
    const body = new FormData()
    body.append("file", file)
    const res = await fetch("/api/upload-apartment-image", { method: "POST", body })
    const result = await res.json()
    if (!res.ok) throw new Error(result.error || "Upload failed")
    return result.url as string
  }

  // Upload one or more photos (up to MAX_PHOTOS total)
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return

    const remaining = MAX_PHOTOS - formData.image_urls.length
    if (remaining <= 0) {
      alert(`You can upload up to ${MAX_PHOTOS} photos.`)
      e.target.value = ""
      return
    }
    const toUpload = files.slice(0, remaining)

    setUploading(true)
    try {
      const urls: string[] = []
      for (const file of toUpload) {
        urls.push(await uploadOne(file))
      }
      setFormData((prev) => {
        const gallery = [...prev.image_urls, ...urls].slice(0, MAX_PHOTOS)
        return { ...prev, image_urls: gallery, image_url: prev.image_url || gallery[0] || "" }
      })
      if (files.length > remaining) {
        alert(`Added ${remaining} photo(s). Limit is ${MAX_PHOTOS}.`)
      }
    } catch (err: any) {
      console.error("Upload exception:", err)
      alert("Error uploading image: " + (err?.message || err))
    } finally {
      setUploading(false)
      e.target.value = ""
    }
  }

  // Upload a single tour video
  const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploadingVideo(true)
    try {
      const url = await uploadOne(file)
      setFormData((prev) => ({ ...prev, video_url: url }))
    } catch (err: any) {
      console.error("Video upload exception:", err)
      alert("Error uploading video: " + (err?.message || err))
    } finally {
      setUploadingVideo(false)
      e.target.value = ""
    }
  }

  const removePhoto = (url: string) => {
    setFormData((prev) => {
      const gallery = prev.image_urls.filter((u) => u !== url)
      return {
        ...prev,
        image_urls: gallery,
        image_url: prev.image_url === url ? gallery[0] || "" : prev.image_url,
      }
    })
  }

  const makeCover = (url: string) => {
    setFormData((prev) => ({ ...prev, image_url: url }))
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
        price_per_day: parseFloat(formData.price_per_day) || 0,
        image_url: formData.image_url || formData.image_urls[0] || "",
        image_urls: formData.image_urls,
        video_url: formData.video_url || null,
        is_available: true,
      }

      console.log("Inserting apartment:", dataToInsert)

      const error = await insertOrUpdateResilient(dataToInsert, null)

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
      price_per_day: apartment.price_per_day != null ? apartment.price_per_day.toString() : "",
      image_url: apartment.image_url || "",
      image_urls: Array.isArray(apartment.image_urls)
        ? apartment.image_urls
        : apartment.image_url
          ? [apartment.image_url]
          : [],
      video_url: apartment.video_url || "",
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
        price_per_day: parseFloat(formData.price_per_day) || 0,
        image_url: formData.image_url || formData.image_urls[0] || "",
        image_urls: formData.image_urls,
        video_url: formData.video_url || null,
      }

      const error = await insertOrUpdateResilient(dataToUpdate, editingId)

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

  // Mark an apartment occupied (is_available=false) or available (is_available=true)
  const toggleAvailability = async (apt: any) => {
    const makeOccupied = apt.is_available // currently available -> mark occupied
    const verb = makeOccupied ? "occupied" : "available"
    try {
      // Freeing a unit somebody is living in effectively evicts them, so warn by
      // name first. Tenancy is recorded in `bookings` (occupied_apartments is
      // unused), which is also what the tenant's vacate notice is derived from.
      let occupant: any = null
      if (!makeOccupied) {
        const { data: bks } = await supabase
          .from("bookings")
          .select("id, tenant_id, client_name, end_date")
          .eq("apartment_id", apt.id)
          .eq("status", "confirmed")
          .order("start_date", { ascending: false })
          .limit(1)
        occupant = bks?.[0] || null

        if (occupant) {
          const who = occupant.client_name || "the current tenant"
          const until = occupant.end_date ? ` (booked until ${occupant.end_date})` : ""
          const proceed = confirm(
            `⚠ ${apt.name} is currently occupied by ${who}${until}.\n\n` +
              `Marking it available means ${who} has to move out. They will be notified ` +
              `on their tenant dashboard that they must vacate the apartment.\n\n` +
              `Are you sure you want to continue?`
          )
          if (!proceed) return
        }
      }

      const { error } = await supabase
        .from("apartments")
        .update({ is_available: !makeOccupied })
        .eq("id", apt.id)
      if (error) {
        alert("Error: " + error.message)
        return
      }
      // When freeing an apartment, clear any stale occupied record (best-effort).
      // The booking is deliberately left alone: the tenant's "you must move out"
      // notice is derived from (confirmed booking + apartment now available), so
      // cancelling it here would silently swallow the notification.
      if (!makeOccupied) {
        await supabase.from("occupied_apartments").delete().eq("apartment_id", apt.id)
      }
      await fetchApartments()

      if (occupant) {
        alert(
          `${apt.name} is now available.\n\n${occupant.client_name || "The tenant"} has been ` +
            `notified on their dashboard that they must move out.`
        )
      }
    } catch (err) {
      console.error("Error toggling availability:", err)
      alert(`Could not mark apartment ${verb}.`)
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
      price_per_day: "",
      image_url: "",
      image_urls: [],
      video_url: "",
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
              <div>
                <label className="block text-sm font-medium mb-1">Apartment Name</label>
                <Input
                  placeholder="Apartment Name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Type</label>
                <Input
                  placeholder="Type (Studio, 1BR, 2BR)"
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Bedrooms</label>
                <Input
                  placeholder="Bedrooms"
                  type="number"
                  value={formData.bedrooms}
                  onChange={(e) => setFormData({ ...formData, bedrooms: parseInt(e.target.value) || 1 })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Bathrooms</label>
                <Input
                  placeholder="Bathrooms"
                  type="number"
                  value={formData.bathrooms}
                  onChange={(e) => setFormData({ ...formData, bathrooms: parseInt(e.target.value) || 1 })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Size (sqm)</label>
                <Input
                  placeholder="Size (sqm)"
                  type="number"
                  value={formData.size_sqm}
                  onChange={(e) => setFormData({ ...formData, size_sqm: parseInt(e.target.value) || 50 })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Price per Month (RWF)</label>
                <Input
                  placeholder="Price per Month (RWF)"
                  type="number"
                  value={formData.price_per_month}
                  onChange={(e) => setFormData({ ...formData, price_per_month: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Price per Day (RWF)</label>
                <Input
                  placeholder="Price per Day (RWF)"
                  type="number"
                  value={formData.price_per_day}
                  onChange={(e) => setFormData({ ...formData, price_per_day: e.target.value })}
                  required
                />
              </div>
            </div>
            
            <textarea
              placeholder="Description"
              className="w-full p-2 border rounded"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            />

            {/* Photo gallery upload (up to 8) */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Apartment Photos ({formData.image_urls.length}/{MAX_PHOTOS})
              </label>
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={handleFileUpload}
                disabled={uploading || formData.image_urls.length >= MAX_PHOTOS}
                className="w-full p-2 border rounded"
              />
              <p className="text-xs text-muted-foreground mt-1">
                You can select multiple photos at once. The first photo is the cover (shown on cards).
              </p>
              {uploading && <p className="text-sm text-blue-600 mt-1">Uploading photos...</p>}

              {formData.image_urls.length > 0 && (
                <div className="grid grid-cols-4 gap-3 mt-3">
                  {formData.image_urls.map((url) => {
                    const isCover = url === formData.image_url
                    return (
                      <div key={url} className="relative group">
                        <img
                          src={url}
                          alt="Apartment"
                          className={`w-full h-20 object-cover rounded border-2 ${
                            isCover ? "border-blue-500" : "border-transparent"
                          }`}
                        />
                        {isCover && (
                          <span className="absolute top-1 left-1 bg-blue-600 text-white text-[10px] px-1.5 py-0.5 rounded">
                            Cover
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => removePhoto(url)}
                          className="absolute top-1 right-1 bg-red-600 text-white rounded-full w-5 h-5 text-xs flex items-center justify-center"
                          title="Remove"
                        >
                          ×
                        </button>
                        {!isCover && (
                          <button
                            type="button"
                            onClick={() => makeCover(url)}
                            className="absolute bottom-1 left-1 right-1 bg-black/60 text-white text-[10px] py-0.5 rounded opacity-0 group-hover:opacity-100 transition"
                          >
                            Set cover
                          </button>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Tour video upload (one) */}
            <div>
              <label className="block text-sm font-medium mb-2">Apartment Tour Video (optional)</label>
              <input
                type="file"
                accept="video/*"
                onChange={handleVideoUpload}
                disabled={uploadingVideo}
                className="w-full p-2 border rounded"
              />
              <p className="text-xs text-muted-foreground mt-1">One short video, up to 50MB.</p>
              {uploadingVideo && <p className="text-sm text-blue-600 mt-1">Uploading video...</p>}

              {formData.video_url && (
                <div className="mt-3 relative inline-block">
                  <video src={formData.video_url} controls className="w-64 rounded border" />
                  <button
                    type="button"
                    onClick={() => setFormData((prev) => ({ ...prev, video_url: "" }))}
                    className="absolute top-1 right-1 bg-red-600 text-white rounded-full w-6 h-6 text-sm flex items-center justify-center"
                    title="Remove video"
                  >
                    ×
                  </button>
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <Button type="submit" disabled={loading || uploading || uploadingVideo} className="flex-1">
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
                  <TableHead>Status</TableHead>
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
                    <TableCell>RWF {Number(apt.price_per_month || 0).toLocaleString()}</TableCell>
                    <TableCell>
                      {apt.is_available ? (
                        <span className="inline-block px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          Available
                        </span>
                      ) : (
                        <button
                          onClick={() => setDetailsApt(apt)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800 hover:bg-red-200"
                          title="View occupant details"
                        >
                          Occupied <span className="underline">details</span>
                        </button>
                      )}
                    </TableCell>
                    <TableCell className="space-x-2 whitespace-nowrap">
                      <Button
                        variant="outline"
                        size="sm"
                        className={
                          apt.is_available
                            ? "border-red-200 text-red-600 hover:bg-red-50"
                            : "border-green-200 text-green-600 hover:bg-green-50"
                        }
                        onClick={() => toggleAvailability(apt)}
                      >
                        {apt.is_available ? "Mark Occupied" : "Mark Available"}
                      </Button>
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

      {/* Occupant details modal */}
      {detailsApt && (() => {
        const occ = occupantOf(detailsApt.id)
        return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
            onClick={() => setDetailsApt(null)}
          >
            <div
              className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 shadow-2xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-5">
                <p className="text-white/80 text-xs uppercase tracking-wider">Occupied Unit</p>
                <h3 className="text-xl font-bold">{detailsApt.name}</h3>
                <p className="text-white/90 text-sm">{detailsApt.type || "Apartment"}</p>
              </div>
              <div className="p-5 space-y-3">
                {occ ? (
                  <>
                    <DetailRow label="Occupied by" value={occ.client_name || "—"} />
                    <DetailRow label="Email" value={occ.email || "—"} />
                    <DetailRow label="Phone" value={occ.phone_number || "—"} />
                    <DetailRow
                      label="Check-in"
                      value={occ.start_date ? new Date(occ.start_date).toLocaleDateString() : "—"}
                    />
                    <DetailRow
                      label="Check-out"
                      value={occ.end_date ? new Date(occ.end_date).toLocaleDateString() : "—"}
                    />
                    <DetailRow label="Booking status" value={occ.status || "—"} />
                    <DetailRow
                      label="Monthly price"
                      value={`RWF ${Number(detailsApt.price_per_month || 0).toLocaleString()}`}
                    />
                  </>
                ) : (
                  <p className="text-center text-slate-500 dark:text-slate-400 py-6">
                    This unit is marked occupied, but no booking record was found for it.
                  </p>
                )}
              </div>
              <div className="p-4 border-t border-slate-100 dark:border-slate-700 flex justify-end">
                <Button variant="outline" onClick={() => setDetailsApt(null)}>Close</Button>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center gap-4 border-b border-slate-100 dark:border-slate-800 pb-2">
      <span className="text-sm text-slate-500 dark:text-slate-400">{label}</span>
      <span className="text-sm font-medium text-slate-900 dark:text-white text-right">{value}</span>
    </div>
  )
}
