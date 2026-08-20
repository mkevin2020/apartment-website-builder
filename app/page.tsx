import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Building2, Search, ShieldCheck, CreditCard, HeadphonesIcon, Home, CheckCircle, ChevronRight } from "lucide-react";
// (single-property residence — no city-wide marketplace search)
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { FeaturedApartments } from "@/components/featured-apartments";
import { HeroBuilding } from "@/components/three/HeroBuilding";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 font-sans transition-colors">
      <SiteHeader />

      {/* 1. Hero Section — interactive 3D residence (Three.js) */}
      <section className="relative overflow-hidden min-h-[92vh] bg-gradient-to-b from-slate-950 via-[#0a1128] to-blue-950">
        {/* 3D scene: slowly rotating apartment towers, draggable with the mouse */}
        <HeroBuilding />

        {/* legibility gradients over the 3D scene (don't block dragging) */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-slate-950/85 via-slate-950/30 to-transparent" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-slate-950 to-transparent" />

        {/* Content overlay — left-aligned, professional composition */}
        <div className="pointer-events-none relative z-10 mx-auto flex min-h-[92vh] max-w-7xl items-center px-4">
          <div className="max-w-xl pt-24 pb-16">
            <span className="pointer-events-auto inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-amber-400 backdrop-blur">
              <Building2 className="h-3.5 w-3.5" />
              Karama · Kigali
            </span>

            <h1 className="mt-6 text-4xl font-extrabold tracking-tight text-white md:text-6xl">
              Modern Living at <span className="text-amber-500">Cielo Vista</span>
            </h1>
            <p className="mt-6 text-lg font-light leading-relaxed text-blue-100/90 md:text-xl">
              Premium serviced apartments in one secure residence. Browse our
              available units and book your stay in minutes.
            </p>

            {/* Primary actions */}
            <div className="pointer-events-auto mt-10 flex flex-col gap-4 sm:flex-row">
              <Link href="/apartments">
                <Button size="lg" className="h-14 rounded-xl bg-amber-500 px-8 text-lg text-white shadow-lg shadow-amber-500/25 transition-all hover:-translate-y-0.5 hover:bg-amber-600 flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  View Available Apartments
                </Button>
              </Link>
              <Link href="/booking">
                <Button size="lg" variant="outline" className="h-14 rounded-xl border-white/30 bg-white/5 px-8 text-lg text-white backdrop-blur transition-colors hover:bg-white/10 flex items-center gap-2">
                  Book Now
                  <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              </Link>
            </div>

            {/* Trust chips */}
            <div className="pointer-events-auto mt-12 flex flex-wrap gap-3 text-xs font-medium text-blue-100/80">
              <span className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 backdrop-blur">
                <ShieldCheck className="h-3.5 w-3.5 text-green-400" /> Secure residence
              </span>
              <span className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 backdrop-blur">
                <CreditCard className="h-3.5 w-3.5 text-blue-400" /> MTN MoMo &amp; card payments
              </span>
              <span className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 backdrop-blur">
                <HeadphonesIcon className="h-3.5 w-3.5 text-amber-400" /> 24/7 support
              </span>
            </div>

            <p className="mt-8 text-[11px] uppercase tracking-[0.25em] text-blue-200/40">
              Drag the building to look around
            </p>
          </div>
        </div>
      </section>

      {/* 5. Trust & Credibility Section */}
      <section className="bg-white dark:bg-slate-950 py-16 border-b border-slate-100 dark:border-slate-800 transition-colors">
        <div className="max-w-7xl mx-auto px-4">
          <div className="grid gap-6 md:grid-cols-3">
            <div className="group flex items-center gap-5 rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/60 p-6 transition-all hover:-translate-y-1 hover:shadow-lg hover:shadow-green-500/5">
              <div className="shrink-0 rounded-2xl bg-gradient-to-br from-green-500 to-emerald-600 p-3.5 shadow-lg shadow-green-500/25">
                <ShieldCheck className="h-7 w-7 text-white" />
              </div>
              <div>
                <h4 className="font-bold text-slate-900 dark:text-white">Quality Apartments</h4>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Well-maintained and ready to move in.</p>
              </div>
            </div>
            <div className="group flex items-center gap-5 rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/60 p-6 transition-all hover:-translate-y-1 hover:shadow-lg hover:shadow-blue-500/5">
              <div className="shrink-0 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 p-3.5 shadow-lg shadow-blue-500/25">
                <CreditCard className="h-7 w-7 text-white" />
              </div>
              <div>
                <h4 className="font-bold text-slate-900 dark:text-white">Secure Payments</h4>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">MTN MoMo &amp; card — deposits and rent protected.</p>
              </div>
            </div>
            <div className="group flex items-center gap-5 rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/60 p-6 transition-all hover:-translate-y-1 hover:shadow-lg hover:shadow-amber-500/5">
              <div className="shrink-0 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-500 p-3.5 shadow-lg shadow-amber-500/25">
                <HeadphonesIcon className="h-7 w-7 text-white" />
              </div>
              <div>
                <h4 className="font-bold text-slate-900 dark:text-white">24/7 Support</h4>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Chat with our assistant or the manager anytime.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 4. How It Works Section */}
      <section className="py-24 bg-slate-50 dark:bg-slate-900 overflow-hidden transition-colors">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-16">
            <span className="inline-block rounded-full bg-blue-50 dark:bg-blue-900/30 px-4 py-1.5 text-xs font-bold uppercase tracking-[0.2em] text-blue-600 dark:text-blue-400 mb-4">
              How it works
            </span>
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-white mb-4">Finding a home has never been easier</h2>
            <p className="text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">Skip the bureaucracy. Cielo Vista streamlines the entire process so you can move in faster.</p>
          </div>
          
          <div className="relative grid md:grid-cols-3 gap-12 text-center z-10">
            {/* Connecting Line */}
            <div className="hidden md:block absolute top-12 left-[16.66%] right-[16.66%] h-0.5 bg-slate-200 dark:bg-slate-800 -z-10 transition-colors"></div>
            
            <div className="relative bg-white dark:bg-slate-950 p-8 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 hover:shadow-md transition-all">
              <div className="w-20 h-20 bg-blue-600 dark:bg-blue-700 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-blue-600/20 rotate-[-3deg] hover:rotate-0 transition-transform">
                <Search className="h-10 w-10 text-white" />
              </div>
              <h3 className="text-xl font-bold mb-3 text-slate-900 dark:text-white">1. Browse Apartments</h3>
              <p className="text-slate-600 dark:text-slate-400">Explore our available units, with photos, a video tour, and full details.</p>
            </div>
            
            <div className="relative bg-white dark:bg-slate-950 p-8 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 hover:shadow-md transition-all">
              <div className="w-20 h-20 bg-blue-600 dark:bg-blue-700 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-blue-600/20 rotate-[3deg] hover:rotate-0 transition-transform">
                <Home className="h-10 w-10 text-white" />
              </div>
              <h3 className="text-xl font-bold mb-3 text-slate-900 dark:text-white">2. Choose Your Apartment</h3>
              <p className="text-slate-600 dark:text-slate-400">View high-quality photos and a video tour of each unit, then pick the one you love.</p>
            </div>
            
            <div className="relative bg-white dark:bg-slate-950 p-8 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 hover:shadow-md transition-all">
              <div className="w-20 h-20 bg-blue-600 dark:bg-blue-700 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-blue-600/20 rotate-[-3deg] hover:rotate-0 transition-transform">
                <CheckCircle className="h-10 w-10 text-white" />
              </div>
              <h3 className="text-xl font-bold mb-3 text-slate-900 dark:text-white">3. Book Securely</h3>
              <p className="text-slate-600 dark:text-slate-400">Reserve your apartment and pay your deposit safely online — confirmed in minutes.</p>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Featured Listings Preview */}
      <section className="py-24 bg-white dark:bg-slate-950 transition-colors">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between items-end mb-12 gap-6">
            <div>
              <span className="inline-block rounded-full bg-amber-50 dark:bg-amber-900/30 px-4 py-1.5 text-xs font-bold uppercase tracking-[0.2em] text-amber-600 dark:text-amber-400 mb-4">
                Listings
              </span>
              <h2 className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-white mb-4">Available Apartments</h2>
              <p className="text-slate-600 dark:text-slate-400 text-lg">Our apartments available right now at Cielo Vista.</p>
            </div>
            <Link href="/apartments">
              <Button variant="outline" className="text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-900 hover:bg-blue-50 dark:hover:bg-blue-900/50 transition-colors">
                View All Apartments <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </Link>
          </div>

          <FeaturedApartments />
        </div>
      </section>

      {/* 6. Call-To-Action Section */}
      <section className="relative py-24 px-4 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-blue-950 to-slate-950 transition-colors"></div>
        {/* soft glow accents to match the 3D hero (radial gradients — render consistently everywhere) */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(600px circle at 72% 0%, rgba(245,158,11,0.10), transparent 60%), radial-gradient(600px circle at 22% 100%, rgba(59,130,246,0.12), transparent 60%)",
          }}
        ></div>
        <div className="absolute top-0 right-0 -translate-y-12 translate-x-1/3 text-white/5">
           <Building2 className="w-96 h-96" />
        </div>
        <div className="relative max-w-4xl mx-auto text-center z-10">
          <h2 className="text-4xl md:text-5xl font-bold mb-6 text-white tracking-tight">
            Ready to Find Your Next Home?
          </h2>
          <p className="text-xl text-blue-100 mb-10 max-w-2xl mx-auto font-light">
            Browse our available apartments and book your stay at Cielo Vista in minutes.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/apartments">
              <Button size="lg" className="h-14 px-8 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-lg font-medium shadow-lg hover:shadow-amber-500/25 transition-all hover:-translate-y-1">
                Explore Now
              </Button>
            </Link>
            <Link href="/tenant/register">
              <Button size="lg" variant="outline" className="h-14 px-8 bg-transparent text-white border-white/20 hover:bg-white/10 rounded-xl text-lg font-medium">
                Create an Account
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
