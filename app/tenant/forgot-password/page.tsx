"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, ArrowLeft, CheckCircle, Mail, Lock, Shield } from "lucide-react";
import Link from "next/link";
import OTPVerificationModal from "@/components/OTPVerificationModal";

export default function TenantForgotPasswordPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [step, setStep] = useState(1); // 1: Email, 2: OTP, 3: New Password
  const [email, setEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showOTPModal, setShowOTPModal] = useState(false);
  // The verified code, kept so the reset request can be authorised on the
  // server. The browser asserting "the OTP was fine" proves nothing.
  const [verifiedOtp, setVerifiedOtp] = useState("");
  const [passwordResetComplete, setPasswordResetComplete] = useState(false);
  const [otpChannel, setOtpChannel] = useState<"email" | "sms">("email");

  // Prefill the email when arriving from the unified /forgot-password page
  useEffect(() => {
    const prefill = new URLSearchParams(window.location.search).get("email");
    if (prefill) setEmail(prefill);
  }, []);

  // Step 1: Send OTP to email
  const handleSendOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const trimmedEmail = email.trim().toLowerCase();
      
      if (!trimmedEmail) {
        setError("Please enter your email");
        setLoading(false);
        return;
      }

      // The account check happens inside /api/auth/send-otp. Doing it here with
      // the anon key both required client read access to the tenants table and
      // handed anyone a free "does this email have an account?" oracle.

      // Send OTP
      const response = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmedEmail, flowType: "forgot-password", channel: otpChannel }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to send OTP");
        setLoading(false);
        return;
      }

      // Show OTP modal
      setShowOTPModal(true);
      setStep(2);
      setLoading(false);
    } catch (err) {
      console.error("Error:", err);
      setError("An error occurred. Please try again.");
      setLoading(false);
    }
  };

  // Step 2: OTP verified - show password reset form
  const handleOTPVerified = async (otp: string) => {
    setVerifiedOtp(otp);
    setShowOTPModal(false);
    setStep(3);
  };

  // Step 3: Reset password
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (!newPassword || !confirmPassword) {
        setError("Please enter a password");
        setLoading(false);
        return;
      }

      if (newPassword !== confirmPassword) {
        setError("Passwords do not match");
        setLoading(false);
        return;
      }

      if (newPassword.length < 8) {
        setError("Password must be at least 8 characters");
        setLoading(false);
        return;
      }

      const trimmedEmail = email.trim().toLowerCase();

      // The reset is performed server-side, which re-checks the OTP against
      // otp_codes in the same request that writes the password. This used to be
      // an anon-key UPDATE straight from the browser — meaning anyone could
      // reset any account's password without ever holding a valid code.
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: trimmedEmail,
          otp: verifiedOtp,
          newPassword,
          accountType: "tenant",
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(body?.error || "Failed to reset password");
        setLoading(false);
        return;
      }

      setPasswordResetComplete(true);
      setLoading(false);

      setTimeout(() => {
        router.push("/login");
      }, 3000);
    } catch (err) {
      console.error("Error:", err);
      setError("An error occurred. Please try again.");
      setLoading(false);
    }
  };

  // Success Screen
  if (passwordResetComplete) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 via-blue-50 to-indigo-50 px-4">
        <div className="w-full max-w-md">
          <Card className="shadow-2xl border-0">
            <div className="relative bg-gradient-to-br from-emerald-500 to-green-600 text-white rounded-t-xl overflow-hidden">
              <div className="absolute top-0 right-0 w-40 h-40 bg-emerald-400 rounded-full -mr-20 -mt-20 opacity-20"></div>
              <CardHeader className="relative z-10">
                <div className="flex justify-center mb-4">
                  <div className="bg-white bg-opacity-20 p-4 rounded-full">
                    <CheckCircle className="w-12 h-12 text-white" />
                  </div>
                </div>
                <CardTitle className="text-center text-2xl font-bold">
                  Password Reset Successful!
                </CardTitle>
              </CardHeader>
            </div>
            
            <CardContent className="pt-8 text-center">
              <div className="mb-6 space-y-3">
                <p className="text-lg font-semibold text-gray-800">
                  ✓ Your password has been updated
                </p>
                <p className="text-gray-600">
                  You can now login with your new password. You'll be redirected to the login page shortly.
                </p>
              </div>

              <div className="mb-8 p-4 bg-emerald-50 border border-emerald-200 rounded-lg">
                <p className="text-sm text-emerald-700 font-medium">
                  Redirecting in <span className="font-bold text-emerald-900">3 seconds</span>...
                </p>
              </div>

              <Link href="/login" className="block">
                <Button className="w-full bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white font-semibold h-12 rounded-lg shadow-lg transition-all duration-300 hover:shadow-xl">
                  Back to Login
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 px-4 py-8">
      <div className="w-full max-w-md">
        <Card className="shadow-2xl border-0">
          {/* Header with Icon */}
          <div className="relative bg-gradient-to-br from-blue-600 to-indigo-700 text-white rounded-t-xl overflow-hidden">
            <div className="absolute top-0 right-0 w-40 h-40 bg-indigo-400 rounded-full -mr-20 -mt-20 opacity-20"></div>
            <div className="absolute bottom-0 left-0 w-32 h-32 bg-blue-400 rounded-full -ml-16 -mb-16 opacity-20"></div>
            
            <CardHeader className="relative z-10">
              <div className="flex justify-center mb-4">
                <div className="bg-white bg-opacity-20 p-4 rounded-full">
                  <Shield className="w-8 h-8 text-white" />
                </div>
              </div>
              <CardTitle className="text-center text-2xl font-bold">
                Reset Your Password
              </CardTitle>
              <p className="text-center text-indigo-100 text-sm mt-2">
                {step === 1 ? "Secure your account" : step === 3 ? "Create a new password" : "Verify your identity"}
              </p>
            </CardHeader>

            {/* Progress indicator */}
            <div className="relative z-10 flex justify-center gap-2 px-6 pb-4">
              {[1, 2, 3].map((s) => (
                <div
                  key={s}
                  className={`h-2 flex-1 rounded-full transition-all duration-300 ${
                    s <= step ? "bg-white" : "bg-indigo-300"
                  }`}
                ></div>
              ))}
            </div>
          </div>

          <CardContent className="pt-8 pb-8">
            {/* Step 1: Email */}
            {step === 1 && (
              <form onSubmit={handleSendOTP} className="space-y-5 animate-fadeIn">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                  <p className="text-sm text-blue-800 font-medium flex items-center gap-2">
                    <Mail className="w-4 h-4" />
                    {otpChannel === "email"
                      ? "We'll send a verification code to your email"
                      : "We'll SMS a verification code to your registered phone"}
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-700">
                    Send my code by
                  </label>
                  <div className="flex gap-2">
                    {([
                      { value: "email", label: "✉️ Email" },
                      { value: "sms", label: "💬 SMS" },
                    ] as const).map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        disabled={loading}
                        onClick={() => setOtpChannel(opt.value)}
                        className={`flex-1 rounded-lg border-2 py-2.5 text-sm font-semibold transition-colors ${
                          otpChannel === opt.value
                            ? "border-blue-500 bg-blue-50 text-blue-700"
                            : "border-gray-200 text-gray-500 hover:border-gray-300"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-700">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 w-5 h-5 text-gray-400 pointer-events-none" />
                    <Input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      disabled={loading}
                      placeholder="your@email.com"
                      className="pl-10 h-12 border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                      required
                    />
                  </div>
                </div>

                {error && (
                  <div className="flex gap-3 p-4 bg-red-50 border border-red-200 rounded-lg animate-shake">
                    <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                    <p className="text-red-700 text-sm font-medium">{error}</p>
                  </div>
                )}

                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full h-12 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold rounded-lg shadow-lg transition-all duration-300 hover:shadow-xl disabled:opacity-50"
                >
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                      Sending OTP...
                    </span>
                  ) : (
                    "Send OTP Code"
                  )}
                </Button>

                <div className="text-center pt-4 border-t border-gray-200">
                  <Link href="/login" className="text-indigo-600 hover:text-indigo-700 flex items-center justify-center gap-2 text-sm font-medium transition-colors">
                    <ArrowLeft className="h-4 w-4" />
                    Back to Login
                  </Link>
                </div>
              </form>
            )}

            {/* Step 3: New Password */}
            {step === 3 && (
              <form onSubmit={handleResetPassword} className="space-y-5 animate-fadeIn">
                <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4 mb-6">
                  <p className="text-sm text-indigo-800 font-medium flex items-center gap-2">
                    <Lock className="w-4 h-4" />
                    Create a strong and unique password
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-700">
                    New Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 w-5 h-5 text-gray-400 pointer-events-none" />
                    <Input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      disabled={loading}
                      placeholder="Minimum 6 characters"
                      className="pl-10 h-12 border-gray-300 focus:border-indigo-500 focus:ring-indigo-500"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-700">
                    Confirm Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 w-5 h-5 text-gray-400 pointer-events-none" />
                    <Input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      disabled={loading}
                      placeholder="Re-enter your password"
                      className="pl-10 h-12 border-gray-300 focus:border-indigo-500 focus:ring-indigo-500"
                      required
                    />
                  </div>
                </div>

                {error && (
                  <div className="flex gap-3 p-4 bg-red-50 border border-red-200 rounded-lg animate-shake">
                    <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                    <p className="text-red-700 text-sm font-medium">{error}</p>
                  </div>
                )}

                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full h-12 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold rounded-lg shadow-lg transition-all duration-300 hover:shadow-xl disabled:opacity-50"
                >
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                      Resetting Password...
                    </span>
                  ) : (
                    "Reset Password"
                  )}
                </Button>

                <button
                  type="button"
                  onClick={() => {
                    setStep(1);
                    setEmail("");
                    setNewPassword("");
                    setConfirmPassword("");
                    setError("");
                  }}
                  className="w-full text-indigo-600 hover:text-indigo-700 font-medium text-sm flex items-center justify-center gap-2 transition-colors py-2"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Start Over
                </button>
              </form>
            )}

            {/* OTP Modal */}
            <OTPVerificationModal
              isOpen={showOTPModal}
              email={email}
              channel={otpChannel}
              phone={otpChannel !== "email" ? "your registered phone number" : ""}
              flowType="forgot-password"
              onVerified={handleOTPVerified}
              onCancel={() => {
                setShowOTPModal(false);
                setStep(1);
                setEmail("");
              }}
              loading={loading}
            />
          </CardContent>
        </Card>
      </div>

      {/* Add animation styles */}
      <style jsx>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes shake {
          0%, 100% {
            transform: translateX(0);
          }
          25% {
            transform: translateX(-5px);
          }
          75% {
            transform: translateX(5px);
          }
        }
        .animate-fadeIn {
          animation: fadeIn 0.3s ease-out;
        }
        .animate-shake {
          animation: shake 0.5s ease-in-out;
        }
      `}</style>
    </div>
  );
}
