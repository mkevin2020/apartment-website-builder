"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { dataClient } from "@/lib/data-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { TenantShell } from "@/components/dashboard/TenantShell";
import { TawkChat } from "@/components/TawkChat";
import { StatCard } from "@/components/dashboard/StatCard";
import { Home as HomeIcon, CreditCard as CreditCardIcon, CheckCircle as CheckCircleIcon } from "lucide-react";
import { ChangePasswordModal } from "@/components/change-password-modal";
import { TenantPaymentWidget } from "@/components/TenantPaymentWidget";
import { ApartmentDetailsModal } from "@/components/apartment-details-modal";
import { priceStayForDates, DAILY_LONG_STAY_THRESHOLD, DAILY_LONG_STAY_RATE } from "@/lib/booking-pricing";
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
  Eye,
} from "lucide-react";
import Link from "next/link";
import { DashboardSkeleton } from "@/components/ui/loading-skeletons";

interface TenantSession {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  lease_start?: string;
  lease_end?: string;
  payment_status?: string;
}

interface Payment {
  id: number;
  apartment_id: number;
  amount: number;
  status: string;
  due_date: string;
  reference_number: string;
}

interface Apartment {
  type?: string | null;
  id: string | number;
  name: string;
  unit_number?: string;
  monthly_rent?: number;
  price_per_month?: number;
  price_per_day?: number;
  bedrooms?: number;
  bathrooms?: number;
  size?: number;
  size_sqm?: number;
  description?: string;
  image_url?: string;
  image_urls?: string[] | null;
  video_url?: string | null;
  is_available?: boolean;
}

interface Booking {
  id: string;
  tenant_id: string;
  apartment_id: string;
  check_in_date: string;
  check_out_date: string;
  status: string;
  rate_type?: "monthly" | "daily";
}

interface BookingForm {
  apartment_id: number;
  start_date: string;
  end_date: string;
  rate_type: "monthly" | "daily";
}

// Deposit a tenant must pay upfront when booking
const DEPOSIT_RATE = 0.4;

// Compute the stay breakdown, total price, and the 40% deposit for a booking.
// A monthly booking is split into whole 30-day months + leftover days charged at
// the daily rate, so 3 weeks is priced by the day and "a month + 10 days" pays
// one month plus 10 days. See lib/booking-pricing.ts.
function computeBookingCost(
  apt: { price_per_month?: number; price_per_day?: number },
  startDate: string,
  endDate: string,
  rateType: "monthly" | "daily",
  promoPercent = 0
) {
  const stay = priceStayForDates(apt, startDate, endDate, rateType);
  const afterLongStay = stay.subtotal;

  // Promo code discount (admin-created), applied on top of the above.
  const promoDiscount = promoPercent > 0 ? Math.round(afterLongStay * (promoPercent / 100)) : 0;
  const total = afterLongStay - promoDiscount;

  const deposit = Math.round(total * DEPOSIT_RATE);
  return { ...stay, afterLongStay, promoPercent, promoDiscount, total, deposit };
}

