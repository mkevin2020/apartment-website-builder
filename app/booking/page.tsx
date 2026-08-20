"use client"

import { useState, useEffect } from "react"
import { dataClient } from "@/lib/data-client";
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { SiteHeader } from "@/components/site-header"
import { SiteFooter } from "@/components/site-footer"
import { Home, Calendar, User, Mail, Phone, CheckCircle } from "lucide-react"
import { sanitizePhone } from "@/lib/utils"
import { priceStay, DAYS_PER_MONTH, DAILY_LONG_STAY_THRESHOLD, DAILY_LONG_STAY_RATE } from "@/lib/booking-pricing"

interface Apartment {
  id: number
  name: string
  type: string
  bedrooms: number
  bathrooms: number
  price_per_month: number
  price_per_day?: number
  description?: string
}

type RateType = "daily" | "weekly" | "monthly"

// Add n days to a yyyy-mm-dd date, returning yyyy-mm-dd.
// Done in UTC on purpose: parsing as local midnight and formatting back with
// toISOString() loses a day in any timezone ahead of UTC (Kigali is UTC+2).
function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + "T00:00:00Z")
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

// Compute the check-out date from start date, rate type, quantity and any extra days.
// A "month" is DAYS_PER_MONTH days here, not a calendar month — the price is charged
// in 30-day blocks, so the dates have to line up with it or the server (which prices
// from the dates alone) would come out at a different total.
function computeCheckout(start: string, rate: RateType, qty: number, extraDays = 0): string {
  if (!start) return ""
  if (rate === "daily") return qty < 1 ? "" : addDays(start, qty)
  if (rate === "weekly") return qty < 1 ? "" : addDays(start, qty * 7)
  // Monthly may be 0 months + N days (a stay shorter than a full month)
  if (qty < 1 && extraDays < 1) return ""
  return addDays(start, qty * DAYS_PER_MONTH + extraDays)
}

