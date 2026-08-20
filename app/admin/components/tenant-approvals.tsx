"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { dataClient } from "@/lib/data-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { formatDate } from "@/lib/utils";
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
import { ListSkeleton } from "@/components/ui/loading-skeletons";

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

  const supabase = dataClient();

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

      // Notify the tenant by email (best-effort — never block approval on email)
      try {
        await fetch("/api/tenants/approval-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: selectedTenant.email,
            name: selectedTenant.full_name,
            status: "approved",
          }),
        });
      } catch (emailErr) {
        console.error("Failed to send approval email:", emailErr);
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

      // Notify the tenant by email (best-effort)
      try {
        await fetch("/api/tenants/approval-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: selectedTenant.email,
            name: selectedTenant.full_name,
            status: "rejected",
            reason: rejectionReason,
          }),
        });
      } catch (emailErr) {
        console.error("Failed to send rejection email:", emailErr);
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
        return "bg-gray-100 dark:bg-slate-800 text-gray-800 dark:text-slate-100 border-gray-300 dark:border-slate-700";
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
    // Skeleton, not a spinner: it occupies the same space the real
    // content will, so nothing shifts when the data arrives.
    return <ListSkeleton rows={4} withAvatar />;
  }

  const filteredTenants = filterStatus === "all" ? tenants : tenants.filter((t) => t.approval_status === filterStatus);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900">
      <main className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">Tenant Approvals</h1>
          <p className="text-gray-600 dark:text-slate-400">
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
                  : "border-gray-300 dark:border-slate-700"
              }
            >
              {status.charAt(0).toUpperCase() + status.slice(1)}
              {status !== "all" && (
                <span className="ml-2 bg-white dark:bg-slate-800 text-blue-600 px-2 py-1 rounded-full text-xs font-semibold">
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
              <p className="text-gray-500 dark:text-slate-400 text-lg">
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
                          <h3 className="text-xl font-bold text-gray-900 dark:text-white">
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
                        <p className="text-xs text-gray-500 dark:text-slate-400">
                          {formatDate(tenant.created_at)}
                        </p>
                      </div>

                      <div className="grid md:grid-cols-2 gap-4 mt-4">
                        <div className="flex items-center gap-2">
                          <Mail className="h-4 w-4 text-gray-400 dark:text-slate-500" />
                          <div>
                            <p className="text-xs text-gray-500 dark:text-slate-400">Email</p>
                            <p className="text-sm font-medium text-gray-900 dark:text-white">
                              {tenant.email}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <Phone className="h-4 w-4 text-gray-400 dark:text-slate-500" />
                          <div>
                            <p className="text-xs text-gray-500 dark:text-slate-400">Phone</p>
                            <p className="text-sm font-medium text-gray-900 dark:text-white">
                              {tenant.phone}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-gray-400 dark:text-slate-500" />
                          <div>
                            <p className="text-xs text-gray-500 dark:text-slate-400">ID Number</p>
                            <p className="text-sm font-medium text-gray-900 dark:text-white">
                              {tenant.id_number}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-gray-400 dark:text-slate-500" />
                          <div>
                            <p className="text-xs text-gray-500 dark:text-slate-400">
                              Emergency Contact
                            </p>
                            <p className="text-sm font-medium text-gray-900 dark:text-white">
                              {tenant.emergency_contact}
                            </p>
                          </div>
                        </div>

                        <div className="md:col-span-2">
                          <p className="text-xs text-gray-500 dark:text-slate-400">Address</p>
                          <p className="text-sm font-medium text-gray-900 dark:text-white">
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
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
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
