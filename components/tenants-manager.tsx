"use client";

import { useEffect, useState } from "react";
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
  AlertCircle,
  Trash2,
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
  username: string;
  full_name: string;
  email: string;
  phone: string;
  password: string;
  id_number: string;
  emergency_contact: string;
  emergency_contact_phone: string;
  address: string;
  city: string;
  country: string;
  approval_status: string;
  created_at: string;
  approved_at?: string;
  is_active: boolean;
}

export function TenantsManager() {
  const [admin, setAdmin] = useState<any>(null);
  const [tenants, setTenants] = useState<TenantRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState("pending");
  const [selectedTenant, setSelectedTenant] = useState<TenantRequest | null>(null);
  const [actionType, setActionType] = useState<"approve" | "reject" | "delete" | null>(null);
  const [showDialog, setShowDialog] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    const adminData = localStorage.getItem("admin_session");
    if (adminData) {
      setAdmin(JSON.parse(adminData));
    }
  }, []);

  useEffect(() => {
    if (!admin) return;

    const fetchTenants = async () => {
      try {
        setLoading(true);
        let query = supabase
          .from("tenants")
          .select("*")
          .order("created_at", { ascending: false });

        if (filterStatus !== "all") {
          query = query.eq("approval_status", filterStatus);
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

    fetchTenants();
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

      setTenants(tenants.map((t) => 
        t.id === selectedTenant.id 
          ? { ...t, approval_status: "approved", is_active: true }
          : t
      ));
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
          is_active: false,
          approved_by: admin.id,
          approved_at: new Date().toISOString(),
        })
        .eq("id", selectedTenant.id);

      if (error) {
        console.error("Error rejecting tenant:", error);
        return;
      }

      setTenants(tenants.map((t) => 
        t.id === selectedTenant.id 
          ? { ...t, approval_status: "rejected", is_active: false }
          : t
      ));
      setShowDialog(false);
      setSelectedTenant(null);
      setActionType(null);
    } catch (err) {
      console.error("Error:", err);
    }
  };

  const handleDeleteTenant = async () => {
    if (!selectedTenant || !admin) return;

    try {
      const { error } = await supabase
        .from("tenants")
        .delete()
        .eq("id", selectedTenant.id);

      if (error) {
        console.error("Error deleting tenant:", error);
        return;
      }

      setTenants(tenants.filter((t) => t.id !== selectedTenant.id));
      setShowDialog(false);
      setSelectedTenant(null);
      setActionType(null);
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

  const filteredTenants = tenants.filter((tenant) => {
    const searchLower = searchTerm.toLowerCase();
    return (
      tenant.full_name.toLowerCase().includes(searchLower) ||
      tenant.email.toLowerCase().includes(searchLower) ||
      tenant.username.toLowerCase().includes(searchLower)
    );
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading tenants...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Tenant Management</h2>
        <p className="text-gray-600">View and approve tenant account requests</p>
      </div>

      {/* Search and Filter */}
      <div className="space-y-4">
        <Input
          placeholder="Search by name, email, or username..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="max-w-md"
        />

        <div className="flex gap-2 flex-wrap">
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
              <span className="ml-2 text-xs font-semibold">
                ({tenants.filter((t) => 
                  status === "all" ? true : t.approval_status === status
                ).length})
              </span>
            </Button>
          ))}
        </div>
      </div>

      {/* Tenants List */}
      {filteredTenants.length === 0 ? (
        <Card>
          <CardContent className="pt-8 text-center">
            <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500 text-lg">
              No {filterStatus === "all" ? "" : filterStatus} tenant requests found
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filteredTenants.map((tenant) => (
            <Card key={tenant.id} className="hover:shadow-lg transition-shadow">
              <CardContent className="pt-6">
                <div className="flex flex-col lg:flex-row justify-between gap-6">
                  {/* Tenant Info */}
                  <div className="flex-1">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="text-xl font-bold text-gray-900">
                          {tenant.full_name}
                        </h3>
                        <p className="text-sm text-gray-500 mt-1">
                          @{tenant.username}
                        </p>
                        <div className={`inline-flex items-center gap-2 mt-3 px-3 py-1 rounded-full text-sm font-semibold border ${getStatusColor(
                          tenant.approval_status
                        )}`}>
                          {getStatusIcon(tenant.approval_status)}
                          {tenant.approval_status.charAt(0).toUpperCase() +
                            tenant.approval_status.slice(1)}
                        </div>
                      </div>
                      <p className="text-xs text-gray-400">
                        {new Date(tenant.created_at).toLocaleDateString("en-US", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
                      </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                      <div className="flex items-start gap-2">
                        <Mail className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="text-xs text-gray-500">Email</p>
                          <p className="text-sm font-medium text-gray-900">
                            {tenant.email}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-start gap-2">
                        <Phone className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="text-xs text-gray-500">Phone</p>
                          <p className="text-sm font-medium text-gray-900">
                            {tenant.phone}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-start gap-2">
                        <FileText className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="text-xs text-gray-500">ID Number</p>
                          <p className="text-sm font-medium text-gray-900">
                            {tenant.id_number}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-start gap-2">
                        <User className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="text-xs text-gray-500">Emergency Contact</p>
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

                      <div className="md:col-span-2">
                        <p className="text-xs text-gray-500">Emergency Contact Phone</p>
                        <p className="text-sm font-medium text-gray-900">
                          {tenant.emergency_contact_phone}
                        </p>
                      </div>

                      <div className="md:col-span-2">
                        <p className="text-xs text-gray-500">Password</p>
                        <p className="text-sm font-medium text-gray-900 font-mono bg-gray-100 px-2 py-1 rounded">
                          {tenant.password}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  {tenant.approval_status === "pending" && (
                    <div className="flex flex-col gap-2 lg:justify-center">
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
                      <Button
                        onClick={() => {
                          setSelectedTenant(tenant);
                          setActionType("delete");
                          setShowDialog(true);
                        }}
                        variant="outline"
                        className="gap-2 text-red-600 border-red-300 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4" />
                        Delete
                      </Button>
                    </div>
                  )}
                  {tenant.approval_status === "approved" && (
                    <div className="flex flex-col gap-2 lg:justify-center">
                      <span className="text-sm font-medium text-green-700 bg-green-50 px-4 py-2 rounded-lg text-center">
                        ✓ Account Active
                      </span>
                      <Button
                        onClick={() => {
                          setSelectedTenant(tenant);
                          setActionType("delete");
                          setShowDialog(true);
                        }}
                        variant="outline"
                        className="gap-2 text-red-600 border-red-300 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4" />
                        Delete
                      </Button>
                    </div>
                  )}
                  {tenant.approval_status === "rejected" && (
                    <div className="flex flex-col gap-2 lg:justify-center">
                      <span className="text-sm font-medium text-red-700 bg-red-50 px-4 py-2 rounded-lg text-center">
                        ✗ Account Rejected
                      </span>
                      <Button
                        onClick={() => {
                          setSelectedTenant(tenant);
                          setActionType("delete");
                          setShowDialog(true);
                        }}
                        variant="outline"
                        className="gap-2 text-red-600 border-red-300 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4" />
                        Delete
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Confirmation Dialog */}
      <AlertDialog open={showDialog} onOpenChange={setShowDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {actionType === "approve"
                ? "Approve Tenant Account?"
                : actionType === "reject"
                ? "Reject Tenant Account?"
                : "Delete Tenant Account?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {actionType === "approve"
                ? `Are you sure you want to approve ${selectedTenant?.full_name}'s account? They will be able to login immediately.`
                : actionType === "reject"
                ? `Are you sure you want to reject ${selectedTenant?.full_name}'s account? They will be notified.`
                : `Are you sure you want to delete ${selectedTenant?.full_name}'s account? This action cannot be undone.`}
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="flex gap-2 justify-end">
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={
                actionType === "approve"
                  ? handleApproveTenant
                  : actionType === "reject"
                  ? handleRejectTenant
                  : handleDeleteTenant
              }
              className={
                actionType === "approve"
                  ? "bg-green-600 hover:bg-green-700"
                  : actionType === "delete"
                  ? "bg-red-600 hover:bg-red-700"
                  : "bg-red-600 hover:bg-red-700"
              }
            >
              {actionType === "approve" ? "Approve" : actionType === "reject" ? "Reject" : "Delete"}
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
