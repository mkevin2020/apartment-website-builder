import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    // Get user info from request if available
    const { userEmail, userName, userRole } = await request.json().catch(() => ({}));

    // Determine user role (visitor by default, tenant if authenticated)
    const role = userRole || "visitor";

    // Create new chat session
    const { data, error } = await supabase
      .from("chat_sessions")
      .insert({
        user_email: userEmail,
        user_name: userName,
        user_role: role,
        is_active: true,
      })
      .select("id")
      .single();

    if (error) {
      console.error("Error creating chat session:", error);
      return NextResponse.json(
        { error: "Failed to create session" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      sessionId: data?.id,
      success: true,
    });
  } catch (error) {
    console.error("Session API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
