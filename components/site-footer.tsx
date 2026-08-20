import Link from "next/link"
import { Home, Facebook, Twitter, Instagram } from "lucide-react"

export function SiteFooter() {
  return (
    <footer className="bg-slate-950 dark:bg-black text-slate-400 py-16 border-t border-slate-900 dark:border-slate-800 px-4 transition-colors">
      <div className="max-w-7xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8 mb-12">
        <div className="col-span-2 md:col-span-1">
          <div className="flex items-center gap-2 mb-6">
            <Home className="h-6 w-6 text-amber-500" />
            <span className="text-xl font-bold text-white">Cielo Vista</span>
          </div>
          <p className="text-sm text-slate-400 max-w-xs">
            Cielo Vista — premium serviced apartments in Karama, Kigali. Book your stay with ease. No stress, just home.
          </p>
        </div>
        <div>
          <h4 className="text-white font-semibold mb-4">Explore</h4>
          <ul className="space-y-3 text-sm">
            <li><Link href="/apartments" className="hover:text-amber-400 transition-colors">Browse Apartments</Link></li>
            <li><Link href="/booking" className="hover:text-amber-400 transition-colors">Book Now</Link></li>
            <li><Link href="/tenant/register" className="hover:text-amber-400 transition-colors">Sign Up</Link></li>
            <li><Link href="/login" className="hover:text-amber-400 transition-colors">Log In</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="text-white font-semibold mb-4">Company</h4>
          <ul className="space-y-3 text-sm">
            <li><Link href="/about" className="hover:text-amber-400 transition-colors">About Us</Link></li>
            <li><Link href="/contact" className="hover:text-amber-400 transition-colors">Contact</Link></li>
            <li><Link href="/feedback" className="hover:text-amber-400 transition-colors">Feedback</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="text-white font-semibold mb-4">Contact</h4>
          <ul className="space-y-3 text-sm">
            <li>Karama, Kigali, Rwanda</li>
            <li><a href="mailto:testkevin73@gmail.com" className="hover:text-amber-400 transition-colors">testkevin73@gmail.com</a></li>
          </ul>
        </div>
      </div>
      <div className="max-w-7xl mx-auto pt-8 border-t border-slate-800 flex flex-col md:flex-row items-center justify-between gap-4 text-sm">
        <p>© {new Date().getFullYear()} Cielo Vista Apartments. All rights reserved.</p>
        <div className="flex gap-4">
           <Link href="#" className="w-8 h-8 rounded-full bg-slate-800 hover:bg-amber-500 text-white transition-colors flex items-center justify-center"><Facebook className="w-4 h-4" /></Link>
           <Link href="#" className="w-8 h-8 rounded-full bg-slate-800 hover:bg-amber-500 text-white transition-colors flex items-center justify-center"><Twitter className="w-4 h-4" /></Link>
           <Link href="#" className="w-8 h-8 rounded-full bg-slate-800 hover:bg-amber-500 text-white transition-colors flex items-center justify-center"><Instagram className="w-4 h-4" /></Link>
        </div>
      </div>
    </footer>
  )
}
