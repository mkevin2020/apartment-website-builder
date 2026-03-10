"use client";

import { useEffect, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertCircle,
  Check,
  X,
  Mail,
  Clock,
  User,
  Lock,
} from "lucide-react";

interface PasswordResetRequest {
  id: number;
  user_id: number;
  user_type: "tenant" | "employee";
  email: string;
  user_name: string;
  reason: string;
  status: "pending" | "resolved";
  created_at: string;
  updated_at: string;
  resolved_at?: string;
}

interface User {
  id: number;
  email: string;
  password?: string;
  full_name?: string;
  username?: string;
}

export function PasswordResetRequestsManager() {
  const [requests, setRequests] = useState<PasswordResetRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState<PasswordResetRequest | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const [resetMessage, setResetMessage] = useState("");
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("pending");

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    loadRequests();
  }, [activeTab]);

  const loadRequests = async () => {
    setLoading(true);
    try {
      const status = activeTab === "pending" ? "pending" : "resolved";
      const { data, error: queryError } = await supabase
        .from("password_reset_requests")
        .select("*")
        .eq("status", status)
        .order("created_at", { ascending: false });

      if (queryError) {
        console.error("Error loading requests:", queryError);
        setError("Failed to load requests");
      } else {
        setRequests(data || []);
      }
    } catch (err) {
      console.error("Error:", err);
      setError("An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (request: PasswordResetRequest) => {
    if (!newPassword || !confirmPassword) {
      setResetMessage("Please enter a password");
      return;
    }

    if (newPassword !== confirmPassword) {
      setResetMessage("Passwords do not match");
      return;
    }

    if (newPassword.length < 6) {
      setResetMessage("Password must be at least 6 characters");
      return;
    }

    setResetLoading(true);
    setResetMessage("");

    try {
      const table = request.user_type === "tenant" ? "tenants" : "employees";

      // Update password
      const { error: updateError } = await supabase
        .from(table)
        .update({ password: newPassword })
        .eq("id", request.user_id);

      if (updateError) {
        setResetMessage("Error updating password: " + updateError.message);
        setResetLoading(false);
        return;
      }

      // Mark request as resolved
      const { error: resolveError } = await supabase
        .from("password_reset_requests")
        .update({
          status: "resolved",
          resolved_at: new Date().toISOString(),
        })
        .eq("id", request.id);

      if (resolveError) {
        setResetMessage("Error updating request status: " + resolveError.message);
        setResetLoading(false);
        return;
      }

      setResetMessage(
        "✅ Password has been reset successfully and request resolved!"
      );
      setNewPassword("");
      setConfirmPassword("");
      setSelectedRequest(null);

      // Reload requests
      setTimeout(() => {
        loadRequests();
        setResetMessage("");
      }, 2000);
    } catch (err) {
      setResetMessage("An error occurred: " + String(err));
    } finally {
      setResetLoading(false);
    }
  };

  const handleMarkAsResolved = async (request: PasswordResetRequest) => {
    try {
      const { error } = await supabase
        .from("password_reset_requests")
        .update({
          status: "resolved",
          resolved_at: new Date().toISOString(),
        })
        .eq("id", request.id);

      if (error) {
        setError("Failed to resolve request");
      } else {
        loadRequests();
      }
    } catch (err) {
      setError("An error occurred");
    }
  };

  const handleDeleteRequest = async (id: number) => {
    if (confirm("Are you sure you want to delete this request?")) {
      try {
        const { error } = await supabase
          .from("password_reset_requests")
          .delete()
          .eq("id", id);

        if (error) {
          setError("Failed to delete request");
        } else {
          loadRequests();
        }
      } catch (err) {
        setError("An error occurred");
      }
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5" />
            Password Reset Requests
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="pending">
                Pending Requests
              </TabsTrigger>
              <TabsTrigger value="resolved">
                Resolved Requests
              </TabsTrigger>
            </TabsList>

            <TabsContent value="pending" className="space-y-4">
              {error && (
                <div className="flex gap-2 p-3 bg-red-50 border border-red-200 rounded-md">
                  <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0" />
                  <div className="text-red-700 text-sm">{error}</div>
                </div>
              )}

              {loading ? (
                <p className="text-gray-500">Loading requests...</p>
              ) : requests.length === 0 ? (
                <p className="text-gray-500 text-center py-8">
                  No pending password reset requests
                </p>
              ) : (
                <div className="space-y-4">
                  {requests.map((request) => (
                    <Card
                      key={request.id}
                      className={`p-4 border-l-4 ${
                        selectedRequest?.id === request.id
                          ? "border-l-blue-500 bg-blue-50"
                          : "border-l-orange-500"
                      }`}
                    >
                      <div className="space-y-3">
                        <div className="flex justify-between items-start">
                          <div>
                            <h4 className="font-semibold flex items-center gap-2">
                              <User className="h-4 w-4" />
                              {request.user_name}
                            </h4>
                            <p className="text-sm text-gray-600 flex items-center gap-2">
                              <Mail className="h-4 w-4" />
                              {request.email}
                            </p>
                            <p className="text-xs text-gray-400 flex items-center gap-2 mt-1">
                              <Clock className="h-4 w-4" />
                              {new Date(request.created_at).toLocaleString()}
                            </p>
                          </div>
                          <span className="px-3 py-1 bg-orange-100 text-orange-800 text-xs font-semibold rounded-full">
                            {request.user_type.toUpperCase()}
                          </span>
                        </div>

                        {request.reason && (
                          <div className="bg-gray-50 p-3 rounded-md">
                            <p className="text-xs font-semibold text-gray-600">
                              Reason:
                            </p>
                            <p className="text-sm text-gray-700">
                              {request.reason}
                            </p>
                          </div>
                        )}

                        {selectedRequest?.id === request.id && (
                          <div className="space-y-3 pt-3 border-t">
                            <div>
                              <label className="block text-sm font-medium mb-1">
                                New Password*
                              </label>
                              <Input
                                type="password"
                                value={newPassword}
                                onChange={(e) =>
                                  setNewPassword(e.target.value)
                                }
                                placeholder="Enter new password"
                                disabled={resetLoading}
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium mb-1">
                                Confirm Password*
                              </label>
                              <Input
                                type="password"
                                value={confirmPassword}
                                onChange={(e) =>
                                  setConfirmPassword(e.target.value)
                                }
                                placeholder="Confirm password"
                                disabled={resetLoading}
                              />
                            </div>

                            {resetMessage && (
                              <div className={`text-sm p-2 rounded ${
                                resetMessage.startsWith("✅")
                                  ? "bg-green-100 text-green-700"
                                  : "bg-red-100 text-red-700"
                              }`}>
                                {resetMessage}
                              </div>
                            )}

                            <div className="flex gap-2">
                              <Button
                                onClick={() =>
                                  handleResetPassword(request)
                                }
                                disabled={resetLoading}
                                className="flex-1 bg-green-600 hover:bg-green-700"
                              >
                                {resetLoading ? "Updating..." : "Update Password & Resolve"}
                              </Button>
                              <Button
                                onClick={() => setSelectedRequest(null)}
                                variant="outline"
                                disabled={resetLoading}
                              >
                                Cancel
                              </Button>
                            </div>
                          </div>
                        )}

                        {selectedRequest?.id !== request.id && (
                          <div className="flex gap-2">
                            <Button
                              onClick={() => {
                                setSelectedRequest(request);
                                setNewPassword("");
                                setConfirmPassword("");
                                setResetMessage("");
                              }}
                              size="sm"
                              className="flex-1 bg-blue-600 hover:bg-blue-700"
                            >
                              <Check className="h-4 w-4 mr-1" />
                              Reset Password
                            </Button>
                            <Button
                              onClick={() =>
                                handleDeleteRequest(request.id)
                              }
                              size="sm"
                              variant="destructive"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        )}
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="resolved" className="space-y-4">
              {loading ? (
                <p className="text-gray-500">Loading requests...</p>
              ) : requests.length === 0 ? (
                <p className="text-gray-500 text-center py-8">
                  No resolved password reset requests
                </p>
              ) : (
                <div className="space-y-4">
                  {requests.map((request) => (
                    <Card
                      key={request.id}
                      className="p-4 border-l-4 border-l-green-500 bg-green-50"
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="font-semibold flex items-center gap-2">
                            <Check className="h-4 w-4 text-green-600" />
                            {request.user_name}
                          </h4>
                          <p className="text-sm text-gray-600 flex items-center gap-2">
                            <Mail className="h-4 w-4" />
                            {request.email}
                          </p>
                          <p className="text-xs text-gray-400">
                            Resolved: {request.resolved_at ? new Date(request.resolved_at).toLocaleString() : "N/A"}
                          </p>
                        </div>
                        <span className="px-3 py-1 bg-green-100 text-green-800 text-xs font-semibold rounded-full">
                          RESOLVED
                        </span>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
