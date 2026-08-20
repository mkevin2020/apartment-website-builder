"use client"

import { useState } from "react"
import { dataClient } from "@/lib/data-client";
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { SiteHeader } from "@/components/site-header"
import { SiteFooter } from "@/components/site-footer"
import { Star, MessageSquare, Mail, User, MapPin, Phone } from "lucide-react"

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

  const supabase = dataClient()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const { error } = await supabase.from("client_feedback").insert([{
        ...formData,
        rating: rating,
      }])

      if (error) {
        alert("Error sending message: " + error.message)
        return
      }

      setSuccess(true)
      setFormData({ name: "", email: "", message: "" })
      setRating(0)

      setTimeout(() => setSuccess(false), 5000)
    } catch (err) {
      console.error("Error:", err)
      alert("An error occurred")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 font-sans transition-colors pt-24">
      <SiteHeader />

      <main className="max-w-6xl mx-auto px-4 py-12">
        <div className="text-center mb-16">
          <h1 className="text-4xl md:text-5xl font-extrabold text-slate-900 dark:text-white mb-6">Contact & Feedback</h1>
          <p className="text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
            We'd love to hear from you. Have a question about our apartments? Want to leave a review of your stay? Let us know below!
          </p>
        </div>

        <div className="grid md:grid-cols-5 gap-12 items-start">
          
          {/* Contact Details Side */}
          <div className="md:col-span-2 space-y-8">
            <div className="bg-white dark:bg-slate-950 p-8 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm">
              <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-6">Get in Touch</h3>
              
              <div className="space-y-6">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-full bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
                    <MapPin className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-slate-900 dark:text-white">Our Location</h4>
                    <p className="text-slate-600 dark:text-slate-400">Karama Sector, Kigali, Rwanda</p>
                  </div>
                </div>
                
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-full bg-amber-50 dark:bg-amber-900/30 flex items-center justify-center shrink-0">
                    <Phone className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-slate-900 dark:text-white">Phone</h4>
                    <p className="text-slate-600 dark:text-slate-400">+250 788 123 456</p>
                    <p className="text-xs text-slate-500 mt-1">Available 24/7</p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-full bg-green-50 dark:bg-green-900/30 flex items-center justify-center shrink-0">
                    <Mail className="w-5 h-5 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-slate-900 dark:text-white">Email</h4>
                    <p className="text-slate-600 dark:text-slate-400">info@cielovistakigali.com</p>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="bg-amber-500 rounded-3xl p-8 text-white relative overflow-hidden">
               <div className="absolute -right-6 -bottom-6 opacity-20">
                 <MessageSquare className="w-32 h-32" />
               </div>
               <h3 className="text-xl font-bold mb-2 relative z-10">Client Support</h3>
               <p className="text-amber-100 relative z-10 text-sm">
                 Our dedicated property management team is on standby to assist with any booking inquiries or technical issues.
               </p>
            </div>
          </div>

          {/* Form Side */}
          <div className="md:col-span-3">
            <Card className="bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 shadow-xl dark:shadow-slate-900/50 rounded-3xl overflow-hidden">
              <div className="h-2 w-full bg-blue-600"></div>
              <CardContent className="p-8 md:p-10">
                {success ? (
                  <div className="flex flex-col items-center justify-center text-center py-12 space-y-4">
                    <div className="w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-4">
                      <Star className="w-10 h-10 text-green-600 dark:text-green-400" />
                    </div>
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Message Sent Successfully!</h2>
                    <p className="text-slate-600 dark:text-slate-400">
                      Thank you for your feedback. We appreciate you taking the time to share your thoughts.
                    </p>
                    <Button onClick={() => setSuccess(false)} variant="outline" className="mt-6 border-slate-200 dark:border-slate-700 dark:text-white">
                      Send Another Message
                    </Button>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="grid md:grid-cols-2 gap-6">
                      <div className="space-y-3">
                        <label className="text-sm font-semibold text-slate-900 dark:text-slate-200 flex items-center gap-2">
                          <User className="w-4 h-4 text-blue-600" /> Your Name
                        </label>
                        <Input
                          type="text"
                          placeholder="Jane Doe"
                          className="h-12 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 dark:text-white rounded-xl focus-visible:ring-blue-500"
                          value={formData.name}
                          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                          required
                        />
                      </div>
      
                      <div className="space-y-3">
                        <label className="text-sm font-semibold text-slate-900 dark:text-slate-200 flex items-center gap-2">
                          <Mail className="w-4 h-4 text-blue-600" /> Your Email
                        </label>
                        <Input
                          type="email"
                          placeholder="jane@example.com"
                          className="h-12 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 dark:text-white rounded-xl focus-visible:ring-blue-500"
                          value={formData.email}
                          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                          required
                        />
                      </div>
                    </div>

                    <div className="space-y-3">
                      <label className="text-sm font-semibold text-slate-900 dark:text-slate-200 flex items-center gap-2">
                         Experience Rating
                      </label>
                      <div className="flex gap-2">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <button
                            key={star}
                            type="button"
                            onClick={() => setRating(star)}
                            onMouseEnter={() => setHoverRating(star)}
                            onMouseLeave={() => setHoverRating(0)}
                            className="focus:outline-none transition transform hover:scale-110 active:scale-95"
                          >
                            <Star
                              size={32}
                              className={`transition-colors ${
                                star <= (hoverRating || rating)
                                  ? "fill-amber-400 text-amber-400"
                                  : "text-slate-200 dark:text-slate-700 hover:text-amber-200"
                              }`}
                            />
                          </button>
                        ))}
                      </div>
                      <p className="text-sm text-slate-500 dark:text-slate-400">
                        {rating > 0 ? `${rating} out of 5 stars` : "Optional: Rate your experience"}
                      </p>
                    </div>
    
                    <div className="space-y-3">
                      <label className="text-sm font-semibold text-slate-900 dark:text-slate-200 flex items-center gap-2">
                        <MessageSquare className="w-4 h-4 text-blue-600" /> Your Message
                      </label>
                      <textarea
                        placeholder="How can we help you? Or tell us about your stay..."
                        className="w-full p-4 border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none transition-shadow min-h-[150px] resize-y"
                        value={formData.message}
                        onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                        required
                      />
                    </div>
    
                    <div className="pt-2">
                      <Button type="submit" disabled={loading} className="w-full h-14 text-lg bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-lg hover:shadow-blue-600/25 transition-all">
                        {loading ? "Sending..." : "Send Message"}
                      </Button>
                    </div>
                  </form>
                )}
              </CardContent>
            </Card>            
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  )
}
