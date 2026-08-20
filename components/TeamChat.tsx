"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { dataClient } from "@/lib/data-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MessageSquare, Send, Loader2, Crown, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { VoiceRecorderButton, VoiceNotePlayer, isVoiceMessage, VOICE_PREFIX } from "@/components/chat-voice";

interface Message {
  id: number;
  sender_role: string;
  sender_id: number;
  sender_name: string;
  receiver_role: string;
  receiver_id: number;
  message: string;
  is_read: boolean;
  created_at: string;
}

interface Contact {
  key: string; // "manager:1" | "employee:7"
  role: "manager" | "employee";
  id: number;
  name: string;
  subtitle: string;
}

// Team chat for employees: talk to the manager or to any specific colleague,
// exactly like the manager's Team Chat. Left pane = contacts with unread
// badges; right pane = the selected conversation (polled every 3 s).
export function TeamChat({
  employeeId,
  employeeName,
}: {
  employeeId: number;
  employeeName: string;
}) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selected, setSelected] = useState<Contact | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [unread, setUnread] = useState<Record<string, number>>({});
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const prevCountRef = useRef(0);
  const selectedRef = useRef<Contact | null>(null);
  selectedRef.current = selected;

  const supabase = dataClient();

  // Load contacts: the active manager first, then all active colleagues.
  useEffect(() => {
    (async () => {
      const list: Contact[] = [];
      const { data: mgrs } = await supabase
        .from("managers")
        .select("id, full_name, status")
        .eq("status", "active")
        .order("id", { ascending: true })
        .limit(1);
      if (mgrs && mgrs[0]) {
        list.push({
          key: `manager:${mgrs[0].id}`,
          role: "manager",
          id: mgrs[0].id,
          name: mgrs[0].full_name,
          subtitle: "Manager",
        });
      }
      const { data: emps } = await supabase
        .from("employees")
        .select("id, full_name, position, department, status")
        .neq("status", "inactive")
        .order("full_name");
      for (const e of emps || []) {
        if (Number(e.id) === Number(employeeId)) continue; // not myself
        list.push({
          key: `employee:${e.id}`,
          role: "employee",
          id: e.id,
          name: e.full_name,
          subtitle: e.position || e.department || "Staff",
        });
      }
      setContacts(list);
      setSelected((cur) => cur || list[0] || null);
      setLoading(false);
    })();
  }, [employeeId]);

  // Poll unread counts for the contact list badges.
  const fetchUnread = useCallback(async () => {
    try {
      const res = await fetch(`/api/internal-chat?unread_for=${employeeId}`, { cache: "no-store" });
      const data = await res.json();
      setUnread(data.bySender || {});
    } catch {
      /* ignore */
    }
  }, [employeeId]);

  // Fetch + mark read for the open conversation.
  const fetchMessages = useCallback(async () => {
    const contact = selectedRef.current;
    if (!contact) return;
    try {
      const url =
        contact.role === "manager"
          ? `/api/internal-chat?employee_id=${employeeId}`
          : `/api/internal-chat?peer_a=${employeeId}&peer_b=${contact.id}`;
      const res = await fetch(url, { cache: "no-store" });
      const data = await res.json();
      if (data.messages) setMessages(data.messages);

      await fetch("/api/internal-chat", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          contact.role === "manager"
            ? { employee_id: employeeId, receiver_role: "employee" }
            : { reader_id: employeeId, peer_id: contact.id }
        ),
      });
    } catch {
      /* ignore */
    }
  }, [employeeId]);

  useEffect(() => {
    setMessages([]);
    prevCountRef.current = 0;
    fetchMessages();
    fetchUnread();
    const t = setInterval(() => {
      fetchMessages();
      fetchUnread();
    }, 3000);
    return () => clearInterval(t);
  }, [selected, fetchMessages, fetchUnread]);

  // Scroll down on new messages when already near the bottom.
  useEffect(() => {
    const isNew = messages.length > prevCountRef.current;
    prevCountRef.current = messages.length;
    if (!isNew) return;
    const el = containerRef.current;
    if (!el) return;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 150) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  const postMessage = async (text: string) => {
    const contact = selected;
    if (!contact) return;
    await fetch("/api/internal-chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sender_role: "employee",
        sender_id: employeeId,
        sender_name: employeeName,
        receiver_role: contact.role,
        receiver_id: contact.id,
        employee_id: employeeId,
        message: text,
      }),
    });
    await fetchMessages();
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || sending || !selected) return;
    setSending(true);
    const text = newMessage.trim();
    setNewMessage("");
    try {
      await postMessage(text);
    } catch {
      setNewMessage(text);
    } finally {
      setSending(false);
    }
  };

  // A finished voice recording arrives here as a public URL.
  const sendVoiceNote = async (url: string) => {
    await postMessage(`${VOICE_PREFIX}${url}`);
  };

  const fmtTime = (ts: string) =>
    new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  const isMine = (m: Message) =>
    m.sender_role === "employee" && Number(m.sender_id) === Number(employeeId);

  return (
    <div className="flex h-[640px] rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700 shadow-xl bg-white dark:bg-slate-900">
      {/* ── Contacts ── */}
      <div className="w-64 shrink-0 border-r border-slate-200 dark:border-slate-700 flex flex-col">
        <div className="px-4 py-4 bg-gradient-to-r from-indigo-600 to-blue-600 text-white">
          <p className="font-semibold text-sm flex items-center gap-2">
            <MessageSquare className="h-4 w-4" /> Team Chat
          </p>
          <p className="text-[11px] text-indigo-100 mt-0.5">Message the manager or a colleague</p>
        </div>
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-indigo-500" />
            </div>
          ) : (
            contacts.map((c) => {
              const unreadCount = unread[c.key] || 0;
              return (
                <button
                  key={c.key}
                  onClick={() => setSelected(c)}
                  className={cn(
                    "w-full flex items-center gap-3 px-4 py-3 text-left transition-colors border-b border-slate-100 dark:border-slate-800",
                    selected?.key === c.key
                      ? "bg-indigo-50 dark:bg-indigo-900/30"
                      : "hover:bg-slate-50 dark:hover:bg-slate-800/60"
                  )}
                >
                  <div
                    className={cn(
                      "w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0",
                      c.role === "manager"
                        ? "bg-gradient-to-br from-amber-500 to-orange-500"
                        : "bg-gradient-to-br from-indigo-400 to-blue-500"
                    )}
                  >
                    {c.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-slate-900 dark:text-white truncate flex items-center gap-1.5">
                      {c.name}
                      {c.role === "manager" && <Crown className="h-3 w-3 text-amber-500 shrink-0" />}
                    </p>
                    <p className="text-xs text-slate-400 truncate">{c.subtitle}</p>
                  </div>
                  {unreadCount > 0 && (
                    <span className="shrink-0 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
                      {unreadCount > 9 ? "9+" : unreadCount}
                    </span>
                  )}
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* ── Conversation ── */}
      {/* key: remount the pane per contact so header/thread/input can never
          show mixed state while switching conversations */}
      <div className="flex-1 flex flex-col min-w-0" key={selected?.key || "none"}>
        {selected ? (
          <>
            <div className="flex items-center gap-3 px-5 py-3.5 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900">
              <div
                className={cn(
                  "w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold",
                  selected.role === "manager"
                    ? "bg-gradient-to-br from-amber-500 to-orange-500"
                    : "bg-gradient-to-br from-indigo-400 to-blue-500"
                )}
              >
                {selected.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="font-semibold text-slate-900 dark:text-white text-sm">{selected.name}</p>
                <p className="text-xs text-slate-400">{selected.subtitle}</p>
              </div>
            </div>

            <div ref={containerRef} className="flex-1 overflow-y-auto p-5 space-y-3 bg-slate-50/60 dark:bg-slate-900/50">
              {messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <User className="h-10 w-10 text-slate-300 mb-2" />
                  <p className="text-sm text-slate-400">
                    No messages with {selected.name} yet — say hello!
                  </p>
                </div>
              ) : (
                messages.map((m) => (
                  <div key={m.id} className={cn("flex", isMine(m) ? "justify-end" : "justify-start")}>
                    <div className={cn("max-w-[70%] flex flex-col", isMine(m) ? "items-end" : "items-start")}>
                      {!isMine(m) && (
                        <span className="text-xs text-slate-400 mb-0.5 ml-1">{m.sender_name}</span>
                      )}
                      <div
                        className={cn(
                          "rounded-2xl text-sm leading-relaxed shadow-sm",
                          isVoiceMessage(m.message) ? "p-1.5" : "px-4 py-2.5",
                          isMine(m)
                            ? "bg-gradient-to-br from-indigo-600 to-blue-600 text-white rounded-br-sm"
                            : "bg-white dark:bg-slate-800 text-slate-800 dark:text-white border border-slate-100 dark:border-slate-700 rounded-bl-sm"
                        )}
                      >
                        {isVoiceMessage(m.message) ? (
                          <VoiceNotePlayer text={m.message} />
                        ) : (
                          m.message
                        )}
                      </div>
                      <span className="text-[11px] text-slate-400 mt-1 mx-1">
                        {fmtTime(m.created_at)}
                        {isMine(m) && <span className="ml-1">{m.is_read ? "✓✓" : "✓"}</span>}
                      </span>
                    </div>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            <div className="p-4 border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 flex gap-3">
              <Input
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
                placeholder={`Message ${selected.name}…`}
                disabled={sending}
                className="flex-1 rounded-xl border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
              />
              <VoiceRecorderButton onRecorded={sendVoiceNote} disabled={sending} />
              <Button
                onClick={sendMessage}
                disabled={!newMessage.trim() || sending}
                className="rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 h-10 w-10 p-0 shrink-0"
              >
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">
            Select a contact to start chatting
          </div>
        )}
      </div>
    </div>
  );
}