// Total number of days a stay covers — what the pricing is actually based on
function stayDaysFor(rate: RateType, qty: number, extraDays = 0): number {
  if (rate === "daily") return qty
  if (rate === "weekly") return qty * 7
  return qty * DAYS_PER_MONTH + extraDays
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
  const [rateType, setRateType] = useState<RateType>("monthly")
  const [duration, setDuration] = useState(1)
  // Monthly bookings can add loose days on top of the whole months (e.g. 1 month + 10 days)
  const [extraDays, setExtraDays] = useState(0)
  const [verifying, setVerifying] = useState(false)
  const [cancelled, setCancelled] = useState(false)

  // Promo code — same flow as the tenant dashboard: validate → discount → redeem on booking
  const [promoInput, setPromoInput] = useState("")
  const [promo, setPromo] = useState<{ code: string; percent: number } | null>(null)
  const [promoChecking, setPromoChecking] = useState(false)
  const [promoMsg, setPromoMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null)

  const discounted = (t: number) => (promo ? Math.round(t * (1 - promo.percent / 100)) : t)

  const applyPromo = async () => {
    const code = promoInput.trim()
    if (!code) {
      setPromoMsg({ type: "err", text: "Enter a promo code." })
      return
    }
    setPromoChecking(true)
    setPromoMsg(null)
    try {
      const res = await fetch("/api/promo/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      })
      const data = await res.json()
      if (data.valid) {
        setPromo({ code: data.code, percent: data.discount_percent })
        setPromoMsg({ type: "ok", text: `Code applied — ${data.discount_percent}% off!` })
      } else {
        setPromo(null)
        setPromoMsg({ type: "err", text: data.error || "Invalid promo code." })
      }
    } catch {
      setPromo(null)
      setPromoMsg({ type: "err", text: "Could not check the code. Try again." })
    } finally {
      setPromoChecking(false)
    }
  }

  const clearPromo = () => {
    setPromo(null)
    setPromoInput("")
    setPromoMsg(null)
  }

  const supabase = dataClient()

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
          
          // Auto select if apartment ID is in URL params
          const urlParams = new URLSearchParams(window.location.search);
          const aptId = urlParams.get('apartment');
          if (aptId) {
             setFormData(prev => ({ ...prev, apartment_id: aptId }))
          }
        }
      } catch (err) {
        console.error("Exception fetching apartments:", err)
      } finally {
        setApartmentsLoading(false)
      }
    }

    fetchApartments()
  }, [])

  // Handle the return from Stripe Checkout (guest full payment).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const guestSession = params.get("guest_session")
    if (params.get("status") === "cancelled") {
      setCancelled(true)
      window.history.replaceState({}, "", "/booking")
      return
    }
    if (!guestSession) return

    setVerifying(true)
    fetch(`/api/bookings/guest?session_id=${guestSession}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.paid) setSuccess(true)
        else alert("Payment was not completed. Please try again.")
      })
      .catch(() => alert("Could not verify your payment. Check your email for a receipt."))
      .finally(() => {
        setVerifying(false)
        window.history.replaceState({}, "", "/booking")
      })
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const selectedApartment = apartments.find(
        (apt) => apt.id === parseInt(formData.apartment_id)
      )

      if (!selectedApartment) {
        alert("Please select a valid apartment")
        setLoading(false)
        return
      }

      // Monthly allows 0 months as long as some extra days were added (e.g. 3 weeks)
      const hasDuration = rateType === "monthly" ? duration >= 1 || extraDays >= 1 : duration >= 1

      if (!formData.move_in_date || !hasDuration) {
        alert("Please choose a start date and a valid duration")
        setLoading(false)
        return
      }

      const days = rateType === "monthly" ? extraDays : 0
      const checkout = computeCheckout(formData.move_in_date, rateType, duration, days)
      const stay = priceStay(selectedApartment, stayDaysFor(rateType, duration, days), rateType)
      const total = discounted(stay.subtotal)

      if (total <= 0) {
        alert("This apartment has no price for the selected rate. Please pick another rate.")
        setLoading(false)
        return
      }

      // Guests pay the FULL price upfront (no account = no balance to follow up).
      // Create booking + payment + Stripe Checkout, then redirect to pay.
      const res = await fetch("/api/bookings/guest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_name: formData.client_name,
          client_email: formData.client_email,
          client_phone: formData.client_phone,
          apartment_id: parseInt(formData.apartment_id),
          start_date: formData.move_in_date,
          end_date: checkout,
          // The server re-prices from the dates + rate and charges its own figure,
          // so this amount is only a cross-check against what the guest was shown.
          // Send the PRE-promo total — the server validates and applies the code itself.
          rate_type: rateType,
          amount: stay.subtotal,
          promo_code: promo?.code || null,
        }),
      })
      const data = await res.json()

      if (!res.ok || !data.url) {
        alert("Could not start payment: " + (data.error || "unknown error"))
        setLoading(false)
        return
      }

      // Consume one use of the promo code now that it's applied to a booking.
      if (promo?.code) {
        fetch("/api/promo/redeem", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code: promo.code }),
        }).catch(() => {})
      }

      // Off to Stripe to pay the full amount.
      window.location.href = data.url
    } catch (err) {
      console.error("Error:", err)
      alert("An error occurred")
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 font-sans transition-colors pt-24">
      <SiteHeader />

      <main className="max-w-4xl mx-auto px-4 py-12">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-extrabold text-slate-900 dark:text-white mb-4">Book Your Apartment</h1>
          <p className="text-lg text-slate-600 dark:text-slate-400">
            Secure your stay at Cielo Vista. Fill out the application form below.
          </p>
          <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 px-4 py-1.5 text-sm font-medium text-green-700 dark:text-green-400">
            <CheckCircle className="w-4 h-4" />
            No account needed — book as a guest
          </div>
        </div>

        <Card className="bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 shadow-xl dark:shadow-slate-900/50 rounded-2xl overflow-hidden">
          <div className="h-2 w-full bg-amber-500"></div>
          <CardContent className="p-8 md:p-12">

            {cancelled && !success && !verifying && (
              <div className="mb-6 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 px-4 py-3 text-sm text-amber-700 dark:text-amber-400">
                Payment was cancelled. You can complete your booking below whenever you&apos;re ready.
              </div>
            )}

            {verifying ? (
              <div className="flex flex-col items-center justify-center text-center py-20 space-y-4">
                <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
                <p className="text-slate-600 dark:text-slate-400">Confirming your payment…</p>
              </div>
            ) : success ? (
              <div className="flex flex-col items-center justify-center text-center py-16 space-y-4">
                <div className="w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-4">
                  <CheckCircle className="w-10 h-10 text-green-600 dark:text-green-400" />
                </div>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Payment Received — Booking Confirmed! 🎉</h2>
                <p className="text-slate-600 dark:text-slate-400 max-w-md">
                  Thank you for choosing Cielo Vista. Your full payment was received and your apartment is booked. A receipt with a QR code has been emailed to you — show it at reception when you check in.
                </p>
                <Button onClick={() => setSuccess(false)} variant="outline" className="mt-8 border-slate-200 dark:border-slate-700 dark:text-white">
                  Book Another Stay
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-8">
                {/* Apartment Selection */}
                <div className="space-y-3">
                  <label className="text-sm font-semibold text-slate-900 dark:text-slate-200 flex items-center gap-2">
                    <Home className="w-4 h-4 text-amber-500" /> Select Apartment
                  </label>
                  {apartmentsLoading ? (
                    <div className="w-full p-4 border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-500 rounded-lg animate-pulse">Loading available apartments...</div>
                  ) : apartments.length > 0 ? (
                    <select
                      className="w-full p-4 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500 transition-shadow appearance-none"
                      value={formData.apartment_id}
                      onChange={(e) => setFormData({ ...formData, apartment_id: e.target.value })}
                      required
                    >
                      <option value="" disabled>Choose an available property...</option>
                      {apartments.map((apt) => (
                        <option key={apt.id} value={apt.id}>
                          {apt.name} — {apt.bedrooms} Bed, {apt.bathrooms} Bath — RWF {Number(apt.price_per_month || 0).toLocaleString()}/mo
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="w-full p-4 border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-xl">No apartments currently available.</div>
                  )}
                </div>

                <div className="grid md:grid-cols-2 gap-8">
                  {/* Personal Info */}
                  <div className="space-y-6">
                    <div className="space-y-3">
                      <label className="text-sm font-semibold text-slate-900 dark:text-slate-200 flex items-center gap-2">
                        <User className="w-4 h-4 text-amber-500" /> Full Name
                      </label>
                      <Input
                        type="text"
                        placeholder="Full name"
                        className="h-12 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 dark:text-white rounded-xl focus-visible:ring-amber-500"
                        value={formData.client_name}
                        onChange={(e) => setFormData({ ...formData, client_name: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-3">
                      <label className="text-sm font-semibold text-slate-900 dark:text-slate-200 flex items-center gap-2">
                        <Mail className="w-4 h-4 text-amber-500" /> Email Address
                      </label>
                      <Input
                        type="email"
                        placeholder="Email address"
                        className="h-12 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 dark:text-white rounded-xl focus-visible:ring-amber-500"
                        value={formData.client_email}
                        onChange={(e) => setFormData({ ...formData, client_email: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-3">
                      <label className="text-sm font-semibold text-slate-900 dark:text-slate-200 flex items-center gap-2">
                        <Phone className="w-4 h-4 text-amber-500" /> Phone Number
                      </label>
                      <Input
                        type="tel"
                        inputMode="tel"
                        placeholder="+250788123456"
                        className="h-12 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 dark:text-white rounded-xl focus-visible:ring-amber-500"
                        value={formData.client_phone}
                        onChange={(e) => setFormData({ ...formData, client_phone: sanitizePhone(e.target.value) })}
                        required
                      />
                    </div>
                  </div>

                  {/* Stay duration & dates */}
                  <div className="space-y-6">
                    {/* Rate type */}
                    <div className="space-y-3">
                      <label className="text-sm font-semibold text-slate-900 dark:text-slate-200 flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-amber-500" /> Booking By
                      </label>
                      <div className="grid grid-cols-3 gap-2">
                        {(["daily", "weekly", "monthly"] as const).map((rt) => (
                          <button
                            key={rt}
                            type="button"
                            onClick={() => { setRateType(rt); setDuration(1); setExtraDays(0) }}
                            className={`p-3 rounded-xl border-2 text-sm font-semibold capitalize transition-all ${
                              rateType === rt
                                ? "border-amber-500 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400"
                                : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:border-amber-300"
                            }`}
                          >
                            {rt === "daily" ? "Day" : rt === "weekly" ? "Week" : "Month"}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Start date */}
                    <div className="space-y-3">
                      <label className="text-sm font-semibold text-slate-900 dark:text-slate-200 flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-amber-500" /> Move-in Date
                      </label>
                      <Input
                        type="date"
                        min={new Date().toISOString().slice(0, 10)}
                        className="h-12 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 dark:text-white rounded-xl focus-visible:ring-amber-500"
                        value={formData.move_in_date}
                        onChange={(e) => setFormData({ ...formData, move_in_date: e.target.value })}
                        required
                      />
                    </div>

                    {/* Duration quantity */}
                    <div className="space-y-3">
                      <label className="text-sm font-semibold text-slate-900 dark:text-slate-200 flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-amber-500" />
                        Number of {rateType === "daily" ? "Days" : rateType === "weekly" ? "Weeks" : "Months"}
                      </label>
                      <Input
                        type="number"
                        min={rateType === "monthly" ? 0 : 1}
                        className="h-12 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 dark:text-white rounded-xl focus-visible:ring-amber-500"
                        value={duration}
                        onChange={(e) => {
                          const min = rateType === "monthly" ? 0 : 1
                          setDuration(Math.max(min, parseInt(e.target.value) || min))
                        }}
                        required
                      />
                    </div>

                    {/* Extra days on top of the whole months — lets a guest book
                        "3 weeks" (0 months + 21 days) or "1 month + 10 days" */}
                    {rateType === "monthly" && (
                      <div className="space-y-3">
                        <label className="text-sm font-semibold text-slate-900 dark:text-slate-200 flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-amber-500" />
                          Extra Days <span className="font-normal text-slate-400">(optional)</span>
                        </label>
                        <Input
                          type="number"
                          min={0}
                          max={DAYS_PER_MONTH - 1}
                          className="h-12 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 dark:text-white rounded-xl focus-visible:ring-amber-500"
                          value={extraDays}
                          onChange={(e) =>
                            setExtraDays(Math.min(DAYS_PER_MONTH - 1, Math.max(0, parseInt(e.target.value) || 0)))
                          }
                        />
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          Staying less than a full month? Put 0 months and the number of days here — you&apos;ll be
                          charged the daily rate, never more than one month.
                        </p>
                      </div>
                    )}

                    {/* Promo code (optional) */}
                    <div>
                      <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-2">
                        Promo Code <span className="font-normal text-slate-400">(optional)</span>
                      </label>
                      <div className="flex gap-2">
                        <Input
                          type="text"
                          placeholder="e.g. WELCOME10"
                          className="h-12 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 dark:text-white rounded-xl focus-visible:ring-amber-500 uppercase"
                          value={promoInput}
                          onChange={(e) => setPromoInput(e.target.value.toUpperCase())}
                          disabled={!!promo}
                        />
                        {promo ? (
                          <Button type="button" variant="outline" onClick={clearPromo} className="h-12 rounded-xl px-4">
                            Remove
                          </Button>
                        ) : (
                          <Button
                            type="button"
                            onClick={applyPromo}
                            disabled={promoChecking}
                            className="h-12 rounded-xl px-4 bg-slate-800 hover:bg-slate-900 text-white"
                          >
                            {promoChecking ? "Checking…" : "Apply"}
                          </Button>
                        )}
                      </div>
                      {promoMsg && (
                        <p className={`text-xs mt-1.5 ${promoMsg.type === "ok" ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                          {promoMsg.text}
                        </p>
                      )}
                    </div>

                    {/* Auto-computed checkout + cost */}
                    {(() => {
                      const selectedApt = apartments.find((a) => a.id === parseInt(formData.apartment_id))
                      const days = rateType === "monthly" ? extraDays : 0
                      const stay = priceStay(selectedApt, stayDaysFor(rateType, duration, days), rateType)
                      const baseTotal = stay.subtotal
                      const total = discounted(baseTotal)
                      const checkout = computeCheckout(formData.move_in_date, rateType, duration, days)
                      const unitLabel = rateType === "daily" ? "day" : rateType === "weekly" ? "week" : "month"
                      // Weekly/daily bill off the daily price; monthly can use either
                      const hasPrice =
                        rateType === "monthly"
                          ? stay.monthlyPrice > 0 || stay.dailyPrice > 0
                          : stay.dailyPrice > 0
                      return (
                        <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-900/50 rounded-xl space-y-2">
                          {formData.move_in_date && checkout && (
                            <div className="flex justify-between text-sm">
                              <span className="text-slate-600 dark:text-slate-400">Move-out date</span>
                              <span className="font-semibold text-slate-900 dark:text-white">{checkout}</span>
                            </div>
                          )}
                          {selectedApt && hasPrice && (
                            <>
                              <div className="flex justify-between text-xs text-slate-500 dark:text-slate-500">
                                <span>Stay length</span>
                                <span>{stay.days} day{stay.days > 1 ? "s" : ""}</span>
                              </div>
                              {rateType === "monthly" ? (
                                <>
                                  {stay.months > 0 && (
                                    <div className="flex justify-between text-sm">
                                      <span className="text-slate-600 dark:text-slate-400">
                                        {stay.months} month{stay.months > 1 ? "s" : ""} × RWF {stay.monthlyPrice.toLocaleString()}
                                      </span>
                                      <span className="font-semibold text-slate-900 dark:text-white">
                                        RWF {stay.monthsCost.toLocaleString()}
                                      </span>
                                    </div>
                                  )}
                                  {stay.extraDays > 0 && (
                                    <div className="flex justify-between text-sm">
                                      <span className="text-slate-600 dark:text-slate-400">
                                        {stay.extraDays} day{stay.extraDays > 1 ? "s" : ""}
                                        {stay.dailyPrice > 0 ? ` × RWF ${stay.dailyPrice.toLocaleString()}` : " (no daily rate set)"}
                                      </span>
                                      <span className={stay.extraDaysCapped ? "text-slate-400 line-through" : "font-semibold text-slate-900 dark:text-white"}>
                                        RWF {stay.extraDaysFullCost.toLocaleString()}
                                      </span>
                                    </div>
                                  )}
                                  {stay.extraDaysCapped && (
                                    <div className="flex justify-between text-sm text-green-700 dark:text-green-400">
                                      <span>Capped at one month</span>
                                      <span className="font-semibold">RWF {stay.extraDaysCost.toLocaleString()}</span>
                                    </div>
                                  )}
                                </>
                              ) : (
                                <>
                                  <div className="flex justify-between text-sm">
                                    <span className="text-slate-600 dark:text-slate-400">
                                      {duration} {unitLabel}{duration > 1 ? "s" : ""} × RWF{" "}
                                      {(rateType === "weekly" ? stay.dailyPrice * 7 : stay.dailyPrice).toLocaleString()}
                                    </span>
                                    <span className={stay.longStayDiscount ? "text-slate-400 line-through" : "font-semibold text-slate-900 dark:text-white"}>
                                      RWF {stay.extraDaysFullCost.toLocaleString()}
                                    </span>
                                  </div>
                                  {stay.longStayDiscount && (
                                    <div className="flex justify-between text-sm text-green-700 dark:text-green-400">
                                      <span>Long-stay rate (over {DAILY_LONG_STAY_THRESHOLD} days — pay {Math.round(DAILY_LONG_STAY_RATE * 100)}%)</span>
                                      <span className="font-semibold">RWF {baseTotal.toLocaleString()}</span>
                                    </div>
                                  )}
                                </>
                              )}
                              {promo && (
                                <div className="flex justify-between text-sm text-green-700 dark:text-green-400">
                                  <span>Promo {promo.code} (−{promo.percent}%)</span>
                                  <span className="font-semibold">− RWF {(baseTotal - total).toLocaleString()}</span>
                                </div>
                              )}
                              <div className="flex justify-between items-center pt-2 border-t border-blue-200 dark:border-blue-900/50">
                                <span className="font-semibold text-blue-800 dark:text-blue-300">Total</span>
                                <span className="text-lg font-bold text-blue-800 dark:text-blue-300">RWF {total.toLocaleString()}</span>
                              </div>
                            </>
                          )}
                          {selectedApt && !hasPrice && (
                            <p className="text-xs text-amber-600 dark:text-amber-400">
                              This apartment has no {unitLabel} price set yet. Please pick another rate or contact us.
                            </p>
                          )}
                          <p className="text-xs text-slate-500 dark:text-slate-400 pt-1">
                            You pay this full amount now to confirm your booking instantly.
                          </p>
                        </div>
                      )
                    })()}
                  </div>
                </div>
                
                <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                  <Button type="submit" disabled={loading} className="w-full h-14 text-lg bg-amber-500 hover:bg-amber-600 text-white rounded-xl shadow-lg hover:shadow-amber-500/25 transition-all">
                    {loading ? "Redirecting to secure payment…" : "Pay Full Price & Confirm Booking"}
                  </Button>
                  <p className="text-center text-xs text-slate-500 dark:text-slate-400 mt-3">
                    As a guest you pay the full amount upfront to confirm instantly. Payment is secured by Stripe.
                  </p>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      </main>

      <SiteFooter />
    </div>
  )
}
