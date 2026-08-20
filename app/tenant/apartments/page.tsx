"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { dataClient } from "@/lib/data-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { SessionGuard } from "@/components/auth/session-guard";
import TenantHeader from "@/components/TenantHeader";
import {
  Bed,
  Bath,
  Maximize2,
  Plus,
  AlertCircle,
  CheckCircle,
  X,
  MapPin,
  DollarSign,
} from "lucide-react";
import Link from "next/link";
import { CardGridSkeleton, PageSkeleton } from "@/components/ui/loading-skeletons";

interface TenantSession {
  id: string;
  full_name: string;
  email: string;
  phone: string;
}

interface Apartment {
  type(arg0: string, type: any): unknown;
  id: number;
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

interface BookingForm {
  apartment_id: number;
  start_date: string;
  end_date: string;
}

export default function TenantApartmentsPage() {
  const router = useRouter();
  const [tenant, setTenant] = useState<TenantSession | null>(null);
  const [apartments, setApartments] = useState<Apartment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedApartment, setSelectedApartment] = useState<number | null>(null);
  const [bookingForm, setBookingForm] = useState<BookingForm>({
    apartment_id: 0,
    start_date: "",
    end_date: "",
  });
  const [bookingLoading, setBookingLoading] = useState(false);
  const [bookingSuccess, setBookingSuccess] = useState<string | null>(null);
  const [bookingError, setBookingError] = useState<string | null>(null);

  const supabase = dataClient();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const tenantData = localStorage.getItem("tenant_session");
        if (!tenantData) {
          router.push("/login");
          return;
        }

        const parsedTenant: TenantSession = JSON.parse(tenantData);
        setTenant(parsedTenant);

        // Fetch available apartments
        const { data: apartmentsData, error: apartmentsError } = await supabase
          .from("apartments")
          .select("id, name, type, description, size_sqm, bedrooms, bathrooms, price_per_month, image_url, is_available, created_at")
          .eq("is_available", true)
          .order("price_per_month", { ascending: true });

        if (apartmentsError) {
          console.error("Error fetching apartments:", apartmentsError);
          setError("Failed to load apartments");
          return;
        }

        console.log("=== APARTMENTS FETCHED ===");
        console.log("Full response:", JSON.stringify(apartmentsData, null, 2));
        if (apartmentsData && apartmentsData.length > 0) {
          console.log("First apartment:", JSON.stringify(apartmentsData[0], null, 2));
          console.log("First apartment type field:", apartmentsData[0].type);
        }

