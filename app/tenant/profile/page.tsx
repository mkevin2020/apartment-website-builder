"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { dataClient } from "@/lib/data-client";
import { TenantShell } from "@/components/dashboard/TenantShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { AlertCircle, CheckCircle } from "lucide-react";
import { sanitizePhone } from "@/lib/utils";

export default function TenantProfilePage() {
  const router = useRouter();
  const [tenant, setTenant] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });
  const [formData, setFormData] = useState({
    full_name: "",
    email: "",
    phone: "",
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
    setFormData({
      full_name: parsedTenant.full_name,
      email: parsedTenant.email,
      phone: parsedTenant.phone || "",
    });

    // Pull the full tenant record so every credential is available to display,
    // even if the saved session only had a few fields.
    if (parsedTenant.id) {
      supabase
        .from("tenants")
        .select("*")
        .eq("id", parsedTenant.id)
        .single()
        .then(({ data }) => {
          if (data) {
            setTenant((prev: any) => ({ ...prev, ...data }));
            setFormData((prev) => ({
              full_name: data.full_name ?? prev.full_name,
              email: data.email ?? prev.email,
              phone: data.phone ?? prev.phone,
            }));
          }
        });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage({ type: "", text: "" });

    try {
      const { error } = await supabase
        .from("tenants")
        .update(formData)
        .eq("id", tenant.id);

      if (error) throw error;

      // Update localStorage
      const updatedTenant = { ...tenant, ...formData };
      localStorage.setItem("tenant_session", JSON.stringify(updatedTenant));
      setTenant(updatedTenant);

      setMessage({ type: "success", text: "Profile updated successfully!" });
      setTimeout(() => setMessage({ type: "", text: "" }), 3000);
    } catch (error) {
      setMessage({ type: "error", text: "Failed to update profile" });
    } finally {
      setLoading(false);
    }
  };

  if (!tenant) return null;

  return (
    <TenantShell tenant={tenant} active="profile">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-3xl font-bold mb-8">Edit Profile</h1>

          <Card>
            <CardHeader>
              <CardTitle>Personal Information</CardTitle>
            </CardHeader>
            <CardContent>
              {message.text && (
                <div
                  className={`flex items-center gap-2 p-4 rounded-lg mb-6 ${
                    message.type === "success"
                      ? "bg-green-100 text-green-700"
                      : "bg-red-100 text-red-700"
                  }`}
                >
                  {message.type === "success" ? (
                    <CheckCircle className="h-5 w-5" />
                  ) : (
                    <AlertCircle className="h-5 w-5" />
                  )}
                  {message.text}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Full Name
                  </label>
                  <Input
                    type="text"
                    value={formData.full_name}
                    onChange={(e) =>
                      setFormData({ ...formData, full_name: e.target.value })
                    }
                    disabled={loading}
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">
                    Email
                  </label>
                  <Input
                    type="email"
                    value={formData.email}
                    onChange={(e) =>
                      setFormData({ ...formData, email: e.target.value })
                    }
                    disabled={loading}
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">
                    Phone Number
                  </label>
                  <Input
                    type="tel"
                    inputMode="tel"
                    value={formData.phone}
                    onChange={(e) =>
                      setFormData({ ...formData, phone: sanitizePhone(e.target.value) })
                    }
                    disabled={loading}
                    placeholder="+250 788 352 933"
                  />
                </div>

                {/* All other account credentials (read-only) */}
              <div className="mt-8 pt-6 border-t border-slate-200 dark:border-slate-700">
                <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-4">
                  Account Details
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {[
                    { label: "Username", value: tenant.username },
                    { label: "Tenant ID", value: tenant.id },
                    { label: "ID / National ID Number", value: tenant.id_number },
                    { label: "Date of Birth", value: tenant.date_of_birth },
                    { label: "Gender", value: tenant.gender },
                    { label: "Address", value: tenant.address },
                    { label: "City", value: tenant.city },
                    { label: "Country", value: tenant.country },
                    { label: "Occupation", value: tenant.occupation },
                    { label: "Emergency Contact", value: tenant.emergency_contact },
                    { label: "Emergency Contact Phone", value: tenant.emergency_contact_phone },
                    { label: "Payment Status", value: tenant.payment_status },
                    { label: "Approval Status", value: tenant.approval_status },
                    {
                      label: "Member Since",
                      value: tenant.created_at
                        ? new Date(tenant.created_at).toLocaleDateString()
                        : null,
                    },
                  ]
                    .filter(
                      (f) => f.value !== undefined && f.value !== null && f.value !== ""
                    )
                    .map((f) => (
                      <div key={f.label}>
                        <p className="text-xs uppercase tracking-wide text-slate-400">
                          {f.label}
                        </p>
                        <p className="font-medium text-slate-900 dark:text-white break-words">
                          {String(f.value)}
                        </p>
                      </div>
                    ))}
                </div>
              </div>

                <div className="flex gap-4 pt-6">
                  <Button type="submit" disabled={loading} className="flex-1">
                    {loading ? "Saving..." : "Save Changes"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => router.back()}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
    </TenantShell>
  );
}