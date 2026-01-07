"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import TenantHeader from "@/components/TenantHeader";
import { ChangePasswordModal } from "@/components/change-password-modal";
import {
  Download,
  FileText,
  Wrench,
  CreditCard,
  MapPin,
  Calendar,
  CheckCircle,
  AlertCircle,
  Home,
  DollarSign,
  Bed,
  Bath,
  Maximize2,
  Plus,
  Key,
} from "lucide-react";
import Link from "next/link";

interface TenantSession {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  lease_start?: string;
  lease_end?: string;
  payment_status?: string;
}

interface Apartment {
  id: string | number;
  name: string;
  unit_number?: string;
  monthly_rent?: number;
  price_per_month?: number;
  bedrooms?: number;
  bathrooms?: number;
  size?: number;
  size_sqm?: number;
  description?: string;
  image_url?: string;
  is_available?: boolean;
}

interface Booking {
  id: string;
  tenant_id: string;
  apartment_id: string;
  check_in_date: string;
  check_out_date: string;
  status: string;
}

interface BookingForm {
  apartment_id: number;
  start_date: string;
  end_date: string;
}

export default function TenantDashboard() {
  const router = useRouter();
  const [tenant, setTenant] = useState<TenantSession | null>(null);
  const [booking, setBooking] = useState<Booking | null>(null);
  const [apartment, setApartment] = useState<Apartment | null>(null);
  const [availableApartments, setAvailableApartments] = useState<Apartment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [bookingForm, setBookingForm] = useState<BookingForm>({
    apartment_id: 0,
    start_date: "",
    end_date: "",
  });
  const [bookingLoading, setBookingLoading] = useState(false);
  const [bookingSuccess, setBookingSuccess] = useState<string | null>(null);
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [showBookingForm, setShowBookingForm] = useState(false);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    const fetchTenantData = async () => {
      try {
        const tenantData = localStorage.getItem("tenant_session");
        if (!tenantData) {
          router.push("/login");
          return;
        }

        const parsedTenant: TenantSession = JSON.parse(tenantData);
        setTenant(parsedTenant);

        // Fetch booking details - use query instead of single() to avoid error when no booking exists
        const { data: bookingDataList, error: bookingError } = await supabase
          .from("bookings")
          .select("*")
          .eq("tenant_id", String(parsedTenant.id))
          .order("start_date", { ascending: false })
          .limit(1);

        if (bookingError && bookingError.message) {
          console.error("Error fetching booking:", bookingError.message);
        }

        if (bookingDataList && bookingDataList.length > 0) {
          const bookingData = bookingDataList[0];
          setBooking(bookingData);

          // Fetch apartment details
          const { data: apartmentData, error: apartmentError } = await supabase
            .from("apartments")
            .select("*")
            .eq("id", bookingData.apartment_id)
            .single();

          if (apartmentError && apartmentError.message) {
            console.error("Error fetching apartment:", apartmentError.message);
          }

          if (apartmentData) {
            setApartment(apartmentData);
          }
        }

        // Fetch available apartments
        const { data: availableData, error: availableError } = await supabase
          .from("apartments")
          .select("*")
          .eq("is_available", true)
          .order("price_per_month", { ascending: true });

        if (availableError && availableError.message) {
          console.error("Error fetching available apartments:", availableError.message);
        } else if (availableData) {
          setAvailableApartments(availableData);
        }
      } catch (err) {
        console.error("Error in fetchTenantData:", err);
        setError("Failed to load dashboard data");
      } finally {
        setLoading(false);
      }
    };

    fetchTenantData();
  }, [router, supabase]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  if (!tenant) {
    return null;
  }

  const handleBookApartment = async (apartmentId: number) => {
    if (!bookingForm.start_date || !bookingForm.end_date) {
      setBookingError("Please fill in all booking dates");
      return;
    }

    if (new Date(bookingForm.start_date) >= new Date(bookingForm.end_date)) {
      setBookingError("End date must be after start date");
      return;
    }

    setBookingLoading(true);
    setBookingError(null);

    try {
      const apartmentData = availableApartments.find(a => a.id === apartmentId);
      if (!apartmentData) {
        setBookingError("Apartment not found");
        return;
      }

      const bookingData = {
        tenant_id: String(tenant.id),
        apartment_id: apartmentId,
        start_date: bookingForm.start_date,
        end_date: bookingForm.end_date,
        status: "pending",
        client_name: tenant.full_name,
        email: tenant.email,
        phone_number: tenant.phone || "",
        apartment_type: apartmentData.name,
      };

      const { data, error } = await supabase
        .from("bookings")
        .insert([bookingData])
        .select();

      if (error) {
        console.error("Booking error:", error);
        
        // If apartment_id column doesn't exist, show helpful message
        if (error.message?.includes("apartment_id")) {
          setBookingError(
            "Database configuration issue: The booking system needs to be initialized. Please contact support."
          );
        } else {
          setBookingError(`Failed to book apartment: ${error.message}`);
        }
        return;
      }

      if (!data || data.length === 0) {
        setBookingError("Booking failed. Please try again.");
        return;
      }

      setBookingSuccess("Apartment booked successfully! Check your booked apartments.");
      setBookingForm({ apartment_id: 0, start_date: "", end_date: "" });
      setShowBookingForm(false);

      // Refresh the bookings list
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } catch (err) {
      console.error("Error booking apartment:", err);
      setBookingError("An error occurred while booking the apartment");
    } finally {
      setBookingLoading(false);
    }
  };

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center max-w-md">
          <AlertCircle className="h-16 w-16 text-red-600 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Error</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <Button onClick={() => window.location.reload()}>Try Again</Button>
        </div>
      </div>
    );
  }

  const getPaymentStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case "paid":
        return "bg-green-100 text-green-800 border-green-300";
      case "pending":
        return "bg-yellow-100 text-yellow-800 border-yellow-300";
      case "overdue":
        return "bg-red-100 text-red-800 border-red-300";
      default:
        return "bg-gray-100 text-gray-800 border-gray-300";
    }
  };

  const getPaymentStatusIcon = (status: string) => {
    switch (status?.toLowerCase()) {
      case "paid":
        return <CheckCircle className="h-5 w-5" />;
      case "overdue":
        return <AlertCircle className="h-5 w-5" />;
      default:
        return <CreditCard className="h-5 w-5" />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <TenantHeader tenant={tenant} />

      <main className="container mx-auto px-4 py-8">
        {/* Welcome Section */}
        <div className="mb-8 flex justify-between items-start">
          <div>
            <h1 className="text-4xl font-bold text-gray-900 mb-2">
              Welcome back, {tenant.full_name}! 👋
            </h1>
            <p className="text-gray-600">Manage your apartment and stay updated</p>
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

        {/* Quick Stats */}
        {apartment && (
          <div className="grid md:grid-cols-4 gap-4 mb-8">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Monthly Rent</p>
                    <p className="text-2xl font-bold text-blue-600">
                      ${apartment.monthly_rent}
                    </p>
                  </div>
                  <DollarSign className="h-10 w-10 text-blue-200" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Bedrooms</p>
                    <p className="text-2xl font-bold text-purple-600">
                      {apartment.bedrooms}
                    </p>
                  </div>
                  <Home className="h-10 w-10 text-purple-200" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Unit Number</p>
                    <p className="text-2xl font-bold text-indigo-600">
                      {apartment.unit_number}
                    </p>
                  </div>
                  <MapPin className="h-10 w-10 text-indigo-200" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Payment Status</p>
                    <p className="text-2xl font-bold capitalize">
                      {tenant.payment_status || "N/A"}
                    </p>
                  </div>
                  <div className={`h-10 w-10 rounded-full flex items-center justify-center ${getPaymentStatusColor(tenant.payment_status || "")}`}>
                    {getPaymentStatusIcon(tenant.payment_status || "")}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Main Content Grid */}
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Left Column - Information */}
          <div className="lg:col-span-2 space-y-6">
            {/* Apartment Details */}
            {apartment ? (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Home className="h-5 w-5 text-blue-600" />
                    Your Apartment
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid md:grid-cols-2 gap-6">
                    <div>
                      <p className="text-sm font-medium text-gray-500 uppercase">
                        Apartment Name
                      </p>
                      <p className="text-lg font-semibold text-gray-900 mt-1">
                        {apartment.name}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-500 uppercase">
                        Unit Number
                      </p>
                      <p className="text-lg font-semibold text-gray-900 mt-1">
                        {apartment.unit_number}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-500 uppercase">
                        Size
                      </p>
                      <p className="text-lg font-semibold text-gray-900 mt-1">
                        {apartment.size} sqft
                      </p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-500 uppercase">
                        Bathrooms
                      </p>
                      <p className="text-lg font-semibold text-gray-900 mt-1">
                        {apartment.bathrooms}
                      </p>
                    </div>
                  </div>
                  {apartment.description && (
                    <div className="pt-4 border-t">
                      <p className="text-sm font-medium text-gray-500 uppercase">
                        Description
                      </p>
                      <p className="text-gray-700 mt-2">{apartment.description}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="pt-6">
                  <p className="text-gray-600">No apartment assigned yet</p>
                </CardContent>
              </Card>
            )}

            {/* Lease Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-green-600" />
                  Lease Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <p className="text-sm font-medium text-gray-500 uppercase">
                      Lease Start Date
                    </p>
                    <p className="text-lg font-semibold text-gray-900 mt-1">
                      {tenant.lease_start
                        ? new Date(tenant.lease_start).toLocaleDateString("en-US", {
                            year: "numeric",
                            month: "long",
                            day: "numeric",
                          })
                        : "N/A"}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500 uppercase">
                      Lease End Date
                    </p>
                    <p className="text-lg font-semibold text-gray-900 mt-1">
                      {tenant.lease_end
                        ? new Date(tenant.lease_end).toLocaleDateString("en-US", {
                            year: "numeric",
                            month: "long",
                            day: "numeric",
                          })
                        : "N/A"}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Quick Actions */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button
                  asChild
                  className="w-full justify-start gap-2 bg-blue-600 hover:bg-blue-700"
                >
                  <Link href="/tenant/booked-apartments">
                    <Home className="h-4 w-4" />
                    My Booked Apartments
                  </Link>
                </Button>

                <Button
                  asChild
                  className="w-full justify-start gap-2 bg-blue-600 hover:bg-blue-700"
                >
                  <Link href="/tenant/apartments">
                    <Home className="h-4 w-4" />
                    View Apartments
                  </Link>
                </Button>

                <Button
                  asChild
                  className="w-full justify-start gap-2 bg-blue-600 hover:bg-blue-700"
                >
                  <Link href="/tenant/profile">
                    <FileText className="h-4 w-4" />
                    View Profile
                  </Link>
                </Button>

                <Button asChild variant="outline" className="w-full justify-start gap-2">
                  <Link href="/tenant/payment-history">
                    <CreditCard className="h-4 w-4" />
                    Payment History
                  </Link>
                </Button>

                <Button asChild variant="outline" className="w-full justify-start gap-2">
                  <Link href="/tenant/maintenance">
                    <Wrench className="h-4 w-4" />
                    Request Maintenance
                  </Link>
                </Button>

                <Button asChild variant="outline" className="w-full justify-start gap-2">
                  <Link href="/tenant/profile">
                    <Download className="h-4 w-4" />
                    Download Contract
                  </Link>
                </Button>
              </CardContent>
            </Card>

            {/* Contact Information */}
            <Card>
              <CardHeader>
                <CardTitle>Contact Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm text-gray-600">Full Name</p>
                  <p className="font-semibold text-gray-900">{tenant.full_name}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Email</p>
                  <p className="font-semibold text-gray-900 break-all">{tenant.email}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Phone</p>
                  <p className="font-semibold text-gray-900">{tenant.phone || "N/A"}</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Available Apartments Section */}
        <div className="mt-12">
          <div className="mb-6">
            <h2 className="text-3xl font-bold text-gray-900 mb-2">Available Apartments</h2>
            <p className="text-gray-600">Browse and book from our available apartments</p>
          </div>

          {bookingSuccess && (
            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-start gap-3">
              <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-semibold text-green-900">{bookingSuccess}</p>
              </div>
            </div>
          )}

          {availableApartments.length > 0 ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {availableApartments.map((apt) => (
                <Card key={apt.id} className="overflow-hidden hover:shadow-lg transition-shadow flex flex-col">
                  <div className="relative h-48 w-full bg-gradient-to-br from-blue-100 to-blue-50 flex items-center justify-center">
                    <Home className="h-16 w-16 text-blue-300" />
                  </div>

                  <CardHeader>
                    <CardTitle className="text-lg">{apt.name}</CardTitle>
                    <p className="text-2xl font-bold text-blue-600 mt-2">
                      ${apt.price_per_month || apt.monthly_rent}/mo
                    </p>
                  </CardHeader>

                  <CardContent className="space-y-4 flex-grow">
                    <div className="grid grid-cols-3 gap-3 text-sm">
                      {apt.bedrooms && (
                        <div className="flex items-center gap-2">
                          <Bed className="h-4 w-4 text-blue-600" />
                          <span>{apt.bedrooms} BR</span>
                        </div>
                      )}
                      {apt.bathrooms && (
                        <div className="flex items-center gap-2">
                          <Bath className="h-4 w-4 text-blue-600" />
                          <span>{apt.bathrooms} BA</span>
                        </div>
                      )}
                      {(apt.size || apt.size_sqm) && (
                        <div className="flex items-center gap-2">
                          <Maximize2 className="h-4 w-4 text-blue-600" />
                          <span>{apt.size || apt.size_sqm} sqm</span>
                        </div>
                      )}
                    </div>

                    {apt.description && (
                      <p className="text-sm text-gray-600">{apt.description}</p>
                    )}

                    <Button
                      onClick={() => {
                        setShowBookingForm(!showBookingForm);
                        setBookingForm({ ...bookingForm, apartment_id: apt.id as number });
                      }}
                      className="w-full gap-2 bg-blue-600 hover:bg-blue-700"
                    >
                      <Plus className="h-4 w-4" />
                      Book Apartment
                    </Button>

                    {showBookingForm && bookingForm.apartment_id === apt.id && (
                      <div className="mt-4 p-4 bg-blue-50 rounded-lg space-y-3 border border-blue-200">
                        {bookingError && (
                          <div className="p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
                            {bookingError}
                          </div>
                        )}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Move-in Date
                          </label>
                          <Input
                            type="date"
                            value={bookingForm.start_date}
                            onChange={(e) =>
                              setBookingForm({ ...bookingForm, start_date: e.target.value })
                            }
                            className="w-full"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Move-out Date
                          </label>
                          <Input
                            type="date"
                            value={bookingForm.end_date}
                            onChange={(e) =>
                              setBookingForm({ ...bookingForm, end_date: e.target.value })
                            }
                            className="w-full"
                          />
                        </div>
                        <div className="flex gap-2 pt-2">
                          <Button
                            onClick={() => handleBookApartment(apt.id as number)}
                            disabled={bookingLoading}
                            className="flex-1 bg-green-600 hover:bg-green-700"
                          >
                            {bookingLoading ? "Booking..." : "Confirm Booking"}
                          </Button>
                          <Button
                            onClick={() => {
                              setShowBookingForm(false);
                              setBookingError(null);
                            }}
                            variant="outline"
                            className="flex-1"
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="pt-6 text-center">
                <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-600 text-lg">No apartments available at the moment</p>
              </CardContent>
            </Card>
          )}
        </div>
      </main>

      <ChangePasswordModal
        isOpen={isPasswordModalOpen}
        onClose={() => setIsPasswordModalOpen(false)}
        table="tenants"
        userId={tenant?.id || ""}
      />
    </div>
  );
}