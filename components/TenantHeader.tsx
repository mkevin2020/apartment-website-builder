"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Building2, LogOut, Menu, X, Moon, Sun } from "lucide-react";
import Link from "next/link";
import { TenantNotificationBell } from "@/components/TenantNotificationBell";
import { logout } from "@/components/auth/session-guard";

interface TenantHeaderProps {
  tenant: any;
}

export default function TenantHeader({ tenant }: TenantHeaderProps) {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleLogout = () => {
    void logout("/login");
    router.refresh();
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-950/80 backdrop-blur-md">
      <div className="container mx-auto px-4 py-4">
        <div className="flex justify-between items-center">
          <Link href="/tenant/dashboard" className="flex items-center gap-2 group">
             <div className="w-10 h-10 rounded-xl bg-green-600 flex items-center justify-center group-hover:scale-105 transition-transform">
              <Building2 className="h-5 w-5 text-white" />
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-xl text-slate-900 dark:text-white leading-tight">Cielo Vista</span>
              <span className="text-xs font-semibold tracking-wider text-green-600 dark:text-green-400 uppercase">Tenant Portal</span>
            </div>
          </Link>

          {/* Desktop Menu */}
          <nav className="hidden lg:flex items-center gap-6">
            <Link href="/tenant/dashboard" className="text-sm font-medium text-slate-600 hover:text-green-600 dark:text-slate-300 dark:hover:text-green-400 transition-colors">
              Dashboard
            </Link>
            <Link href="/tenant/booked-apartments" className="text-sm font-medium text-slate-600 hover:text-green-600 dark:text-slate-300 dark:hover:text-green-400 transition-colors">
              My Apartments
            </Link>
            <Link href="/tenant/profile" className="text-sm font-medium text-slate-600 hover:text-green-600 dark:text-slate-300 dark:hover:text-green-400 transition-colors">
              Profile
            </Link>
            <Link href="/tenant/payment-history" className="text-sm font-medium text-slate-600 hover:text-green-600 dark:text-slate-300 dark:hover:text-green-400 transition-colors">
              Payments
            </Link>
            <Link href="/tenant/maintenance" className="text-sm font-medium text-slate-600 hover:text-green-600 dark:text-slate-300 dark:hover:text-green-400 transition-colors">
              Maintenance
            </Link>
          </nav>

          {/* Desktop Actions */}
          <div className="hidden lg:flex items-center gap-4 border-l border-slate-200 dark:border-slate-800 pl-4">
            <span className="text-sm font-semibold text-slate-900 dark:text-white">{tenant?.full_name}</span>
            {tenant?.id && <TenantNotificationBell tenantId={tenant.id} />}
            <button
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="p-2 text-slate-600 hover:text-green-600 dark:text-slate-400 dark:hover:text-green-400 transition-colors rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"
              aria-label="Toggle theme"
            >
              {mounted && (theme === "dark" ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />)}
            </button>
            <Button
              onClick={handleLogout}
              variant="outline"
              size="sm"
              className="border-red-200 text-red-600 hover:bg-red-50 dark:border-red-900/50 dark:text-red-400 dark:hover:bg-red-900/20"
            >
              <LogOut className="h-4 w-4 lg:mr-2" />
              <span className="hidden lg:inline">Logout</span>
            </Button>
          </div>

          {/* Mobile Menu Button */}
          <div className="flex items-center gap-2 lg:hidden">
             {tenant?.id && <TenantNotificationBell tenantId={tenant.id} />}
             <button
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                className="p-2 text-slate-600 hover:text-green-600 dark:text-slate-400 transition-colors"
             >
                {mounted && (theme === "dark" ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />)}
             </button>
             <button
               className="p-2 text-slate-900 dark:text-white"
               onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
             >
               {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
             </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="lg:hidden mt-4 pt-4 border-t border-slate-200 dark:border-slate-800 space-y-4">
            <nav className="flex flex-col space-y-4">
              <Link href="/tenant/dashboard" className="text-slate-600 dark:text-slate-300 font-medium hover:text-green-600 dark:hover:text-green-400">Dashboard</Link>
              <Link href="/tenant/booked-apartments" className="text-slate-600 dark:text-slate-300 font-medium hover:text-green-600 dark:hover:text-green-400">My Apartments</Link>
              <Link href="/tenant/profile" className="text-slate-600 dark:text-slate-300 font-medium hover:text-green-600 dark:hover:text-green-400">Profile</Link>
              <Link href="/tenant/payment-history" className="text-slate-600 dark:text-slate-300 font-medium hover:text-green-600 dark:hover:text-green-400">Payments</Link>
              <Link href="/tenant/maintenance" className="text-slate-600 dark:text-slate-300 font-medium hover:text-green-600 dark:hover:text-green-400">Maintenance</Link>
            </nav>
            <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
               <div className="flex justify-between items-center bg-slate-50 dark:bg-slate-900 p-4 rounded-xl">
                 <span className="font-semibold text-slate-900 dark:text-white">{tenant?.full_name}</span>
                 <Button onClick={handleLogout} variant="destructive" size="sm">
                   <LogOut className="h-4 w-4 mr-2" /> Logout
                 </Button>
               </div>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}