export default function TenantDashboard() {
  const router = useRouter();
  const [tenant, setTenant] = useState<TenantSession | null>(null);
  const [booking, setBooking] = useState<Booking | null>(null);
  const [apartment, setApartment] = useState<Apartment | null>(null);
  const [availableApartments, setAvailableApartments] = useState<Apartment[]>([]);
  const [pendingPayments, setPendingPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [bookingForm, setBookingForm] = useState<BookingForm>({
    apartment_id: 0,
    start_date: "",
    end_date: "",
    rate_type: "monthly",
  });
  const [bookingLoading, setBookingLoading] = useState(false);
  const [cancellingPaymentId, setCancellingPaymentId] = useState<number | null>(null);
  const [bookingSuccess, setBookingSuccess] = useState<string | null>(null);
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [showBookingForm, setShowBookingForm] = useState(false);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [detailsApt, setDetailsApt] = useState<Apartment | null>(null);
  // Promo code the tenant types + the applied discount (0 until a valid code is entered)
  const [promoInput, setPromoInput] = useState("");
  const [promo, setPromo] = useState<{ code: string; percent: number } | null>(null);
  const [promoMsg, setPromoMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [promoChecking, setPromoChecking] = useState(false);

  const applyPromo = async () => {
    const code = promoInput.trim();
    if (!code) return;
    setPromoChecking(true);
    setPromoMsg(null);
    try {
      const res = await fetch("/api/promo/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      if (data.valid) {
        setPromo({ code: data.code, percent: data.discount_percent });
        setPromoMsg({ type: "ok", text: `Code applied — ${data.discount_percent}% off!` });
      } else {
        setPromo(null);
        setPromoMsg({ type: "err", text: data.error || "Invalid promo code." });
      }
    } catch {
      setPromo(null);
      setPromoMsg({ type: "err", text: "Could not check the code. Try again." });
    } finally {
      setPromoChecking(false);
    }
  };

  const clearPromo = () => {
    setPromo(null);
    setPromoInput("");
    setPromoMsg(null);
  };

  const supabase = dataClient();

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
          console.log("=== APARTMENTS FETCHED (Dashboard) ===");
          console.log("Full response:", JSON.stringify(availableData, null, 2));
          if (availableData.length > 0) {
            console.log("First apartment:", JSON.stringify(availableData[0], null, 2));
            console.log("First apartment type field:", availableData[0].type);
          }
          setAvailableApartments(availableData);
        }

        // Fetch pending payments
        const { data: paymentsData, error: paymentsError } = await supabase
          .from("tenant_payments")
          .select("*")
          .eq("tenant_id", parsedTenant.id)
          .eq("status", "pending")
          .order("due_date", { ascending: true });

        if (paymentsError) {
          console.error("Error fetching payments:", paymentsError);
        } else if (paymentsData) {
          setPendingPayments(paymentsData);
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

  // If arriving with #available-apartments (e.g. from "Browse Apartments"), scroll there
  // once the section has rendered.
  useEffect(() => {
    if (!loading && typeof window !== "undefined" && window.location.hash === "#available-apartments") {
      setTimeout(() => {
        document.getElementById("available-apartments")?.scrollIntoView({ behavior: "smooth" });
      }, 150);
    }
  }, [loading]);

  if (loading) {
    // Skeleton, not a spinner: it occupies the same space the real
    // content will, so nothing shifts when the data arrives.
    return <DashboardSkeleton />;
  }

  if (!tenant) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-slate-900">
        <div className="text-center max-w-md">
          <AlertCircle className="h-16 w-16 text-red-600 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-800 dark:text-slate-100 mb-2">Session Expired</h2>
          <p className="text-gray-600 dark:text-slate-400 mb-6">Your session has expired. Please log in again.</p>
          <Button onClick={() => router.push('/login')}>Go to Login</Button>
        </div>
      </div>
    );
  }

  const handleBookApartment = async (apartmentId: number) => {
    if (!bookingForm.start_date || !bookingForm.end_date) {
      setBookingError("Please fill in all booking dates");
      return;
    }

    // Move-in date cannot be in the past
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (new Date(bookingForm.start_date + "T00:00:00") < today) {
      setBookingError("Move-in date cannot be in the past. Please pick today or a future date.");
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

      // Debug logging - show all available keys
      console.log("=== APARTMENT DATA DEBUG ===");
      console.log("Full apartment object:", JSON.stringify(apartmentData, null, 2));
      console.log("Available keys:", Object.keys(apartmentData));
      console.log("apartmentData.type:", apartmentData.type);
      console.log("apartmentData.name:", apartmentData.name);
      console.log("apartmentData.id:", apartmentData.id);

      const bookingData = {
        tenant_id: String(tenant.id),
        apartment_id: apartmentId,
        start_date: bookingForm.start_date,
        end_date: bookingForm.end_date,
        status: "pending",
        client_name: tenant.full_name,
        email: tenant.email,
        phone_number: tenant.phone || "",
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

      // Mark the apartment as booked (no longer available)
      const { error: apartmentUpdateError } = await supabase
        .from("apartments")
        .update({ is_available: false })
        .eq("id", apartmentId);

      if (apartmentUpdateError) {
        console.error("Failed to mark apartment as booked:", apartmentUpdateError.message);
      }

      // Auto-create the pending payment for the FULL amount the tenant owes,
      // after any promo-code discount.
      const { total } = computeBookingCost(
        apartmentData,
        bookingForm.start_date,
        bookingForm.end_date,
        bookingForm.rate_type,
        promo?.percent || 0
      );
      if (total > 0) {
        const today = new Date().toISOString().split("T")[0];
        const dueDate = bookingForm.start_date || today;
        const referenceNumber = `BKG-${new Date().getFullYear()}-${Math.floor(Math.random() * 900000 + 100000)}`;

        const { error: paymentError } = await supabase.from("tenant_payments").insert({
          tenant_id: tenant.id,
          apartment_id: apartmentId,
          amount: total,
          payment_date: today,
          due_date: dueDate,
          status: "pending",
          reference_number: referenceNumber,
        });

        if (paymentError) {
          console.error("Failed to create pending payment:", paymentError.message);
        }
      }

      // Booking confirmation email + SMS (fire-and-forget; failures never block the booking)
      if (tenant.email) {
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
            totalPrice: total,
            phone_number: tenant.phone || "",
          }),
        }).catch(() => {});
      }
      if (tenant.phone) {
        fetch("/api/bookings/send-sms", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phone_number: tenant.phone, client_name: tenant.full_name }),
        }).catch(() => {});
      }

      // Consume one use of the promo code now that it's been applied to a booking.
      if (promo?.code) {
        fetch("/api/promo/redeem", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code: promo.code }),
        }).catch(() => {});
      }

      setBookingSuccess(
        `Booking confirmed! Total of RWF ${total.toLocaleString()}${
          promo ? ` (${promo.percent}% promo applied)` : ""
        } is now pending in your Payments.`
      );
      clearPromo();
      setBookingForm({ apartment_id: 0, start_date: "", end_date: "", rate_type: "monthly" });
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
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-slate-900">
        <div className="text-center max-w-md">
          <AlertCircle className="h-16 w-16 text-red-600 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-800 dark:text-slate-100 mb-2">Error</h2>
          <p className="text-gray-600 dark:text-slate-400 mb-6">{error}</p>
          <Button onClick={() => window.location.reload()}>Try Again</Button>
        </div>
      </div>
    );
  }

  // Tenant-initiated cancellation of a pending payment. Soft-cancel: the row
  // keeps existing with status "cancelled" so the manager can see what was
  // cancelled (Manager dashboard → Finance → Cancelled Payments).
  const cancelPendingPayment = async (paymentId: number) => {
    if (!window.confirm("Cancel this pending payment? The manager will be able to see it was cancelled.")) {
      return;
    }
    setCancellingPaymentId(paymentId);
    try {
      const { error: cancelError } = await supabase
        .from("tenant_payments")
        .update({ status: "cancelled", updated_at: new Date().toISOString() })
        .eq("id", paymentId)
        .eq("status", "pending"); // only pending ones can be cancelled
      if (cancelError) throw cancelError;
      setPendingPayments((prev) => prev.filter((p) => p.id !== paymentId));
    } catch (err) {
      console.error("Error cancelling payment:", err);
      alert("Failed to cancel the payment. Please try again.");
    } finally {
      setCancellingPaymentId(null);
    }
  };

  const getPaymentStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case "paid":
        return "bg-green-100 text-green-800 border-green-300";
      case "pending":
        return "bg-yellow-100 text-yellow-800 border-yellow-300";
      case "overdue":
        return "bg-red-100 text-red-800 border-red-300";
      default:
        return "bg-gray-100 dark:bg-slate-800 text-gray-800 dark:text-slate-100 border-gray-300 dark:border-slate-700";
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
    <TenantShell tenant={tenant} active="overview">
      {/* Overview stats */}
      <div className="grid gap-4 sm:grid-cols-3 mb-6">
        <StatCard
          label="Current Booking"
          value={booking ? apartment?.name || "Active" : "None"}
          icon={HomeIcon}
          tint="bg-blue-50 text-blue-600"
          onClick={() => router.push("/tenant/booked-apartments")}
        />
        <StatCard
          label="Pending Payments"
          value={pendingPayments.length}
          icon={CreditCardIcon}
          tint="bg-amber-50 text-amber-600"
          onClick={() => router.push("/tenant/payment-history")}
        />
        <StatCard
          label="Available Apartments"
          value={availableApartments.length}
          icon={CheckCircleIcon}
          tint="bg-green-50 text-green-600"
        />
      </div>

        {/* Welcome Section */}
        <div className="mb-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-extrabold text-slate-900 dark:text-white mb-2 tracking-tight">
              Welcome back, <span className="text-blue-600 dark:text-blue-400">{tenant.full_name}</span> 👋
            </h1>
            <p className="text-slate-600 dark:text-slate-400">Manage your apartment and stay updated</p>
          </div>
          <Button
            onClick={() => setIsPasswordModalOpen(true)}
            variant="outline"
            className="flex items-center gap-2 rounded-xl border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 dark:text-white shadow-sm hover:shadow-md transition-shadow"
          >
            <Key className="h-4 w-4" />
            Change Password
          </Button>
        </div>

        {/* Pending Payments Alert */}
        {pendingPayments.length > 0 && (
          <div className="mb-8 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="flex items-start gap-4">
              <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <h3 className="font-semibold text-yellow-900 mb-2">
                  You have {pendingPayments.length} pending payment{pendingPayments.length !== 1 ? 's' : ''}
                </h3>
                <p className="text-sm text-yellow-800">
                  Total amount due: <strong className="font-bold">{pendingPayments.reduce((sum, p) => sum + (p.amount || 0), 0).toLocaleString()} RWF</strong>
                </p>
                <div className="mt-3 space-y-2">
                  {pendingPayments.map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center justify-between gap-3 rounded-lg border border-yellow-200 bg-white/70 px-3 py-2"
                    >
                      <div className="text-sm text-yellow-900">
                        <span className="font-semibold">{Number(p.amount).toLocaleString()} RWF</span>
                        {p.due_date && (
                          <span className="text-yellow-700"> — due {new Date(p.due_date).toLocaleDateString()}</span>
                        )}
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-red-300 text-red-700 hover:bg-red-50 hover:text-red-800 shrink-0"
                        disabled={cancellingPaymentId === p.id}
                        onClick={() => cancelPendingPayment(p.id)}
                      >
                        {cancellingPaymentId === p.id ? "Cancelling…" : "Cancel"}
                      </Button>
                    </div>
                  ))}
                </div>
                <p className="text-sm text-yellow-700 mt-2">See the payment section on the right to make a payment.</p>
              </div>
            </div>
          </div>
        )}

        {/* Quick Stats */}
        {apartment && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
            <Card className="border-t-4 border-t-blue-500 shadow-lg dark:shadow-slate-900/50 rounded-2xl dark:bg-slate-950 dark:border-x-slate-800 dark:border-b-slate-800 transition-colors">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                      {booking?.rate_type === "daily" ? "Daily Rent" : "Monthly Rent"}
                    </p>
                    <p className="text-3xl font-bold text-slate-900 dark:text-white mt-1">
                      RWF {Number(
                        (booking?.rate_type === "daily"
                          ? apartment.price_per_day
                          : apartment.price_per_month) ?? apartment.monthly_rent ?? 0
                      ).toLocaleString()}
                      <span className="text-base font-medium text-slate-400">
                        /{booking?.rate_type === "daily" ? "day" : "month"}
                      </span>
                    </p>
                    {apartment.price_per_day ? (
                      <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                        Per day: RWF {Number(apartment.price_per_day).toLocaleString()}
                      </p>
                    ) : null}
                  </div>
                  <div className="w-12 h-12 rounded-full bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center">
                    <DollarSign className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-t-4 border-t-indigo-500 shadow-lg dark:shadow-slate-900/50 rounded-2xl dark:bg-slate-950 dark:border-x-slate-800 dark:border-b-slate-800 transition-colors">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Bedrooms</p>
                    <p className="text-3xl font-bold text-slate-900 dark:text-white mt-1">
                      {apartment.bedrooms}
                    </p>
                  </div>
                  <div className="w-12 h-12 rounded-full bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center">
                     <Home className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-t-4 border-t-amber-500 shadow-lg dark:shadow-slate-900/50 rounded-2xl dark:bg-slate-950 dark:border-x-slate-800 dark:border-b-slate-800 transition-colors">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Unit Number</p>
                    <p className="text-3xl font-bold text-slate-900 dark:text-white mt-1">
                      {apartment.unit_number || apartment.name || "—"}
                    </p>
                  </div>
                  <div className="w-12 h-12 rounded-full bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center">
                    <MapPin className="h-6 w-6 text-amber-600 dark:text-amber-400" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-t-4 border-t-green-500 shadow-lg dark:shadow-slate-900/50 rounded-2xl dark:bg-slate-950 dark:border-x-slate-800 dark:border-b-slate-800 transition-colors">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Payment Status</p>
                    <p className="text-2xl font-bold capitalize text-slate-900 dark:text-white mt-1 truncate">
                      {tenant.payment_status || "N/A"}
                    </p>
                  </div>
                  <div className={`h-12 w-12 rounded-full flex items-center justify-center ${getPaymentStatusColor(tenant.payment_status || "")} dark:bg-opacity-20`}>
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
                      <p className="text-sm font-medium text-gray-500 dark:text-slate-400 uppercase">
                        Apartment Name
                      </p>
                      <p className="text-lg font-semibold text-gray-900 dark:text-white mt-1">
                        {apartment.name}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-500 dark:text-slate-400 uppercase">
                        Unit Number
                      </p>
                      <p className="text-lg font-semibold text-gray-900 dark:text-white mt-1">
                        {apartment.unit_number}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-500 dark:text-slate-400 uppercase">
                        Size
                      </p>
                      <p className="text-lg font-semibold text-gray-900 dark:text-white mt-1">
                        {apartment.size} sqft
                      </p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-500 dark:text-slate-400 uppercase">
                        Bathrooms
                      </p>
                      <p className="text-lg font-semibold text-gray-900 dark:text-white mt-1">
                        {apartment.bathrooms}
                      </p>
                    </div>
                  </div>
                  {apartment.description && (
                    <div className="pt-4 border-t">
                      <p className="text-sm font-medium text-gray-500 dark:text-slate-400 uppercase">
                        Description
                      </p>
                      <p className="text-gray-700 dark:text-slate-300 mt-2">{apartment.description}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="pt-6">
                  <p className="text-gray-600 dark:text-slate-400">No apartment assigned yet</p>
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
                    <p className="text-sm font-medium text-gray-500 dark:text-slate-400 uppercase">
                      Lease Start Date
                    </p>
                    <p className="text-lg font-semibold text-gray-900 dark:text-white mt-1">
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
                    <p className="text-sm font-medium text-gray-500 dark:text-slate-400 uppercase">
                      Lease End Date
                    </p>
                    <p className="text-lg font-semibold text-gray-900 dark:text-white mt-1">
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
            {/* Payment Widget */}
            {pendingPayments.length > 0 && (
              <div id="payment-widget-section">
                <TenantPaymentWidget
                  pendingPayments={pendingPayments}
                  tenantId={tenant.id}
                />
              </div>
            )}

            <Card>
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button
                  onClick={() => router.push('/tenant/payments?action=pay')}
                  className="w-full justify-start gap-2 bg-green-600 hover:bg-green-700 font-semibold cursor-pointer active:bg-green-800 transition-colors"
                >
                  <DollarSign className="h-4 w-4" />
                  Make Payment
                </Button>

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
                  onClick={() =>
                    document
                      .getElementById("available-apartments")
                      ?.scrollIntoView({ behavior: "smooth" })
                  }
                  className="w-full justify-start gap-2 bg-blue-600 hover:bg-blue-700"
                >
                  <Home className="h-4 w-4" />
                  Browse Apartments
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
                  <p className="text-sm text-gray-600 dark:text-slate-400">Full Name</p>
                  <p className="font-semibold text-gray-900 dark:text-white">{tenant.full_name}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600 dark:text-slate-400">Email</p>
                  <p className="font-semibold text-gray-900 dark:text-white break-all">{tenant.email}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600 dark:text-slate-400">Phone</p>
                  <p className="font-semibold text-gray-900 dark:text-white">{tenant.phone || "N/A"}</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Available Apartments Section */}
        <div id="available-apartments" className="mt-12 scroll-mt-24">
          <div className="mb-6">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Available Apartments</h2>
            <p className="text-gray-600 dark:text-slate-400">Browse and book from our available apartments</p>
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
                  <button
                    type="button"
                    onClick={() => setDetailsApt(apt)}
                    className="relative h-48 w-full bg-gradient-to-br from-blue-100 to-blue-50 flex items-center justify-center group"
                    title="View details"
                  >
                    {apt.image_url ? (
                      <img src={apt.image_url} alt={apt.name} className="h-full w-full object-cover" />
                    ) : (
                      <Home className="h-16 w-16 text-blue-300" />
                    )}
                    <span className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                      <span className="opacity-0 group-hover:opacity-100 transition-opacity text-white text-sm font-semibold bg-black/50 px-3 py-1.5 rounded-full">
                        View Details
                      </span>
                    </span>
                  </button>

                  <CardHeader>
                    <CardTitle className="text-lg">{apt.name}</CardTitle>
                    <p className="text-2xl font-bold text-blue-600 mt-2">
                      RWF {Number(apt.price_per_month || apt.monthly_rent || 0).toLocaleString()}/mo
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
                      <p className="text-sm text-gray-600 dark:text-slate-400">{apt.description}</p>
                    )}

                    <Button
                      variant="outline"
                      onClick={() => setDetailsApt(apt)}
                      className="w-full gap-2"
                    >
                      <Eye className="h-4 w-4" />
                      View Details
                    </Button>

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
                          <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                            Move-in Date
                          </label>
                          <Input
                            type="date"
                            min={new Date().toISOString().slice(0, 10)}
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
                            min={bookingForm.start_date || new Date().toISOString().slice(0, 10)}
                            value={bookingForm.end_date}
                            onChange={(e) =>
                              setBookingForm({ ...bookingForm, end_date: e.target.value })
                            }
                            className="w-full"
                          />
                        </div>

                        {/* Rate type: per day or per month */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                            Billing Rate
                          </label>
                          <div className="grid grid-cols-2 gap-2">
                            {(["monthly", "daily"] as const).map((rt) => (
                              <button
                                key={rt}
                                type="button"
                                onClick={() => setBookingForm({ ...bookingForm, rate_type: rt })}
                                className={`p-2 rounded-lg border-2 text-sm font-semibold transition-all ${
                                  bookingForm.rate_type === rt
                                    ? "border-blue-500 bg-blue-100 text-blue-700"
                                    : "border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-600 dark:text-slate-400 hover:border-blue-300"
                                }`}
                              >
                                {rt === "monthly"
                                  ? `Per Month — RWF ${Number(apt.price_per_month || 0).toLocaleString()}`
                                  : `Per Day — RWF ${Number(apt.price_per_day || 0).toLocaleString()}`}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Promo code */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                            Promo code (optional)
                          </label>
                          {promo ? (
                            <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                              <span className="text-sm text-green-700 font-medium">
                                {promo.code} — {promo.percent}% off applied
                              </span>
                              <button
                                type="button"
                                onClick={clearPromo}
                                className="text-xs text-red-600 hover:underline"
                              >
                                Remove
                              </button>
                            </div>
                          ) : (
                            <div className="flex gap-2">
                              <Input
                                placeholder="Enter code"
                                value={promoInput}
                                onChange={(e) => setPromoInput(e.target.value.toUpperCase())}
                                className="flex-1"
                              />
                              <Button
                                type="button"
                                variant="outline"
                                onClick={applyPromo}
                                disabled={promoChecking || !promoInput.trim()}
                              >
                                {promoChecking ? "Checking…" : "Apply"}
                              </Button>
                            </div>
                          )}
                          {promoMsg && (
                            <p className={`text-xs mt-1 ${promoMsg.type === "ok" ? "text-green-600" : "text-red-600"}`}>
                              {promoMsg.text}
                            </p>
                          )}
                        </div>

                        {/* Live cost summary */}
                        {bookingForm.start_date && bookingForm.end_date &&
                          new Date(bookingForm.end_date) > new Date(bookingForm.start_date) && (() => {
                            const c = computeBookingCost(apt, bookingForm.start_date, bookingForm.end_date, bookingForm.rate_type, promo?.percent || 0);
                            return (
                              <div className="bg-white dark:bg-slate-800 border border-blue-200 rounded-lg p-3 text-sm space-y-1">
                                <div className="flex justify-between text-gray-500 dark:text-slate-500 text-xs">
                                  <span>Stay length</span>
                                  <span>{c.days} day{c.days > 1 ? "s" : ""}</span>
                                </div>
                                {c.months > 0 && (
                                  <div className="flex justify-between text-gray-600 dark:text-slate-400">
                                    <span>{c.months} month{c.months > 1 ? "s" : ""} × RWF {c.monthlyPrice.toLocaleString()}</span>
                                    <span className="font-semibold text-gray-900 dark:text-white">RWF {c.monthsCost.toLocaleString()}</span>
                                  </div>
                                )}
                                {c.extraDays > 0 && (
                                  <div className="flex justify-between text-gray-600 dark:text-slate-400">
                                    <span>
                                      {c.extraDays} day{c.extraDays > 1 ? "s" : ""}
                                      {c.dailyPrice > 0 ? ` × RWF ${c.dailyPrice.toLocaleString()}` : " (no daily rate set)"}
                                    </span>
                                    <span className={c.extraDaysCapped || c.longStayDiscount ? "text-gray-400 line-through" : "font-semibold text-gray-900 dark:text-white"}>
                                      RWF {c.extraDaysFullCost.toLocaleString()}
                                    </span>
                                  </div>
                                )}
                                {c.extraDaysCapped && (
                                  <div className="flex justify-between text-green-700 dark:text-green-400">
                                    <span>Capped at one month</span>
                                    <span className="font-semibold">RWF {c.extraDaysCost.toLocaleString()}</span>
                                  </div>
                                )}
                                {c.longStayDiscount && (
                                  <div className="flex justify-between text-green-700 dark:text-green-400">
                                    <span>Long-stay rate (over {DAILY_LONG_STAY_THRESHOLD} days — pay {Math.round(DAILY_LONG_STAY_RATE * 100)}%)</span>
                                    <span className="font-semibold">RWF {c.afterLongStay.toLocaleString()}</span>
                                  </div>
                                )}
                                {c.promoDiscount > 0 && (
                                  <div className="flex justify-between text-green-700 dark:text-green-400">
                                    <span>Promo {promo?.code} ({c.promoPercent}% off)</span>
                                    <span className="font-semibold">− RWF {c.promoDiscount.toLocaleString()}</span>
                                  </div>
                                )}
                                <div className="flex justify-between items-center pt-1 border-t border-gray-100 dark:border-slate-700">
                                  <span className="font-semibold text-blue-700">Total due now</span>
                                  <span className="text-lg font-bold text-blue-700">RWF {c.total.toLocaleString()}</span>
                                </div>
                              </div>
                            );
                          })()}

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
                <AlertCircle className="h-12 w-12 text-gray-400 dark:text-slate-500 mx-auto mb-3" />
                <p className="text-gray-600 dark:text-slate-400 text-lg">No apartments available at the moment</p>
              </CardContent>
            </Card>
          )}
        </div>
      <ChangePasswordModal
        isOpen={isPasswordModalOpen}
        onClose={() => setIsPasswordModalOpen(false)}
        table="tenants"
        userId={tenant?.id || ""}
      />

      {detailsApt && (
        <ApartmentDetailsModal
          apt={{ ...detailsApt, id: Number(detailsApt.id) }}
          onClose={() => setDetailsApt(null)}
          onBook={(apt) => {
            // Tenant booking stays in-app (deposit flow), not the public guest page
            setBookingForm({ ...bookingForm, apartment_id: Number(apt.id) });
            setShowBookingForm(true);
            setDetailsApt(null);
            setTimeout(() => {
              document.getElementById("available-apartments")?.scrollIntoView({ behavior: "smooth" });
            }, 50);
          }}
        />
      )}
      {/* Live chat with the manager (tawk.to) — tenant dashboard only.
          The visitor details label the conversation in the manager's tawk
          dashboard with the tenant's name, email and apartment info. */}
      <TawkChat
        visitor={
          tenant
            ? {
                name: tenant.full_name,
                email: tenant.email,
                phone: tenant.phone,
                "tenant-id": String(tenant.id),
                apartment: apartment?.name,
                "unit-number": apartment?.unit_number,
                "monthly-rent": apartment?.monthly_rent
                  ? `RWF ${apartment.monthly_rent}`
                  : undefined,
                "booking-status": booking?.status,
              }
            : undefined
        }
      />
    </TenantShell>
  );
}