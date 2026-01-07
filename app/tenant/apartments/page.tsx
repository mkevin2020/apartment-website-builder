"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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

interface TenantSession {
  id: string;
  full_name: string;
  email: string;
  phone: string;
}

interface Apartment {
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

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

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
          .select("*")
          .eq("is_available", true)
          .order("price_per_month", { ascending: true });

        if (apartmentsError) {
          console.error("Error fetching apartments:", apartmentsError);
          setError("Failed to load apartments");
          return;
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

      const bookingData = {
        tenant_id: tenant?.id,
        apartment_id: apartmentId,
        start_date: bookingForm.start_date,
        end_date: bookingForm.end_date,
        status: "pending",
        client_name: tenant?.full_name,
        email: tenant?.email,
        phone_number: tenant?.phone || "",
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
    return (
      <div className="min-h-screen bg-gray-50">
        <TenantHeader tenant={tenant} />
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading apartments...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!tenant) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <TenantHeader tenant={tenant} />

      <main className="container mx-auto px-4 py-8">
        {/* Header Section */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-gray-900 mb-2">Available Apartments</h1>
            <p className="text-gray-600">Browse and book from our available apartments</p>
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
                    <p className="text-sm text-gray-600">Unit: {apt.unit_number}</p>
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
                    <p className="text-sm text-gray-600 line-clamp-3">{apt.description}</p>
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
              <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-600 text-lg mb-4">No apartments available at the moment</p>
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
