import React from "react"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import Link from "next/link"
import Image from "next/image"
import { SiteHeader } from "@/components/site-header"
import { SiteFooter } from "@/components/site-footer"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Bed, Bath, Square, MapPin } from "lucide-react"
import { ViewDetailsButton } from "@/components/apartment-details-modal"

interface Apartment {
  id: number
  name: string
  type?: string | null
  description?: string | null
  image_url?: string | null
  image_urls?: string[] | null
  video_url?: string | null
  price_per_month: number
  price_per_day?: number | null
  bedrooms?: number | null
  bathrooms?: number | null
  size_sqm?: number | null
  is_available?: boolean | null
}

async function getApartments(): Promise<Apartment[]> {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        // Read-only. This is a public marketing page that needs no session, and
        // the app does not use Supabase Auth, so nothing here should ever write
        // a cookie. A `setAll` that calls cookieStore.set() from a Server
        // Component would also throw — cookies can only be set in Server
        // Actions and Route Handlers.
        getAll() {
          return cookieStore.getAll()
        },
        setAll() {
          /* intentionally a no-op */
        },
      },
    },
  )

  const { data, error } = await supabase
    .from("apartments")
    .select("*")
    .eq("is_available", true)
    .order("price_per_month", { ascending: true })

  if (error) {
    console.error("Error fetching apartments:", error)
    return []
  }

  return (data as Apartment[]) || []
}

export default async function ApartmentsPage() {
  const apartments = await getApartments()

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 font-sans transition-colors pt-24">
      <SiteHeader />

      <main className="max-w-7xl mx-auto px-4 py-12">
        <div className="text-center mb-16">
          <h1 className="text-4xl md:text-5xl font-extrabold text-slate-900 dark:text-white mb-6">Available Listings</h1>
          <p className="text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
            Discover your perfect home at Cielo Vista. Each apartment is designed with luxury, comfort, and state-of-the-art amenities in mind.
          </p>
        </div>

        {apartments.length === 0 ? (
          <div className="text-center py-20 bg-white dark:bg-slate-950 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm">
            <p className="text-xl text-slate-500 dark:text-slate-400">
              No apartments available at the moment. Please check back soon!
            </p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {apartments.map((apt: Apartment) => (
              <Card key={apt.id} className="group overflow-hidden border border-transparent dark:border-slate-800 bg-white dark:bg-slate-950 shadow-sm hover:shadow-xl dark:shadow-slate-900/50 transition-all duration-300 rounded-2xl flex flex-col">
                <div className="relative h-64 w-full overflow-hidden">
                  <div className="absolute top-4 left-4 z-10 bg-white/90 dark:bg-slate-900/90 backdrop-blur text-blue-900 dark:text-amber-500 font-semibold px-3 py-1 rounded-full text-sm">
                    RWF {Number(apt.price_per_month || 0).toLocaleString()}<span className="text-xs text-slate-500 dark:text-slate-400 font-normal">/mo</span>
                  </div>
                  {apt.image_url ? (
                    <img src={apt.image_url} alt={apt.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-in-out" />
                  ) : (
                    <div className="w-full h-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                      <p className="text-slate-400 dark:text-slate-500">No image available</p>
                    </div>
                  )}
                </div>
                
                <CardContent className="p-6 flex flex-col flex-grow">
                  <div className="flex items-center gap-1 text-slate-500 dark:text-slate-400 text-sm mb-2">
                    <MapPin className="h-4 w-4" /> Kigali, Rwanda
                  </div>
                  <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">{apt.name}</h3>
                  <p className="text-slate-600 dark:text-slate-400 text-sm mb-6 line-clamp-2">
                    {apt.description || "A beautiful apartment perfect for your premium lifestyle needs."}
                  </p>
                  
                  <div className="grid grid-cols-3 gap-2 mb-6 pt-4 border-t border-slate-100 dark:border-slate-800">
                    <div className="flex flex-col items-center justify-center text-center">
                      <Bed className="h-5 w-5 text-amber-500 mb-1" />
                      <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{apt.bedrooms} Bed</span>
                    </div>
                    <div className="flex flex-col items-center justify-center text-center border-l border-r border-slate-100 dark:border-slate-800">
                      <Bath className="h-5 w-5 text-amber-500 mb-1" />
                      <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{apt.bathrooms} Bath</span>
                    </div>
                    <div className="flex flex-col items-center justify-center text-center">
                      <Square className="h-5 w-5 text-amber-500 mb-1" />
                      <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{apt.size_sqm} sqm</span>
                    </div>
                  </div>
                  
                  <div className="mt-auto flex gap-2">
                    <ViewDetailsButton
                      apt={apt}
                      className="flex-1 bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white hover:bg-blue-600 dark:hover:bg-amber-500 hover:text-white transition-colors h-12"
                    />
                    <Link href={`/booking?apartment=${apt.id}`} className="flex-1 block">
                      <Button className="w-full bg-blue-600 dark:bg-amber-500 text-white hover:bg-blue-700 dark:hover:bg-amber-600 transition-colors h-12">
                        Book Now
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>

      <SiteFooter />
    </div>
  )
}
