"use client";

import { useEffect, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Pencil, Trash2, Plus, Search } from "lucide-react";

export function EmployeesManager() {
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<any>(null);
  const [formData, setFormData] = useState({
    username: "",
    password: "",
    full_name: "",
    email: "",
    phone: "",
    position: "",
    department: "",
    hire_date: "",
    status: "active",
  });

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    fetchEmployees();
  }, []);

  const fetchEmployees = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("employees")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching employees:", error);
      } else {
        setEmployees(data || []);
      }
    } catch (err) {
      console.error("Error:", err);
    }
    setLoading(false);
  };

  const handleOpenDialog = (employee?: any) => {
    if (employee) {
      setSelectedEmployee(employee);
      setFormData({
        username: employee.username,
        password: employee.password,
        full_name: employee.full_name,
        email: employee.email || "",
        phone: employee.phone || "",
        position: employee.position || "",
        department: employee.department || "",
        hire_date: employee.hire_date || "",
        status: employee.status || "active",
      });
    } else {
      setSelectedEmployee(null);
      setFormData({
        username: "",
        password: "",
        full_name: "",
        email: "",
        phone: "",
        position: "",
        department: "",
        hire_date: "",
        status: "active",
      });
    }
    setIsDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!formData.username || !formData.full_name) {
      alert("Please fill in required fields");
      return;
    }

    try {
      if (selectedEmployee) {
        // Update employee
        const { error } = await supabase
          .from("employees")
          .update({
            ...formData,
            updated_at: new Date().toISOString(),
          })
          .eq("id", selectedEmployee.id);

        if (error) {
          alert("Error updating employee: " + error.message);
          return;
        }
      } else {
        // Add new employee
        const { error } = await supabase.from("employees").insert([formData]);

        if (error) {
          alert("Error adding employee: " + error.message);
          return;
        }
      }

      setIsDialogOpen(false);
      await fetchEmployees();
    } catch (err) {
      alert("An error occurred");
    }
  };

  const handleDelete = async () => {
    try {
      const { error } = await supabase
        .from("employees")
        .delete()
        .eq("id", selectedEmployee.id);

      if (error) {
        alert("Error deleting employee: " + error.message);
        return;
      }

      setIsDeleteDialogOpen(false);
      await fetchEmployees();
    } catch (err) {
      alert("An error occurred");
    }
  };

  const filteredEmployees = employees.filter((emp) =>
    `${emp.full_name} ${emp.username} ${emp.email || ""}`
      .toLowerCase()
      .includes(searchTerm.toLowerCase())
  );

  const departments = ["IT", "Maintenance", "Security", "Administration", "Cleaning"];
  const positions = ["Manager", "Supervisor", "Technician", "Staff", "Intern"];
  const statuses = ["active", "inactive", "on-leave"];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Employees Management</h2>
        <Button onClick={() => handleOpenDialog()} className="flex items-center gap-2">
          <Plus className="h-4 w-4" />
          Add Employee
        </Button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
        <Input
          placeholder="Search by name, username, or email..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Employees Table */}
      <Card>
        <CardContent className="pt-6">
          {loading ? (
            <div className="text-center py-8">Loading employees...</div>
          ) : filteredEmployees.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No employees found
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="text-left py-3 px-4 font-semibold text-sm">
                      Name
                    </th>
                    <th className="text-left py-3 px-4 font-semibold text-sm">
                      Username
                    </th>
                    <th className="text-left py-3 px-4 font-semibold text-sm">
                      Password
                    </th>
                    <th className="text-left py-3 px-4 font-semibold text-sm">
                      Email
                    </th>
                    <th className="text-left py-3 px-4 font-semibold text-sm">
                      Position
                    </th>
                    <th className="text-left py-3 px-4 font-semibold text-sm">
                      Department
                    </th>
                    <th className="text-left py-3 px-4 font-semibold text-sm">
                      Status
                    </th>
                    <th className="text-right py-3 px-4 font-semibold text-sm">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEmployees.map((employee) => (
                    <tr key={employee.id} className="border-b hover:bg-gray-50">
                      <td className="py-3 px-4 font-medium">{employee.full_name}</td>
                      <td className="py-3 px-4 text-sm text-gray-600">
                        {employee.username}
                      </td>
                      <td className="py-3 px-4 text-sm font-mono bg-gray-100 px-2 py-1 rounded max-w-xs">
                        {employee.password || "-"}
                      </td>
                      <td className="py-3 px-4 text-sm">{employee.email || "-"}</td>
                      <td className="py-3 px-4 text-sm">
                        {employee.position || "-"}
                      </td>
                      <td className="py-3 px-4 text-sm">
                        {employee.department || "-"}
                      </td>
                      <td className="py-3 px-4 text-sm">
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-semibold ${
                            employee.status === "active"
                              ? "bg-green-100 text-green-800"
                              : employee.status === "on-leave"
                              ? "bg-yellow-100 text-yellow-800"
                              : "bg-red-100 text-red-800"
                          }`}
                        >
                          {employee.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenDialog(employee)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => {
                            setSelectedEmployee(employee);
                            setIsDeleteDialogOpen(true);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedEmployee ? "Edit Employee" : "Add New Employee"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  Username *
                </label>
                <Input
                  value={formData.username}
                  onChange={(e) =>
                    setFormData({ ...formData, username: e.target.value })
                  }
                  placeholder="Username"
                  disabled={!!selectedEmployee}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">
                  Password {selectedEmployee && "(leave blank to keep current)"}
                </label>
                <Input
                  type="password"
                  value={formData.password}
                  onChange={(e) =>
                    setFormData({ ...formData, password: e.target.value })
                  }
                  placeholder="Password"
                  required={!selectedEmployee}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Full Name *
              </label>
              <Input
                value={formData.full_name}
                onChange={(e) =>
                  setFormData({ ...formData, full_name: e.target.value })
                }
                placeholder="Full name"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Email</label>
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                  placeholder="Email"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Phone</label>
                <Input
                  value={formData.phone}
                  onChange={(e) =>
                    setFormData({ ...formData, phone: e.target.value })
                  }
                  placeholder="Phone number"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  Position
                </label>
                <Select
                  value={formData.position}
                  onValueChange={(value) =>
                    setFormData({ ...formData, position: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select position" />
                  </SelectTrigger>
                  <SelectContent>
                    {positions.map((pos) => (
                      <SelectItem key={pos} value={pos}>
                        {pos}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">
                  Department
                </label>
                <Select
                  value={formData.department}
                  onValueChange={(value) =>
                    setFormData({ ...formData, department: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select department" />
                  </SelectTrigger>
                  <SelectContent>
                    {departments.map((dept) => (
                      <SelectItem key={dept} value={dept}>
                        {dept}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  Hire Date
                </label>
                <Input
                  type="date"
                  value={formData.hire_date}
                  onChange={(e) =>
                    setFormData({ ...formData, hire_date: e.target.value })
                  }
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Status</label>
                <Select
                  value={formData.status}
                  onValueChange={(value) =>
                    setFormData({ ...formData, status: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {statuses.map((status) => (
                      <SelectItem key={status} value={status}>
                        {status.charAt(0).toUpperCase() +
                          status.slice(1).replace("-", " ")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit}>
              {selectedEmployee ? "Update" : "Add"} Employee
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogTitle>Delete Employee</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete {selectedEmployee?.full_name}? This
            action cannot be undone.
          </AlertDialogDescription>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
