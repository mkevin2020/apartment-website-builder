"use client";

import { ReactNode, useState } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Menu, ChevronRight } from "lucide-react";

export type NavItem = { id: string; label: string; icon: any };
export type NavGroup = { group: string; items: NavItem[] };
export type MenuAction = { label: string; icon: any; onClick: () => void; danger?: boolean; hideOnDesktop?: boolean };

interface DashboardShellProps {
  brandTitle: string;
  brandSubtitle: string;
  brandLetter?: string;
  nav: NavGroup[];
  active: string;
  onNavigate: (id: string) => void;
  user: { name: string; role?: string };
  breadcrumb?: string;
  actions?: ReactNode;
  menuItems?: MenuAction[];
  children: ReactNode;
}

/**
 * Shared professional dashboard chrome: fixed left sidebar (grouped nav),
 * sticky top bar with breadcrumb + actions + profile menu, and a mobile drawer.
 * Used by the admin, manager, employee and tenant dashboards for one consistent look.
 */
export function DashboardShell({
  brandTitle,
  brandSubtitle,
  brandLetter = "C",
  nav,
  active,
  onNavigate,
  user,
  breadcrumb,
  actions,
  menuItems = [],
  children,
}: DashboardShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const allItems = nav.flatMap((g) => g.items);
  const activeItem = allItems.find((i) => i.id === active);
  const initials = (user.name || "U").slice(0, 2).toUpperCase();

  const go = (id: string) => {
    onNavigate(id);
    setMobileOpen(false);
  };

  const SidebarNav = () => (
    <nav className="flex flex-col gap-6 px-3 py-4">
      {nav.map((group) => (
        <div key={group.group}>
          <p className="px-3 mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            {group.group}
          </p>
          <div className="space-y-0.5">
            {group.items.map((item) => {
              const Icon = item.icon;
              const isActive = active === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => go(item.id)}
                  className={`w-full flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-blue-600 text-white shadow-sm"
                      : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );

  const Brand = () => (
    <div className="flex items-center gap-2.5 px-5 h-16 border-b border-slate-200 dark:border-slate-800">
      <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white font-bold shadow-lg shadow-blue-600/20">
        {brandLetter}
      </div>
      <div className="leading-tight">
        <p className="font-bold text-slate-900 dark:text-white">{brandTitle}</p>
        <p className="text-[11px] text-slate-400">{brandSubtitle}</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 font-sans">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex fixed inset-y-0 left-0 w-64 flex-col bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 z-40">
        <Brand />
        <div className="flex-1 overflow-y-auto">
          <SidebarNav />
        </div>
      </aside>

      <div className="lg:pl-64">
        {/* Top bar */}
        <header className="sticky top-0 z-30 h-16 bg-white/80 dark:bg-slate-900/80 backdrop-blur border-b border-slate-200 dark:border-slate-800 flex items-center gap-3 px-4 sm:px-6">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="lg:hidden">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0 w-64">
              <SheetTitle className="sr-only">Navigation</SheetTitle>
              <Brand />
              <SidebarNav />
            </SheetContent>
          </Sheet>

          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              <span>{breadcrumb || brandTitle}</span>
              <ChevronRight className="h-3 w-3" />
              <span className="text-slate-600 dark:text-slate-300 font-medium">{activeItem?.label}</span>
            </div>
            <h1 className="text-lg font-bold text-slate-900 dark:text-white truncate">{activeItem?.label}</h1>
          </div>

          <div className="ml-auto flex items-center gap-2">
            {actions}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 rounded-full pl-1 pr-3 py-1 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                  <span className="h-8 w-8 rounded-full bg-blue-600 text-white text-sm font-semibold flex items-center justify-center">
                    {initials}
                  </span>
                  <span className="hidden sm:block text-sm font-medium text-slate-700 dark:text-slate-200 max-w-[140px] truncate">
                    {user.name}
                  </span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuLabel>
                  <div className="font-medium">{user.name}</div>
                  {user.role && <div className="text-xs text-slate-400 font-normal">{user.role}</div>}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {menuItems.map((m, i) => {
                  const Icon = m.icon;
                  return (
                    <DropdownMenuItem
                      key={i}
                      onClick={m.onClick}
                      className={`${m.danger ? "text-red-600 focus:text-red-600" : ""} ${m.hideOnDesktop ? "sm:hidden" : ""}`}
                    >
                      <Icon className="h-4 w-4 mr-2" /> {m.label}
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main className="p-4 sm:p-6 max-w-[1400px]">{children}</main>
      </div>
    </div>
  );
}
