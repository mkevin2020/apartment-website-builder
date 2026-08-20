"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, ArrowLeft, Mail, Loader2 } from "lucide-react";
import Link from "next/link";

// Unified "forgot password" entry point for the single /login page.
// Every role logs in at /login, so this page detects which kind of account
// the email belongs to and sends the user into the matching reset flow:
//   - tenants  -> self-service OTP reset  (/tenant/forgot-password)
//   - employees -> admin reset request    (/employee/forgot-password)
//   - managers  -> admin reset request    (/manager/forgot-password)
export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const trimmed = email.trim().toLowerCase();
    if (!trimmed) {
      setError("Please enter your email address.");
      return;
    }

    setLoading(true);
    try {
      const target = encodeURIComponent(trimmed);

      // One server call decides which portal this address belongs to. The page
      // used to query tenants / employees / managers directly with the anon
      // key; once those tables stopped being readable signed-out, every lookup
      // came back 401 and the page reported "no account found" for addresses
      // that plainly existed.
      const res = await fetch("/api/auth/locate-account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed }),
      })

      if (res.status === 429) {
        setError("Too many attempts. Please wait a few minutes and try again.")
        setLoading(false)
        return
      }

      if (!res.ok) {
        setError("Something went wrong. Please try again.")
        setLoading(false)
        return
      }

      const { found, accountType } = await res.json()

      if (found && accountType === "tenant") {
        router.push(`/tenant/forgot-password?email=${target}`)
        return
      }
      if (found && accountType === "employee") {
        router.push(`/employee/forgot-password?email=${target}`)
        return
      }
      if (found && accountType === "manager") {
        router.push(`/manager/forgot-password?email=${target}`)
        return
      }

      setError(
        "No account was found with that email. Check the spelling, or create a tenant account if you don't have one yet."
      )
      setLoading(false);
    } catch (err: any) {
      setError(err?.message || "Something went wrong. Please try again.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Link
          href="/login"
          className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 mb-4 font-medium"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Login
        </Link>

        <Card className="border-slate-200 dark:border-slate-800 dark:bg-slate-950 shadow-lg">
          <CardHeader>
            <CardTitle className="text-xl text-slate-900 dark:text-white">
              Forgot your password?
            </CardTitle>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Enter the email on your account and we'll take you to the right reset
              steps — whether you're a tenant, an employee, or a manager.
            </p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label
                  htmlFor="fp-email"
                  className="text-sm font-medium text-slate-700 dark:text-slate-300"
                >
                  Email address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    id="fp-email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setError("");
                    }}
                    disabled={loading}
                    className="pl-9 h-11 rounded-lg border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                  />
                </div>
              </div>

              {error && (
                <div className="rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-900/20 p-3 flex gap-2.5 items-start">
                  <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
                </div>
              )}

              <Button
                type="submit"
                disabled={loading || !email.trim()}
                className="w-full h-11 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Checking your account…
                  </>
                ) : (
                  "Continue"
                )}
              </Button>
            </form>

            <p className="text-xs text-slate-500 dark:text-slate-400 mt-5 text-center">
              Don&apos;t have an account?{" "}
              <Link href="/tenant/register" className="text-blue-600 hover:underline font-medium">
                Register as a tenant
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
