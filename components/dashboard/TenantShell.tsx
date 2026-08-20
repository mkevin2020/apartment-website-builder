"use client";

import { ReactNode, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { DashboardShell, type NavGroup } from "./DashboardShell";
import { TenantNotificationBell } from "@/components/TenantNotificationBell";
import { SessionGuard, logout as doLogout } from "@/components/auth/session-guard";
import { LayoutDashboard, Home, CreditCard, Receipt, Wrench, User, LogOut, Moon, Sun } from "lucide-react";

const ROUTES: Record<string, string> = {
  overview: "/tenant/dashboard",
  apartments: "/tenant/booked-apartments",
  payments: "/tenant/payments",
  history: "/tenant/payment-history",
  maintenance: "/tenant/maintenance",
  profile: "/tenant/profile",
};

const NAV: NavGroup[] = [
  { group: "Main", items: [{ id: "overview", label: "Dashboard", icon: LayoutDashboard }] },
  { group: "Bookings", items: [{ id: "apartments", label: "My Apartments", icon: Home }] },
  {
    group: "Payments",
    items: [
      { id: "payments", label: "Make a Payment", icon: CreditCard },
      { id: "history", label: "Payment History", icon: Receipt },
    ],
  },
  { group: "Support", items: [{ id: "maintenance", label: "Maintenance", icon: Wrench }] },
  { group: "Account", items: [{ id: "profile", label: "Profile", icon: User }] },
];

// Shared sidebar shell for every tenant portal page. Nav links navigate between
// the tenant's routes; the notification bell + theme toggle live in the top bar.
export function TenantShell({
  tenant,
  active,
  children,
}: {
  tenant: any;
  active: string;
  children: ReactNode;
}) {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const logout = () => {
    void doLogout("/login");
  };

  return (
    <DashboardShell
      brandTitle="Cielo Vista"
      brandSubtitle="Tenant Portal"
      breadcrumb="Tenant"
      nav={NAV}
      active={active}
      onNavigate={(id) => router.push(ROUTES[id] || "/tenant/dashboard")}
      user={{ name: tenant?.full_name || "Tenant", role: "Tenant" }}
      actions={
        <>
          {tenant?.id && <TenantNotificationBell tenantId={tenant.id} />}
          <button
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300"
            aria-label="Toggle theme"
          >
            {mounted && (theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />)}
          </button>
        </>
      }
      menuItems={[{ label: "Logout", icon: LogOut, onClick: logout, danger: true }]}
    >
      {/* Kicks back to login if the session is gone — also after bfcache restore */}
      <SessionGuard sessionKey="tenant_session" />
      {children}
    </DashboardShell>
  );
}
