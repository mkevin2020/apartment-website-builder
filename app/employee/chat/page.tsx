"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import EmployeeHeader from "@/components/ui/employee/EmployeeHeader";
import { TeamChat } from "@/components/TeamChat";
import { SessionGuard, logout as doLogout } from "@/components/auth/session-guard";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

// Team chat page — any employee can message the manager or a specific
// colleague, mirroring the manager's Team Chat.
export default function EmployeeChatPage() {
  const router = useRouter();
  const [employee, setEmployee] = useState<any>(null);

  useEffect(() => {
    const raw = localStorage.getItem("employee_session");
    if (!raw) {
      router.replace("/login");
      return;
    }
    try {
      setEmployee(JSON.parse(raw));
    } catch {
      router.replace("/login");
    }
  }, [router]);

  const logout = () => {
    void doLogout("/employee/login");
  };

  if (!employee) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 font-sans pb-12">
      <SessionGuard sessionKey="employee_session" />
      <EmployeeHeader employee={employee} onLogout={logout} />
      <main className="container mx-auto px-4 py-8 max-w-5xl">
        <Link
          href="/employee/dashboard"
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-indigo-600 mb-4"
        >
          <ArrowLeft className="h-4 w-4" /> Back to my dashboard
        </Link>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-1">Team Chat</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
          Chat with your team — the manager or any colleague.
        </p>
        <TeamChat
          employeeId={Number(employee.id)}
          employeeName={employee.full_name || employee.username}
        />
      </main>
    </div>
  );
}
