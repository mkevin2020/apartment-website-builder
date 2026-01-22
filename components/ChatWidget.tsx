"use client";

import { useEffect, useRef, useState } from "react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MessageCircle, X, Send, Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";
import styles from "./chat-widget.module.css";

interface ChatMessage {
  id?: string;
  sender_role: "user" | "assistant";
  message: string;
  created_at?: string;
}

interface ChatWidgetProps {
  onSessionCreated?: (sessionId: string) => void;
}

export function ChatWidget({ onSessionCreated }: ChatWidgetProps) {
  const { theme, setTheme } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      sender_role: "assistant",
      message: "Hello! 👋 I'm your Cielo Vista apartment assistant. How can I help you today? I can answer questions about availability, pricing, bookings, apartment rules, maintenance, and more.",
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string>("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Initialize or get existing session
  useEffect(() => {
    const initializeSession = async () => {
      try {
        const storedSessionId = localStorage.getItem("chat_session_id");
        const storedSessionTime = localStorage.getItem("chat_session_time");
        const now = Date.now();
        const SESSION_DURATION = 24 * 60 * 60 * 1000; // 24 hours

        // Check if session is still valid
        if (
          storedSessionId &&
          storedSessionTime &&
          now - parseInt(storedSessionTime) < SESSION_DURATION
        ) {
          setSessionId(storedSessionId);
          return;
        }

        // Create new session
        const response = await fetch("/api/chat/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        });

        const data = await response.json();
        if (data.sessionId) {
          setSessionId(data.sessionId);
          localStorage.setItem("chat_session_id", data.sessionId);
          localStorage.setItem("chat_session_time", now.toString());
          onSessionCreated?.(data.sessionId);
        }
      } catch (error) {
        console.error("Failed to initialize chat session:", error);
      }
    };

    initializeSession();
  }, [onSessionCreated]);

  // Auto-scroll to latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !sessionId) return;

    const messageText = input; // ✅ Store message BEFORE clearing input
    const userMessage: ChatMessage = {
      sender_role: "user",
      message: messageText,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/chat/message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          message: messageText, // ✅ Use stored messageText instead of input
        }),
      });

      const data = await response.json();

      if (data.reply) {
        const assistantMessage: ChatMessage = {
          sender_role: "assistant",
          message: data.reply,
        };
        setMessages((prev) => [...prev, assistantMessage]);
      } else if (data.error) {
        const errorMessage: ChatMessage = {
          sender_role: "assistant",
          message:
            "Sorry, I encountered an error processing your message. Please try again or contact our support team.",
        };
        setMessages((prev) => [...prev, errorMessage]);
      }
    } catch (error) {
      console.error("Failed to send message:", error);
      const errorMessage: ChatMessage = {
        sender_role: "assistant",
        message:
          "Sorry, something went wrong. Please try again later or contact support.",
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "fixed bottom-6 right-6 w-14 h-14 rounded-full bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg hover:shadow-xl transition-all duration-300 flex items-center justify-center z-40",
          isOpen && "scale-95"
        )}
        aria-label="Toggle chat"
      >
        {isOpen ? (
          <X className="w-6 h-6" />
        ) : (
          <MessageCircle className="w-6 h-6" />
        )}
      </button>

      {/* Chat window */}
      <div
        className={cn(
          "fixed bottom-24 right-6 w-96 h-[600px] bg-white dark:bg-slate-950 rounded-lg shadow-2xl flex flex-col transition-all duration-300 z-40",
          isOpen
            ? "opacity-100 visible translate-y-0"
            : "opacity-0 invisible translate-y-4"
        )}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-4 rounded-t-lg flex justify-between items-start">
          <div className="flex-1">
            <h3 className="font-semibold text-lg">Cielo Vista Assistant</h3>
            <p className="text-sm text-blue-100">Ask me anything about your apartments</p>
          </div>
          <button
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="ml-2 p-1 hover:bg-blue-500 rounded transition"
            aria-label="Toggle theme"
          >
            {theme === "dark" ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-white dark:bg-slate-950">
          {messages.map((msg, index) => (
            <div
              key={index}
              className={cn(
                "flex",
                msg.sender_role === "user"
                  ? "justify-end"
                  : "justify-start"
              )}
            >
              <div
                className={cn(
                  "max-w-xs px-4 py-2 rounded-lg",
                  msg.sender_role === "user"
                    ? "bg-blue-600 text-white rounded-br-none"
                    : "bg-gray-100 dark:bg-slate-800 text-gray-900 dark:text-gray-100 rounded-bl-none"
                )}
              >
                <p className="text-sm">{msg.message}</p>
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-gray-100 dark:bg-slate-800 text-gray-900 dark:text-gray-100 px-4 py-2 rounded-lg rounded-bl-none">
                <div className="flex space-x-2">
                  <div className="w-2 h-2 bg-gray-500 dark:bg-gray-400 rounded-full animate-bounce" />
                  <div className="w-2 h-2 bg-gray-500 dark:bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0.1s" }} />
                  <div className="w-2 h-2 bg-gray-500 dark:bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0.2s" }} />
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <form
          onSubmit={handleSendMessage}
          className="border-t dark:border-slate-800 p-4 flex gap-2 bg-white dark:bg-slate-950"
        >
          <Input
            type="text"
            placeholder="Type your message..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={isLoading}
            className="flex-1 dark:bg-slate-800 dark:text-white dark:border-slate-700"
          />
          <Button
            type="submit"
            disabled={isLoading || !input.trim()}
            size="icon"
            className="bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600"
          >
            <Send className="w-4 h-4" />
          </Button>
        </form>
      </div>
    </>
  );
}
