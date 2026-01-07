"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
import TenantHeader from "@/components/TenantHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { AlertCircle, CheckCircle } from "lucide-react";

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
    setFormData({
      full_name: parsedTenant.full_name,
      email: parsedTenant.email,
      phone: parsedTenant.phone || "",
    });
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
    <div className="min-h-screen bg-gray-50">
      <TenantHeader tenant={tenant} />

      <main className="container mx-auto px-4 py-8">
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
                    value={formData.phone}
                    onChange={(e) =>
                      setFormData({ ...formData, phone: e.target.value })
                    }
                    disabled={loading}
                    placeholder="(555) 123-4567"
                  />
                </div>

                <div className="flex gap-4 pt-4">
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
      </main>
    </div>
  );
}