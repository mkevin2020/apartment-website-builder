"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  CheckCircle,
  XCircle,
  Clock,
  User,
  Mail,
  Phone,
  FileText,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface TenantRequest {
  id: number;
  full_name: string;
  email: string;
  phone: string;
  id_number: string;
  emergency_contact: string;
  emergency_contact_phone: string;
  address: string;
  city: string;
  country: string;
  approval_status: string;
  created_at: string;
}

export default function TenantApprovalsPage() {
  const router = useRouter();
  const [admin, setAdmin] = useState<any>(null);
  const [tenants, setTenants] = useState<TenantRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState("pending");
  const [selectedTenant, setSelectedTenant] = useState<TenantRequest | null>(null);
  const [actionType, setActionType] = useState<"approve" | "reject" | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [showDialog, setShowDialog] = useState(false);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    const checkAdminAuth = () => {
      const adminSession = localStorage.getItem("admin_session");
      if (!adminSession) {
        router.push("/login");
        return;
      }

      const adminData = JSON.parse(adminSession);
      setAdmin(adminData);
    };

    checkAdminAuth();
  }, [router]);

  useEffect(() => {
    if (!admin) return;

    const fetchTenantRequests = async () => {
      try {
        const query = supabase
          .from("tenants")
          .select("*")
          .order("created_at", { ascending: false });

        if (filterStatus !== "all") {
          query.eq("approval_status", filterStatus);
        }

        const { data, error } = await query;

        if (error) {
          console.error("Error fetching tenants:", error);
          return;
        }

        setTenants(data || []);
      } catch (err) {
        console.error("Error:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchTenantRequests();
  }, [admin, filterStatus]);

  const handleApproveTenant = async () => {
    if (!selectedTenant || !admin) return;

    try {
      const { error } = await supabase
        .from("tenants")
        .update({
          approval_status: "approved",
          is_active: true,
          approved_by: admin.id,
          approved_at: new Date().toISOString(),
        })
        .eq("id", selectedTenant.id);

      if (error) {
        console.error("Error approving tenant:", error);
        return;
      }

      // Refresh the list
      setTenants(tenants.filter((t) => t.id !== selectedTenant.id));
      setShowDialog(false);
      setSelectedTenant(null);
      setActionType(null);
    } catch (err) {
      console.error("Error:", err);
    }
  };

  const handleRejectTenant = async () => {
    if (!selectedTenant || !admin) return;

    try {
      const { error } = await supabase
        .from("tenants")
        .update({
          approval_status: "rejected",
          approved_by: admin.id,
          approved_at: new Date().toISOString(),
        })
        .eq("id", selectedTenant.id);

      if (error) {
        console.error("Error rejecting tenant:", error);
        return;
      }

      // Refresh the list
      setTenants(tenants.filter((t) => t.id !== selectedTenant.id));
      setShowDialog(false);
      setSelectedTenant(null);
      setActionType(null);
      setRejectionReason("");
    } catch (err) {
      console.error("Error:", err);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "bg-yellow-100 text-yellow-800 border-yellow-300";
      case "approved":
        return "bg-green-100 text-green-800 border-green-300";
      case "rejected":
        return "bg-red-100 text-red-800 border-red-300";
      default:
        return "bg-gray-100 text-gray-800 border-gray-300";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "pending":
        return <Clock className="h-5 w-5" />;
      case "approved":
        return <CheckCircle className="h-5 w-5" />;
      case "rejected":
        return <XCircle className="h-5 w-5" />;
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading tenant requests...</p>
        </div>
      </div>
    );
  }

  const filteredTenants = filterStatus === "all" ? tenants : tenants.filter((t) => t.approval_status === filterStatus);

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Tenant Approvals</h1>
          <p className="text-gray-600">
            Review and approve new tenant account requests
          </p>
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-2 mb-8 flex-wrap">
          {["pending", "approved", "rejected", "all"].map((status) => (
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
              {status !== "all" && (
                <span className="ml-2 bg-white text-blue-600 px-2 py-1 rounded-full text-xs font-semibold">
                  {tenants.filter((t) => t.approval_status === status).length}
                </span>
              )}
            </Button>
          ))}
        </div>

        {/* Tenant Requests */}
        {filteredTenants.length === 0 ? (
          <Card>
            <CardContent className="pt-8 text-center">
              <p className="text-gray-500 text-lg">
                No {filterStatus === "all" ? "" : filterStatus} tenant requests
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6">
            {filteredTenants.map((tenant) => (
              <Card key={tenant.id} className="hover:shadow-lg transition-shadow">
                <CardContent className="pt-6">
                  <div className="flex flex-col md:flex-row justify-between gap-6">
                    {/* Tenant Info */}
                    <div className="flex-1 space-y-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="text-xl font-bold text-gray-900">
                            {tenant.full_name}
                          </h3>
                          <div className={`inline-flex items-center gap-2 mt-2 px-3 py-1 rounded-full text-sm font-semibold border ${getStatusColor(
                            tenant.approval_status
                          )}`}>
                            {getStatusIcon(tenant.approval_status)}
                            {tenant.approval_status.charAt(0).toUpperCase() +
                              tenant.approval_status.slice(1)}
                          </div>
                        </div>
                        <p className="text-xs text-gray-500">
                          {new Date(tenant.created_at).toLocaleDateString()}
                        </p>
                      </div>

                      <div className="grid md:grid-cols-2 gap-4 mt-4">
                        <div className="flex items-center gap-2">
                          <Mail className="h-4 w-4 text-gray-400" />
                          <div>
                            <p className="text-xs text-gray-500">Email</p>
                            <p className="text-sm font-medium text-gray-900">
                              {tenant.email}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <Phone className="h-4 w-4 text-gray-400" />
                          <div>
                            <p className="text-xs text-gray-500">Phone</p>
                            <p className="text-sm font-medium text-gray-900">
                              {tenant.phone}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-gray-400" />
                          <div>
                            <p className="text-xs text-gray-500">ID Number</p>
                            <p className="text-sm font-medium text-gray-900">
                              {tenant.id_number}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-gray-400" />
                          <div>
                            <p className="text-xs text-gray-500">
                              Emergency Contact
                            </p>
                            <p className="text-sm font-medium text-gray-900">
                              {tenant.emergency_contact}
                            </p>
                          </div>
                        </div>

                        <div className="md:col-span-2">
                          <p className="text-xs text-gray-500">Address</p>
                          <p className="text-sm font-medium text-gray-900">
                            {tenant.address}, {tenant.city}, {tenant.country}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    {tenant.approval_status === "pending" && (
                      <div className="flex flex-col gap-2 md:justify-center">
                        <Button
                          onClick={() => {
                            setSelectedTenant(tenant);
                            setActionType("approve");
                            setShowDialog(true);
                          }}
                          className="bg-green-600 hover:bg-green-700 text-white gap-2"
                        >
                          <CheckCircle className="h-4 w-4" />
                          Approve
                        </Button>
                        <Button
                          onClick={() => {
                            setSelectedTenant(tenant);
                            setActionType("reject");
                            setShowDialog(true);
                          }}
                          variant="destructive"
                          className="gap-2"
                        >
                          <XCircle className="h-4 w-4" />
                          Reject
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>

      {/* Confirmation Dialog */}
      <AlertDialog open={showDialog} onOpenChange={setShowDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {actionType === "approve"
                ? "Approve Tenant Account?"
                : "Reject Tenant Account?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {actionType === "approve"
                ? `Are you sure you want to approve ${selectedTenant?.full_name}'s account? They will be able to login immediately.`
                : `Are you sure you want to reject ${selectedTenant?.full_name}'s account? They will be notified via email.`}
            </AlertDialogDescription>
          </AlertDialogHeader>

          {actionType === "reject" && (
            <div className="my-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Rejection Reason (optional)
              </label>
              <Input
                placeholder="Enter reason for rejection"
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
              />
            </div>
          )}

          <div className="flex gap-2 justify-end">
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={
                actionType === "approve"
                  ? handleApproveTenant
                  : handleRejectTenant
              }
              className={
                actionType === "approve"
                  ? "bg-green-600 hover:bg-green-700"
                  : "bg-red-600 hover:bg-red-700"
              }
            >
              {actionType === "approve" ? "Approve" : "Reject"}
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
