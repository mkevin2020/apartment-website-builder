"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { createBrowserClient } from "@supabase/ssr";
import {
  Building,
  Users,
  Calendar,
  MessageSquare,
  LogOut,
  Key,
  Home,
  FileText,
  BarChart3,
  AlertCircle,
  CheckCircle,
} from "lucide-react";
import Link from "next/link";

interface Manager {
  id: number;
  username: string;
  full_name: string;
  email: string;
  department: string;
  [key: string]: any;
}

interface Apartment {
  id: number;
  name: string;
  type: string;
  bedrooms: number;
  bathrooms: number;
  price_per_month: number;
  is_available: boolean;
  [key: string]: any;
}

interface Tenant {
  id: number;
  username: string;
  email: string;
  full_name: string;
  phone: string;
  approval_status: string;
  is_active: boolean;
  [key: string]: any;
}

interface Booking {
  id: number;
  client_name: string;
  email: string;
  apartment_type: string;
  start_date: string;
  end_date: string;
  status: string;
  [key: string]: any;
}

export default function ManagerDashboard() {
  const router = useRouter();
  const [manager, setManager] = useState<Manager | null>(null);
  const [loading, setLoading] = useState(true);
  const [apartments, setApartments] = useState<Apartment[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [occupiedCount, setOccupiedCount] = useState(0);
  const [availableCount, setAvailableCount] = useState(0);
  const [messages, setMessages] = useState<any[]>([]);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
  );

  useEffect(() => {
    const managerData = localStorage.getItem("manager_session");
    if (!managerData) {
      router.push("/login");
      return;
    }
    try {
      setManager(JSON.parse(managerData));
    } catch (err) {
      console.error("Error parsing manager session:", err);
      router.push("/login");
    }
    setLoading(false);
  }, [router]);

  // Fetch apartments
  useEffect(() => {
    if (!manager) return;

    const fetchApartments = async () => {
      try {
        const { data, error } = await supabase
          .from("apartments")
          .select("*")
          .order("created_at", { ascending: false });

        if (error) throw error;
        setApartments(data || []);

        // Count occupied and available
        const available = data?.filter((a) => a.is_available).length || 0;
        const occupied = (data?.length || 0) - available;
        setAvailableCount(available);
        setOccupiedCount(occupied);
      } catch (err) {
        console.error("Error fetching apartments:", err);
      }
    };

    fetchApartments();
  }, [manager]);

  // Fetch tenants
  useEffect(() => {
    if (!manager) return;

    const fetchTenants = async () => {
      try {
        const { data, error } = await supabase
          .from("tenants")
          .select("*")
          .eq("approval_status", "approved")
          .order("created_at", { ascending: false });

        if (error) throw error;
        setTenants(data || []);
      } catch (err) {
        console.error("Error fetching tenants:", err);
      }
    };

    fetchTenants();
  }, [manager]);

  // Fetch bookings
  useEffect(() => {
    if (!manager) return;

    const fetchBookings = async () => {
      try {
        const { data, error } = await supabase
          .from("bookings")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(10);

        if (error) throw error;
        setBookings(data || []);
      } catch (err) {
        console.error("Error fetching bookings:", err);
      }
    };

    fetchBookings();
  }, [manager]);

  // Fetch messages
  useEffect(() => {
    if (!manager) return;

    const fetchMessages = async () => {
      try {
        const { data, error } = await supabase
          .from("client_feedback")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(10);

        if (error) throw error;
        setMessages(data || []);
      } catch (err) {
        console.error("Error fetching messages:", err);
      }
    };

    fetchMessages();
  }, [manager]);

  const handleLogout = () => {
    localStorage.removeItem("manager_session");
    router.push("/login");
  };

  const handleChangePassword = () => {
    // TODO: Implement password change modal
    alert("Password change feature coming soon!");
  };

  if (loading) return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  if (!manager) return null;

  const stats = [
    {
      label: "Total Apartments",
      value: apartments.length,
      icon: Building,
      color: "text-blue-600",
      bgColor: "bg-blue-50",
    },
    {
      label: "Available",
      value: availableCount,
      icon: CheckCircle,
      color: "text-green-600",
      bgColor: "bg-green-50",
    },
    {
      label: "Occupied",
      value: occupiedCount,
      icon: Home,
      color: "text-orange-600",
      bgColor: "bg-orange-50",
    },
    {
      label: "Active Tenants",
      value: tenants.filter((t) => t.is_active).length,
      icon: Users,
      color: "text-purple-600",
      bgColor: "bg-purple-50",
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Manager Portal</h1>
            <p className="text-sm text-slate-600">Welcome, {manager.full_name}</p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={handleChangePassword}
              className="flex items-center gap-2"
            >
              <Key className="h-4 w-4" />
              Change Password
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleLogout}
              className="flex items-center gap-2"
            >
              <LogOut className="h-4 w-4" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {stats.map((stat, idx) => {
            const Icon = stat.icon;
            return (
              <Card key={idx} className="border-0 shadow-sm">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-slate-600 font-medium">{stat.label}</p>
                      <p className="text-3xl font-bold text-slate-900 mt-1">{stat.value}</p>
                    </div>
                    <div className={`p-3 rounded-lg ${stat.bgColor}`}>
                      <Icon className={`h-6 w-6 ${stat.color}`} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Tabs */}
        <Tabs defaultValue="apartments" className="space-y-6">
          <TabsList className="bg-white border border-slate-200">
            <TabsTrigger value="apartments" className="flex items-center gap-2">
              <Building className="h-4 w-4" />
              Apartments
            </TabsTrigger>
            <TabsTrigger value="tenants" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Tenants
            </TabsTrigger>
            <TabsTrigger value="bookings" className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Bookings
            </TabsTrigger>
            <TabsTrigger value="messages" className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              Messages
            </TabsTrigger>
          </TabsList>

          {/* Apartments Tab */}
          <TabsContent value="apartments" className="space-y-4">
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle>Property Management</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 border-b">
                      <tr>
                        <th className="text-left p-3 font-medium">Name</th>
                        <th className="text-left p-3 font-medium">Type</th>
                        <th className="text-left p-3 font-medium">Bedrooms</th>
                        <th className="text-left p-3 font-medium">Price/Month</th>
                        <th className="text-left p-3 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {apartments.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="p-6 text-center text-slate-600">
                            No apartments found
                          </td>
                        </tr>
                      ) : (
                        apartments.map((apt) => (
                          <tr key={apt.id} className="border-b hover:bg-slate-50">
                            <td className="p-3 font-medium">{apt.name}</td>
                            <td className="p-3">{apt.type}</td>
                            <td className="p-3">{apt.bedrooms}</td>
                            <td className="p-3">${apt.price_per_month}</td>
                            <td className="p-3">
                              <span
                                className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${
                                  apt.is_available
                                    ? "bg-green-100 text-green-800"
                                    : "bg-red-100 text-red-800"
                                }`}
                              >
                                {apt.is_available ? "Available" : "Occupied"}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tenants Tab */}
          <TabsContent value="tenants" className="space-y-4">
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle>Tenant Management</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 border-b">
                      <tr>
                        <th className="text-left p-3 font-medium">Name</th>
                        <th className="text-left p-3 font-medium">Email</th>
                        <th className="text-left p-3 font-medium">Phone</th>
                        <th className="text-left p-3 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tenants.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="p-6 text-center text-slate-600">
                            No tenants found
                          </td>
                        </tr>
                      ) : (
                        tenants.map((tenant) => (
                          <tr key={tenant.id} className="border-b hover:bg-slate-50">
                            <td className="p-3 font-medium">{tenant.full_name}</td>
                            <td className="p-3">{tenant.email}</td>
                            <td className="p-3">{tenant.phone}</td>
                            <td className="p-3">
                              <span
                                className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${
                                  tenant.is_active
                                    ? "bg-green-100 text-green-800"
                                    : "bg-gray-100 text-gray-800"
                                }`}
                              >
                                {tenant.is_active ? "Active" : "Inactive"}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Bookings Tab */}
          <TabsContent value="bookings" className="space-y-4">
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle>Recent Bookings</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 border-b">
                      <tr>
                        <th className="text-left p-3 font-medium">Client Name</th>
                        <th className="text-left p-3 font-medium">Apartment Type</th>
                        <th className="text-left p-3 font-medium">Check-in</th>
                        <th className="text-left p-3 font-medium">Check-out</th>
                        <th className="text-left p-3 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bookings.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="p-6 text-center text-slate-600">
                            No bookings found
                          </td>
                        </tr>
                      ) : (
                        bookings.map((booking) => (
                          <tr key={booking.id} className="border-b hover:bg-slate-50">
                            <td className="p-3 font-medium">{booking.client_name}</td>
                            <td className="p-3">{booking.apartment_type}</td>
                            <td className="p-3">{booking.start_date}</td>
                            <td className="p-3">{booking.end_date}</td>
                            <td className="p-3">
                              <span
                                className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${
                                  booking.status === "confirmed"
                                    ? "bg-green-100 text-green-800"
                                    : "bg-yellow-100 text-yellow-800"
                                }`}
                              >
                                {booking.status}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Messages Tab */}
          <TabsContent value="messages" className="space-y-4">
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle>Client Messages</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {messages.length === 0 ? (
                    <div className="p-6 text-center text-slate-600">
                      No messages found
                    </div>
                  ) : (
                    messages.map((msg) => (
                      <div key={msg.id} className="border border-slate-200 rounded-lg p-4 hover:bg-slate-50">
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <p className="font-medium text-slate-900">{msg.name}</p>
                            <p className="text-sm text-slate-600">{msg.email}</p>
                          </div>
                          <span
                            className={`text-xs px-2 py-1 rounded ${
                              msg.is_read
                                ? "bg-gray-100 text-gray-700"
                                : "bg-blue-100 text-blue-700"
                            }`}
                          >
                            {msg.is_read ? "Read" : "New"}
                          </span>
                        </div>
                        <p className="text-slate-700 text-sm">{msg.message}</p>
                        <p className="text-slate-500 text-xs mt-2">
                          {new Date(msg.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
