import React from "react"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import Link from "next/link"
import Image from "next/image"
import { SiteHeader } from "@/components/site-header"
import { SiteFooter } from "@/components/site-footer"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Bed, Bath, Square } from "lucide-react"

interface Apartment {
  id: number
  name: string
  description?: string | null
  image_url?: string | null
  price_per_month: number
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
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
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
    <div className="min-h-screen bg-background">
      <SiteHeader />

      <main className="container mx-auto px-4 py-12">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4 text-foreground">Available Apartments</h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Discover your perfect home at Cielo Vista. Each apartment is designed with luxury and comfort in mind.
          </p>
        </div>

        {apartments.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-xl text-muted-foreground">
              No apartments available at the moment. Please check back soon!
            </p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {apartments.map((apt: Apartment) => (
              <Card key={apt.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                <div className="relative h-64 w-full">
                  {apt.image_url ? (
                    <Image src={apt.image_url || "/placeholder.svg"} alt={apt.name} fill className="object-cover" />
                  ) : (
                    <div className="w-full h-full bg-muted flex items-center justify-center">
                      <p className="text-muted-foreground">No image available</p>
                    </div>
                  )}
                  <Badge className="absolute top-4 right-4 bg-primary text-primary-foreground">
                    ${apt.price_per_month}/month
                  </Badge>
                </div>
                <CardHeader>
                  <CardTitle>{apt.name}</CardTitle>
                  <CardDescription>{apt.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div className="flex items-center gap-2 text-sm">
                      <Bed className="h-4 w-4 text-primary" />
                      <span>{apt.bedrooms} Beds</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Bath className="h-4 w-4 text-primary" />
                      <span>{apt.bathrooms} Baths</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Square className="h-4 w-4 text-primary" />
                      <span>{apt.size_sqm} sqm</span>
                    </div>
                  </div>
                  <Link href={`/booking?apartment=${apt.id}`}>
                    <Button className="w-full">Book Now</Button>
                  </Link>
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
