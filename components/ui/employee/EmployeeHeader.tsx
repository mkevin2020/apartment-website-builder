"use client";

import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";

interface EmployeeHeaderProps {
  employee: any;
  onLogout: () => void;
}

export default function EmployeeHeader({ employee, onLogout }: EmployeeHeaderProps) {
  return (
    <header className="bg-white border-b border-gray-200 shadow-sm">
      <div className="container mx-auto px-4 py-4 flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Cielo Vista</h2>
          <p className="text-sm text-gray-500">Employee Portal</p>
        </div>
        <div className="text-right">
          <p className="text-sm font-medium text-gray-700">
            {employee.full_name || employee.username}
          </p>
          <p className="text-xs text-gray-500">
            {employee.position || "Employee"}
          </p>
        </div>
      </div>
    </header>
  );
}