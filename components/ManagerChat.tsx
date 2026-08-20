"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { dataClient } from "@/lib/data-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { VoiceRecorderButton, VoiceNotePlayer, isVoiceMessage, VOICE_PREFIX } from "@/components/chat-voice";
import {
  MessageSquare,
  Send,
  User,
  ChevronLeft,
  Circle,
  Loader2,
} from "lucide-react";

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

interface Employee {
  id: number;
  full_name: string;
  username: string;
  position: string;
  department: string;
  status: string;
}

interface ManagerChatProps {
  managerId: number;
  managerName: string;
}

export function ManagerChat({ managerId, managerName }: ManagerChatProps) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [unreadCounts, setUnreadCounts] = useState<Record<number, number>>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const prevCountRef = useRef(0);
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  const supabase = dataClient();

  // Fetch all employees
  useEffect(() => {
    const fetchEmployees = async () => {
      const { data } = await supabase
        .from("employees")
        .select("id, full_name, username, position, department, status")
        .order("full_name", { ascending: true });
      setEmployees(data || []);
    };
    fetchEmployees();
  }, []);

  // Fetch unread counts for all employees
  const fetchUnreadCounts = useCallback(async () => {
    const { data } = await supabase
      .from("internal_messages")
      .select("employee_id")
      .eq("receiver_role", "manager")
      .eq("is_read", false);

    if (data) {
      const counts: Record<number, number> = {};
      data.forEach((msg: any) => {
        counts[msg.employee_id] = (counts[msg.employee_id] || 0) + 1;
      });
      setUnreadCounts(counts);
    }
  }, []);

  useEffect(() => {
    fetchUnreadCounts();
    const interval = setInterval(fetchUnreadCounts, 5000);
    return () => clearInterval(interval);
  }, [fetchUnreadCounts]);

  // Fetch messages for selected employee
  const fetchMessages = useCallback(async (employeeId: number) => {
    try {
      const res = await fetch(`/api/internal-chat?employee_id=${employeeId}`, { cache: "no-store" });
      const data = await res.json();
      if (data.messages) {
        setMessages(data.messages);
      }
    } catch (err) {
      console.error("Error fetching messages:", err);
    }
  }, []);

  // Mark messages as read when manager opens a conversation
  const markAsRead = useCallback(async (employeeId: number) => {
    await fetch("/api/internal-chat", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ employee_id: employeeId, receiver_role: "manager" }),
    });
    setUnreadCounts((prev) => ({ ...prev, [employeeId]: 0 }));
  }, []);

  // Poll for new messages when a conversation is open
  useEffect(() => {
    if (!selectedEmployee) return;

    fetchMessages(selectedEmployee.id);
    markAsRead(selectedEmployee.id);

    pollRef.current = setInterval(() => {
      fetchMessages(selectedEmployee.id);
      markAsRead(selectedEmployee.id);
    }, 3000);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [selectedEmployee, fetchMessages, markAsRead]);

  // Only scroll down when a NEW message arrives AND the user is already near the bottom
  // (so it never yanks you down while reading older messages or on polling refreshes)
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

  const handleSelectEmployee = (emp: Employee) => {
    setSelectedEmployee(emp);
    setMessages([]);
    setLoadingMessages(true);
    fetchMessages(emp.id).finally(() => setLoadingMessages(false));
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedEmployee || sending) return;

    setSending(true);
    const msgText = newMessage.trim();
    setNewMessage("");

    try {
      await fetch("/api/internal-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sender_role: "manager",
          sender_id: managerId,
          sender_name: managerName,
          receiver_role: "employee",
          receiver_id: selectedEmployee.id,
          employee_id: selectedEmployee.id,
          message: msgText,
        }),
      });

      // Immediately refresh messages
      await fetchMessages(selectedEmployee.id);
    } catch (err) {
      console.error("Error sending message:", err);
      setNewMessage(msgText); // Restore on error
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

  // A finished voice recording arrives here as a public URL.
  const sendVoiceNote = async (url: string) => {
    if (!selectedEmployee) return;
    await fetch("/api/internal-chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sender_role: "manager",
        sender_id: managerId,
        sender_name: managerName,
        receiver_role: "employee",
        receiver_id: selectedEmployee.id,
        employee_id: selectedEmployee.id,
        message: `${VOICE_PREFIX}${url}`,
      }),
    });
    await fetchMessages(selectedEmployee.id);
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

  // Group messages by date
  const groupedMessages = messages.reduce((groups: Record<string, Message[]>, msg) => {
    const dateKey = formatDate(msg.created_at);
    if (!groups[dateKey]) groups[dateKey] = [];
    groups[dateKey].push(msg);
    return groups;
  }, {});

  const totalUnread = Object.values(unreadCounts).reduce((a, b) => a + b, 0);

  return (
    <div className="flex h-[680px] rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700 shadow-xl bg-white dark:bg-slate-900">
      {/* Left Sidebar – Employee List */}
      <div className="w-80 flex-shrink-0 border-r border-slate-200 dark:border-slate-700 flex flex-col bg-slate-50 dark:bg-slate-950">
        {/* Sidebar Header */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-700 bg-gradient-to-r from-blue-600 to-indigo-600">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-white" />
            <h2 className="text-white font-bold text-lg">Messages</h2>
            {totalUnread > 0 && (
              <span className="ml-auto bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                {totalUnread}
              </span>
            )}
          </div>
          <p className="text-blue-100 text-xs mt-1">Chat with your team</p>
        </div>

        {/* Employee List */}
        <div className="flex-1 overflow-y-auto">
          {employees.length === 0 ? (
            <div className="p-6 text-center text-slate-500 dark:text-slate-400 text-sm">
              No employees found
            </div>
          ) : (
            employees.map((emp) => {
              const unread = unreadCounts[emp.id] || 0;
              const isSelected = selectedEmployee?.id === emp.id;
              return (
                <button
                  key={emp.id}
                  onClick={() => handleSelectEmployee(emp)}
                  className={`w-full flex items-center gap-3 px-4 py-3.5 text-left transition-all hover:bg-white dark:hover:bg-slate-800 border-b border-slate-100 dark:border-slate-800 ${
                    isSelected
                      ? "bg-white dark:bg-slate-800 border-l-4 border-l-blue-500"
                      : "border-l-4 border-l-transparent"
                  }`}
                >
                  {/* Avatar */}
                  <div className="relative flex-shrink-0">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm text-white ${
                        isSelected
                          ? "bg-blue-600"
                          : "bg-gradient-to-br from-indigo-400 to-blue-500"
                      }`}
                    >
                      {emp.full_name.charAt(0).toUpperCase()}
                    </div>
                    <span
                      className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white dark:border-slate-950 ${
                        emp.status === "active" ? "bg-green-400" : "bg-gray-400"
                      }`}
                    />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p
                      className={`text-sm font-semibold truncate ${
                        isSelected
                          ? "text-blue-600 dark:text-blue-400"
                          : "text-slate-900 dark:text-white"
                      }`}
                    >
                      {emp.full_name}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                      {emp.position || emp.department || "Employee"}
                    </p>
                  </div>

                  {/* Unread Badge */}
                  {unread > 0 && (
                    <span className="flex-shrink-0 bg-blue-600 text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center">
                      {unread}
                    </span>
                  )}
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Right Side – Conversation */}
      <div className="flex-1 flex flex-col">
        {!selectedEmployee ? (
          /* Empty State */
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-blue-900/30 dark:to-indigo-900/30 flex items-center justify-center mb-4">
              <MessageSquare className="h-10 w-10 text-blue-500" />
            </div>
            <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-2">
              Select a conversation
            </h3>
            <p className="text-slate-500 dark:text-slate-400 text-sm max-w-xs">
              Choose an employee from the left panel to start or continue a conversation.
            </p>
          </div>
        ) : (
          <>
            {/* Conversation Header */}
            <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm">
              <button
                onClick={() => setSelectedEmployee(null)}
                className="md:hidden p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-400 to-blue-500 flex items-center justify-center font-bold text-white text-sm flex-shrink-0">
                {selectedEmployee.full_name.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="font-semibold text-slate-900 dark:text-white">
                  {selectedEmployee.full_name}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
                  <Circle
                    className={`h-2 w-2 fill-current ${
                      selectedEmployee.status === "active"
                        ? "text-green-500"
                        : "text-gray-400"
                    }`}
                  />
                  {selectedEmployee.position || selectedEmployee.department || "Employee"}
                </p>
              </div>
            </div>

            {/* Messages Area */}
            <div ref={messagesContainerRef} className="flex-1 overflow-y-auto p-5 space-y-4 bg-slate-50 dark:bg-slate-900/50">
              {loadingMessages ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
                </div>
              ) : Object.keys(groupedMessages).length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <div className="w-16 h-16 rounded-2xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center mb-3">
                    <MessageSquare className="h-8 w-8 text-blue-400" />
                  </div>
                  <p className="text-slate-500 dark:text-slate-400 text-sm">
                    No messages yet. Say hello! 👋
                  </p>
                </div>
              ) : (
                Object.entries(groupedMessages).map(([date, msgs]) => (
                  <div key={date}>
                    {/* Date Divider */}
                    <div className="flex items-center gap-3 my-4">
                      <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700" />
                      <span className="text-xs text-slate-400 dark:text-slate-500 font-medium px-2">
                        {date}
                      </span>
                      <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700" />
                    </div>

                    {/* Messages */}
                    <div className="space-y-3">
                      {msgs.map((msg) => {
                        const isManager = msg.sender_role === "manager";
                        return (
                          <div
                            key={msg.id}
                            className={`flex ${isManager ? "justify-end" : "justify-start"}`}
                          >
                            {!isManager && (
                              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-400 to-blue-500 flex items-center justify-center text-white text-xs font-bold mr-2 flex-shrink-0 mt-1">
                                {msg.sender_name.charAt(0).toUpperCase()}
                              </div>
                            )}
                            <div
                              className={`max-w-[70%] group relative ${
                                isManager ? "items-end" : "items-start"
                              } flex flex-col`}
                            >
                              {!isManager && (
                                <span className="text-xs text-slate-400 mb-1 ml-1">
                                  {msg.sender_name}
                                </span>
                              )}
                              <div
                                className={`${isVoiceMessage(msg.message) ? "p-1.5" : "px-4 py-2.5"} rounded-2xl shadow-sm text-sm leading-relaxed ${
                                  isManager
                                    ? "bg-gradient-to-br from-blue-600 to-indigo-600 text-white rounded-br-sm"
                                    : "bg-white dark:bg-slate-800 text-slate-800 dark:text-white border border-slate-100 dark:border-slate-700 rounded-bl-sm"
                                }`}
                              >
                                {isVoiceMessage(msg.message) ? (
                                  <VoiceNotePlayer text={msg.message} />
                                ) : (
                                  msg.message
                                )}
                              </div>
                              <span
                                className={`text-xs text-slate-400 mt-1 ${
                                  isManager ? "mr-1" : "ml-1"
                                }`}
                              >
                                {formatTime(msg.created_at)}
                                {isManager && (
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

            {/* Message Input */}
            <div className="p-4 border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
              <div className="flex gap-3 items-center">
                <Input
                  id="manager-chat-input"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={`Message ${selectedEmployee.full_name}...`}
                  className="flex-1 rounded-xl border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  disabled={sending}
                />
                <VoiceRecorderButton onRecorded={sendVoiceNote} disabled={sending} />
                <Button
                  id="manager-chat-send-btn"
                  onClick={handleSendMessage}
                  disabled={!newMessage.trim() || sending}
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
          </>
        )}
      </div>
    </div>
  );
}
