"use client";

import { useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Key } from "lucide-react";

interface ChangePasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  table: "tenants" | "employees";
  userId: string;
  onSuccess?: () => void;
}

export function ChangePasswordModal({
  isOpen,
  onClose,
  table,
  userId,
  onSuccess,
}: ChangePasswordModalProps) {
  const [formData, setFormData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [loading, setLoading] = useState(false);

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

  const validateForm = () => {
    setError("");

    if (!formData.currentPassword) {
      setError("Current password is required");
      return false;
    }

    if (!formData.newPassword) {
      setError("New password is required");
      return false;
    }

    if (formData.newPassword.length < 6) {
      setError("Password must be at least 6 characters");
      return false;
    }

    if (formData.newPassword !== formData.confirmPassword) {
      setError("Passwords do not match");
      return false;
    }

    if (formData.currentPassword === formData.newPassword) {
      setError("New password must be different from current password");
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    try {
      setLoading(true);
      setError("");

      // Get current user data
      const { data: user, error: fetchError } = await supabase
        .from(table)
        .select("*")
        .eq("id", userId)
        .single();

      if (fetchError || !user) {
        setError("Failed to verify user");
        setLoading(false);
        return;
      }

      // Verify current password
      if (user.password !== formData.currentPassword) {
        setError("Current password is incorrect");
        setLoading(false);
        return;
      }

      // Update password
      const { error: updateError } = await supabase
        .from(table)
        .update({ password: formData.newPassword })
        .eq("id", userId);

      if (updateError && updateError.message) {
        console.error("Error updating password:", updateError.message);
        setError("Failed to update password");
        setLoading(false);
        return;
      }

      setSuccessMessage("Password changed successfully!");
      setFormData({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });

      setTimeout(() => {
        setSuccessMessage("");
        onClose();
        onSuccess?.();
      }, 1500);
    } catch (err) {
      console.error("Error:", err);
      setError("An error occurred while changing the password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Change Password</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Current Password</label>
            <Input
              type="password"
              name="currentPassword"
              value={formData.currentPassword}
              onChange={handleInputChange}
              placeholder="Enter your current password"
              disabled={loading}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">New Password</label>
            <Input
              type="password"
              name="newPassword"
              value={formData.newPassword}
              onChange={handleInputChange}
              placeholder="Enter new password"
              disabled={loading}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Confirm New Password</label>
            <Input
              type="password"
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleInputChange}
              placeholder="Confirm new password"
              disabled={loading}
            />
          </div>

          {error && <div className="text-red-500 text-sm">{error}</div>}
          {successMessage && (
            <div className="text-green-500 text-sm">{successMessage}</div>
          )}

          <Button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700"
          >
            {loading ? "Changing..." : "Change Password"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
