"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  AlertCircle,
  CheckCircle,
  Clock,
  XCircle,
  Home,
  User,
  Calendar,
  DollarSign,
} from "lucide-react";
import Link from "next/link";

interface AdminSession {
  username: string;
  full_name: string;
}

interface Booking {
  id: number;
  tenant_id: string;
  apartment_id: number;
  start_date: string;
  end_date: string;
  status: string;
  client_name?: string;
  email?: string;
  phone_number?: string;
  apartment?: {
    id: number;
    name: string;
    price_per_month: number;
  };
}

interface Apartment {
  id: number;
  name: string;
  price_per_month: number;
}

export default function AdminBookingsPage() {
  const router = useRouter();
  const [admin, setAdmin] = useState<AdminSession | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [apartments, setApartments] = useState<Map<number, Apartment>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string | null>(null);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    const fetchData = async () => {
      try {
        const adminData = localStorage.getItem("admin_session");
        if (!adminData) {
          router.push("/admin/login");
          return;
        }

        const parsedAdmin: AdminSession = JSON.parse(adminData);
        setAdmin(parsedAdmin);

        // Fetch all bookings
        const { data: bookingsData, error: bookingsError } = await supabase
          .from("bookings")
          .select("*")
          .order("start_date", { ascending: false });

        if (bookingsError) {
          console.error("Error fetching bookings:", bookingsError);
          setError("Failed to load bookings");
          return;
        }

        // Fetch apartment details
        const { data: apartmentsData, error: apartmentsError } = await supabase
          .from("apartments")
          .select("*");

        if (apartmentsError) {
          console.error("Error fetching apartments:", apartmentsError);
        }

        if (apartmentsData) {
          const aptMap = new Map();
          apartmentsData.forEach((apt: Apartment) => {
            aptMap.set(apt.id, apt);
          });
          setApartments(aptMap);
        }

        setBookings(bookingsData || []);
      } catch (err) {
        console.error("Error:", err);
        setError("Failed to load data");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [router, supabase]);

  const getStatusIcon = (status: string) => {
    switch (status?.toLowerCase()) {
      case "confirmed":
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      case "pending":
        return <Clock className="h-5 w-5 text-yellow-600" />;
      case "rejected":
        return <XCircle className="h-5 w-5 text-red-600" />;
      default:
        return <Clock className="h-5 w-5 text-gray-600" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case "confirmed":
        return "bg-green-100 text-green-800";
      case "pending":
        return "bg-yellow-100 text-yellow-800";
      case "rejected":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const filteredBookings = filterStatus
    ? bookings.filter((b) => b.status?.toLowerCase() === filterStatus.toLowerCase())
    : bookings;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading bookings...</p>
        </div>
      </div>
    );
  }

  if (!admin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold text-gray-900">All Tenant Bookings</h1>
            <Button asChild variant="outline">
              <Link href="/admin/dashboard">Back to Dashboard</Link>
            </Button>
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
            <p className="text-red-900">{error}</p>
          </div>
        )}

        {/* Filter Buttons */}
        <div className="mb-6 flex gap-2 flex-wrap">
          <Button
            onClick={() => setFilterStatus(null)}
            variant={filterStatus === null ? "default" : "outline"}
            className="gap-2"
          >
            All Bookings ({bookings.length})
          </Button>
          <Button
            onClick={() => setFilterStatus("pending")}
            variant={filterStatus === "pending" ? "default" : "outline"}
            className="gap-2 bg-yellow-100 text-yellow-800 hover:bg-yellow-200"
          >
            Pending ({bookings.filter((b) => b.status?.toLowerCase() === "pending").length})
          </Button>
          <Button
            onClick={() => setFilterStatus("confirmed")}
            variant={filterStatus === "confirmed" ? "default" : "outline"}
            className="gap-2 bg-green-100 text-green-800 hover:bg-green-200"
          >
            Confirmed ({bookings.filter((b) => b.status?.toLowerCase() === "confirmed").length})
          </Button>
          <Button
            onClick={() => setFilterStatus("rejected")}
            variant={filterStatus === "rejected" ? "default" : "outline"}
            className="gap-2 bg-red-100 text-red-800 hover:bg-red-200"
          >
            Rejected ({bookings.filter((b) => b.status?.toLowerCase() === "rejected").length})
          </Button>
        </div>

        {/* Bookings Grid */}
        {filteredBookings.length > 0 ? (
          <div className="grid gap-6">
            {filteredBookings.map((booking) => {
              const apartment = apartments.get(booking.apartment_id);
              return (
                <Card key={booking.id} className="hover:shadow-lg transition-shadow">
                  <CardContent className="pt-6">
                    <div className="grid md:grid-cols-2 gap-6">
                      {/* Tenant Info */}
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                          <User className="h-5 w-5 text-blue-600" />
                          Tenant Information
                        </h3>
                        <div className="space-y-3">
                          <div>
                            <p className="text-sm text-gray-600">Tenant ID</p>
                            <p className="font-medium text-gray-900">{booking.tenant_id}</p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-600">Client Name</p>
                            <p className="font-medium text-gray-900">
                              {booking.client_name || "N/A"}
                            </p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-600">Email</p>
                            <p className="font-medium text-gray-900 break-all">
                              {booking.email || "N/A"}
                            </p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-600">Phone</p>
                            <p className="font-medium text-gray-900">
                              {booking.phone_number || "N/A"}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Booking Info */}
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                          <Home className="h-5 w-5 text-blue-600" />
                          Booking Details
                        </h3>
                        <div className="space-y-3">
                          <div>
                            <p className="text-sm text-gray-600">Apartment</p>
                            <p className="font-medium text-gray-900 flex items-center gap-2">
                              {apartment ? (
                                <>
                                  <Home className="h-4 w-4 text-gray-400" />
                                  {apartment.name}
                                </>
                              ) : (
                                "Unknown Apartment"
                              )}
                            </p>
                          </div>
                          <div className="flex gap-6">
                            <div>
                              <p className="text-sm text-gray-600">Check-in</p>
                              <p className="font-medium text-gray-900 flex items-center gap-2">
                                <Calendar className="h-4 w-4 text-gray-400" />
                                {new Date(booking.start_date).toLocaleDateString()}
                              </p>
                            </div>
                            <div>
                              <p className="text-sm text-gray-600">Check-out</p>
                              <p className="font-medium text-gray-900 flex items-center gap-2">
                                <Calendar className="h-4 w-4 text-gray-400" />
                                {new Date(booking.end_date).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                          {apartment && (
                            <div>
                              <p className="text-sm text-gray-600">Monthly Rent</p>
                              <p className="font-medium text-gray-900 flex items-center gap-2">
                                <DollarSign className="h-4 w-4 text-gray-400" />
                                ${apartment.price_per_month}
                              </p>
                            </div>
                          )}
                          <div className="flex items-center gap-2 pt-2">
                            <span className="text-sm text-gray-600">Status:</span>
                            <span
                              className={`px-3 py-1 rounded-full text-sm font-medium flex items-center gap-2 ${getStatusColor(
                                booking.status
                              )}`}
                            >
                              {getStatusIcon(booking.status)}
                              {booking.status}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <Card>
            <CardContent className="pt-12 text-center pb-12">
              <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-600 text-lg">
                {filterStatus ? "No bookings with this status" : "No bookings found"}
              </p>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
