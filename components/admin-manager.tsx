"use client";

import { useState, useEffect } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Trash2, Plus, Settings } from "lucide-react";

interface Admin {
  id: number;
  username: string;
  full_name: string;
  created_at: string;
}

export function AdminManager() {
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [adminToDelete, setAdminToDelete] = useState<Admin | null>(null);
  const [formData, setFormData] = useState({
    username: "",
    password: "",
    confirmPassword: "",
    full_name: "",
  });
  const [settingsData, setSettingsData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [settingsError, setSettingsError] = useState("");
  const [settingsSuccess, setSettingsSuccess] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSettingsSubmitting, setIsSettingsSubmitting] = useState(false);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const fetchAdmins = async () => {
    try {
      setLoading(true);
      const { data, error: queryError } = await supabase
        .from("admin_accounts")
        .select("*")
        .order("created_at", { ascending: false });

      if (queryError && queryError.message) {
        console.error("Error fetching admins:", queryError.message);
        setError("Failed to load admins");
        return;
      }

      setAdmins(data || []);
    } catch (err) {
      console.error("Error:", err);
      setError("An error occurred while fetching admins");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdmins();
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSettingsInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setSettingsData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const validateForm = () => {
    setError("");

    if (!formData.username.trim()) {
      setError("Username is required");
      return false;
    }

    if (formData.username.length < 3) {
      setError("Username must be at least 3 characters");
      return false;
    }

    if (!formData.password) {
      setError("Password is required");
      return false;
    }

    if (formData.password.length < 6) {
      setError("Password must be at least 6 characters");
      return false;
    }

    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match");
      return false;
    }

    if (!formData.full_name.trim()) {
      setError("Full name is required");
      return false;
    }

    return true;
  };

  const validateSettingsForm = () => {
    setSettingsError("");

    if (!settingsData.currentPassword) {
      setSettingsError("Current password is required");
      return false;
    }

    if (!settingsData.newPassword) {
      setSettingsError("New password is required");
      return false;
    }

    if (settingsData.newPassword.length < 6) {
      setSettingsError("Password must be at least 6 characters");
      return false;
    }

    if (settingsData.newPassword !== settingsData.confirmPassword) {
      setSettingsError("Passwords do not match");
      return false;
    }

    return true;
  };

  const handleAddAdmin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    try {
      setIsSubmitting(true);
      setError("");

      // Check if username already exists
      const { data: existingAdmin } = await supabase
        .from("admin_accounts")
        .select("id")
        .eq("username", formData.username)
        .single();

      if (existingAdmin) {
        setError("Username already exists");
        setIsSubmitting(false);
        return;
      }

      // Insert new admin
      const { error: insertError } = await supabase
        .from("admin_accounts")
        .insert([
          {
            username: formData.username,
            password: formData.password,
            full_name: formData.full_name,
          },
        ]);

      if (insertError && insertError.message) {
        console.error("Error adding admin:", insertError.message);
        setError("Failed to add admin account");
        setIsSubmitting(false);
        return;
      }

      setSuccessMessage("Admin account created successfully!");
      setFormData({
        username: "",
        password: "",
        confirmPassword: "",
        full_name: "",
      });

      setTimeout(() => {
        setIsDialogOpen(false);
        setSuccessMessage("");
        fetchAdmins();
      }, 1500);
    } catch (err) {
      console.error("Error:", err);
      setError("An error occurred while creating the admin account");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateSettingsForm()) {
      return;
    }

    try {
      setIsSettingsSubmitting(true);
      setSettingsError("");

      // Verify current password
      const { data: currentPassword } = await supabase
        .from("settings")
        .select("setting_value")
        .eq("setting_key", "master_deletion_password")
        .single();

      if (!currentPassword || currentPassword.setting_value !== settingsData.currentPassword) {
        setSettingsError("Current password is incorrect");
        setIsSettingsSubmitting(false);
        return;
      }

      // Update password
      const { error: updateError } = await supabase
        .from("settings")
        .update({ setting_value: settingsData.newPassword })
        .eq("setting_key", "master_deletion_password");

      if (updateError && updateError.message) {
        console.error("Error updating password:", updateError.message);
        setSettingsError("Failed to update password");
        setIsSettingsSubmitting(false);
        return;
      }

      setSettingsSuccess("Master deletion password updated successfully!");
      setSettingsData({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });

      setTimeout(() => {
        setIsSettingsOpen(false);
        setSettingsSuccess("");
      }, 1500);
    } catch (err) {
      console.error("Error:", err);
      setSettingsError("An error occurred while updating the password");
    } finally {
      setIsSettingsSubmitting(false);
    }
  };

  const handleDeleteAdminClick = (admin: Admin) => {
    setAdminToDelete(admin);
    setDeletePassword("");
    setDeleteError("");
    setIsDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!adminToDelete) return;

    try {
      setDeleteError("");

      // Verify master deletion password
      const { data: settings } = await supabase
        .from("settings")
        .select("setting_value")
        .eq("setting_key", "master_deletion_password")
        .single();

      if (!settings || settings.setting_value !== deletePassword) {
        setDeleteError("Incorrect password");
        return;
      }

      // Prevent deleting your own admin account
      const currentAdmin = localStorage.getItem("admin_session");
      if (currentAdmin) {
        const parsedAdmin = JSON.parse(currentAdmin);
        if (parsedAdmin.id === adminToDelete.id) {
          setDeleteError("You cannot delete your own admin account");
          return;
        }
      }

      // Delete the admin
      const { error: deleteError } = await supabase
        .from("admin_accounts")
        .delete()
        .eq("id", adminToDelete.id);

      if (deleteError && deleteError.message) {
        console.error("Error deleting admin:", deleteError.message);
        setDeleteError("Failed to delete admin");
        return;
      }

      setSuccessMessage(`Admin "${adminToDelete.username}" deleted successfully`);
      setTimeout(() => {
        setSuccessMessage("");
        setIsDeleteDialogOpen(false);
        setAdminToDelete(null);
        fetchAdmins();
      }, 1500);
    } catch (err) {
      console.error("Error:", err);
      setDeleteError("An error occurred while deleting the admin");
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center py-8">Loading admins...</div>;
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {successMessage && (
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded">
          ✓ {successMessage}
        </div>
      )}

      <div className="flex justify-end gap-2">
        <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" className="gap-2">
              <Settings className="h-4 w-4" />
              Settings
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Change Master Deletion Password</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleChangePassword} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Current Password</label>
                <Input
                  type="password"
                  name="currentPassword"
                  value={settingsData.currentPassword}
                  onChange={handleSettingsInputChange}
                  placeholder="Enter current password"
                  disabled={isSettingsSubmitting}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">New Password</label>
                <Input
                  type="password"
                  name="newPassword"
                  value={settingsData.newPassword}
                  onChange={handleSettingsInputChange}
                  placeholder="Enter new password"
                  disabled={isSettingsSubmitting}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Confirm New Password</label>
                <Input
                  type="password"
                  name="confirmPassword"
                  value={settingsData.confirmPassword}
                  onChange={handleSettingsInputChange}
                  placeholder="Confirm new password"
                  disabled={isSettingsSubmitting}
                />
              </div>

              {settingsError && (
                <div className="text-red-500 text-sm">{settingsError}</div>
              )}

              {settingsSuccess && (
                <div className="text-green-500 text-sm">{settingsSuccess}</div>
              )}

              <Button
                type="submit"
                disabled={isSettingsSubmitting}
                className="w-full bg-blue-600 hover:bg-blue-700"
              >
                {isSettingsSubmitting ? "Updating..." : "Update Password"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2 bg-blue-600 hover:bg-blue-700">
              <Plus className="h-4 w-4" />
              Add New Admin
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Admin Account</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleAddAdmin} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Username</label>
                <Input
                  type="text"
                  name="username"
                  value={formData.username}
                  onChange={handleInputChange}
                  placeholder="Enter username"
                  disabled={isSubmitting}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Full Name</label>
                <Input
                  type="text"
                  name="full_name"
                  value={formData.full_name}
                  onChange={handleInputChange}
                  placeholder="Enter full name"
                  disabled={isSubmitting}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Password</label>
                <Input
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  placeholder="Enter password"
                  disabled={isSubmitting}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Confirm Password</label>
                <Input
                  type="password"
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleInputChange}
                  placeholder="Confirm password"
                  disabled={isSubmitting}
                />
              </div>

              {error && (
                <div className="text-red-500 text-sm">{error}</div>
              )}

              {successMessage && (
                <div className="text-green-500 text-sm">{successMessage}</div>
              )}

              <Button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-blue-600 hover:bg-blue-700"
              >
                {isSubmitting ? "Creating..." : "Create Admin"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Admin Accounts ({admins.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {admins.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No admins found</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Username</TableHead>
                    <TableHead>Full Name</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {admins.map((admin) => (
                    <TableRow key={admin.id}>
                      <TableCell className="font-medium">{admin.username}</TableCell>
                      <TableCell>{admin.full_name || "-"}</TableCell>
                      <TableCell>
                        {new Date(admin.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          onClick={() => handleDeleteAdminClick(admin)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Admin Account</AlertDialogTitle>
            <AlertDialogDescription>
              Enter the master deletion password to confirm deletion of admin "{adminToDelete?.username}".
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Input
              type="password"
              placeholder="Enter master deletion password"
              value={deletePassword}
              onChange={(e) => {
                setDeletePassword(e.target.value);
                setDeleteError("");
              }}
              className="mb-2"
            />
            {deleteError && (
              <div className="text-red-500 text-sm">{deleteError}</div>
            )}
          </div>
          <div className="flex justify-end gap-2">
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
