"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";

export default function TenantLoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [credentials, setCredentials] = useState({
    email: "",
    password: "",
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
      const { data, error: queryError } = await supabase
        .from("tenants")
        .select("*")
        .eq("email", credentials.email)
        .single();

      if (queryError || !data) {
        setError("Invalid email or password");
        setLoading(false);
        return;
      }

      // Validate password
      if (data.password !== credentials.password) {
        setError("Invalid email or password");
        setLoading(false);
        return;
      }

      // Store tenant session
      localStorage.setItem("tenant_session", JSON.stringify(data));
      router.push("/tenant/dashboard");
    } catch (err) {
      setError("An error occurred. Please try again.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-t-lg">
          <CardTitle>Tenant Portal</CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Email</label>
              <Input
                type="email"
                value={credentials.email}
                onChange={(e) =>
                  setCredentials({ ...credentials, email: e.target.value })
                }
                disabled={loading}
                placeholder="Enter your email"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Password</label>
              <Input
                type="password"
                value={credentials.password}
                onChange={(e) =>
                  setCredentials({ ...credentials, password: e.target.value })
                }
                disabled={loading}
                placeholder="Enter your password"
                required
              />
            </div>

            {error && <p className="text-red-500 text-sm">{error}</p>}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Logging in..." : "Login"}
            </Button>

            <div className="text-center text-sm text-gray-600">
              Don't have an account?{" "}
              <Link href="/tenant/signup" className="text-blue-600 hover:underline">
                Sign up here
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}