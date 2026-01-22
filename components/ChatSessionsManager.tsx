import { createClient } from "@supabase/supabase-js";
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

interface ChatSession {
  id: string;
  user_email: string;
  user_name: string;
  user_role: string;
  created_at: string;
  message_count?: number;
}

async function getChatSessions(): Promise<ChatSession[]> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  try {
    const { data, error } = await supabase
      .from("chat_sessions")
      .select(
        `
        id,
        user_email,
        user_name,
        user_role,
        created_at,
        chat_messages(count)
      `
      )
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) throw error;

    return (
      data?.map((session: any) => ({
        id: session.id,
        user_email: session.user_email || "Anonymous",
        user_name: session.user_name || "-",
        user_role: session.user_role,
        created_at: session.created_at,
        message_count: session.chat_messages?.[0]?.count || 0,
      })) || []
    );
  } catch (error) {
    console.error("Error fetching chat sessions:", error);
    return [];
  }
}

export async function ChatSessionsManager() {
  const sessions = await getChatSessions();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Chat Sessions</CardTitle>
        <CardDescription>
          View all chatbot conversations from visitors and tenants
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Messages</TableHead>
                <TableHead>Started</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sessions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-4 text-gray-500">
                    No chat sessions yet
                  </TableCell>
                </TableRow>
              ) : (
                sessions.map((session) => (
                  <TableRow key={session.id}>
                    <TableCell className="font-medium">{session.user_email}</TableCell>
                    <TableCell>{session.user_name}</TableCell>
                    <TableCell>
                      <Badge variant={session.user_role === "tenant" ? "default" : "secondary"}>
                        {session.user_role}
                      </Badge>
                    </TableCell>
                    <TableCell>{session.message_count}</TableCell>
                    <TableCell>
                      {formatDistanceToNow(new Date(session.created_at), { addSuffix: true })}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
