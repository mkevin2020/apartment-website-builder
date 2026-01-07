import Link from "next/link"
import { Building2, Mail, Phone, MapPin } from "lucide-react"

export function SiteFooter() {
  return (
    <footer className="bg-slate-900 text-slate-300">
      <div className="container mx-auto px-4 py-12">
        <div className="grid md:grid-cols-4 gap-8">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Building2 className="h-6 w-6 text-amber-500" />
              <span className="text-xl font-bold text-white">Cielo Vista</span>
            </div>
            <p className="text-sm">Premium apartment living in the heart of Kigali, Karama Sector.</p>
          </div>

          <div>
            <h3 className="text-white font-semibold mb-4">Quick Links</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/" className="hover:text-amber-500 transition-colors">
                  Home
                </Link>
              </li>
              <li>
                <Link href="/apartments" className="hover:text-amber-500 transition-colors">
                  Apartments
                </Link>
              </li>
              <li>
                <Link href="/booking" className="hover:text-amber-500 transition-colors">
                  Booking
                </Link>
              </li>
              <li>
                <Link href="/feedback" className="hover:text-amber-500 transition-colors">
                  Contact
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="text-white font-semibold mb-4">Contact Info</h3>
            <ul className="space-y-2 text-sm">
              <li className="flex items-start gap-2">
                <MapPin className="h-4 w-4 mt-1 flex-shrink-0" />
                <span>Karama Sector, Kigali, Rwanda</span>
              </li>
              <li className="flex items-center gap-2">
                <Phone className="h-4 w-4 flex-shrink-0" />
                <span>+250 XXX XXX XXX</span>
              </li>
              <li className="flex items-center gap-2">
                <Mail className="h-4 w-4 flex-shrink-0" />
                <span>info@cielovista.rw</span>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="text-white font-semibold mb-4">Office Hours</h3>
            <ul className="space-y-2 text-sm">
              <li>Monday - Friday: 8AM - 6PM</li>
              <li>Saturday: 9AM - 4PM</li>
              <li>Sunday: Closed</li>
            </ul>
          </div>
        </div>

        <div className="border-t border-slate-800 mt-8 pt-8 text-center text-sm">
          <p>&copy; {new Date().getFullYear()} Cielo Vista Apartments. All rights reserved.</p>
        </div>
      </div>
    </footer>
  )
}
