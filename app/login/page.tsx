"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createBrowserClient } from "@supabase/ssr"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import Link from "next/link"
import { LogIn, AlertCircle } from "lucide-react"

export default function LoginPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [activeTab, setActiveTab] = useState("admin")

  const [adminCreds, setAdminCreds] = useState({ username: "", password: "" })
  const [employeeCreds, setEmployeeCreds] = useState({ username: "", password: "" })
  const [tenantCreds, setTenantCreds] = useState({ email: "", password: "" })

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  console.log("Supabase URL:", supabaseUrl ? "✅ Set" : "❌ Missing")
  console.log("Supabase Key:", supabaseKey ? "✅ Set" : "❌ Missing")

  const supabase = createBrowserClient(supabaseUrl || "", supabaseKey || "")

  // Admin Login
  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)

    try {
      if (!adminCreds.username || !adminCreds.password) {
        setError("Please enter username and password")
        setLoading(false)
        return
      }

      console.log("🔐 Attempting admin login with:", adminCreds.username)

      const { data, error: queryError } = await supabase
        .from("admin_accounts")
        .select("*")
        .eq("username", adminCreds.username)
        .eq("password", adminCreds.password)

      console.log("Query data:", data)
      console.log("Query error:", queryError)

      if (queryError) {
        console.error("❌ Query error:", queryError)
        setError(`Login failed: ${queryError.message}`)
        setLoading(false)
        return
      }

      if (!data || data.length === 0) {
        console.error("❌ No admin found")
        setError("Invalid username or password")
        setLoading(false)
        return
      }

      console.log("✅ Admin login successful!")
      localStorage.setItem("admin_session", JSON.stringify(data[0]))
      setAdminCreds({ username: "", password: "" })
      router.push("/admin/dashboard")
    } catch (err) {
      console.error("❌ Login error:", err)
      setError("An unexpected error occurred")
      setLoading(false)
    }
  }

  // Employee Login
  const handleEmployeeLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)

    try {
      if (!employeeCreds.username || !employeeCreds.password) {
        setError("Please enter username and password")
        setLoading(false)
        return
      }

      console.log("🔐 Attempting employee login with:", employeeCreds.username)

      const { data: allEmployees, error: allError } = await supabase
        .from("employees")
        .select("*")

      console.log("All employees:", allEmployees)

      if (!allEmployees || allEmployees.length === 0) {
        setError("No employees found in database")
        setLoading(false)
        return
      }

      const employee = allEmployees.find(
        (emp) =>
          emp.username.trim() === employeeCreds.username.trim() &&
          emp.password.trim() === employeeCreds.password.trim()
      )

      if (!employee) {
        console.error("❌ No employee found with matching credentials")
        setError("Invalid username or password")
        setLoading(false)
        return
      }

      // Check if employee is active
      if (employee.status !== "active") {
        console.error("❌ Employee account is inactive")
        setError("Your account has been deactivated. Contact admin.")
        setLoading(false)
        return
      }

      console.log("✅ Employee login successful!")
      localStorage.setItem("employee_session", JSON.stringify(employee))
      setEmployeeCreds({ username: "", password: "" })
      router.push("/employee/dashboard")
    } catch (err) {
      console.error("❌ Login error:", err)
      setError("An unexpected error occurred")
      setLoading(false)
    }
  }

  // Tenant Login
  const handleTenantLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)

    try {
      if (!tenantCreds.email || !tenantCreds.password) {
        setError("Please enter email and password")
        setLoading(false)
        return
      }

      console.log("🔐 Attempting tenant login with:", tenantCreds.email)

      const { data: tenants, error: queryError } = await supabase
        .from("tenants")
        .select("*")
        .eq("email", tenantCreds.email)
        .eq("password", tenantCreds.password)

      console.log("Tenant query data:", tenants)
      console.log("Tenant query error:", queryError)

      if (queryError) {
        console.error("❌ Query error:", queryError)
        setError(`Login failed: ${queryError.message}`)
        setLoading(false)
        return
      }

      if (!tenants || tenants.length === 0) {
        console.error("❌ No tenant found")
        setError("Invalid email or password")
        setLoading(false)
        return
      }

      const tenant = tenants[0]

      // Check if tenant account is approved
      if (tenant.approval_status !== "approved") {
        console.error("❌ Tenant account not approved")
        setError(
          tenant.approval_status === "pending"
            ? "Your account is pending admin approval. Please wait."
            : "Your account has been rejected. Contact admin."
        )
        setLoading(false)
        return
      }

      // Check if tenant account is active
      if (!tenant.is_active) {
        console.error("❌ Tenant account is inactive")
        setError("Your account has been deactivated. Contact admin.")
        setLoading(false)
        return
      }

      console.log("✅ Tenant login successful!")
      localStorage.setItem("tenant_session", JSON.stringify(tenant))
      setTenantCreds({ email: "", password: "" })
      router.push("/tenant/dashboard")
    } catch (err) {
      console.error("❌ Login error:", err)
      setError("An unexpected error occurred")
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-blue-100 p-4">
      <Card className="w-full max-w-md shadow-xl border-0">
        <CardHeader className="bg-gradient-to-r from-blue-600 to-blue-800 text-white rounded-t-lg pb-6">
          <CardTitle className="flex items-center gap-2 text-2xl">
            <LogIn className="h-6 w-6" />
            Cielo Vista Portal
          </CardTitle>
          <p className="text-blue-100 text-sm mt-2">Sign in to your account</p>
        </CardHeader>

        <CardContent className="pt-6">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex gap-2">
              <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          )}

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-3 mb-6 bg-slate-100 p-1 rounded-lg">
              <TabsTrigger 
                value="admin"
                className="data-[state=active]:bg-white data-[state=active]:text-blue-600 rounded text-xs sm:text-sm"
              >
                Admin
              </TabsTrigger>
              <TabsTrigger 
                value="employee"
                className="data-[state=active]:bg-white data-[state=active]:text-purple-600 rounded text-xs sm:text-sm"
              >
                Employee
              </TabsTrigger>
              <TabsTrigger 
                value="tenant"
                className="data-[state=active]:bg-white data-[state=active]:text-green-600 rounded text-xs sm:text-sm"
              >
                Tenant
              </TabsTrigger>
            </TabsList>

            {/* Admin Login Tab */}
            <TabsContent value="admin" className="space-y-4">
              <form onSubmit={handleAdminLogin} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Username</label>
                  <Input
                    type="text"
                    value={adminCreds.username}
                    onChange={(e) => setAdminCreds({ ...adminCreds, username: e.target.value })}
                    placeholder="Enter admin username"
                    disabled={loading}
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Password</label>
                  <Input
                    type="password"
                    value={adminCreds.password}
                    onChange={(e) => setAdminCreds({ ...adminCreds, password: e.target.value })}
                    placeholder="Enter admin password"
                    disabled={loading}
                    required
                  />
                </div>

                <Button 
                  type="submit" 
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium"
                  disabled={loading}
                >
                  {loading ? "Signing in..." : "Admin Login"}
                </Button>
              </form>
            </TabsContent>

            {/* Employee Login Tab */}
            <TabsContent value="employee" className="space-y-4">
              <form onSubmit={handleEmployeeLogin} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Username</label>
                  <Input
                    type="text"
                    value={employeeCreds.username}
                    onChange={(e) => setEmployeeCreds({ ...employeeCreds, username: e.target.value })}
                    placeholder="Enter employee username"
                    disabled={loading}
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Password</label>
                  <Input
                    type="password"
                    value={employeeCreds.password}
                    onChange={(e) => setEmployeeCreds({ ...employeeCreds, password: e.target.value })}
                    placeholder="Enter employee password"
                    disabled={loading}
                    required
                  />
                </div>

                <Button 
                  type="submit" 
                  className="w-full bg-purple-600 hover:bg-purple-700 text-white font-medium"
                  disabled={loading}
                >
                  {loading ? "Signing in..." : "Employee Login"}
                </Button>
              </form>
            </TabsContent>

            {/* Tenant Login Tab */}
            <TabsContent value="tenant" className="space-y-4">
              <form onSubmit={handleTenantLogin} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Email</label>
                  <Input
                    type="email"
                    value={tenantCreds.email}
                    onChange={(e) => setTenantCreds({ ...tenantCreds, email: e.target.value })}
                    placeholder="Enter your email"
                    disabled={loading}
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Password</label>
                  <Input
                    type="password"
                    value={tenantCreds.password}
                    onChange={(e) => setTenantCreds({ ...tenantCreds, password: e.target.value })}
                    placeholder="Enter your password"
                    disabled={loading}
                    required
                  />
                </div>

                <Button 
                  type="submit" 
                  className="w-full bg-green-600 hover:bg-green-700 text-white font-medium"
                  disabled={loading}
                >
                  {loading ? "Signing in..." : "Tenant Login"}
                </Button>
              </form>

              <div className="pt-2 border-t">
                <p className="text-sm text-slate-600 mb-3">Don't have an account?</p>
                <Link href="/tenant/register">
                  <Button 
                    type="button"
                    variant="outline"
                    className="w-full border-green-300 text-green-700 hover:bg-green-50"
                  >
                    Create Tenant Account
                  </Button>
                </Link>
              </div>
            </TabsContent>
          </Tabs>

          <div className="mt-6 text-center">
            <Link href="/" className="text-blue-600 hover:text-blue-700 text-sm font-medium">
              Back to Home
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
