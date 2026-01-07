"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { AdminHeader } from "@/components/admin-header"
import ChangePasswordModal from "@/components/admin/ChangePasswordModal"
import { ApartmentsManager } from "@/components/apartments-manager"
import { EmployeesManager } from "@/components/employees-manager"
import { BookingsManager } from "@/components/bookings-manager"
import { MaintenanceManager } from "@/components/ui/employee/maintenance-manager"
import { FeedbackManager } from "@/components/feedback-manager"
import { TenantsManager } from "@/components/tenants-manager"
import { AdminManager } from "@/components/admin-manager"
import { Building, Users, Calendar, MessageSquare, Key, Wrench, LogOut, Home, Eye, Shield } from "lucide-react"
import Link from "next/link"

export default function AdminDashboard() {
  const router = useRouter()
  const [admin, setAdmin] = useState<any>(null)
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false)
  const [showSuccessMessage, setShowSuccessMessage] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const adminData = localStorage.getItem("admin_session")
    if (!adminData) {
      router.push("/login?redirect=admin")
      return
    }
    try {
      setAdmin(JSON.parse(adminData))
    } catch (err) {
      router.push("/login?redirect=admin")
    }
    setLoading(false)
  }, [router])

  const handleLogout = () => {
    localStorage.removeItem("admin_session")
    router.push("/login")
  }

  const handlePasswordChangeSuccess = () => {
    setShowSuccessMessage(true)
    setTimeout(() => setShowSuccessMessage(false), 3000)
  }

  if (loading) return <div className="flex items-center justify-center min-h-screen">Loading...</div>
  if (!admin) return null

  return (
    <div className="min-h-screen bg-background">
      <AdminHeader admin={admin} onLogout={handleLogout} />

      <main className="container mx-auto px-4 py-8">
        <div className="mb-8 flex justify-between items-center">
          <div>
            <h1 className="text-4xl font-bold mb-2">Dashboard</h1>
            <p className="text-muted-foreground">Welcome back, {admin.username}!</p>
          </div>
          <Button 
            onClick={() => setIsPasswordModalOpen(true)}
            variant="outline"
            className="flex items-center gap-2"
          >
            <Key className="h-4 w-4" />
            Change Password
          </Button>
        </div>

        {showSuccessMessage && (
          <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-6">
            ✓ Password changed successfully!
          </div>
        )}

        <Tabs defaultValue="apartments" className="space-y-8">
          <TabsList className="grid w-full grid-cols-7 lg:w-auto">
            <TabsTrigger value="apartments" className="flex items-center gap-2">
              <Building className="h-4 w-4" />
              <span className="hidden sm:inline">Apartments</span>
            </TabsTrigger>
            <TabsTrigger value="tenants" className="flex items-center gap-2">
              <Home className="h-4 w-4" />
              <span className="hidden sm:inline">Tenants</span>
            </TabsTrigger>
            <TabsTrigger value="employees" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">Employees</span>
            </TabsTrigger>
            <TabsTrigger value="admins" className="flex items-center gap-2">
              <Shield className="h-4 w-4" />
              <span className="hidden sm:inline">Admins</span>
            </TabsTrigger>
            <TabsTrigger value="bookings" className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              <span className="hidden sm:inline">Bookings</span>
            </TabsTrigger>
            <TabsTrigger value="maintenance" className="flex items-center gap-2">
              <Wrench className="h-4 w-4" />
              <span className="hidden sm:inline">Maintenance</span>
            </TabsTrigger>
            <TabsTrigger value="feedback" className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              <span className="hidden sm:inline">Feedback</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="apartments">
            <ApartmentsManager />
          </TabsContent>

          <TabsContent value="tenants">
            <TenantsManager />
          </TabsContent>

          <TabsContent value="employees">
            <EmployeesManager />
          </TabsContent>

          <TabsContent value="admins">
            <AdminManager />
          </TabsContent>

          <TabsContent value="bookings">
            <div className="space-y-4">
              <div className="flex justify-end mb-4">
                <Button asChild className="gap-2 bg-blue-600 hover:bg-blue-700">
                  <Link href="/admin/bookings">
                    <Eye className="h-4 w-4" />
                    View All Bookings
                  </Link>
                </Button>
              </div>
              <BookingsManager />
            </div>
          </TabsContent>

          <TabsContent value="maintenance">
            <MaintenanceManager />
          </TabsContent>

          <TabsContent value="feedback">
            <FeedbackManager />
          </TabsContent>
        </Tabs>
      </main>

      <ChangePasswordModal
        isOpen={isPasswordModalOpen}
        onClose={() => setIsPasswordModalOpen(false)}
        adminId={admin.id}
        onSuccess={handlePasswordChangeSuccess}
      />
    </div>
  )
}
