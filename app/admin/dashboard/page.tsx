"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { dataClient } from "@/lib/data-client";
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { DashboardShell, type NavGroup } from "@/components/dashboard/DashboardShell"
import { SessionGuard, logout } from "@/components/auth/session-guard"
import { StatCard } from "@/components/dashboard/StatCard"
import ChangePasswordModal from "@/components/admin/ChangePasswordModal"
import { ApartmentsManager } from "@/components/apartments-manager"
import { EmployeesManager } from "@/components/employees-manager"
import { ManagersManager } from "@/components/managers-manager"
import { BookingsManager } from "@/components/bookings-manager"
import { OccupiedApartmentsManager } from "@/components/occupied-apartments-manager"
import { BookedApartmentsTable } from "@/components/booked-apartments-table"
import { MaintenanceManager } from "@/components/ui/employee/maintenance-manager"
import { FeedbackManager } from "@/components/feedback-manager"
import { TenantsManager } from "@/components/tenants-manager"
import { AdminManager } from "@/components/admin-manager"
import { PasswordResetRequestsManager } from "@/components/password-reset-requests-manager"
import { CheckedTicketsManager } from "@/components/checked-tickets-manager"
import { PromoCodesManager } from "@/components/promo-codes-manager"
import {
  PieChart, Pie, Cell, Tooltip as RTooltip, ResponsiveContainer,
} from "recharts"
import {
  Building, Users, Calendar, MessageSquare, Key, Wrench, LogOut, Home, Eye,
  Shield, AlertCircle, Lock, QrCode, Ticket, Tag, LayoutDashboard,
  TrendingUp, ChevronRight,
} from "lucide-react"
import Link from "next/link"

const NAV: NavGroup[] = [
  { group: "Main", items: [{ id: "overview", label: "Overview", icon: LayoutDashboard }] },
  {
    group: "Properties",
    items: [
      { id: "apartments", label: "Apartments", icon: Building },
      { id: "occupied", label: "Occupied", icon: AlertCircle },
    ],
  },
  {
    group: "Bookings",
    items: [
      { id: "bookings", label: "Bookings", icon: Calendar },
      { id: "tickets", label: "Tickets Checked", icon: Ticket },
    ],
  },
  {
    group: "People",
    items: [
      { id: "tenants", label: "Tenants", icon: Home },
      { id: "employees", label: "Employees", icon: Users },
      { id: "managers", label: "Managers", icon: Shield },
      { id: "admins", label: "Admins", icon: Shield },
    ],
  },
  {
    group: "Operations",
    items: [
      { id: "maintenance", label: "Maintenance", icon: Wrench },
      { id: "feedback", label: "Feedback", icon: MessageSquare },
      { id: "promo", label: "Promo Codes", icon: Tag },
      { id: "password-reset", label: "Password Checks", icon: Lock },
    ],
  },
]

const PIE_COLORS = ["#2563eb", "#f97316"]

export default function AdminDashboard() {
  const router = useRouter()
  const [admin, setAdmin] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [active, setActive] = useState("overview")
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false)
  const [showSuccessMessage, setShowSuccessMessage] = useState(false)
  const [regenLoading, setRegenLoading] = useState(false)

  const supabase = dataClient()

  useEffect(() => {
    const adminData = localStorage.getItem("admin_session")
    if (!adminData) {
      router.push("/login?redirect=admin")
      return
    }
    try {
      setAdmin(JSON.parse(adminData))
    } catch {
      router.push("/login?redirect=admin")
    }
    setLoading(false)
  }, [router])

  const handleLogout = () => {
    void logout("/login")
  }

  const handleRegenerateQR = async () => {
    if (!confirm("Regenerate all receipt QR codes to use the current site URL? Do this after your ngrok/public URL changes.")) return
    setRegenLoading(true)
    try {
      const res = await fetch("/api/admin/regenerate-qr", { method: "POST" })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed")
      alert(`Updated ${data.updated} QR code(s) to point at:\n${data.baseUrl}`)
    } catch (err: any) {
      alert("Failed to regenerate QR codes: " + (err?.message || "Unknown error"))
    } finally {
      setRegenLoading(false)
    }
  }

  if (loading) return <div className="flex items-center justify-center min-h-screen">Loading...</div>
  if (!admin) return null

  return (
    <DashboardShell
      brandTitle="Cielo Vista"
      brandSubtitle="Admin Console"
      breadcrumb="Admin"
      nav={NAV}
      active={active}
      onNavigate={setActive}
      user={{ name: admin.username, role: "Administrator" }}
      actions={
        <Button onClick={handleRegenerateQR} disabled={regenLoading} variant="outline" size="sm" className="hidden sm:flex gap-2">
          <QrCode className="h-4 w-4" />
          {regenLoading ? "Regenerating…" : "Regenerate QR"}
        </Button>
      }
      menuItems={[
        { label: "Change Password", icon: Key, onClick: () => setIsPasswordModalOpen(true) },
        { label: "Regenerate QR", icon: QrCode, onClick: handleRegenerateQR, hideOnDesktop: true },
        { label: "Logout", icon: LogOut, onClick: handleLogout, danger: true },
      ]}
    >
      {/* Kicks back to login if the session is gone — also after bfcache restore */}
      <SessionGuard sessionKey="admin_session" />
      {showSuccessMessage && (
        <div className="mb-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-400 px-4 py-3 rounded-xl">
          ✓ Password changed successfully!
        </div>
      )}

      {active === "overview" ? (
        <OverviewSection supabase={supabase} onNavigate={setActive} />
      ) : (
        <SectionContent active={active} />
      )}

      <ChangePasswordModal
        isOpen={isPasswordModalOpen}
        onClose={() => setIsPasswordModalOpen(false)}
        adminId={admin.id}
        onSuccess={() => {
          setShowSuccessMessage(true)
          setTimeout(() => setShowSuccessMessage(false), 3000)
        }}
      />
    </DashboardShell>
  )
}

