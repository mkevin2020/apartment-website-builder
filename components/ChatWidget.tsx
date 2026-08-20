"use client";

import { useEffect, useRef, useState } from "react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { X, Send, Moon, Sun, Mic, MicOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { safeJsonResponse } from "@/lib/safe-fetch-json";
import { stripMarkdown } from "@/lib/strip-markdown";

interface ChatMessage {
  id?: string;
  sender_role: "user" | "assistant";
  message: string;
  created_at?: string;
}

interface ChatWidgetProps {
  onSessionCreated?: (sessionId: string) => void;
}

// Detect WHO is using the chat right now, straight from localStorage, so the bot
// always replies in the correct mode for the currently logged-in user. Priority:
// admin > manager > employee > tenant > visitor. Re-run on every send so logging
// in (or out) after the widget mounted is reflected immediately.
function detectCurrentUser(): { role: string; name: string; id: any } {
  if (typeof window === "undefined") return { role: "visitor", name: "", id: null };

  const read = (key: string): any | null => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  };

  const admin = read("admin_session");
  if (admin) return { role: "admin", name: admin.full_name || admin.username || "Admin", id: admin.id ?? null };

  const manager = read("manager_session");
  if (manager) return { role: "manager", name: manager.full_name || manager.username || "Manager", id: manager.id ?? null };

  const employee = read("employee_session");
  if (employee) return { role: "employee", name: employee.full_name || employee.username || "Employee", id: employee.id ?? null };

  const tenant = read("tenant_session");
  if (tenant) return { role: "tenant", name: tenant.full_name || tenant.username || "Tenant", id: tenant.id ?? null };

  return { role: "visitor", name: "", id: null };
}

