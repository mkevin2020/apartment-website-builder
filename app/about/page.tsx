"use client";

import Image from "next/image"
import Link from "next/link"
import { SiteHeader } from "@/components/site-header"
import { SiteFooter } from "@/components/site-footer"
import { Button } from "@/components/ui/button"
import { Building2, ShieldCheck, HeartPulse, GraduationCap, ArrowRight, MapPin } from "lucide-react"

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 font-sans transition-colors pt-24">
      <SiteHeader />

      <main className="w-full overflow-hidden">
        {/* Header Hero Section */}
        <section className="max-w-7xl mx-auto px-4 py-16 md:py-24 text-center">
          <div className="inline-block mb-6 px-4 py-2 bg-amber-500/10 border border-amber-500/20 dark:bg-amber-900/30 dark:border-amber-700/30 rounded-full">
            <span className="text-amber-600 dark:text-amber-400 text-sm font-semibold tracking-wide uppercase">Our Story</span>
          </div>
          <h1 className="text-4xl md:text-6xl font-extrabold text-slate-900 dark:text-white mb-6">
            Elevating Urban Living in Kigali
          </h1>
          <p className="text-xl text-slate-600 dark:text-slate-400 max-w-3xl mx-auto font-light leading-relaxed">
            At Cielo Vista, we believe that your apartment should be more than just a place to sleep. It should be a sanctuary, a community, and a seamless extension of your premium lifestyle.
          </p>
        </section>

        {/* Feature Image Grid */}
        <section className="max-w-7xl mx-auto px-4 pb-24">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2 h-[400px] md:h-[500px] rounded-3xl overflow-hidden relative group shadow-lg dark:shadow-slate-900/50">
              <img 
                src="/luxury-apartment-exterior.png" 
                alt="Architecture" 
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-in-out" 
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 to-transparent flex items-end p-8">
                <div>
                   <h3 className="text-white text-2xl font-bold mb-2">Modern Architecture</h3>
                   <p className="text-slate-300">Award-winning design centered around natural light.</p>
                </div>
              </div>
            </div>
            <div className="grid grid-rows-2 gap-6 h-[400px] md:h-[500px]">
              <div className="rounded-3xl overflow-hidden relative group shadow-md dark:shadow-slate-900/50">
                <img 
                  src="/luxury-apartment-living-room.png" 
                  alt="Interior" 
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-in-out" 
                />
              </div>
              <div className="rounded-3xl overflow-hidden relative group shadow-md dark:shadow-slate-900/50">
                 <img 
                  src="/luxury-bedroom-apartment.jpg" 
                  alt="Comfort" 
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-in-out" 
                />
              </div>
            </div>
          </div>
        </section>

        {/* Core Values Section */}
        <section className="bg-white dark:bg-slate-950 py-24 border-y border-slate-100 dark:border-slate-800 transition-colors">
          <div className="max-w-7xl mx-auto px-4">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-white mb-4">Our Core Values</h2>
              <p className="text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">We hold ourselves to the highest standards of hospitality, security, and design excellence.</p>
            </div>
            
            <div className="grid md:grid-cols-3 gap-12">
              <div className="space-y-4">
                <div className="w-16 h-16 bg-blue-50 dark:bg-blue-900/30 rounded-2xl flex items-center justify-center">
                  <HeartPulse className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">Exceptional Comfort</h3>
                <p className="text-slate-600 dark:text-slate-400 leading-relaxed text-sm">
                  Every living space is meticulously designed with hand-picked premium materials, advanced climate control, and unmatched acoustic isolation.
                </p>
              </div>

              <div className="space-y-4">
                <div className="w-16 h-16 bg-green-50 dark:bg-green-900/30 rounded-2xl flex items-center justify-center">
                  <ShieldCheck className="w-8 h-8 text-green-600 dark:text-green-400" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">Uncompromising Security</h3>
                <p className="text-slate-600 dark:text-slate-400 leading-relaxed text-sm">
                  Our facilities employ 24/7 on-site personnel alongside state-of-the-art surveillance and biometric access to guarantee your safety.
                </p>
              </div>

              <div className="space-y-4">
                <div className="w-16 h-16 bg-amber-50 dark:bg-amber-900/30 rounded-2xl flex items-center justify-center">
                  <GraduationCap className="w-8 h-8 text-amber-600 dark:text-amber-400" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">Sustainable Future</h3>
                <p className="text-slate-600 dark:text-slate-400 leading-relaxed text-sm">
                  Committed to green living, Cielo Vista incorporates smart-energy systems and eco-friendly practices throughout the property.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Location Section */}
        <section className="py-24 bg-slate-50 dark:bg-slate-900 transition-colors">
          <div className="max-w-7xl mx-auto px-4 flex flex-col md:flex-row items-center gap-16">
            <div className="w-full md:w-1/2 space-y-8">
              <div>
                <h2 className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-white mb-6">Located in the Heart of Karama</h2>
                <p className="text-lg text-slate-600 dark:text-slate-400 mb-6">
                  Cielo Vista places you exactly where you need to be. Enjoy the tranquility of our secluded neighborhood while staying mere minutes from Kigali's premier shopping, dining, and business districts.
                </p>
                <div className="flex flex-col gap-4">
                  <div className="flex items-center gap-3 text-slate-700 dark:text-slate-300">
                    <MapPin className="w-5 h-5 text-amber-500" /> 15 mins to Kigali International Airport
                  </div>
                  <div className="flex items-center gap-3 text-slate-700 dark:text-slate-300">
                    <Building2 className="w-5 h-5 text-amber-500" /> 10 mins to Downtown Business Hub
                  </div>
                </div>
              </div>
              
              <Link href="/contact" className="inline-block">
                <Button size="lg" className="h-14 px-8 bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-lg transition-all">
                  Contact Our Team
                  <ArrowRight className="ml-2 w-5 h-5" />
                </Button>
              </Link>
            </div>
            
            <div className="w-full md:w-1/2 bg-white dark:bg-slate-950 p-4 rounded-3xl shadow-xl dark:shadow-slate-900/50 border border-slate-100 dark:border-slate-800">
               {/* Decorative MAP representation */}
               <div className="w-full h-[400px] bg-slate-100 dark:bg-slate-900 rounded-2xl flex items-center justify-center relative overflow-hidden">
                 <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10 dark:opacity-5"></div>
                 <div className="text-center relative z-10">
                    <div className="w-16 h-16 bg-amber-500 rounded-full flex items-center justify-center mx-auto mb-4 shadow-xl animate-bounce">
                      <MapPin className="w-8 h-8 text-white" />
                    </div>
                    <h4 className="font-bold text-lg text-slate-900 dark:text-white">Karama Sector, Kigali</h4>
                    <p className="text-sm text-slate-500 dark:text-slate-400">View on Google Maps</p>
                 </div>
               </div>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="bg-amber-500 py-20 px-4 text-center">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-3xl md:text-5xl font-bold text-white mb-6">Experience Cielo Vista Today</h2>
            <p className="text-amber-50 text-lg mb-10 opacity-90 text-balance">Join our community and elevate your lifestyle. Select a tailored premium apartment that fits your needs.</p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/apartments">
                <Button size="lg" className="h-14 px-8 bg-slate-900 hover:bg-black text-white rounded-xl shadow-lg transition-all">
                  Browse Listings
                </Button>
              </Link>
              <Link href="/booking">
                <Button size="lg" variant="outline" className="h-14 px-8 bg-transparent text-white border-white/30 hover:bg-white/10 rounded-xl transition-all">
                  Book a Viewing
                </Button>
              </Link>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  )
}
