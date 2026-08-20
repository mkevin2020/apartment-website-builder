"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { dataClient } from "@/lib/data-client";
import { TenantShell } from "@/components/dashboard/TenantShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Wrench, AlertCircle, CheckCircle } from "lucide-react";

const ISSUE_TYPES = [
  "Plumbing",
  "Electrical",
  "HVAC",
  "Appliance",
  "Flooring",
  "Paint",
  "Door/Lock",
  "Window",
  "Other",
];

const PRIORITY_LEVELS = ["low", "normal", "high", "emergency"];

export default function MaintenanceRequestPage() {
  const router = useRouter();
  const [tenant, setTenant] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });
  const [requests, setRequests] = useState<any[]>([]);
  const [apartments, setApartments] = useState<{ id: number; label: string }[]>([]);
  const [formData, setFormData] = useState({
    apartment_id: "",
    issue_type: "",
    description: "",
    priority: "normal",
  });

  const supabase = dataClient();

  useEffect(() => {
    const tenantData = localStorage.getItem("tenant_session");
    if (!tenantData) {
      router.push("/login");
      return;
    }

    const parsedTenant = JSON.parse(tenantData);
    setTenant(parsedTenant);
    fetchRequests(parsedTenant.id);
    fetchApartments(parsedTenant);
  }, [router]);

  const fetchRequests = async (tenantId: string) => {
    const { data } = await supabase
      .from("maintenance_requests")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false });

    if (data) setRequests(data);
  };

  // Build the list of apartments this tenant can report on, from their bookings.
  const fetchApartments = async (parsedTenant: any) => {
    const { data: bookings } = await supabase
      .from("bookings")
      .select("apartment_id")
      .eq("tenant_id", String(parsedTenant.id));

    // Unique apartment ids across all their bookings (+ the one on their profile, if any)
    const ids = new Set<number>();
    (bookings || []).forEach((b: any) => b.apartment_id && ids.add(Number(b.apartment_id)));
    if (parsedTenant.apartment_id) ids.add(Number(parsedTenant.apartment_id));

    if (ids.size === 0) {
      setApartments([]);
      return;
    }

    const { data: apts } = await supabase
      .from("apartments")
      .select("id, name, unit_number")
      .in("id", Array.from(ids));

    const list = (apts || []).map((a: any) => ({
      id: a.id,
      label: a.unit_number ? `${a.name} (Unit ${a.unit_number})` : a.name,
    }));
    setApartments(list);

    // Pre-select if there's only one apartment
    if (list.length === 1) {
      setFormData((prev) => ({ ...prev, apartment_id: String(list[0].id) }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.apartment_id) {
      setMessage({ type: "error", text: "Please choose which apartment needs maintenance." });
      return;
    }
    if (!formData.issue_type) {
      setMessage({ type: "error", text: "Please choose what maintenance is needed." });
      return;
    }

    setLoading(true);
    setMessage({ type: "", text: "" });

    const apartmentLabel =
      apartments.find((a) => String(a.id) === formData.apartment_id)?.label ||
      `Apartment #${formData.apartment_id}`;

    try {
      // Submit maintenance request for the apartment the tenant chose
      const { error: requestError } = await supabase.from("maintenance_requests").insert([
        {
          tenant_id: tenant.id,
          apartment_id: Number(formData.apartment_id),
          issue_type: formData.issue_type,
          description: formData.description,
          priority: formData.priority,
          status: "pending",
        },
      ]);

      if (requestError) throw requestError;

      // Send notification to admin and employees via client_feedback
      const notificationMessage = `[MAINTENANCE REQUEST] ${tenant.full_name} submitted a maintenance request:\n\nApartment: ${apartmentLabel}\nType: ${formData.issue_type}\nPriority: ${formData.priority}\nDescription: ${formData.description}`;

      const { error: notificationError } = await supabase.from("client_feedback").insert([
        {
          name: tenant.full_name,
          email: tenant.email,
          message: notificationMessage,
          is_read: false,
        },
      ]);

      if (notificationError) {
        console.error("Error sending notification:", notificationError);
      }

      setMessage({
        type: "success",
        text: "Maintenance request submitted successfully! Admins and employees have been notified.",
      });
      setFormData({
        apartment_id: apartments.length === 1 ? String(apartments[0].id) : "",
        issue_type: "",
        description: "",
        priority: "normal",
      });
      await fetchRequests(tenant.id);
      setTimeout(() => setMessage({ type: "", text: "" }), 3000);
    } catch (error) {
      setMessage({ type: "error", text: "Failed to submit request" });
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "text-green-600 bg-green-50";
      case "in-progress":
        return "text-blue-600 bg-blue-50";
      case "pending":
        return "text-yellow-600 bg-yellow-50";
      default:
        return "text-gray-600 dark:text-slate-400 bg-gray-50 dark:bg-slate-800";
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "emergency":
        return "text-red-600";
      case "high":
        return "text-orange-600";
      case "normal":
        return "text-blue-600";
      case "low":
        return "text-gray-600 dark:text-slate-400";
      default:
        return "text-gray-600 dark:text-slate-400";
    }
  };

  if (!tenant) return null;

  return (
    <TenantShell tenant={tenant} active="maintenance">
        <h1 className="text-3xl font-bold mb-8 flex items-center gap-2">
          <Wrench className="h-8 w-8" />
          Maintenance Requests
        </h1>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Request Form */}
          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle>Submit Request</CardTitle>
              </CardHeader>
              <CardContent>
                {message.text && (
                  <div
                    className={`flex items-center gap-2 p-3 rounded-lg mb-4 text-sm ${
                      message.type === "success"
                        ? "bg-green-100 text-green-700"
                        : "bg-red-100 text-red-700"
                    }`}
                  >
                    {message.type === "success" ? (
                      <CheckCircle className="h-4 w-4" />
                    ) : (
                      <AlertCircle className="h-4 w-4" />
                    )}
                    {message.text}
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Which apartment?
                    </label>
                    {apartments.length === 0 ? (
                      <p className="text-sm text-amber-600 bg-amber-50 dark:bg-amber-900/20 rounded-md p-2">
                        No booked apartments found on your account, so there's nothing to report on yet.
                      </p>
                    ) : (
                      <Select
                        value={formData.apartment_id}
                        onValueChange={(value) =>
                          setFormData({ ...formData, apartment_id: value })
                        }
                        disabled={loading}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select your apartment" />
                        </SelectTrigger>
                        <SelectContent>
                          {apartments.map((a) => (
                            <SelectItem key={a.id} value={String(a.id)}>
                              {a.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Issue Type
                    </label>
                    <Select
                      value={formData.issue_type}
                      onValueChange={(value) =>
                        setFormData({ ...formData, issue_type: value })
                      }
                      disabled={loading}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select issue type" />
                      </SelectTrigger>
                      <SelectContent>
                        {ISSUE_TYPES.map((type) => (
                          <SelectItem key={type} value={type}>
                            {type}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Priority
                    </label>
                    <Select
                      value={formData.priority}
                      onValueChange={(value) =>
                        setFormData({ ...formData, priority: value })
                      }
                      disabled={loading}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PRIORITY_LEVELS.map((level) => (
                          <SelectItem key={level} value={level}>
                            {level.charAt(0).toUpperCase() + level.slice(1)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Description
                    </label>
                    <Textarea
                      value={formData.description}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          description: e.target.value,
                        })
                      }
                      disabled={loading}
                      placeholder="Describe the issue..."
                      rows={4}
                      required
                    />
                  </div>

                  <Button
                    type="submit"
                    className="w-full"
                    disabled={loading || apartments.length === 0}
                  >
                    {loading ? "Submitting..." : "Submit Request"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>

          {/* Requests List */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>Your Requests</CardTitle>
              </CardHeader>
              <CardContent>
                {requests.length === 0 ? (
                  <p className="text-gray-500 dark:text-slate-400 text-center py-8">
                    No maintenance requests yet
                  </p>
                ) : (
                  <div className="space-y-4">
                    {requests.map((request) => (
                      <div
                        key={request.id}
                        className="border rounded-lg p-4 hover:shadow-md transition"
                      >
                        <div className="flex justify-between items-start mb-2">
                          <h3 className="font-semibold">{request.issue_type}</h3>
                          <div className="flex gap-2">
                            <span
                              className={`text-xs font-semibold px-2 py-1 rounded ${
                                getPriorityColor(request.priority)
                              } bg-opacity-10`}
                            >
                              {request.priority.toUpperCase()}
                            </span>
                            <span
                              className={`text-xs font-semibold px-2 py-1 rounded ${getStatusColor(
                                request.status
                              )}`}
                            >
                              {request.status.toUpperCase()}
                            </span>
                          </div>
                        </div>
                        <p className="text-gray-600 dark:text-slate-400 text-sm mb-2">
                          {request.description}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-slate-400 mb-1">
                          🏠 {apartments.find((a) => a.id === Number(request.apartment_id))?.label ||
                            `Apartment #${request.apartment_id}`}
                        </p>
                        <p className="text-xs text-gray-400 dark:text-slate-500">
                          {new Date(request.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
    </TenantShell>
  );
}