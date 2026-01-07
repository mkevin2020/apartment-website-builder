"use client"

import { useState } from "react"
import { createBrowserClient } from "@supabase/ssr"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { SiteHeader } from "@/components/site-header"
import { SiteFooter } from "@/components/site-footer"
import { Star } from "lucide-react"

export default function ContactPage() {
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [rating, setRating] = useState(0)
  const [hoverRating, setHoverRating] = useState(0)
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    message: "",
  })

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const feedbackData = {
        ...formData,
        rating: rating,
      }

      const { error } = await supabase.from("client_feedback").insert([feedbackData])

      if (error) {
        alert("Error sending feedback: " + error.message)
        console.error("Feedback error:", error)
        return
      }

      alert("Feedback sent successfully!")
      setSuccess(true)
      setFormData({ name: "", email: "", message: "" })
      setRating(0)

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
              <CardTitle>Contact Us & Share Your Feedback</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Name</label>
                  <Input
                    type="text"
                    placeholder="Your name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Email</label>
                  <Input
                    type="email"
                    placeholder="Your email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Rating</label>
                  <div className="flex gap-2">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setRating(star)}
                        onMouseEnter={() => setHoverRating(star)}
                        onMouseLeave={() => setHoverRating(0)}
                        className="focus:outline-none transition"
                      >
                        <Star
                          size={24}
                          className={`${
                            star <= (hoverRating || rating)
                              ? "fill-yellow-400 text-yellow-400"
                              : "text-gray-300"
                          }`}
                        />
                      </button>
                    ))}
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    {rating > 0 ? `${rating} star${rating !== 1 ? "s" : ""}` : "Select a rating"}
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Message</label>
                  <textarea
                    placeholder="Your feedback message"
                    className="w-full p-2 border rounded"
                    rows={6}
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    required
                  />
                </div>

                {success && <p className="text-green-600">Feedback sent successfully!</p>}

                <Button type="submit" disabled={loading || rating === 0} className="w-full">
                  {loading ? "Sending..." : "Send Feedback"}
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
