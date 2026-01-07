"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import EmployeeHeader from "@/components/ui/employee/EmployeeHeader";
import BookingsManager from "@/components/ui/employee/bookings";
import { ChangePasswordModal } from "@/components/change-password-modal";
import { createBrowserClient } from "@supabase/ssr";
import { Building, Calendar, Users, MessageSquare, LogOut, Eye, Mail, Phone, FileText, User, Key } from "lucide-react";
import Link from "next/link";

export default function EmployeeDashboard() {
  const router = useRouter();
  const [employee, setEmployee] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [apartments, setApartments] = useState<any[]>([]);
  const [tenants, setTenants] = useState<any[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
  );

  useEffect(() => {
    const employeeData = localStorage.getItem("employee_session");
    if (!employeeData) {
      router.push("/login?redirect=employee");
      return;
    }
    try {
      setEmployee(JSON.parse(employeeData));
    } catch (err) {
      console.error("Error parsing employee session:", err);
      router.push("/login?redirect=employee");
    }
    setLoading(false);
  }, [router]);

  // Fetch apartments
  useEffect(() => {
    if (!employee) return;

    const fetchApartments = async () => {
      try {
        const { data, error } = await supabase
          .from("apartments")
          .select("*")
          .order("created_at", { ascending: false });

        if (error) throw error;
        setApartments(data || []);
      } catch (err) {
        console.error("Error fetching apartments:", err);
      }
    };

    fetchApartments();
  }, [employee]);

  // Fetch feedback as messages
  useEffect(() => {
    if (!employee) return;

    const fetchMessages = async () => {
      try {
        const { data, error } = await supabase
          .from("client_feedback")
          .select("*")
          .order("created_at", { ascending: false });

        if (error) throw error;
        setMessages(data || []);
      } catch (err) {
        console.error("Error fetching messages:", err);
      }
    };

    fetchMessages();
  }, [employee]);

  // Fetch tenants
  useEffect(() => {
    if (!employee) return;

    const fetchTenants = async () => {
      try {
        const { data, error } = await supabase
          .from("tenants")
          .select("*")
          .order("created_at", { ascending: false });

        if (error) throw error;
        setTenants(data || []);
      } catch (err) {
        console.error("Error fetching tenants:", err);
      }
    };

    fetchTenants();
  }, [employee]);

  const handleLogout = () => {
    localStorage.removeItem("employee_session");
    router.push("/login");
  };

  const handleToggleAvailability = async (id: number, isAvailable: boolean) => {
    try {
      const { error } = await supabase
        .from("apartments")
        .update({ is_available: !isAvailable })
        .eq("id", id);

      if (error) throw error;

      setApartments((prev) =>
        prev.map((apt) =>
          apt.id === id ? { ...apt, is_available: !isAvailable } : apt
        )
      );
    } catch (err) {
      console.error("Error updating apartment availability:", err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-600">Loading...</p>
      </div>
    );
  }

  if (!employee) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      <EmployeeHeader employee={employee} onLogout={handleLogout} />

      <main className="container mx-auto px-4 py-8">
        <div className="mb-8 flex justify-between items-center">
          <div>
            <h1 className="text-4xl font-bold mb-2">Dashboard</h1>
            <p className="text-muted-foreground">Welcome back, {employee?.full_name}!</p>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={() => setIsPasswordModalOpen(true)}
              variant="outline"
              className="flex items-center gap-2"
            >
              <Key className="h-4 w-4" />
              Change Password
            </Button>
            <Button
              onClick={handleLogout}
              variant="destructive"
              className="flex items-center gap-2"
            >
              <LogOut className="h-4 w-4" />
              Logout
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-600 text-sm">Total Apartments</p>
                  <p className="text-3xl font-bold">{apartments.length}</p>
                </div>
                <Building className="h-8 w-8 text-blue-600 opacity-20" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-600 text-sm">Available Units</p>
                  <p className="text-3xl font-bold">
                    {apartments.filter((a) => a.is_available).length}
                  </p>
                </div>
                <Calendar className="h-8 w-8 text-green-600 opacity-20" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-600 text-sm">Total Tenants</p>
                  <p className="text-3xl font-bold">{tenants.length}</p>
                </div>
                <Users className="h-8 w-8 text-indigo-600 opacity-20" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-600 text-sm">New Messages</p>
                  <p className="text-3xl font-bold">
                    {messages.filter((m) => !m.is_read).length}
                  </p>
                </div>
                <MessageSquare className="h-8 w-8 text-purple-600 opacity-20" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-600 text-sm">Total Messages</p>
                  <p className="text-3xl font-bold">{messages.length}</p>
                </div>
                <MessageSquare className="h-8 w-8 text-orange-600 opacity-20" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="apartments" className="space-y-8">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="apartments" className="flex items-center gap-2">
              <Building className="h-4 w-4" />
              <span className="hidden sm:inline">Apartments</span>
            </TabsTrigger>
            <TabsTrigger value="bookings" className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              <span className="hidden sm:inline">Bookings</span>
            </TabsTrigger>
            <TabsTrigger value="tenants" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">Tenants</span>
            </TabsTrigger>
            <TabsTrigger value="messages" className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              <span className="hidden sm:inline">Messages</span>
            </TabsTrigger>
          </TabsList>

          {/* Apartments Tab */}
          <TabsContent value="apartments">
            <Card>
              <CardHeader>
                <CardTitle>Available Apartments</CardTitle>
              </CardHeader>
              <CardContent>
                {apartments.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">
                    No apartments found
                  </p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {apartments.map((apt) => (
                      <div
                        key={apt.id}
                        className="border rounded-lg p-4 hover:shadow-md transition-shadow"
                      >
                        {apt.image_url && (
                          <img
                            src={apt.image_url}
                            alt={apt.name}
                            className="w-full h-40 object-cover rounded-lg mb-3"
                          />
                        )}
                        <h3 className="font-semibold text-lg mb-2">{apt.name}</h3>
                        <p className="text-sm text-gray-600 mb-2">
                          {apt.description}
                        </p>
                        <div className="grid grid-cols-2 gap-2 text-sm mb-3">
                          <div>
                            <p className="text-gray-600">Bedrooms</p>
                            <p className="font-semibold">{apt.bedrooms}</p>
                          </div>
                          <div>
                            <p className="text-gray-600">Bathrooms</p>
                            <p className="font-semibold">{apt.bathrooms}</p>
                          </div>
                          <div>
                            <p className="text-gray-600">Size</p>
                            <p className="font-semibold">{apt.size_sqm} m²</p>
                          </div>
                          <div>
                            <p className="text-gray-600">Price</p>
                            <p className="font-semibold">
                              RWF {apt.price_per_month}
                            </p>
                          </div>
                        </div>
                        <div className="flex justify-between items-center mb-3">
                          <span
                            className={`px-2 py-1 rounded text-sm font-medium ${
                              apt.is_available
                                ? "bg-green-100 text-green-800"
                                : "bg-red-100 text-red-800"
                            }`}
                          >
                            {apt.is_available ? "Available" : "Occupied"}
                          </span>
                        </div>
                        <Button
                          onClick={() => handleToggleAvailability(apt.id, apt.is_available)}
                          variant={apt.is_available ? "destructive" : "default"}
                          className="w-full"
                        >
                          {apt.is_available ? "Mark as Occupied" : "Mark as Available"}
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Bookings Tab */}
          <TabsContent value="bookings">
            <div className="space-y-4">
              <div className="flex justify-end mb-4">
                <Button asChild className="gap-2 bg-blue-600 hover:bg-blue-700">
                  <Link href="/employee/bookings">
                    <Eye className="h-4 w-4" />
                    View All Bookings
                  </Link>
                </Button>
              </div>
              <BookingsManager />
            </div>
          </TabsContent>

          {/* Tenants Tab */}
          <TabsContent value="tenants">
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Tenants</h2>
                <p className="text-gray-600">View all registered tenants</p>
              </div>

              {/* Search and Filter */}
              <div className="space-y-4">
                <Input
                  placeholder="Search by name, email, or username..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="max-w-md"
                />

                <div className="flex gap-2 flex-wrap">
                  {["all", "pending", "approved", "rejected"].map((status) => (
                    <Button
                      key={status}
                      variant={filterStatus === status ? "default" : "outline"}
                      onClick={() => setFilterStatus(status)}
                      className={
                        filterStatus === status
                          ? "bg-blue-600 hover:bg-blue-700"
                          : "border-gray-300"
                      }
                    >
                      {status.charAt(0).toUpperCase() + status.slice(1)}
                      <span className="ml-2 text-xs font-semibold">
                        ({tenants.filter((t) => 
                          status === "all" ? true : t.approval_status === status
                        ).length})
                      </span>
                    </Button>
                  ))}
                </div>
              </div>

              {/* Tenants List */}
              {tenants.length === 0 ? (
                <Card>
                  <CardContent className="pt-8 text-center">
                    <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-500 text-lg">No tenants found</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-4">
                  {tenants
                    .filter((tenant) => {
                      const searchLower = searchTerm.toLowerCase();
                      const matchesSearch =
                        tenant.full_name.toLowerCase().includes(searchLower) ||
                        tenant.email.toLowerCase().includes(searchLower) ||
                        tenant.username.toLowerCase().includes(searchLower);
                      const matchesStatus =
                        filterStatus === "all" || tenant.approval_status === filterStatus;
                      return matchesSearch && matchesStatus;
                    })
                    .map((tenant) => (
                      <Card key={tenant.id} className="hover:shadow-lg transition-shadow">
                        <CardContent className="pt-6">
                          <div className="grid md:grid-cols-2 gap-6">
                            {/* Left Column - Basic Info */}
                            <div>
                              <h3 className="text-xl font-bold text-gray-900 mb-4">
                                {tenant.full_name}
                              </h3>
                              <div className="space-y-3">
                                <div className="flex items-start gap-2">
                                  <User className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
                                  <div>
                                    <p className="text-xs text-gray-500">Username</p>
                                    <p className="text-sm font-medium text-gray-900">
                                      @{tenant.username}
                                    </p>
                                  </div>
                                </div>

                                <div className="flex items-start gap-2">
                                  <Mail className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
                                  <div>
                                    <p className="text-xs text-gray-500">Email</p>
                                    <p className="text-sm font-medium text-gray-900 break-all">
                                      {tenant.email}
                                    </p>
                                  </div>
                                </div>

                                <div className="flex items-start gap-2">
                                  <Phone className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
                                  <div>
                                    <p className="text-xs text-gray-500">Phone</p>
                                    <p className="text-sm font-medium text-gray-900">
                                      {tenant.phone}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Right Column - Additional Info */}
                            <div>
                              <div className="space-y-3">
                                <div>
                                  <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold border ${
                                    tenant.approval_status === "approved"
                                      ? "bg-green-100 text-green-800 border-green-300"
                                      : tenant.approval_status === "pending"
                                      ? "bg-yellow-100 text-yellow-800 border-yellow-300"
                                      : "bg-red-100 text-red-800 border-red-300"
                                  }`}>
                                    {tenant.approval_status.charAt(0).toUpperCase() +
                                      tenant.approval_status.slice(1)}
                                  </div>
                                </div>

                                <div className="flex items-start gap-2">
                                  <FileText className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
                                  <div>
                                    <p className="text-xs text-gray-500">ID Number</p>
                                    <p className="text-sm font-medium text-gray-900">
                                      {tenant.id_number}
                                    </p>
                                  </div>
                                </div>

                                <div>
                                  <p className="text-xs text-gray-500">Address</p>
                                  <p className="text-sm font-medium text-gray-900">
                                    {tenant.address}, {tenant.city}, {tenant.country}
                                  </p>
                                </div>

                                <div>
                                  <p className="text-xs text-gray-500">Emergency Contact</p>
                                  <p className="text-sm font-medium text-gray-900">
                                    {tenant.emergency_contact}
                                  </p>
                                  <p className="text-xs text-gray-500 mt-1">
                                    {tenant.emergency_contact_phone}
                                  </p>
                                </div>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                </div>
              )}
            </div>
          </TabsContent>

          {/* Messages Tab */}
          <TabsContent value="messages">
            <Card>
              <CardHeader>
                <CardTitle>Client Feedback</CardTitle>
              </CardHeader>
              <CardContent>
                {messages.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">
                    No messages yet
                  </p>
                ) : (
                  <div className="space-y-4">
                    {messages.map((msg) => (
                      <div
                        key={msg.id}
                        className={`border rounded-lg p-4 ${
                          msg.is_read ? "bg-white" : "bg-blue-50"
                        }`}
                      >
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <h3 className="font-semibold">{msg.name}</h3>
                            <p className="text-sm text-gray-600">{msg.email}</p>
                          </div>
                          <span
                            className={`px-2 py-1 rounded text-sm font-medium ${
                              msg.is_read
                                ? "bg-gray-100 text-gray-800"
                                : "bg-blue-100 text-blue-800"
                            }`}
                          >
                            {msg.is_read ? "Read" : "New"}
                          </span>
                        </div>
                        <p className="text-gray-700">{msg.message}</p>
                        <p className="text-xs text-gray-500 mt-2">
                          {new Date(msg.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      <ChangePasswordModal
        isOpen={isPasswordModalOpen}
        onClose={() => setIsPasswordModalOpen(false)}
        table="employees"
        userId={employee?.id || ""}
      />
    </div>
  );
}