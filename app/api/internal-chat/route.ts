import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { requireRole, STAFF, errorResponse } from "@/lib/auth/session";

// Never cache chat responses — polling must always get fresh messages
export const dynamic = "force-dynamic";
export const revalidate = 0;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET /api/internal-chat
//   ?employee_id=X            → employee X's conversation with the manager
//   ?peer_a=X&peer_b=Y        → direct conversation between two employees
//   ?unread_for=X             → unread summary for employee X (manager + colleagues)
export async function GET(request: NextRequest) {
  try {
    // Internal staff messages — never readable by tenants or the public.
    await requireRole(request, STAFF);

    const { searchParams } = new URL(request.url);
    const employeeId = searchParams.get("employee_id");
    const peerA = searchParams.get("peer_a");
    const peerB = searchParams.get("peer_b");
    const unreadFor = searchParams.get("unread_for");

    // Unread summary: everything addressed to this employee that's unread,
    // whoever sent it (manager or a colleague).
    if (unreadFor) {
      const { data, error } = await supabase
        .from("internal_messages")
        .select("id, sender_role, sender_id")
        .eq("receiver_role", "employee")
        .eq("receiver_id", Number(unreadFor))
        .eq("is_read", false);
      if (error) {
        console.error("Error fetching unread summary:", error);
        return NextResponse.json({ error: "Failed" }, { status: 500 });
      }
      // Per-sender counts, keyed "role:id" (e.g. "manager:1", "employee:7")
      const bySender: Record<string, number> = {};
      for (const m of data || []) {
        const key = `${m.sender_role}:${m.sender_id}`;
        bySender[key] = (bySender[key] || 0) + 1;
      }
      return NextResponse.json({ count: (data || []).length, bySender });
    }

    // Direct employee ↔ employee conversation
    if (peerA && peerB) {
      const a = Number(peerA);
      const b = Number(peerB);
      const { data, error } = await supabase
        .from("internal_messages")
        .select("*")
        .eq("sender_role", "employee")
        .eq("receiver_role", "employee")
        .or(
          `and(sender_id.eq.${a},receiver_id.eq.${b}),and(sender_id.eq.${b},receiver_id.eq.${a})`
        )
        .order("created_at", { ascending: true });
      if (error) {
        console.error("Error fetching peer messages:", error);
        return NextResponse.json({ error: "Failed to fetch messages" }, { status: 500 });
      }
      return NextResponse.json({ messages: data || [] });
    }

    if (!employeeId) {
      return NextResponse.json(
        { error: "Missing employee_id" },
        { status: 400 }
      );
    }

    // Manager thread only: exclude employee↔employee messages, which also
    // carry an employee_id (the sender's) but belong to peer conversations.
    const { data, error } = await supabase
      .from("internal_messages")
      .select("*")
      .eq("employee_id", Number(employeeId))
      .or("sender_role.eq.manager,receiver_role.eq.manager")
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Error fetching internal messages:", error);
      return NextResponse.json(
        { error: "Failed to fetch messages" },
        { status: 500 }
      );
    }

    return NextResponse.json({ messages: data || [] });
  } catch (err) {
    return errorResponse(err);
  }
}

// POST /api/internal-chat
// Send a message
export async function POST(request: NextRequest) {
  try {
    const session = await requireRole(request, STAFF);

    const body = await request.json();
    const {
      receiver_role,
      receiver_id,
      employee_id,
      message,
    } = body;

    // The sender is whoever holds the session — taking it from the body let
    // anyone post messages under a colleague's name.
    const sender_role = session.role;
    const sender_id = session.sub;
    const sender_name = session.name || "";

    if (!receiver_role || !receiver_id || !employee_id || !message) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("internal_messages")
      .insert({
        sender_role,
        sender_id: Number(sender_id),
        sender_name,
        receiver_role,
        receiver_id: Number(receiver_id),
        employee_id: Number(employee_id),
        message,
        is_read: false,
      })
      .select()
      .single();

    if (error) {
      console.error("Error sending internal message:", error);
      return NextResponse.json(
        { error: "Failed to send message" },
        { status: 500 }
      );
    }

    return NextResponse.json({ message: data, success: true });
  } catch (err) {
    return errorResponse(err);
  }
}

// PATCH /api/internal-chat
// Mark messages as read.
//   { employee_id, receiver_role }   → manager-thread messages (legacy)
//   { reader_id, peer_id }           → colleague messages from peer_id to reader_id
export async function PATCH(request: NextRequest) {
  try {
    await requireRole(request, STAFF);

    const body = await request.json();
    const { employee_id, receiver_role, reader_id, peer_id } = body;

    // Peer conversation: mark what the colleague sent me as read.
    if (reader_id && peer_id) {
      const { error } = await supabase
        .from("internal_messages")
        .update({ is_read: true })
        .eq("sender_role", "employee")
        .eq("receiver_role", "employee")
        .eq("sender_id", Number(peer_id))
        .eq("receiver_id", Number(reader_id))
        .eq("is_read", false);
      if (error) {
        console.error("Error marking peer messages read:", error);
        return NextResponse.json({ error: "Failed" }, { status: 500 });
      }
      return NextResponse.json({ success: true });
    }

    if (!employee_id || !receiver_role) {
      return NextResponse.json(
        { error: "Missing employee_id or receiver_role" },
        { status: 400 }
      );
    }

    // Manager-thread only: the other side of this thread is always the manager
    // when the reader is the employee, and vice versa. Without this, an
    // employee's own sent colleague messages (which share employee_id) would
    // get marked read here.
    const otherRole = receiver_role === "employee" ? "manager" : "employee";
    const { error } = await supabase
      .from("internal_messages")
      .update({ is_read: true })
      .eq("employee_id", Number(employee_id))
      .eq("receiver_role", receiver_role)
      .eq("sender_role", otherRole)
      .eq("is_read", false);

    if (error) {
      console.error("Error marking messages as read:", error);
      return NextResponse.json(
        { error: "Failed to mark messages as read" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return errorResponse(err);
  }
}
