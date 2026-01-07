"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, CheckCircle, ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function TenantRegisterPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [step, setStep] = useState(1); // Multi-step form

  const [formData, setFormData] = useState({
    username: "",
    full_name: "",
    email: "",
    password: "",
    confirm_password: "",
    phone: "",
    id_number: "",
    emergency_contact: "",
    emergency_contact_phone: "",
    address: "",
    city: "",
    country: "",
  });

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const validateStep1 = () => {
    if (!formData.username.trim()) {
      setError("Username is required");
      return false;
    }
    if (formData.username.length < 3) {
      setError("Username must be at least 3 characters");
      return false;
    }
    if (!formData.full_name.trim()) {
      setError("Full name is required");
      return false;
    }
    if (!formData.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      setError("Valid email is required");
      return false;
    }
    if (!formData.password || formData.password.length < 6) {
      setError("Password must be at least 6 characters");
      return false;
    }
    if (formData.password !== formData.confirm_password) {
      setError("Passwords do not match");
      return false;
    }
    return true;
  };

  const validateStep2 = () => {
    if (!formData.phone.trim()) {
      setError("Phone number is required");
      return false;
    }
    if (!formData.id_number.trim()) {
      setError("ID number is required");
      return false;
    }
    if (!formData.emergency_contact.trim()) {
      setError("Emergency contact name is required");
      return false;
    }
    if (!formData.emergency_contact_phone.trim()) {
      setError("Emergency contact phone is required");
      return false;
    }
    return true;
  };

  const validateStep3 = () => {
    if (!formData.address.trim()) {
      setError("Address is required");
      return false;
    }
    if (!formData.city.trim()) {
      setError("City is required");
      return false;
    }
    if (!formData.country.trim()) {
      setError("Country is required");
      return false;
    }
    return true;
  };

  const handleNextStep = () => {
    setError("");
    if (step === 1 && validateStep1()) {
      setStep(2);
    } else if (step === 2 && validateStep2()) {
      setStep(3);
    }
  };

  const handlePrevStep = () => {
    setError("");
    setStep(step - 1);
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (!validateStep3()) {
        setLoading(false);
        return;
      }

      // Check if username already exists
      const { data: existingUsernames, error: usernameCheckError } = await supabase
        .from("tenants")
        .select("id")
        .eq("username", formData.username);

      if (usernameCheckError) {
        setError(`Registration failed: ${usernameCheckError.message}`);
        setLoading(false);
        return;
      }

      if (existingUsernames && existingUsernames.length > 0) {
        setError("This username is already taken");
        setLoading(false);
        return;
      }

      // Check if email already exists
      const { data: existingTenants, error: checkError } = await supabase
        .from("tenants")
        .select("id")
        .eq("email", formData.email);

      if (checkError) {
        setError(`Registration failed: ${checkError.message}`);
        setLoading(false);
        return;
      }

      if (existingTenants && existingTenants.length > 0) {
        setError("This email is already registered");
        setLoading(false);
        return;
      }

      // Check if ID number already exists
      const { data: existingIds, error: idCheckError } = await supabase
        .from("tenants")
        .select("id")
        .eq("id_number", formData.id_number);

      if (idCheckError) {
        setError(`Registration failed: ${idCheckError.message}`);
        setLoading(false);
        return;
      }

      if (existingIds && existingIds.length > 0) {
        setError("This ID number is already registered");
        setLoading(false);
        return;
      }

      // Create tenant account
      const { data: newTenant, error: insertError } = await supabase
        .from("tenants")
        .insert([
          {
            username: formData.username,
            full_name: formData.full_name,
            email: formData.email,
            password: formData.password,
            phone: formData.phone,
            id_number: formData.id_number,
            emergency_contact: formData.emergency_contact,
            emergency_contact_phone: formData.emergency_contact_phone,
            address: formData.address,
            city: formData.city,
            country: formData.country,
            approval_status: "pending",
            is_active: false,
          },
        ])
        .select();

      if (insertError) {
        console.error("❌ Registration error:", insertError);
        setError(`Registration failed: ${insertError.message}`);
        setLoading(false);
        return;
      }

      if (!newTenant || newTenant.length === 0) {
        setError("Failed to create account. Please try again.");
        setLoading(false);
        return;
      }

      console.log("✅ Tenant registration successful!");
      setSuccess(true);

      // Redirect to login after 3 seconds
      setTimeout(() => {
        router.push("/login");
      }, 3000);
    } catch (err) {
      console.error("❌ Registration error:", err);
      setError("An unexpected error occurred");
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-green-100 p-4">
        <Card className="w-full max-w-md shadow-xl border-0">
          <CardContent className="pt-12 text-center">
            <div className="mb-6 flex justify-center">
              <CheckCircle className="h-16 w-16 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Registration Successful!</h2>
            <p className="text-gray-600 mb-2">
              Your account has been created and is pending admin approval.
            </p>
            <p className="text-sm text-gray-500 mb-6">
              We will notify you via email once your account is approved.
            </p>
            <p className="text-xs text-gray-400">Redirecting to login...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-green-100 p-4 py-8">
      <Card className="w-full max-w-md shadow-xl border-0">
        <CardHeader className="bg-gradient-to-r from-green-600 to-green-800 text-white rounded-t-lg pb-6">
          <CardTitle className="text-2xl">Tenant Registration</CardTitle>
          <p className="text-green-100 text-sm mt-2">
            Create your account - Step {step} of 3
          </p>
        </CardHeader>

        <CardContent className="pt-6">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex gap-2">
              <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          )}

          <form onSubmit={step === 3 ? handleRegister : (e) => { e.preventDefault(); handleNextStep(); }} className="space-y-4">
            {/* Step 1: Account Details */}
            {step === 1 && (
              <>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    Username
                  </label>
                  <Input
                    type="text"
                    name="username"
                    value={formData.username}
                    onChange={handleInputChange}
                    placeholder="Choose a username"
                    disabled={loading}
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    Full Name
                  </label>
                  <Input
                    type="text"
                    name="full_name"
                    value={formData.full_name}
                    onChange={handleInputChange}
                    placeholder="Enter your full name"
                    disabled={loading}
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    Email Address
                  </label>
                  <Input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    placeholder="Enter your email"
                    disabled={loading}
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    Password
                  </label>
                  <Input
                    type="password"
                    name="password"
                    value={formData.password}
                    onChange={handleInputChange}
                    placeholder="Enter password (min 6 characters)"
                    disabled={loading}
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    Confirm Password
                  </label>
                  <Input
                    type="password"
                    name="confirm_password"
                    value={formData.confirm_password}
                    onChange={handleInputChange}
                    placeholder="Confirm your password"
                    disabled={loading}
                    required
                  />
                </div>
              </>
            )}

            {/* Step 2: Personal Details */}
            {step === 2 && (
              <>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    Phone Number
                  </label>
                  <Input
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handleInputChange}
                    placeholder="Enter phone number"
                    disabled={loading}
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    ID Number
                  </label>
                  <Input
                    type="text"
                    name="id_number"
                    value={formData.id_number}
                    onChange={handleInputChange}
                    placeholder="Enter your ID number"
                    disabled={loading}
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    Emergency Contact Name
                  </label>
                  <Input
                    type="text"
                    name="emergency_contact"
                    value={formData.emergency_contact}
                    onChange={handleInputChange}
                    placeholder="Enter emergency contact name"
                    disabled={loading}
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    Emergency Contact Phone
                  </label>
                  <Input
                    type="tel"
                    name="emergency_contact_phone"
                    value={formData.emergency_contact_phone}
                    onChange={handleInputChange}
                    placeholder="Enter emergency contact phone"
                    disabled={loading}
                    required
                  />
                </div>
              </>
            )}

            {/* Step 3: Address Details */}
            {step === 3 && (
              <>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    Address
                  </label>
                  <Input
                    type="text"
                    name="address"
                    value={formData.address}
                    onChange={handleInputChange}
                    placeholder="Enter your address"
                    disabled={loading}
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    City
                  </label>
                  <Input
                    type="text"
                    name="city"
                    value={formData.city}
                    onChange={handleInputChange}
                    placeholder="Enter city"
                    disabled={loading}
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    Country
                  </label>
                  <Input
                    type="text"
                    name="country"
                    value={formData.country}
                    onChange={handleInputChange}
                    placeholder="Enter country"
                    disabled={loading}
                    required
                  />
                </div>
              </>
            )}

            {/* Navigation Buttons */}
            <div className="flex gap-3 pt-4">
              {step > 1 && (
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={handlePrevStep}
                  disabled={loading}
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back
                </Button>
              )}

              <Button
                type="submit"
                className={`flex-1 ${
                  step === 3
                    ? "bg-green-600 hover:bg-green-700"
                    : "bg-blue-600 hover:bg-blue-700"
                } text-white font-medium`}
                disabled={loading}
              >
                {loading ? "Processing..." : step === 3 ? "Register" : "Next"}
              </Button>
            </div>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-slate-600 mb-2">Already have an account?</p>
            <Link href="/login" className="text-green-600 hover:text-green-700 text-sm font-medium">
              Go to Login
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
