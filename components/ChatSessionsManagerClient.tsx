"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";
import { Loader2, Eye, Download } from "lucide-react";
import { ChatConversationDialog } from "./ChatConversationDialog";

interface ChatSession {
  id: string;
  user_email: string;
  user_name: string;
  user_role: string;
  created_at: string;
  message_count?: number;
}

export function ChatSessionsManagerClient() {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [selectedSession, setSelectedSession] = useState<ChatSession | null>(null);

  useEffect(() => {
    fetchSessions();
  }, []);

  const fetchSessions = async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/chat/sessions");
      const data = await response.json();
      setSessions(data.sessions || []);
    } catch (error) {
      console.error("Error fetching sessions:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleViewConversation = (session: ChatSession) => {
    setSelectedSession(session);
    setSelectedSessionId(session.id);
  };

  const handleExportConversation = async (sessionId: string) => {
    try {
      const response = await fetch(`/api/chat/conversation/${sessionId}`);
      const data = await response.json();

      const session = sessions.find((s) => s.id === sessionId);
      const content = `Chat Conversation Export\n\nSession ID: ${sessionId}\nEmail: ${
        session?.user_email || "N/A"
      }\nName: ${session?.user_name || "N/A"}\nRole: ${session?.user_role}\n\n---\n\n${data.messages
        .map(
          (msg: any) =>
            `${msg.sender_role === "user" ? "User" : "Assistant"}: ${msg.message}\n`
        )
        .join("\n")}`;

      const blob = new Blob([content], { type: "text/plain" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `chat-${sessionId}-${new Date().toISOString().split("T")[0]}.txt`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error("Error exporting conversation:", error);
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Chat Sessions</CardTitle>
              <CardDescription>
                View all chatbot conversations from visitors and tenants
              </CardDescription>
            </div>
            <Button onClick={fetchSessions} size="sm">
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin" />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Messages</TableHead>
                    <TableHead>Started</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sessions.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-4 text-gray-500">
                        No chat sessions yet
                      </TableCell>
                    </TableRow>
                  ) : (
                    sessions.map((session) => (
                      <TableRow key={session.id}>
                        <TableCell className="font-medium">{session.user_email}</TableCell>
                        <TableCell>{session.user_name || "-"}</TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              session.user_role === "tenant" ? "default" : "secondary"
                            }
                          >
                            {session.user_role}
                          </Badge>
                        </TableCell>
                        <TableCell>{session.message_count || 0}</TableCell>
                        <TableCell>
                          {formatDistanceToNow(new Date(session.created_at), {
                            addSuffix: true,
                          })}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleViewConversation(session)}
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleExportConversation(session.id)}
                            >
                              <Download className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            )}
          </div>
        </CardContent>
      </Card>

      <ChatConversationDialog
        sessionId={selectedSessionId}
        onClose={() => {
          setSelectedSessionId(null);
          setSelectedSession(null);
        }}
        userEmail={selectedSession?.user_email}
        userName={selectedSession?.user_name}
        userRole={selectedSession?.user_role}
      />
    </>
  );
}
