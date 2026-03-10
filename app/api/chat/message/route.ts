import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

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

    // Get session info to know user role
    const { data: sessionData } = await supabase
      .from("chat_sessions")
      .select("user_role, user_name")
      .eq("id", sessionId)
      .single();

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
      .limit(4); // Reduce to 4 messages for faster processing

    if (historyError) {
      console.error("Error fetching chat history:", historyError);
    }

    // Call the AI service with user role context
    const aiResponse = await callAIService(
      message,
      chatHistory || [],
      sessionData?.user_role || "visitor",
      sessionData?.user_name || ""
    );

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
  chatHistory: Array<{ sender_role: string; message: string }>,
  userRole: string = "visitor",
  userName: string = ""
) {
  const ollamaUrl = process.env.OLLAMA_API_URL;
  const ollamaModel = process.env.OLLAMA_MODEL || "mistral:7b";
  const googleApiKey = process.env.GOOGLE_AI_API_KEY;

  // Generate system prompt based on user role
  let systemPrompt = `You are a professional and friendly apartment receptionist for Cielo Vista Apartments. You help potential residents and current tenants with questions about:
- Apartment availability and types
- Rent prices and payment information
- Booking visits and tours
- Apartment rules and policies
- Maintenance requests and support
- General contact information

Always maintain a professional, warm, and helpful tone. If you cannot answer a specific question, politely suggest that the user contact our management team directly. When appropriate, provide phone numbers or direct them to speak with an admin. Keep responses concise and friendly. Never make promises about pricing or availability that require confirmation from management.`;

  // Customize prompt based on user role
  if (userRole === "admin") {
    systemPrompt += `\n\nYou are assisting an Administrator (${userName}). Provide additional insights on operations, tenant management, and system administration when relevant. Be more detailed and strategic in your responses.`;
  } else if (userRole === "employee") {
    systemPrompt += `\n\nYou are assisting an Employee (${userName}). Help with tenant inquiries, booking management, and operational questions. Be helpful but stay within employee responsibilities.`;
  } else if (userRole === "tenant") {
    systemPrompt += `\n\nYou are assisting a Tenant (${userName}). Focus on their apartment-related questions, maintenance, payments, and tenant services. Be extra helpful and friendly.`;
  }

  // Try Ollama first if configured
  if (ollamaUrl) {
    try {
      console.log(`Using Ollama model: ${ollamaModel}`);
      
      // Build messages for Ollama
      const messages = [
        {
          role: "system",
          content: systemPrompt,
        },
        ...chatHistory.map((msg) => ({
          role: msg.sender_role === "user" ? "user" : "assistant",
          content: msg.message,
        })),
        {
          role: "user",
          content: userMessage,
        },
      ];

      const response = await fetch(`${ollamaUrl}/api/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: ollamaModel,
          messages: messages,
          stream: false,
          temperature: 0.7,
          num_predict: 200, // Limit max tokens for faster response
          top_k: 40,
          top_p: 0.9,
        }),
      });

      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.statusText}`);
      }

      const data = await response.json();
      const aiResponse = data.message?.content || data.response || "";

      if (aiResponse) {
        return aiResponse;
      }
    } catch (ollamaError) {
      console.error("Error calling Ollama API:", ollamaError);
      console.log("Falling back to Google AI API...");
    }
  }

  // Fallback to Google AI API
  if (!googleApiKey) {
    console.error("Neither Ollama nor Google AI API is configured");
    return "I'm experiencing technical difficulties. Please contact our support team. Make sure Ollama is running on localhost:11434 or configure a Google AI API key.";
  }

  try {
    console.log("Using Google Gemini API");
    const genAI = new GoogleGenerativeAI(googleApiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    // Build conversation history for the model
    const history = chatHistory.map((msg) => ({
      role: msg.sender_role === "user" ? "user" : "model",
      parts: [{ text: msg.message }],
    }));

    // Start a chat session with history
    const chat = model.startChat({ history });

    // Send the new message and get response
    const result = await chat.sendMessage(userMessage);
    const aiResponse = result.response.text();

    return aiResponse || "I'm unable to generate a response. Please try again or contact our support team.";
  } catch (error) {
    console.error("Error calling Google Gemini API:", error);
    return "I'm experiencing technical difficulties. Please contact our support team at support@cielovista.com or call +250 788 352 933.";
  }
}
