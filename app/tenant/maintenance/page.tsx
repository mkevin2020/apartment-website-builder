"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
import TenantHeader from "@/components/TenantHeader";
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
  const [formData, setFormData] = useState({
    issue_type: "",
    description: "",
    priority: "normal",
  });

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    const tenantData = localStorage.getItem("tenant_session");
    if (!tenantData) {
      router.push("/login");
      return;
    }

    const parsedTenant = JSON.parse(tenantData);
    setTenant(parsedTenant);
    fetchRequests(parsedTenant.id);
  }, [router]);

  const fetchRequests = async (tenantId: string) => {
    const { data } = await supabase
      .from("maintenance_requests")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false });

    if (data) setRequests(data);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage({ type: "", text: "" });

    try {
      // Submit maintenance request
      const { error: requestError } = await supabase.from("maintenance_requests").insert([
        {
          tenant_id: tenant.id,
          apartment_id: tenant.apartment_id,
          issue_type: formData.issue_type,
          description: formData.description,
          priority: formData.priority,
          status: "pending",
        },
      ]);

      if (requestError) throw requestError;

      // Send notification to admin and employees via client_feedback
      const notificationMessage = `[MAINTENANCE REQUEST] ${tenant.full_name} submitted a maintenance request:\n\nType: ${formData.issue_type}\nPriority: ${formData.priority}\nDescription: ${formData.description}`;

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
      setFormData({ issue_type: "", description: "", priority: "normal" });
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
        return "text-gray-600 bg-gray-50";
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
        return "text-gray-600";
      default:
        return "text-gray-600";
    }
  };

  if (!tenant) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      <TenantHeader tenant={tenant} />

      <main className="container mx-auto px-4 py-8">
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

                  <Button type="submit" className="w-full" disabled={loading}>
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
                  <p className="text-gray-500 text-center py-8">
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
                        <p className="text-gray-600 text-sm mb-2">
                          {request.description}
                        </p>
                        <p className="text-xs text-gray-400">
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
      </main>
    </div>
  );
}