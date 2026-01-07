import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Building2, MapPin, Star, ArrowRight, LogIn } from "lucide-react"

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header with Login Button */}
      <header className="fixed top-0 right-0 z-50 p-4">
        <Link href="/login">
          <Button className="bg-amber-500 hover:bg-amber-600 text-white flex items-center gap-2">
            <LogIn className="h-4 w-4" />
            Login
          </Button>
        </Link>
      </header>

      {/* Hero Section */}
      <section className="relative h-screen flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-950 via-blue-900 to-slate-900">
          <div className="absolute inset-0 opacity-20">
            <img src="/luxury-apartment-exterior.png" alt="Cielo Vista Apartments" className="w-full h-full object-cover" />
          </div>
        </div>

        <div className="relative z-10 text-center px-4 max-w-5xl mx-auto">
          <div className="inline-block mb-4 px-4 py-2 bg-amber-500/20 border border-amber-500/30 rounded-full">
            <span className="text-amber-300 text-sm font-medium">Premium Living in Kigali</span>
          </div>
          <h1 className="text-5xl md:text-7xl font-bold text-white mb-6 text-balance">
            Welcome to Cielo Vista Apartments
          </h1>
          <p className="text-xl md:text-2xl text-blue-100 mb-8 text-balance max-w-3xl mx-auto">
            Experience luxury living in the heart of Karama Sector, Kigali. Your perfect home awaits.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/apartments">
              <Button size="lg" className="bg-amber-500 hover:bg-amber-600 text-white">
                View Apartments
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            <Link href="/booking">
              <Button size="lg" variant="outline" className="bg-white/10 hover:bg-white/20 text-white border-white/30">
                Book Now
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-4 bg-slate-50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-slate-900 mb-4">Why Choose Cielo Vista?</h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto">
              Discover the perfect blend of comfort, luxury, and convenience in Kigali's most sought-after location.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <Card className="border-none shadow-lg hover:shadow-xl transition-shadow">
              <CardContent className="pt-8 text-center">
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <MapPin className="h-8 w-8 text-blue-600" />
                </div>
                <h3 className="text-xl font-semibold mb-2">Prime Location</h3>
                <p className="text-slate-600">
                  Located in Karama Sector, close to shopping centers, restaurants, and major business districts.
                </p>
              </CardContent>
            </Card>

            <Card className="border-none shadow-lg hover:shadow-xl transition-shadow">
              <CardContent className="pt-8 text-center">
                <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Building2 className="h-8 w-8 text-amber-600" />
                </div>
                <h3 className="text-xl font-semibold mb-2">Modern Design</h3>
                <p className="text-slate-600">
                  Contemporary architecture with premium finishes and state-of-the-art amenities.
                </p>
              </CardContent>
            </Card>

            <Card className="border-none shadow-lg hover:shadow-xl transition-shadow">
              <CardContent className="pt-8 text-center">
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Star className="h-8 w-8 text-blue-600" />
                </div>
                <h3 className="text-xl font-semibold mb-2">Luxury Living</h3>
                <p className="text-slate-600">
                  24/7 security, parking, high-speed internet, and professional property management.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Featured Apartments Preview */}
      <section className="py-20 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-slate-900 mb-4">Featured Apartments</h2>
            <p className="text-lg text-slate-600">Explore our range of luxury apartments designed for your comfort</p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 mb-8">
            <Card className="overflow-hidden border-none shadow-lg">
              <img src="/luxury-apartment-living-room.png" alt="Studio Apartment" className="w-full h-64 object-cover" />
              <CardContent className="p-6">
                <h3 className="text-2xl font-semibold mb-2">Studio Apartments</h3>
                <p className="text-slate-600 mb-4">Perfect for individuals seeking modern, efficient living spaces.</p>
                <p className="text-amber-600 font-semibold text-xl">From RWF 350,000/month</p>
              </CardContent>
            </Card>

            <Card className="overflow-hidden border-none shadow-lg">
              <img src="/luxury-bedroom-apartment.jpg" alt="Family Apartment" className="w-full h-64 object-cover" />
              <CardContent className="p-6">
                <h3 className="text-2xl font-semibold mb-2">Family Apartments</h3>
                <p className="text-slate-600 mb-4">Spacious 2-3 bedroom units ideal for families.</p>
                <p className="text-amber-600 font-semibold text-xl">From RWF 750,000/month</p>
              </CardContent>
            </Card>
          </div>

          <div className="text-center">
            <Link href="/apartments">
              <Button size="lg" className="bg-blue-600 hover:bg-blue-700">
                View All Apartments
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 bg-gradient-to-br from-blue-900 to-slate-900 text-white">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl font-bold mb-6">Ready to Make Cielo Vista Your Home?</h2>
          <p className="text-xl text-blue-100 mb-8">
            Contact us today to schedule a viewing or book your apartment online.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/booking">
              <Button size="lg" className="bg-amber-500 hover:bg-amber-600">
                Book an Apartment
              </Button>
            </Link>
            <Link href="/feedback">
              <Button size="lg" variant="outline" className="bg-white/10 hover:bg-white/20 border-white/30">
                Contact Us
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
