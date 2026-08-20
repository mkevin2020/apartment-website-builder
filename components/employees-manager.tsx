"use client";

import { useEffect, useState } from "react";
import { dataClient } from "@/lib/data-client";
import bcrypt from "bcryptjs";
import { sanitizePhone } from "@/lib/utils";
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

export const WEEKDAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;

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
    day_off: "Sunday",
  });

  const supabase = dataClient();

  useEffect(() => {
    fetchEmployees();
  }, []);

  const fetchEmployees = async () => {
    setLoading(true);
    try {
      // Include each employee's weekly schedule so we can show their day off.
      let { data, error } = await supabase
        .from("employees")
        .select("*, employee_schedules(weekday, is_off)")
        .order("created_at", { ascending: false });

      if (error) {
        // employee_schedules table not created yet (scripts/027 not run) —
        // fall back to a plain list so the page keeps working.
        ({ data, error } = await supabase
          .from("employees")
          .select("*")
          .order("created_at", { ascending: false }));
      }

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

  // The employee's day off = the weekday marked is_off in their schedule.
  const getDayOff = (employee: any): string | null => {
    const off = (employee?.employee_schedules || []).find((s: any) => s.is_off);
    return off?.weekday || null;
  };

  const handleOpenDialog = (employee?: any) => {
    if (employee) {
      setSelectedEmployee(employee);
      setFormData({
        username: employee.username,
        password: "", // leave blank — only set a new password if the admin types one
        full_name: employee.full_name,
        email: employee.email || "",
        phone: employee.phone || "",
        position: employee.position || "",
        department: employee.department || "",
        hire_date: employee.hire_date || "",
        status: employee.status || "active",
        day_off: getDayOff(employee) || "Sunday",
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
        day_off: "Sunday",
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
      // day_off is stored in employee_schedules, not on the employees row.
      const { day_off, ...employeeFields } = formData;

      if (selectedEmployee) {
        // Update employee (only change the password if a new one was entered)
        const updatePayload: any = {
          ...employeeFields,
          updated_at: new Date().toISOString(),
        };
        if (formData.password) {
          updatePayload.password = await bcrypt.hash(formData.password, 10);
        } else {
          delete updatePayload.password; // keep existing password
        }

        const { error } = await supabase
          .from("employees")
          .update(updatePayload)
          .eq("id", selectedEmployee.id);

        if (error) {
          // Renaming an employee onto a username someone else already holds.
          if (error.code === "23505" || /duplicate key/i.test(error.message || "")) {
            alert(
              `The username "${formData.username}" is already taken by another employee.\n\n` +
                `Please choose a different username.`
            );
            return;
          }
          alert("Error updating employee: " + error.message);
          return;
        }

        await saveDayOff(selectedEmployee.id, day_off);
      } else {
        // Add new employee (hashed password)
        const { data: created, error } = await supabase
          .from("employees")
          .insert([{ ...employeeFields, password: await bcrypt.hash(formData.password, 10) }])
          .select("id")
          .single();

        if (error) {
          // 23505 = unique violation. Usernames must be unique because employees
          // log in with them, so say that plainly instead of leaking the raw
          // Postgres constraint text.
          if (error.code === "23505" || /duplicate key/i.test(error.message || "")) {
            alert(
              `The username "${formData.username}" is already taken by another employee.\n\n` +
                `Please choose a different username.`
            );
            return;
          }
          alert("Error adding employee: " + error.message);
          return;
        }

        // Create the full default week (08:00–17:00) with the chosen day off.
        if (created?.id) {
          const week = WEEKDAYS.map((weekday) => ({
            employee_id: created.id,
            weekday,
            is_off: weekday === day_off,
          }));
          const { error: scheduleError } = await supabase
            .from("employee_schedules")
            .upsert(week, { onConflict: "employee_id,weekday" });
          if (scheduleError) {
            // Employee was created; schedule table may be missing (scripts/027).
            console.error("Error creating schedule:", scheduleError);
            alert(
              "Employee created, but the work schedule could not be saved. " +
                "Make sure scripts/027-employee-schedules.sql has been run in Supabase."
            );
          }
        }
      }

      setIsDialogOpen(false);
      await fetchEmployees();
    } catch (err) {
      alert("An error occurred");
    }
  };

  // Move the is_off flag to the chosen weekday, keeping any custom hours the
  // manager already set on the other days.
  const saveDayOff = async (employeeId: number, dayOff: string) => {
    const rows = WEEKDAYS.map((weekday) => ({
      employee_id: employeeId,
      weekday,
      is_off: weekday === dayOff,
    }));
    const { error } = await supabase
      .from("employee_schedules")
      .upsert(rows, { onConflict: "employee_id,weekday" });
    if (error) {
      console.error("Error saving day off:", error);
      alert(
        "Employee saved, but the day off could not be updated. " +
          "Make sure scripts/027-employee-schedules.sql has been run in Supabase."
      );
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

  const departments = ["IT", "Maintenance", "Security", "Administration", "Cleaning", "Reception"];
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
                    <th className="text-left py-3 px-4 font-semibold text-sm">
                      Day Off
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
                        ••••••••
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
                      <td className="py-3 px-4 text-sm">
                        {getDayOff(employee) ? (
                          <span className="px-2 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-800">
                            {getDayOff(employee)}
                          </span>
                        ) : (
                          "-"
                        )}
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
                  type="tel"
                  inputMode="tel"
                  value={formData.phone}
                  onChange={(e) =>
                    setFormData({ ...formData, phone: sanitizePhone(e.target.value) })
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

            <div>
              <label className="block text-sm font-medium mb-2">
                Day Off *
              </label>
              <Select
                value={formData.day_off}
                onValueChange={(value) =>
                  setFormData({ ...formData, day_off: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select the weekly day off" />
                </SelectTrigger>
                <SelectContent>
                  {WEEKDAYS.map((day) => (
                    <SelectItem key={day} value={day}>
                      {day}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500 mt-1">
                The weekly rest day. Working hours per day are set by the
                manager in the Work Schedule.
              </p>
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
