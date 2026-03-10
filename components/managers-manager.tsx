"use client";

import { useState, useEffect } from "react";
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
import { createBrowserClient } from "@supabase/ssr";
import { Plus, Edit2, Trash2, AlertCircle, CheckCircle } from "lucide-react";

interface Manager {
  id: number;
  username: string;
  password: string;
  email: string;
  full_name: string;
  phone: string;
  department: string;
  status: string;
  created_at: string;
  [key: string]: any;
}

export function ManagersManager() {
  const [managers, setManagers] = useState<Manager[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [openDialog, setOpenDialog] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState({
    username: "",
    password: "",
    email: "",
    full_name: "",
    phone: "",
    department: "",
  });

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
  );

  // Fetch managers
  useEffect(() => {
    fetchManagers();
  }, []);

  const fetchManagers = async () => {
    try {
      const { data, error: queryError } = await supabase
        .from("managers")
        .select("*")
        .order("created_at", { ascending: false });

      if (queryError) throw queryError;
      setManagers(data || []);
    } catch (err: any) {
      setError(err.message || "Failed to fetch managers");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    try {
      if (!formData.username || !formData.password || !formData.email || !formData.full_name) {
        setError("Please fill in all required fields");
        setLoading(false);
        return;
      }

      if (editingId) {
        // Update existing manager
        const { error: updateError } = await supabase
          .from("managers")
          .update({
            username: formData.username,
            password: formData.password,
            email: formData.email,
            full_name: formData.full_name,
            phone: formData.phone,
            department: formData.department,
            updated_at: new Date().toISOString(),
          })
          .eq("id", editingId);

        if (updateError) throw updateError;
        setSuccess("Manager updated successfully!");
      } else {
        // Create new manager
        const { error: insertError } = await supabase
          .from("managers")
          .insert({
            username: formData.username,
            password: formData.password,
            email: formData.email,
            full_name: formData.full_name,
            phone: formData.phone,
            department: formData.department,
            status: "active",
          });

        if (insertError) throw insertError;
        setSuccess("Manager created successfully!");
      }

      setFormData({
        username: "",
        password: "",
        email: "",
        full_name: "",
        phone: "",
        department: "",
      });
      setEditingId(null);
      setOpenDialog(false);
      fetchManagers();
    } catch (err: any) {
      setError(err.message || "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (manager: Manager) => {
    setFormData({
      username: manager.username,
      password: manager.password,
      email: manager.email,
      full_name: manager.full_name,
      phone: manager.phone,
      department: manager.department,
    });
    setEditingId(manager.id);
    setOpenDialog(true);
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm("Are you sure you want to delete this manager?")) return;

    try {
      const { error: deleteError } = await supabase
        .from("managers")
        .delete()
        .eq("id", id);

      if (deleteError) throw deleteError;
      setSuccess("Manager deleted successfully!");
      fetchManagers();
    } catch (err: any) {
      setError(err.message || "Failed to delete manager");
    }
  };

  const handleToggleStatus = async (manager: Manager) => {
    const newStatus = manager.status === "active" ? "inactive" : "active";
    try {
      const { error: updateError } = await supabase
        .from("managers")
        .update({ status: newStatus })
        .eq("id", manager.id);

      if (updateError) throw updateError;
      setSuccess(`Manager status changed to ${newStatus}!`);
      fetchManagers();
    } catch (err: any) {
      setError(err.message || "Failed to update status");
    }
  };

  const handleCloseDialog = () => {
    setEditingId(null);
    setFormData({
      username: "",
      password: "",
      email: "",
      full_name: "",
      phone: "",
      department: "",
    });
    setOpenDialog(false);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Managers Management</CardTitle>
        <Dialog open={openDialog} onOpenChange={setOpenDialog}>
          <DialogTrigger asChild>
            <Button
              onClick={() => {
                setEditingId(null);
                setFormData({
                  username: "",
                  password: "",
                  email: "",
                  full_name: "",
                  phone: "",
                  department: "",
                });
              }}
              className="flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              Add Manager
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingId ? "Edit Manager" : "Create New Manager"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Username*</label>
                <Input
                  type="text"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  placeholder="Enter username"
                  disabled={loading}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Password*</label>
                <Input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder="Enter password"
                  disabled={loading}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Email*</label>
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="Enter email"
                  disabled={loading}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Full Name*</label>
                <Input
                  type="text"
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  placeholder="Enter full name"
                  disabled={loading}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Phone</label>
                <Input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="Enter phone number"
                  disabled={loading}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Department</label>
                <Input
                  type="text"
                  value={formData.department}
                  onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                  placeholder="Enter department"
                  disabled={loading}
                />
              </div>

              {error && (
                <div className="flex gap-2 p-3 bg-red-50 border border-red-200 rounded">
                  <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0" />
                  <p className="text-red-700 text-sm">{error}</p>
                </div>
              )}

              <div className="flex gap-2 pt-4">
                <Button type="submit" disabled={loading} className="flex-1">
                  {loading ? "Saving..." : editingId ? "Update Manager" : "Create Manager"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCloseDialog}
                  disabled={loading}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>

      <CardContent>
        {success && (
          <div className="mb-4 flex gap-2 p-3 bg-green-50 border border-green-200 rounded">
            <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0" />
            <p className="text-green-700 text-sm">{success}</p>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b">
              <tr>
                <th className="text-left p-3 font-medium">Username</th>
                <th className="text-left p-3 font-medium">Full Name</th>
                <th className="text-left p-3 font-medium">Email</th>
                <th className="text-left p-3 font-medium">Department</th>
                <th className="text-left p-3 font-medium">Status</th>
                <th className="text-left p-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {managers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-slate-600">
                    No managers found
                  </td>
                </tr>
              ) : (
                managers.map((manager) => (
                  <tr key={manager.id} className="border-b hover:bg-slate-50">
                    <td className="p-3 font-medium">{manager.username}</td>
                    <td className="p-3">{manager.full_name}</td>
                    <td className="p-3">{manager.email}</td>
                    <td className="p-3">{manager.department}</td>
                    <td className="p-3">
                      <button
                        onClick={() => handleToggleStatus(manager)}
                        className={`inline-block px-3 py-1 rounded-full text-xs font-medium cursor-pointer ${
                          manager.status === "active"
                            ? "bg-green-100 text-green-800 hover:bg-green-200"
                            : "bg-red-100 text-red-800 hover:bg-red-200"
                        }`}
                      >
                        {manager.status}
                      </button>
                    </td>
                    <td className="p-3">
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleEdit(manager)}
                        >
                          <Edit2 className="h-3 w-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleDelete(manager.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
