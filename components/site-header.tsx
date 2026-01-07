"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Building2, Menu, X } from "lucide-react"
import { useState, Suspense } from "react"

function SiteHeaderContent() {
  const pathname = usePathname()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const isActive = (path: string) => pathname === path
  const isAdminRoute = pathname?.startsWith("/admin")

  if (isAdminRoute) {
    return null
  }

  const navLinks = [
    { href: "/", label: "Home" },
    { href: "/apartments", label: "Apartments" },
    { href: "/booking", label: "Booking" },
    { href: "/feedback", label: "Contact" },
  ]

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2">
          <Building2 className="h-6 w-6 text-blue-600" />
          <span className="text-xl font-bold text-slate-900">Cielo Vista</span>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-6">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`text-sm font-medium transition-colors hover:text-blue-600 ${
                isActive(link.href) ? "text-blue-600" : "text-slate-700"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {/* Mobile Menu Button */}
        <button className="md:hidden" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
          {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {/* Mobile Navigation */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t bg-white">
          <nav className="container mx-auto flex flex-col gap-4 p-4">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`text-sm font-medium transition-colors hover:text-blue-600 ${
                  isActive(link.href) ? "text-blue-600" : "text-slate-700"
                }`}
                onClick={() => setMobileMenuOpen(false)}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      )}
    </header>
  )
}

export function SiteHeader() {
  return (
    <Suspense fallback={null}>
      <SiteHeaderContent />
    </Suspense>
  )
}
