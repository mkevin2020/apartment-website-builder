import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // Use service role key for server-side operations
);

export async function POST(request: NextRequest) {
  try {
    const { sessionId, message } = await request.json();

    if (!sessionId || !message) {
      return NextResponse.json(
        { error: "Missing sessionId or message" },
        { status: 400 }
      );
    }

    // Store user message in database
    const { error: messageError } = await supabase
      .from("chat_messages")
      .insert({
        session_id: sessionId,
        sender_role: "user",
        message,
      });

    if (messageError) {
      console.error("Error storing user message:", messageError);
      return NextResponse.json(
        { error: "Failed to store message" },
        { status: 500 }
      );
    }

    // Get chat history for context
    const { data: chatHistory, error: historyError } = await supabase
      .from("chat_messages")
      .select("sender_role, message")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: true })
      .limit(10); // Get last 10 messages for context

    if (historyError) {
      console.error("Error fetching chat history:", historyError);
    }

    // Call the AI service
    const aiResponse = await callAIService(message, chatHistory || []);

    // Store assistant response in database
    const { error: responseError } = await supabase
      .from("chat_messages")
      .insert({
        session_id: sessionId,
        sender_role: "assistant",
        message: aiResponse,
      });

    if (responseError) {
      console.error("Error storing assistant response:", responseError);
    }

    return NextResponse.json({ reply: aiResponse });
  } catch (error) {
    console.error("Chat API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

async function callAIService(
  userMessage: string,
  chatHistory: Array<{ sender_role: string; message: string }>
) {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    console.error("OpenAI API key is not configured");
    return "I'm experiencing technical difficulties. Please contact our support team.";
  }

  const systemPrompt = `You are a professional and friendly apartment receptionist for Cielo Vista Apartments. You help potential residents and current tenants with questions about:
- Apartment availability and types
- Rent prices and payment information
- Booking visits and tours
- Apartment rules and policies
- Maintenance requests and support
- General contact information

Always maintain a professional, warm, and helpful tone. If you cannot answer a specific question, politely suggest that the user contact our management team directly. When appropriate, provide phone numbers or direct them to speak with an admin. Keep responses concise and friendly. Never make promises about pricing or availability that require confirmation from management.`;

  const messages = [
    { role: "system", content: systemPrompt },
    ...chatHistory.map((msg) => ({
      role: msg.sender_role === "user" ? "user" : "assistant",
      content: msg.message,
    })),
    { role: "user", content: userMessage },
  ];

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages,
        max_tokens: 500,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error("OpenAI API error:", JSON.stringify(errorData, null, 2));
      console.error("Response status:", response.status);
      return `OpenAI Error: ${JSON.stringify(errorData)}`;
    }

    const data = await response.json();
    return (
      data.choices?.[0]?.message?.content ||
      "I'm unable to generate a response. Please try again or contact our support team."
    );
  } catch (error) {
    console.error("Error calling OpenAI API:", error);
    return "I'm experiencing technical difficulties. Please contact our support team at support@cielovista.com or call (555) 123-4567.";
  }
}
