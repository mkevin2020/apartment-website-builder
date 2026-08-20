"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { dataClient } from "@/lib/data-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MessageSquare, Send, Loader2, Circle } from "lucide-react";

interface Message {
  id: number;
  sender_role: string;
  sender_id: number;
  sender_name: string;
  receiver_role: string;
  receiver_id: number;
  employee_id: number;
  message: string;
  is_read: boolean;
  created_at: string;
}

interface Manager {
  id: number;
  full_name: string;
  status: string;
}

interface EmployeeChatProps {
  employeeId: number;
  employeeName: string;
}

export function EmployeeChat({ employeeId, employeeName }: EmployeeChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [manager, setManager] = useState<Manager | null>(null);
  const [managerId, setManagerId] = useState<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const prevCountRef = useRef(0);
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  const supabase = dataClient();

  // Fetch manager info (first active manager)
  useEffect(() => {
    const fetchManager = async () => {
      // Take the first active manager (don't use .single() — it errors on 0 or 2+ rows)
      const { data } = await supabase
        .from("managers")
        .select("id, full_name, status")
        .eq("status", "active")
        .order("id", { ascending: true })
        .limit(1);
      const mgr = data && data.length > 0 ? data[0] : null;
      if (mgr) {
        setManager(mgr);
        setManagerId(mgr.id);
      }
    };
    fetchManager();
  }, []);

  // Fetch messages
  const fetchMessages = useCallback(async () => {
    try {
      const res = await fetch(`/api/internal-chat?employee_id=${employeeId}`, { cache: "no-store" });
      const data = await res.json();
      if (data.messages) {
        setMessages(data.messages);
      }
    } catch (err) {
      console.error("Error fetching messages:", err);
    }
  }, [employeeId]);

  // Mark messages as read
  const markAsRead = useCallback(async () => {
    await fetch("/api/internal-chat", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ employee_id: employeeId, receiver_role: "employee" }),
    });
  }, [employeeId]);

  // Initial load + polling
  useEffect(() => {
    fetchMessages().finally(() => setLoading(false));
    markAsRead();

    pollRef.current = setInterval(() => {
      fetchMessages();
      markAsRead();
    }, 3000);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [fetchMessages, markAsRead]);

  // Only scroll down when a NEW message arrives AND the user is already near the bottom
  // (so it never yanks you down while you're reading older messages or on polling refreshes)
  useEffect(() => {
    const isNewMessage = messages.length > prevCountRef.current;
    prevCountRef.current = messages.length;
    if (!isNewMessage) return;

    const container = messagesContainerRef.current;
    if (!container) return;
    const nearBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight < 150;
    if (nearBottom) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  const handleSendMessage = async () => {
    if (!newMessage.trim() || sending || !managerId) return;

    setSending(true);
    const msgText = newMessage.trim();
    setNewMessage("");

    try {
      await fetch("/api/internal-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sender_role: "employee",
          sender_id: employeeId,
          sender_name: employeeName,
          receiver_role: "manager",
          receiver_id: managerId,
          employee_id: employeeId,
          message: msgText,
        }),
      });

      await fetchMessages();
    } catch (err) {
      console.error("Error sending message:", err);
      setNewMessage(msgText);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const formatTime = (ts: string) => {
    const date = new Date(ts);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const formatDate = (ts: string) => {
    const date = new Date(ts);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) return "Today";
    if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
    return date.toLocaleDateString([], { month: "short", day: "numeric" });
  };

  // Group by date
  const groupedMessages = messages.reduce(
    (groups: Record<string, Message[]>, msg) => {
      const dateKey = formatDate(msg.created_at);
      if (!groups[dateKey]) groups[dateKey] = [];
      groups[dateKey].push(msg);
      return groups;
    },
    {}
  );

  const unreadFromManager = messages.filter(
    (m) => m.sender_role === "manager" && !m.is_read
  ).length;

  return (
    <div className="flex flex-col h-[620px] rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700 shadow-xl bg-white dark:bg-slate-900">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4 bg-gradient-to-r from-blue-600 to-indigo-600">
        <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center font-bold text-white text-sm flex-shrink-0 border border-white/30">
          {manager ? manager.full_name.charAt(0).toUpperCase() : "M"}
        </div>
        <div className="flex-1">
          <p className="font-semibold text-white">
            {manager ? manager.full_name : "Manager"}
          </p>
          <p className="text-xs text-blue-100 flex items-center gap-1">
            <Circle className="h-2 w-2 fill-green-400 text-green-400" />
            {manager?.status === "active" ? "Online" : "Away"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-white/80" />
          <span className="text-white font-semibold text-sm">Chat with Manager</span>
        </div>
      </div>

      {/* Messages */}
      <div ref={messagesContainerRef} className="flex-1 overflow-y-auto p-5 space-y-4 bg-slate-50 dark:bg-slate-900/50">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
          </div>
        ) : Object.keys(groupedMessages).length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-16 h-16 rounded-2xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center mb-3">
              <MessageSquare className="h-8 w-8 text-blue-400" />
            </div>
            <p className="text-slate-600 dark:text-slate-300 font-semibold mb-1">
              No messages yet
            </p>
            <p className="text-slate-400 dark:text-slate-500 text-sm max-w-xs">
              Your manager can reach you here. You can also start the conversation!
            </p>
          </div>
        ) : (
          Object.entries(groupedMessages).map(([date, msgs]) => (
            <div key={date}>
              {/* Date Divider */}
              <div className="flex items-center gap-3 my-4">
                <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700" />
                <span className="text-xs text-slate-400 font-medium px-2">
                  {date}
                </span>
                <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700" />
              </div>

              {/* Messages */}
              <div className="space-y-3">
                {msgs.map((msg) => {
                  const isEmployee = msg.sender_role === "employee";
                  return (
                    <div
                      key={msg.id}
                      className={`flex ${isEmployee ? "justify-end" : "justify-start"}`}
                    >
                      {!isEmployee && (
                        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-400 to-blue-500 flex items-center justify-center text-white text-xs font-bold mr-2 flex-shrink-0 mt-1">
                          {msg.sender_name.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div
                        className={`max-w-[70%] flex flex-col ${
                          isEmployee ? "items-end" : "items-start"
                        }`}
                      >
                        {!isEmployee && (
                          <span className="text-xs text-slate-400 mb-1 ml-1">
                            {msg.sender_name}
                          </span>
                        )}
                        <div
                          className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed shadow-sm ${
                            isEmployee
                              ? "bg-gradient-to-br from-blue-600 to-indigo-600 text-white rounded-br-sm"
                              : "bg-white dark:bg-slate-800 text-slate-800 dark:text-white border border-slate-100 dark:border-slate-700 rounded-bl-sm"
                          }`}
                        >
                          {msg.message}
                        </div>
                        <span
                          className={`text-xs text-slate-400 mt-1 ${
                            isEmployee ? "mr-1" : "ml-1"
                          }`}
                        >
                          {formatTime(msg.created_at)}
                          {isEmployee && (
                            <span className="ml-1">
                              {msg.is_read ? "✓✓" : "✓"}
                            </span>
                          )}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
        {!managerId && (
          <p className="text-xs text-amber-500 text-center mb-2">
            ⚠️ No active manager found. Chat will be available once a manager is assigned.
          </p>
        )}
        <div className="flex gap-3 items-center">
          <Input
            id="employee-chat-input"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message to your manager..."
            className="flex-1 rounded-xl border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            disabled={sending || !managerId}
          />
          <Button
            id="employee-chat-send-btn"
            onClick={handleSendMessage}
            disabled={!newMessage.trim() || sending || !managerId}
            className="rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-md hover:shadow-lg transition-all h-10 w-10 p-0 flex-shrink-0"
          >
            {sending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
        <p className="text-xs text-slate-400 mt-2 text-center">
          Press Enter to send · Updates every 3s
        </p>
      </div>
    </div>
  );
}