function SectionContent({ active }: { active: string }) {
  switch (active) {
    case "apartments":
      return <ApartmentsManager />
    case "occupied":
      return (
        <div className="space-y-6">
          <BookedApartmentsTable />
          <OccupiedApartmentsManager />
        </div>
      )
    case "tenants":
      return <TenantsManager />
    case "employees":
      return <EmployeesManager />
    case "managers":
      return <ManagersManager />
    case "admins":
      return <AdminManager />
    case "bookings":
      return (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button asChild className="gap-2 bg-blue-600 hover:bg-blue-700">
              <Link href="/admin/bookings">
                <Eye className="h-4 w-4" /> View All Bookings
              </Link>
            </Button>
          </div>
          <BookingsManager />
        </div>
      )
    case "tickets":
      return <CheckedTicketsManager />
    case "maintenance":
      return <MaintenanceManager />
    case "feedback":
      return <FeedbackManager />
    case "promo":
      return <PromoCodesManager />
    case "password-reset":
      return <PasswordResetRequestsManager />
    default:
      return null
  }
}

function OverviewSection({ supabase, onNavigate }: { supabase: any; onNavigate: (id: string) => void }) {
  // Revenue is deliberately absent here: money figures are the MANAGER's view
  // (see /manager/dashboard) — the admin must not see them.
  const [stats, setStats] = useState<null | {
    total: number; available: number; occupied: number; tenants: number
    bookings: number; maintenanceOpen: number
  }>(null)

  useEffect(() => {
    const load = async () => {
      const [apRes, tRes, bRes, mRes] = await Promise.all([
        supabase.from("apartments").select("id,is_available"),
        supabase.from("tenants").select("id").eq("approval_status", "approved"),
        supabase.from("bookings").select("id"),
        supabase.from("maintenance_requests").select("id,status"),
      ])
      const apts = apRes.data || []
      const available = apts.filter((a: any) => a.is_available).length
      const maintenance = mRes.data || []
      setStats({
        total: apts.length,
        available,
        occupied: apts.length - available,
        tenants: (tRes.data || []).length,
        bookings: (bRes.data || []).length,
        maintenanceOpen: maintenance.filter((m: any) => (m.status || "").toLowerCase() === "pending").length,
      })
    }
    load()
  }, [supabase])

  if (!stats) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}
        <Skeleton className="h-72 rounded-2xl sm:col-span-2" />
        <Skeleton className="h-72 rounded-2xl sm:col-span-2" />
      </div>
    )
  }

  const occRate = stats.total ? Math.round((stats.occupied / stats.total) * 100) : 0
  const cards = [
    { label: "Total Apartments", value: stats.total, icon: Building, tint: "bg-blue-50 text-blue-600", nav: "apartments" },
    { label: "Available", value: stats.available, icon: Home, tint: "bg-green-50 text-green-600", nav: "apartments" },
    { label: "Occupied", value: stats.occupied, icon: AlertCircle, tint: "bg-orange-50 text-orange-600", nav: "occupied" },
    { label: "Active Tenants", value: stats.tenants, icon: Users, tint: "bg-purple-50 text-purple-600", nav: "tenants" },
    { label: "Total Bookings", value: stats.bookings, icon: Calendar, tint: "bg-indigo-50 text-indigo-600", nav: "bookings" },
    { label: "Occupancy Rate", value: `${occRate}%`, icon: TrendingUp, tint: "bg-cyan-50 text-cyan-600", nav: "occupied" },
    { label: "Open Maintenance", value: stats.maintenanceOpen, icon: Wrench, tint: "bg-amber-50 text-amber-600", nav: "maintenance" },
  ]
  const pieData = [
    { name: "Available", value: stats.available },
    { name: "Occupied", value: stats.occupied },
  ]

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((c) => (
          <StatCard key={c.label} label={c.label} value={c.value} icon={c.icon} tint={c.tint} onClick={() => onNavigate(c.nav)} />
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="border-slate-200 dark:border-slate-800 rounded-2xl">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Building className="h-4 w-4 text-blue-600" /> Occupancy
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64 flex flex-col">
              <ResponsiveContainer width="100%" height="80%">
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3}>
                    {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i]} />)}
                  </Pie>
                  <RTooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex justify-center gap-4 text-sm">
                <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-full bg-blue-600" /> Available ({stats.available})</span>
                <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-full bg-orange-500" /> Occupied ({stats.occupied})</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
