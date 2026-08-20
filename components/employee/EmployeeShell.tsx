"use client";

import { useEffect, useState, useCallback, ReactNode } from "react";
import { useRouter } from "next/navigation";
import EmployeeHeader from "@/components/ui/employee/EmployeeHeader";
import { EmployeeClockIn } from "@/components/employee/employee-clock-in";
import { ChangePasswordModal } from "@/components/change-password-modal";
import { Button } from "@/components/ui/button";
import { Key } from "lucide-react";
import { DEPARTMENTS, DepartmentSlug, departmentToSlug } from "@/lib/employee-departments";
import { SessionGuard, logout } from "@/components/auth/session-guard";
import { EmployeeScheduleManager } from "@/components/employee-schedule-manager";

const accentMap: Record<string, string> = {
  violet: "from-violet-600 to-purple-600",
  amber: "from-amber-500 to-orange-500",
  blue: "from-blue-600 to-indigo-600",
  emerald: "from-emerald-600 to-green-600",
  cyan: "from-cyan-600 to-teal-600",
};

interface EmployeeShellProps {
  slug: DepartmentSlug;
  children: (employee: any) => ReactNode;
}

/**
 * Shared employee dashboard shell: handles auth, the header, the department banner,
 * and locks each employee to their own department's dashboard.
 */
export function EmployeeShell({ slug, children }: EmployeeShellProps) {
  const router = useRouter();
  const [employee, setEmployee] = useState<any>(null);
  const [ready, setReady] = useState(false);
  const [chatUnread, setChatUnread] = useState(0);
  const [pwOpen, setPwOpen] = useState(false);

  const cfg = DEPARTMENTS[slug];

  useEffect(() => {
    const raw = localStorage.getItem("employee_session");
    if (!raw) {
      router.push("/login");
      return;
    }
    let emp: any;
    try {
      emp = JSON.parse(raw);
    } catch {
      router.push("/login");
      return;
    }

    // Lock the employee to their own department dashboard
    const ownSlug = departmentToSlug(emp.department);
    if (ownSlug !== slug) {
      router.replace(`/employee/${ownSlug}`);
      return;
    }

    setEmployee(emp);
    setReady(true);
    // Attendance clock-in is handled by <EmployeeClockIn> (it also shows the status).
  }, [router, slug]);

  // Poll unread team-chat messages — from the manager AND from colleagues.
  const fetchUnread = useCallback(async (employeeId: number) => {
    try {
      const res = await fetch(`/api/internal-chat?unread_for=${employeeId}`, { cache: "no-store" });
      const data = await res.json();
      setChatUnread(Number(data.count) || 0);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (!employee?.id) return;
    fetchUnread(employee.id);
    const t = setInterval(() => fetchUnread(employee.id), 5000);
    return () => clearInterval(t);
  }, [employee, fetchUnread]);

  const handleLogout = async () => {
    // Record clock-out before clearing the session (await it, otherwise the
    // logout below can tear the cookie down before the request is authorised).
    if (employee?.id) {
      try {
        await fetch("/api/attendance/clock", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "out" }),
        });
      } catch {
        // Never block sign-out on the clock-out call.
      }
    }
    await logout("/employee/login");
  };

  if (!ready || !employee) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 transition-colors font-sans pb-12">
      {/* Kicks back to login if the session is gone — also after bfcache restore */}
      <SessionGuard sessionKey="employee_session" />
      <EmployeeHeader employee={employee} onLogout={handleLogout} chatUnreadCount={chatUnread} />

      <main className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Department banner */}
        <div className={`relative overflow-hidden rounded-3xl bg-gradient-to-br ${accentMap[cfg.accent] || accentMap.blue} text-white p-6 md:p-8 mb-8 shadow-xl flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4`}>
          {/* decorative 3D-ish glow orbs */}
          <div className="pointer-events-none absolute -top-16 -right-10 h-48 w-48 rounded-full bg-white/10 blur-2xl" />
          <div className="pointer-events-none absolute -bottom-20 left-1/3 h-40 w-40 rounded-full bg-black/10 blur-2xl" />
          <div className="relative">
            <p className="text-white/80 text-sm font-medium uppercase tracking-wider mb-1">
              {employee.position || "Staff"} · {cfg.name}
            </p>
            <h1 className="text-2xl md:text-3xl font-extrabold drop-shadow-sm">{cfg.title}</h1>
            <p className="text-white/90 mt-1">{cfg.subtitle}</p>
            <p className="text-white/80 text-sm mt-3">Welcome, {employee.full_name || employee.username}</p>
          </div>
          <Button
            onClick={() => setPwOpen(true)}
            variant="secondary"
            size="sm"
            className="relative shrink-0 gap-2 bg-white/20 hover:bg-white/30 text-white border-0 backdrop-blur-sm"
          >
            <Key className="h-4 w-4" />
            Change Password
          </Button>
        </div>

        <EmployeeClockIn employee={employee} />

        {children(employee)}

        {/* Every employee sees the whole team's weekly roster with their own row
            highlighted, but read-only — only the manager can change it, from
            Manager → Operations → Work Schedule. */}
        <div className="mt-8">
          <EmployeeScheduleManager readOnly highlightEmployeeId={employee.id} />
        </div>
      </main>

      <ChangePasswordModal
        isOpen={pwOpen}
        onClose={() => setPwOpen(false)}
        table="employees"
        userId={String(employee.id)}
      />
    </div>
  );
}
