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
  DialogFooter,
} from "@/components/ui/dialog";

interface ChangePasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  adminId: string;
  onSuccess: () => void;
}

export default function ChangePasswordModal({
  isOpen,
  onClose,
  adminId,
  onSuccess,
}: ChangePasswordModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [passwords, setPasswords] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // Validation
    if (
      !passwords.currentPassword ||
      !passwords.newPassword ||
      !passwords.confirmPassword
    ) {
      setError("All fields are required");
      return;
    }

    if (passwords.newPassword !== passwords.confirmPassword) {
      setError("New passwords do not match");
      return;
    }

    if (passwords.newPassword.length < 6) {
      setError("Password must be at least 6 characters long");
      return;
    }

    setLoading(true);

    try {
      // Get current admin data from localStorage
      const adminSession = JSON.parse(
        localStorage.getItem("admin_session") || "{}"
      );

      // Verify current password matches
      if (adminSession.password !== passwords.currentPassword) {
        setError("Current password is incorrect");
        setLoading(false);
        return;
      }

      // Update password in database
      const { error: updateError } = await supabase
        .from("admin_accounts")
        .update({ password: passwords.newPassword })
        .eq("id", adminId);

      if (updateError) {
        setError("Failed to update password");
        setLoading(false);
        return;
      }

      // Update local session with new password
      adminSession.password = passwords.newPassword;
      localStorage.setItem("admin_session", JSON.stringify(adminSession));

      // Reset form
      setPasswords({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });

      onSuccess();
      onClose();
    } catch (err) {
      setError("An error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Change Password</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">
              Current Password
            </label>
            <Input
              type="password"
              value={passwords.currentPassword}
              onChange={(e) =>
                setPasswords({
                  ...passwords,
                  currentPassword: e.target.value,
                })
              }
              disabled={loading}
              placeholder="Enter your current password"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              New Password
            </label>
            <Input
              type="password"
              value={passwords.newPassword}
              onChange={(e) =>
                setPasswords({
                  ...passwords,
                  newPassword: e.target.value,
                })
              }
              disabled={loading}
              placeholder="Enter new password"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              Confirm New Password
            </label>
            <Input
              type="password"
              value={passwords.confirmPassword}
              onChange={(e) =>
                setPasswords({
                  ...passwords,
                  confirmPassword: e.target.value,
                })
              }
              disabled={loading}
              placeholder="Confirm new password"
              required
            />
          </div>

          {error && <p className="text-red-500 text-sm">{error}</p>}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Updating..." : "Change Password"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}