        setApartments(apartmentsData || []);
      } catch (err) {
        console.error("Error in fetchData:", err);
        setError("Failed to load data");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [router, supabase]);

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
      const apartmentData = apartments.find(a => a.id === apartmentId);
      if (!apartmentData) {
        setBookingError("Apartment not found");
        return;
      }

      // Debug logging - show all available keys
      console.log("=== APARTMENT DATA DEBUG ===");
      console.log("Full apartment object:", JSON.stringify(apartmentData, null, 2));
      console.log("Available keys:", Object.keys(apartmentData));
      console.log("apartmentData.type:", apartmentData.type);
      console.log("apartmentData.name:", apartmentData.name);
      console.log("apartmentData.id:", apartmentData.id);

      const bookingData = {
        tenant_id: tenant?.id,
        apartment_id: apartmentId,
        start_date: bookingForm.start_date,
        end_date: bookingForm.end_date,
        status: "pending",
        client_name: tenant?.full_name,
        email: tenant?.email,
        phone_number: tenant?.phone || "",
        apartment_type: apartmentData.type || apartmentData.name || "Unknown",
      };

      console.log("=== BOOKING DATA BEING SENT ===");
      console.log(JSON.stringify(bookingData, null, 2));

      const { data, error } = await supabase
        .from("bookings")
        .insert([bookingData])
        .select();

      if (error) {
        console.error("Full booking error object:", JSON.stringify(error, null, 2));
        console.error("Error message:", error.message);
        console.error("Error code:", error.code);
        console.error("Error details:", error.details);
        
        // If apartment_id column doesn't exist, show helpful message
        if (error.message?.includes("apartment_id")) {
          setBookingError(
            "Database configuration issue: The booking system needs to be initialized. Please contact support."
          );
        } else {
          setBookingError(`Failed to book apartment: ${error.message || JSON.stringify(error)}`);
        }
        return;
      }

      if (!data || data.length === 0) {
        setBookingError("Booking failed. Please try again.");
        return;
      }

      // Booking confirmation email (fire-and-forget; failure never blocks the booking)
      if (tenant?.email) {
        fetch("/api/bookings/send-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            client_email: tenant.email,
            client_name: tenant.full_name,
            apartment_name: apartmentData.name || apartmentData.type || "Apartment",
            booking_reference: `BKG-${data[0].id}`,
            start_date: bookingForm.start_date,
            move_out_date: bookingForm.end_date,
            price_per_month: apartmentData.price_per_month || apartmentData.monthly_rent || 0,
            phone_number: tenant.phone || "",
          }),
        }).catch(() => {});
      }

      // Notify the tenant by SMS that their booking was submitted (IntouchSMS).
      // Fire-and-forget — safe no-op until the IntouchSMS API key is set.
      if (tenant?.phone) {
        fetch("/api/bookings/send-sms", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phone_number: tenant.phone, client_name: tenant.full_name }),
        }).catch(() => {});
      }

      setBookingSuccess("Apartment booked successfully! Redirecting to your bookings...");
      setBookingForm({ apartment_id: 0, start_date: "", end_date: "" });
      setSelectedApartment(null);

      // Redirect after 2 seconds
      setTimeout(() => {
        router.push("/tenant/booked-apartments");
      }, 2000);
    } catch (err) {
      console.error("Error booking apartment:", err);
      setBookingError("An error occurred while booking the apartment");
    } finally {
      setBookingLoading(false);
    }
  };

  if (loading) {
    // Skeleton, not a spinner: it occupies the same space the real
    // content will, so nothing shifts when the data arrives.
    return <PageSkeleton label="Loading apartments"><CardGridSkeleton count={6} /></PageSkeleton>;
  }

  if (!tenant) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 transition-colors">
      <SessionGuard sessionKey="tenant_session" />
      <TenantHeader tenant={tenant} />

      <main className="container mx-auto px-4 py-8">
        {/* Header Section */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">Available Apartments</h1>
            <p className="text-gray-600 dark:text-slate-400">Browse and book from our available apartments</p>
          </div>
          <Button asChild variant="outline" className="gap-2">
            <Link href="/tenant/dashboard">
              Back to Dashboard
            </Link>
          </Button>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
            <p className="text-red-900">{error}</p>
          </div>
        )}

        {bookingSuccess && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-start gap-3">
            <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
            <p className="text-green-900 font-semibold">{bookingSuccess}</p>
          </div>
        )}

        {/* Apartments Grid */}
        {apartments.length > 0 ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {apartments.map((apt) => (
              <Card
                key={apt.id}
                className="overflow-hidden hover:shadow-lg transition-all flex flex-col"
              >
                {/* Image Section */}
                <div className="relative h-56 w-full bg-gradient-to-br from-blue-100 to-blue-50 flex items-center justify-center overflow-hidden">
                  {apt.image_url ? (
                    <img
                      src={apt.image_url}
                      alt={apt.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="flex flex-col items-center gap-2">
                      <div className="h-20 w-20 bg-blue-200 rounded-lg flex items-center justify-center">
                        <MapPin className="h-10 w-10 text-blue-600" />
                      </div>
                      <p className="text-blue-600 font-medium text-sm">Apartment Image</p>
                    </div>
                  )}
                </div>

                {/* Header */}
                <CardHeader className="pb-3">
                  <CardTitle className="text-xl">{apt.name}</CardTitle>
                  {apt.unit_number && (
                    <p className="text-sm text-gray-600 dark:text-slate-400">Unit: {apt.unit_number}</p>
                  )}
                  <p className="text-2xl font-bold text-blue-600 mt-2">
                    ${apt.price_per_month || apt.monthly_rent}/month
                  </p>
                </CardHeader>

                {/* Content */}
                <CardContent className="space-y-4 flex-grow flex flex-col">
                  {/* Features Grid */}
                  <div className="grid grid-cols-3 gap-3">
                    {apt.bedrooms && (
                      <div className="flex items-center gap-2 p-2 bg-blue-50 rounded">
                        <Bed className="h-4 w-4 text-blue-600" />
                        <span className="text-sm font-medium">{apt.bedrooms} BR</span>
                      </div>
                    )}
                    {apt.bathrooms && (
                      <div className="flex items-center gap-2 p-2 bg-blue-50 rounded">
                        <Bath className="h-4 w-4 text-blue-600" />
                        <span className="text-sm font-medium">{apt.bathrooms} BA</span>
                      </div>
                    )}
                    {(apt.size || apt.size_sqm) && (
                      <div className="flex items-center gap-2 p-2 bg-blue-50 rounded">
                        <Maximize2 className="h-4 w-4 text-blue-600" />
                        <span className="text-sm font-medium">{apt.size || apt.size_sqm} sqm</span>
                      </div>
                    )}
                  </div>

                  {/* Description */}
                  {apt.description && (
                    <p className="text-sm text-gray-600 dark:text-slate-400 line-clamp-3">{apt.description}</p>
                  )}

                  {/* Booking Section */}
                  {selectedApartment === apt.id ? (
                    <div className="mt-auto pt-4 space-y-3 border-t">
                      {bookingError && (
                        <div className="p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
                          {bookingError}
                        </div>
                      )}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
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
                        <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
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
                          onClick={() => handleBookApartment(apt.id)}
                          disabled={bookingLoading}
                          className="flex-1 bg-green-600 hover:bg-green-700"
                        >
                          {bookingLoading ? "Booking..." : "Confirm"}
                        </Button>
                        <Button
                          onClick={() => {
                            setSelectedApartment(null);
                            setBookingError(null);
                          }}
                          variant="outline"
                          className="flex-1"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <Button
                      onClick={() => {
                        setSelectedApartment(apt.id);
                        setBookingForm({ apartment_id: apt.id, start_date: "", end_date: "" });
                      }}
                      className="mt-auto w-full gap-2 bg-blue-600 hover:bg-blue-700"
                    >
                      <Plus className="h-4 w-4" />
                      Book Now
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="pt-12 text-center pb-12">
              <AlertCircle className="h-12 w-12 text-gray-400 dark:text-slate-500 mx-auto mb-3" />
              <p className="text-gray-600 dark:text-slate-400 text-lg mb-4">No apartments available at the moment</p>
              <Button asChild>
                <Link href="/tenant/dashboard">Back to Dashboard</Link>
              </Button>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
