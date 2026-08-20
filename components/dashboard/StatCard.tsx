"use client";

import { TiltCard } from "./TiltCard";

interface StatCardProps {
  label: string;
  value: string | number;
  icon: any;
  tint?: string; // e.g. "bg-blue-50 text-blue-600"
  onClick?: () => void;
  hint?: string;
}

// A 3D-tilting stat card used across the dashboard overviews.
export function StatCard({ label, value, icon: Icon, tint = "bg-blue-50 text-blue-600", onClick, hint }: StatCardProps) {
  return (
    <TiltCard
      onClick={onClick}
      className={`bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm hover:shadow-xl ${
        onClick ? "cursor-pointer" : ""
      }`}
    >
      <div className="flex items-center justify-between">
        <div className={`h-11 w-11 rounded-xl flex items-center justify-center ${tint} dark:bg-opacity-20`}>
          <Icon className="h-5 w-5" />
        </div>
        {hint && <span className="text-[11px] font-medium text-slate-400">{hint}</span>}
      </div>
      <p className="mt-4 text-2xl font-bold text-slate-900 dark:text-white truncate">{value}</p>
      <p className="text-sm text-slate-500 dark:text-slate-400">{label}</p>
    </TiltCard>
  );
}
