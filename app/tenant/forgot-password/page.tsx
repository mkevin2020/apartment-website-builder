"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function TenantForgotPasswordPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [formData, setFormData] = useState({
    email: "",
    fullName: "",
    reason: "",
  });

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (!formData.email || !formData.fullName) {
        setError("Please fill in all required fields");
        setLoading(false);
        return;
      }

      // Check if tenant exists
      const { data: tenant, error: queryError } = await supabase
        .from("tenants")
        .select("*")
        .eq("email", formData.email)
        .single();

      if (queryError || !tenant) {
        setError("No account found with this email");
        setLoading(false);
        return;
      }

      // Create password reset request
      const { error: insertError } = await supabase
        .from("password_reset_requests")
        .insert({
          user_id: tenant.id,
          user_type: "tenant",
          email: formData.email,
          user_name: formData.fullName,
          reason: formData.reason || "User requested password reset",
          status: "pending",
        });

      if (insertError) {
        setError("Failed to submit request. Please try again.");
        setLoading(false);
        return;
      }

      setSubmitted(true);
      setTimeout(() => {
        router.push("/tenant/login");
      }, 3000);
    } catch (err) {
      setError("An error occurred. Please try again.");
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <Card className="w-full max-w-md shadow-lg">
          <CardHeader className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-t-lg">
            <CardTitle>Request Submitted</CardTitle>
          </CardHeader>
          <CardContent className="pt-6 text-center">
            <div className="mb-4">
              <h3 className="text-lg font-semibold mb-2">
                ✅ Request Successfully Submitted
              </h3>
              <p className="text-gray-600">
                Your password reset request has been sent to the admin. They will
                review your request and change your password shortly.
              </p>
            </div>
            <p className="text-sm text-gray-500 mb-4">
              Redirecting to login page in 3 seconds...
            </p>
            <Link href="/tenant/login">
              <Button className="w-full">Back to Login</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-t-lg">
          <CardTitle>Reset Password</CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <p className="text-sm text-gray-600 mb-4">
              Enter your details and we'll notify the admin to help you reset
              your password.
            </p>

            <div>
              <label className="block text-sm font-medium mb-2">
                Email Address*
              </label>
              <Input
                type="email"
                value={formData.email}
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })
                }
                disabled={loading}
                placeholder="Enter your email"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Full Name*
              </label>
              <Input
                type="text"
                value={formData.fullName}
                onChange={(e) =>
                  setFormData({ ...formData, fullName: e.target.value })
                }
                disabled={loading}
                placeholder="Enter your full name"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Additional Details (Optional)
              </label>
              <textarea
                value={formData.reason}
                onChange={(e) =>
                  setFormData({ ...formData, reason: e.target.value })
                }
                disabled={loading}
                placeholder="Tell us why you need to reset your password"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={3}
              />
            </div>

            {error && (
              <div className="flex gap-2 p-3 bg-red-50 border border-red-200 rounded-md">
                <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0" />
                <p className="text-red-700 text-sm">{error}</p>
              </div>
            )}

            <Button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-700"
              disabled={loading}
            >
              {loading ? "Submitting..." : "Submit Reset Request"}
            </Button>

            <div className="text-center pt-2">
              <Link href="/tenant/login" className="text-blue-600 hover:underline flex items-center justify-center gap-1 text-sm">
                <ArrowLeft className="h-4 w-4" />
                Back to Login
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