export function ChatWidget({ onSessionCreated }: ChatWidgetProps) {
  const { theme, setTheme } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string>("");
  const [userRole, setUserRole] = useState<string>("visitor");
  const [userName, setUserName] = useState<string>("");
  const [isListening, setIsListening] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  // Text already typed when the mic starts, so speech appends instead of replacing.
  const voiceBaseTextRef = useRef("");

  // Mark component as mounted to fix hydration errors
  useEffect(() => {
    setMounted(true);
  }, []);

  // Stop the microphone if the widget unmounts mid-recording.
  useEffect(() => {
    return () => {
      try {
        recognitionRef.current?.stop();
      } catch {}
    };
  }, []);

  // Voice input via the browser's built-in speech recognition (Chrome/Edge/
  // Android). Tap the mic to talk — words appear live in the input box; tap
  // again to stop. Not supported in Firefox, where the button explains itself.
  const toggleVoiceInput = () => {
    if (isListening) {
      try {
        recognitionRef.current?.stop();
      } catch {}
      setIsListening(false);
      return;
    }

    const SpeechRecognitionImpl =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognitionImpl) {
      alert("Voice input is not supported in this browser. Please use Chrome, Edge, or Safari.");
      return;
    }

    const recognition = new SpeechRecognitionImpl();
    recognitionRef.current = recognition;
    // Follow the site language switcher (en ↔ fr) for better accuracy.
    recognition.lang = document.documentElement.lang === "fr" ? "fr-FR" : "en-US";
    recognition.interimResults = true; // show words while still speaking
    recognition.continuous = true; // keep listening until tapped again

    voiceBaseTextRef.current = input.trim() ? input.trim() + " " : "";

    recognition.onresult = (event: any) => {
      let transcript = "";
      for (let i = 0; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      setInput((voiceBaseTextRef.current + transcript).trimStart());
    };
    recognition.onerror = (event: any) => {
      if (event.error === "not-allowed") {
        alert("Microphone access was blocked. Allow the microphone for this site to use voice input.");
      }
      setIsListening(false);
    };
    recognition.onend = () => setIsListening(false);

    recognition.start();
    setIsListening(true);
  };

  // Initialize or get existing session
  useEffect(() => {
    const initializeSession = async () => {
      try {
        // Detect who is using the chat right now (live, from localStorage)
        const { role, name } = detectCurrentUser();

        setUserRole(role);
        setUserName(name);

        // Start with generic greeting
        setMessages([
          {
            sender_role: "assistant",
            message: "Hello! 👋 I'm your Cielo Vista apartment assistant. How can I help you today? I can answer questions about availability, pricing, bookings, and more.",
          },
        ]);

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

        // Create new session with user info
        const response = await fetch("/api/chat/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            user_role: role,
            user_name: name,
          }),
        });

        const data = await safeJsonResponse<{ sessionId?: string; error?: string }>(response, "Unable to initialize chat.");
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

    const messageText = input;
    const userMessage: ChatMessage = {
      sender_role: "user",
      message: messageText,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    // Re-detect the current user on every send: if they logged in (or out) after
    // the chat opened, the bot switches mode immediately (tenant/employee/etc.).
    const { role, name, id } = detectCurrentUser();
    if (role !== userRole) setUserRole(role);
    if (name !== userName) setUserName(name);

    try {
      const response = await fetch("/api/chat/message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          message: messageText,
          userRole: role,
          userName: name,
          // Lets the server look up this tenant's own booking/balance so the
          // assistant can answer about their actual account.
          userId: id,
          page: typeof window !== "undefined" ? window.location.pathname : "",
        }),
      });

      const data = await safeJsonResponse<{ reply?: string; error?: string }>(response, "Unable to send message.");

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
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "fixed bottom-6 right-4 sm:right-6 w-14 h-14 rounded-full overflow-hidden shadow-xl hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 z-[100]",
          isOpen && "scale-90 opacity-0 invisible"
        )}
        aria-label="Open chat"
      >
        {/* Robot logo zoomed slightly so the black corners of the source image stay cropped out */}
        <img src="/chatbot-logo.jpg" alt="Chatbot" className="w-full h-full object-cover scale-[1.18]" />
      </button>

      <div
        className={cn(
          "fixed bottom-4 sm:bottom-24 right-4 sm:right-6 w-[calc(100vw-2rem)] sm:w-[400px] h-[calc(100vh-2rem)] sm:h-[calc(100vh-8rem)] max-h-[700px] bg-white/90 dark:bg-slate-950/90 backdrop-blur-xl border border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col transition-all duration-500 ease-in-out z-[100] rounded-3xl overflow-hidden",
          isOpen
            ? "opacity-100 translate-y-0 scale-100 pointer-events-auto"
            : "opacity-0 translate-y-8 scale-95 pointer-events-none"
        )}
      >
        <div className="bg-gradient-to-r from-blue-600/95 to-blue-700/95 text-white p-5 flex justify-between items-start border-b border-blue-500/30 shrink-0">
          <div className="flex flex-col">
            <h3 className="font-bold text-lg tracking-tight">Cielo Vista Assistant</h3>
            <p className="text-xs text-blue-100 font-medium opacity-90 mt-0.5">Online • Ready to help</p>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="p-2 hover:bg-white/20 rounded-full transition-colors"
              aria-label="Toggle theme"
            >
              {mounted && (theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />)}
            </button>
            <button
              onClick={() => setIsOpen(false)}
              className="p-2 hover:bg-white/20 rounded-full transition-colors"
              aria-label="Close chat"
            >
              <X className="w-4 h-4 text-white" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5 bg-transparent scroll-smooth">
          {messages.map((msg, index) => (
            <div
              key={index}
              className={cn(
                "flex w-full animate-in fade-in slide-in-from-bottom-2 duration-300",
                msg.sender_role === "user" ? "justify-end" : "justify-start"
              )}
            >
              <div
                className={cn(
                  "max-w-[85%] px-5 py-3.5 rounded-2xl leading-relaxed shadow-sm text-sm",
                  msg.sender_role === "user"
                    ? "bg-gradient-to-br from-blue-600 to-blue-700 text-white rounded-br-sm"
                    : "bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 text-slate-800 dark:text-slate-200 rounded-bl-sm"
                )}
              >
                {/* whitespace-pre-line keeps the bot's line breaks and bullets readable */}
                <p className="whitespace-pre-line">
                  {msg.sender_role === "user" ? msg.message : stripMarkdown(msg.message)}
                </p>
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex justify-start animate-in fade-in duration-300">
              <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-sm px-5 py-4 rounded-2xl rounded-bl-sm flex space-x-2">
                <div className="w-2.5 h-2.5 bg-blue-600/60 dark:bg-blue-400/60 rounded-full animate-bounce" />
                <div className="w-2.5 h-2.5 bg-blue-600/60 dark:bg-blue-400/60 rounded-full animate-bounce" style={{ animationDelay: "0.15s" }} />
                <div className="w-2.5 h-2.5 bg-blue-600/60 dark:bg-blue-400/60 rounded-full animate-bounce" style={{ animationDelay: "0.3s" }} />
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        <form
          onSubmit={handleSendMessage}
          className="border-t border-slate-200 dark:border-slate-800/80 p-4 shrink-0 bg-transparent"
          suppressHydrationWarning
        >
          <div className="flex gap-2">
            <Input
              type="text"
              placeholder={isListening ? "Listening… speak now" : "Ask me anything..."}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={isLoading}
              suppressHydrationWarning
              className="flex-1 h-12 rounded-xl border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 focus-visible:ring-blue-500 shadow-inner px-4 text-sm"
            />
            <Button
              type="button"
              onClick={toggleVoiceInput}
              disabled={isLoading}
              aria-label={isListening ? "Stop voice input" : "Start voice input"}
              title={isListening ? "Stop voice input" : "Speak your message"}
              className={cn(
                "h-12 w-12 rounded-xl shadow-md hover:shadow-lg transition-all shrink-0 p-0 flex items-center justify-center",
                isListening
                  ? "bg-red-600 hover:bg-red-700 text-white animate-pulse"
                  : "bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200"
              )}
            >
              {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            </Button>
            <Button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="h-12 w-12 rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-md hover:shadow-lg transition-all shrink-0 p-0 flex items-center justify-center"
            >
              <Send className="w-5 h-5 ml-1" />
            </Button>
          </div>
        </form>
      </div>
    </>
  );
}
