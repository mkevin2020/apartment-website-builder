"use client";

import { useTheme } from "next-themes";
import { useEffect, useRef, useState, useCallback } from "react";
import { dataClient } from "@/lib/data-client";
import { Building2, LogOut, Moon, Sun, Bell, Send, Loader2, MessageSquare } from "lucide-react";
import Link from "next/link";

interface EmployeeHeaderProps {
  employee: any;
  onLogout: () => void;
  chatUnreadCount?: number;
}

interface Msg {
  id: number;
  sender_role: string;
  sender_name: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

export default function EmployeeHeader({ employee, onLogout, chatUnreadCount = 0 }: EmployeeHeaderProps) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [pulse, setPulse] = useState(false);
  const prevCount = useRef(0);

  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [loading, setLoading] = useState(false);
  const [managerId, setManagerId] = useState<number | null>(null);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const supabase = dataClient();

  useEffect(() => setMounted(true), []);

  // Pulse the bell when a new unread message arrives
  useEffect(() => {
    if (chatUnreadCount > prevCount.current) {
      setPulse(true);
      const t = setTimeout(() => setPulse(false), 1500);
      prevCount.current = chatUnreadCount;
      return () => clearTimeout(t);
    }
    prevCount.current = chatUnreadCount;
  }, [chatUnreadCount]);

  // Find the active manager (to reply to)
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("managers")
        .select("id")
        .eq("status", "active")
        .order("id", { ascending: true })
        .limit(1);
      if (data && data[0]) setManagerId(data[0].id);
    })();
  }, []);

  const fetchMessages = useCallback(async () => {
    if (!employee?.id) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/internal-chat?employee_id=${employee.id}`, { cache: "no-store" });
      const data = await res.json();
      setMessages(data.messages || []);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, [employee]);

  const markRead = useCallback(async () => {
    if (!employee?.id) return;
    try {
      await fetch("/api/internal-chat", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employee_id: employee.id, receiver_role: "employee" }),
      });
    } catch {
      /* ignore */
    }
  }, [employee]);

  const togglePanel = async () => {
    const next = !open;
    setOpen(next);
    if (next) {
      await fetchMessages();
      await markRead();
    }
  };

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const sendReply = async () => {
    if (!reply.trim() || sending || !managerId) return;
    setSending(true);
    const text = reply.trim();
    setReply("");
    try {
      await fetch("/api/internal-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sender_role: "employee",
          sender_id: employee.id,
          sender_name: employee.full_name || employee.username,
          receiver_role: "manager",
          receiver_id: managerId,
          employee_id: employee.id,
          message: text,
        }),
      });
      await fetchMessages();
    } catch {
      setReply(text);
    } finally {
      setSending(false);
    }
  };

  const fmt = (ts: string) => new Date(ts).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-950/80 backdrop-blur-md">
      <div className="container mx-auto px-4 py-4 flex flex-col md:flex-row justify-between items-center gap-4">
        <Link href="/employee/dashboard" className="flex items-center gap-2 group">
          <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center group-hover:scale-105 transition-transform">
            <Building2 className="h-5 w-5 text-white" />
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-xl text-slate-900 dark:text-white leading-tight">Cielo Vista</span>
            <span className="text-xs font-semibold tracking-wider text-indigo-600 dark:text-indigo-400 uppercase">Employee Portal</span>
          </div>
        </Link>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-sm font-semibold text-slate-900 dark:text-white">
              {employee?.full_name || employee?.username}
            </p>
            <p className="text-xs font-medium text-indigo-600 dark:text-indigo-400">
              {employee?.position || "Staff"}
            </p>
          </div>
          <div className="flex items-center gap-2 border-l border-slate-200 dark:border-slate-800 pl-4">

            {/* Team Chat — message the manager or any colleague */}
            <Link
              href="/employee/chat"
              className="p-2 rounded-full text-slate-600 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400 transition-colors hover:bg-slate-100 dark:hover:bg-slate-800"
              title="Team Chat — message the manager or a colleague"
              aria-label="Team Chat"
            >
              <MessageSquare className="w-5 h-5" />
            </Link>

            {/* Notification Bell + dropdown */}
            <div className="relative" ref={panelRef}>
              <button
                onClick={togglePanel}
                className={`p-2 rounded-full transition-colors ${
                  chatUnreadCount > 0
                    ? "text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30"
                    : "text-slate-600 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                }`}
                aria-label={`${chatUnreadCount} unread messages`}
                title={chatUnreadCount > 0 ? `${chatUnreadCount} unread message(s) from manager` : "Notifications"}
              >
                <Bell className={`w-5 h-5 ${pulse ? "animate-bounce" : ""}`} />
              </button>

              {chatUnreadCount > 0 && (
                <>
                  <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-red-500 opacity-75 animate-ping" />
                  <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-red-500 flex items-center justify-center">
                    <span className="text-white font-bold leading-none" style={{ fontSize: "9px" }}>
                      {chatUnreadCount > 9 ? "9+" : chatUnreadCount}
                    </span>
                  </span>
                </>
              )}

              {open && (
                <div className="absolute right-0 mt-2 w-80 max-w-[90vw] rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden z-50">
                  <div className="px-4 py-3 bg-gradient-to-r from-indigo-600 to-blue-600 text-white flex items-center gap-2">
                    <MessageSquare className="h-4 w-4" />
                    <span className="font-semibold text-sm">Messages from Manager</span>
                  </div>

                  <div className="max-h-72 overflow-y-auto p-3 space-y-2 bg-slate-50 dark:bg-slate-900/50">
                    {loading ? (
                      <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-indigo-500" /></div>
                    ) : messages.length === 0 ? (
                      <p className="text-center text-sm text-slate-400 py-6">No messages yet.</p>
                    ) : (
                      messages.map((m) => {
                        const fromEmp = m.sender_role === "employee";
                        return (
                          <div key={m.id} className={`flex ${fromEmp ? "justify-end" : "justify-start"}`}>
                            <div className={`max-w-[80%] px-3 py-2 rounded-2xl text-sm ${
                              fromEmp
                                ? "bg-indigo-600 text-white rounded-br-sm"
                                : "bg-white dark:bg-slate-800 text-slate-800 dark:text-white border border-slate-100 dark:border-slate-700 rounded-bl-sm"
                            }`}>
                              {!fromEmp && <p className="text-[10px] text-slate-400 mb-0.5">{m.sender_name}</p>}
                              <p>{m.message}</p>
                              <p className={`text-[10px] mt-1 ${fromEmp ? "text-indigo-100" : "text-slate-400"}`}>{fmt(m.created_at)}</p>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  <div className="p-2 border-t border-slate-200 dark:border-slate-700 flex gap-2">
                    <input
                      value={reply}
                      onChange={(e) => setReply(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") sendReply(); }}
                      placeholder={managerId ? "Reply to manager…" : "No manager available"}
                      disabled={!managerId || sending}
                      className="flex-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white"
                    />
                    <button
                      onClick={sendReply}
                      disabled={!reply.trim() || sending || !managerId}
                      className="rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white px-3 flex items-center justify-center disabled:opacity-50"
                    >
                      {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Dark Mode Toggle */}
            <button
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="p-2 text-slate-600 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400 transition-colors rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"
              aria-label="Toggle theme"
            >
              {mounted && (theme === "dark" ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />)}
            </button>

            {/* Logout */}
            <button
              onClick={onLogout}
              className="p-2 text-slate-600 hover:text-red-600 dark:text-slate-400 dark:hover:text-red-400 transition-colors rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"
              aria-label="Logout"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
