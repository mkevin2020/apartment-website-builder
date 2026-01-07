"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { LogOut, Menu, X } from "lucide-react";
import { useState } from "react";
import Link from "next/link";

interface TenantHeaderProps {
  tenant: any;
}

export default function TenantHeader({ tenant }: TenantHeaderProps) {
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = () => {
    localStorage.removeItem("tenant_session");
    router.push("/login");
    router.refresh();
  };

  return (
    <header className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg">
      <div className="container mx-auto px-4 py-4">
        <div className="flex justify-between items-center">
          <Link href="/tenant/dashboard" className="font-bold text-xl">
            Cielo Vista Apartments
          </Link>

          {/* Desktop Menu */}
          <nav className="hidden md:flex gap-6">
            <Link href="/tenant/dashboard" className="hover:opacity-80">
              Dashboard
            </Link>
            <Link href="/tenant/booked-apartments" className="hover:opacity-80">
              My Apartments
            </Link>
            <Link href="/tenant/profile" className="hover:opacity-80">
              Profile
            </Link>
            <Link href="/tenant/payment-history" className="hover:opacity-80">
              Payments
            </Link>
            <Link href="/tenant/maintenance" className="hover:opacity-80">
              Maintenance
            </Link>
          </nav>

          {/* Desktop Actions */}
          <div className="hidden md:flex items-center gap-4">
            <span className="text-sm">{tenant?.full_name}</span>
            <Button
              onClick={handleLogout}
              variant="outline"
              className="text-white border-white hover:bg-white hover:text-blue-600"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </Button>
          </div>

          {/* Mobile Menu Button */}
          <button
            className="md:hidden"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? (
              <X className="h-6 w-6" />
            ) : (
              <Menu className="h-6 w-6" />
            )}
          </button>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <nav className="md:hidden mt-4 space-y-2 pb-4">
            <Link
              href="/tenant/dashboard"
              className="block hover:opacity-80 py-2"
            >
              Dashboard
            </Link>
            <Link
              href="/tenant/booked-apartments"
              className="block hover:opacity-80 py-2"
            >
              My Apartments
            </Link>
            <Link href="/tenant/profile" className="block hover:opacity-80 py-2">
              Profile
            </Link>
            <Link
              href="/tenant/payment-history"
              className="block hover:opacity-80 py-2"
            >
              Payments
            </Link>
            <Link
              href="/tenant/maintenance"
              className="block hover:opacity-80 py-2"
            >
              Maintenance
            </Link>
            <Button
              onClick={handleLogout}
              variant="outline"
              className="w-full text-white border-white hover:bg-white hover:text-blue-600"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </Button>
          </nav>
        )}
      </div>
    </header>
  );
}