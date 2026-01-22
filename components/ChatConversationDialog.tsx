"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";
import { Loader2 } from "lucide-react";

interface ChatMessage {
  id: string;
  sender_role: "user" | "assistant";
  message: string;
  created_at: string;
}

interface ChatConversationProps {
  sessionId: string | null;
  onClose: () => void;
  userEmail?: string;
  userName?: string;
  userRole?: string;
}

export function ChatConversationDialog({
  sessionId,
  onClose,
  userEmail,
  userName,
  userRole,
}: ChatConversationProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!sessionId) return;

    const fetchMessages = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(`/api/chat/conversation/${sessionId}`);
        const data = await response.json();
        setMessages(data.messages || []);
      } catch (error) {
        console.error("Error fetching messages:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchMessages();
  }, [sessionId]);

  if (!sessionId) return null;

  return (
    <Dialog open={!!sessionId} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[600px] flex flex-col">
        <DialogHeader>
          <DialogTitle>Chat Conversation</DialogTitle>
          <DialogDescription>
            <div className="space-y-2 mt-2">
              <div>
                <span className="font-semibold">Email:</span> {userEmail}
              </div>
              <div>
                <span className="font-semibold">Name:</span> {userName || "-"}
              </div>
              <div>
                <span className="font-semibold">Role:</span>{" "}
                <Badge variant={userRole === "tenant" ? "default" : "secondary"}>
                  {userRole}
                </Badge>
              </div>
            </div>
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 py-4">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : messages.length === 0 ? (
            <div className="text-center text-gray-500 py-8">
              No messages in this conversation
            </div>
          ) : (
            messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${
                  msg.sender_role === "user" ? "justify-end" : "justify-start"
                }`}
              >
                <div
                  className={`max-w-xs px-4 py-2 rounded-lg ${
                    msg.sender_role === "user"
                      ? "bg-blue-600 text-white rounded-br-none"
                      : "bg-gray-100 text-gray-900 rounded-bl-none"
                  }`}
                >
                  <p className="text-sm break-words">{msg.message}</p>
                  <p className="text-xs mt-1 opacity-70">
                    {formatDistanceToNow(new Date(msg.created_at), {
                      addSuffix: true,
                    })}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
