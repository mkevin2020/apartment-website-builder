"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { AdminHeader } from "@/components/admin-header"
import ChangePasswordModal from "@/components/admin/ChangePasswordModal"
import { ApartmentsManager } from "@/components/apartments-manager"
import { EmployeesManager } from "@/components/employees-manager"
import { ManagersManager } from "@/components/managers-manager"
import { BookingsManager } from "@/components/bookings-manager"
import { OccupiedApartmentsManager } from "@/components/occupied-apartments-manager"
import { MaintenanceManager } from "@/components/ui/employee/maintenance-manager"
import { FeedbackManager } from "@/components/feedback-manager"
import { TenantsManager } from "@/components/tenants-manager"
import { AdminManager } from "@/components/admin-manager"
import { PasswordResetRequestsManager } from "@/components/password-reset-requests-manager"
import { Building, Users, Calendar, MessageSquare, Key, Wrench, LogOut, Home, Eye, Shield, AlertCircle, Lock } from "lucide-react"
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
          <div className="flex justify-end">
            <TabsList className="flex flex-row w-auto gap-1 bg-transparent flex-wrap justify-end">
              <TabsTrigger value="apartments" className="flex items-center gap-2 py-2 px-3 rounded-lg hover:bg-gray-100">
                <Building className="h-5 w-5" />
                <span>Apartments</span>
              </TabsTrigger>
              <TabsTrigger value="occupied" className="flex items-center gap-2 py-2 px-3 rounded-lg hover:bg-gray-100">
                <AlertCircle className="h-5 w-5" />
                <span>Occupied</span>
              </TabsTrigger>
              <TabsTrigger value="tenants" className="flex items-center gap-2 py-2 px-3 rounded-lg hover:bg-gray-100">
                <Home className="h-5 w-5" />
                <span>Tenants</span>
              </TabsTrigger>
              <TabsTrigger value="employees" className="flex items-center gap-2 py-2 px-3 rounded-lg hover:bg-gray-100">
                <Users className="h-5 w-5" />
                <span>Employees</span>
              </TabsTrigger>
              <TabsTrigger value="managers" className="flex items-center gap-2 py-2 px-3 rounded-lg hover:bg-gray-100">
                <Shield className="h-5 w-5" />
                <span>Managers</span>
              </TabsTrigger>
              <TabsTrigger value="admins" className="flex items-center gap-2 py-2 px-3 rounded-lg hover:bg-gray-100">
                <Shield className="h-5 w-5" />
                <span>Admins</span>
              </TabsTrigger>
              <TabsTrigger value="bookings" className="flex items-center gap-2 py-2 px-3 rounded-lg hover:bg-gray-100">
                <Calendar className="h-5 w-5" />
                <span>Bookings</span>
              </TabsTrigger>
              <TabsTrigger value="maintenance" className="flex items-center gap-2 py-2 px-3 rounded-lg hover:bg-gray-100">
                <Wrench className="h-5 w-5" />
                <span>Maintenance</span>
              </TabsTrigger>
              <TabsTrigger value="feedback" className="flex items-center gap-2 py-2 px-3 rounded-lg hover:bg-gray-100">
                <MessageSquare className="h-5 w-5" />
                <span>Feedback</span>
              </TabsTrigger>
              <TabsTrigger value="password-reset" className="flex items-center gap-2 py-2 px-3 rounded-lg hover:bg-gray-100">
                <Lock className="h-5 w-5" />
                <span>Password Reset</span>
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="w-full">
            <TabsContent value="apartments" className="mt-0">
              <ApartmentsManager />
            </TabsContent>

            <TabsContent value="occupied" className="mt-0">
              <OccupiedApartmentsManager />
            </TabsContent>

            <TabsContent value="tenants" className="mt-0">
              <TenantsManager />
            </TabsContent>

            <TabsContent value="employees" className="mt-0">
              <EmployeesManager />
            </TabsContent>

            <TabsContent value="managers" className="mt-0">
              <ManagersManager />
            </TabsContent>

            <TabsContent value="admins" className="mt-0">
              <AdminManager />
            </TabsContent>

            <TabsContent value="bookings" className="mt-0">
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

            <TabsContent value="maintenance" className="mt-0">
              <MaintenanceManager />
            </TabsContent>

            <TabsContent value="feedback" className="mt-0">
              <FeedbackManager />
            </TabsContent>

            <TabsContent value="password-reset" className="mt-0">
              <PasswordResetRequestsManager />
            </TabsContent>
          </div>
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
