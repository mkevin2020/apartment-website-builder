"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { dashboardPathFor } from "@/lib/employee-departments";
import { SessionGuard } from "@/components/auth/session-guard";

// Dispatcher: sends a logged-in employee to their own department's dashboard.
// (Each department now has its own dashboard under /employee/<department>.)
export default function EmployeeDashboardRedirect() {
  const router = useRouter();

  useEffect(() => {
    const raw = localStorage.getItem("employee_session");
    if (!raw) {
      router.replace("/login");
      return;
    }
    try {
      const emp = JSON.parse(raw);
      router.replace(dashboardPathFor(emp.department));
    } catch {
      router.replace("/login");
    }
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900">
      <SessionGuard sessionKey="employee_session" redirectTo="/employee/login" />
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600" />
    </div>
  );
}
