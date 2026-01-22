import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  try {
    // Get query parameters for pagination
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");

    // Fetch sessions with message counts
    const { data: sessions, error: sessionError } = await supabase
      .from("chat_sessions")
      .select(
        `
        id,
        user_email,
        user_name,
        user_role,
        created_at
      `
      )
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (sessionError) {
      console.error("Error fetching sessions:", sessionError);
      return NextResponse.json(
        { error: "Failed to fetch sessions" },
        { status: 500 }
      );
    }

    // Get message counts for each session
    const sessionsWithCounts = await Promise.all(
      (sessions || []).map(async (session) => {
        const { count, error: countError } = await supabase
          .from("chat_messages")
          .select("id", { count: "exact", head: true })
          .eq("session_id", session.id);

        return {
          ...session,
          message_count: count || 0,
        };
      })
    );

    return NextResponse.json({
      sessions: sessionsWithCounts,
      success: true,
    });
  } catch (error) {
    console.error("Sessions API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
