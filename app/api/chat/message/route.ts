import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { getSession, errorResponse } from "@/lib/auth/session";
import { enforceRateLimit } from "@/lib/auth/rate-limit";
import { parseJson, z, shortText } from "@/lib/auth/validate";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // Use service role key for server-side operations
);

const chatSchema = z.object({
  sessionId: shortText(128),
  message: z.string().trim().min(1).max(2000),
  page: z.string().trim().max(200).optional(),
  // userRole / userName / userId are accepted for backwards compatibility with
  // older clients but are DELIBERATELY IGNORED — see below.
  userRole: z.unknown().optional(),
  userName: z.unknown().optional(),
  userId: z.unknown().optional(),
});

export async function POST(request: NextRequest) {
  try {
    // The model call is expensive and the endpoint is public, so cap it hard
    // per IP; signed-in users additionally get a per-account budget.
    await enforceRateLimit(request, "chat-ip", 30, 5 * 60);

    const { sessionId, message, page } = await parseJson(request, chatSchema);

    // ── Identity comes from the signed session cookie, never the request body ──
    //
    // This route previously took `userRole` and `userId` straight from the JSON
    // body. Two things followed from that:
    //
    //   1. Sending {"userRole":"admin"} put the assistant into ADMIN MODE for an
    //      anonymous caller.
    //   2. Sending {"userRole":"tenant","userId":42} made buildAccountContext()
    //      load tenant 42's name, email, phone, payment history and maintenance
    //      requests — and the assistant then read them back. Any tenant's PII,
    //      enumerable by id, with no session at all.
    //
    // The body values are now ignored entirely. An unauthenticated caller is a
    // visitor and gets the visitor prompt with no account context, whatever they
    // claim to be.
    const authSession = await getSession(request);
    if (authSession) {
      await enforceRateLimit(request, "chat-user", 60, 5 * 60, String(authSession.sub));
    }

    const effectiveRole = authSession?.role || "visitor";
    const effectiveName = authSession?.name || "";
    const effectiveUserId = authSession?.sub ?? null;

    // Keep the stored session row in step with who is actually signed in.
    const { data: sessionData } = await supabase
      .from("chat_sessions")
      .select("user_role, user_name")
      .eq("id", sessionId)
      .single();

    if (
      authSession &&
      (effectiveRole !== sessionData?.user_role || effectiveName !== sessionData?.user_name)
    ) {
      await supabase
        .from("chat_sessions")
        .update({ user_role: effectiveRole, user_name: effectiveName })
        .eq("id", sessionId);
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
      .limit(4); // Reduce to 4 messages for faster processing

    if (historyError) {
      console.error("Error fetching chat history:", historyError);
    }

    // Look up the signed-in tenant's own situation (apartment, dates, balance,
    // maintenance) so the bot can actually resolve their problem instead of
    // giving generic instructions.
    const accountContext = await buildAccountContext(effectiveRole, effectiveUserId);

    // Call the AI service with the CURRENT user role context + the page they're on
    const aiResponse = await callAIService(
      message,
      chatHistory || [],
      effectiveRole,
      effectiveName,
      page || "",
      accountContext
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

    return NextResponse.json({ reply: stripMarkdown(aiResponse) });
  } catch (error) {
    return errorResponse(error);
  }
}

// The upfront share a tenant pays when booking; the rest is the outstanding
// balance. Kept in step with app/tenant/dashboard/page.tsx.
const DEPOSIT_RATE = 0.4;

/**
 * The chat bubble renders PLAIN TEXT, so any markdown the model emits shows up
 * literally as **stars** and looks broken. The system prompt asks it not to,
 * but models ignore that often enough — this guarantees it.
 */
function stripMarkdown(text: string): string {
  if (!text) return text;
  return (
    text
      // ```code fences``` and `inline code`
      .replace(/```[\s\S]*?```/g, (m) => m.replace(/```[a-z]*\n?/gi, "").trim())
      .replace(/`([^`]+)`/g, "$1")
      // [label](url) -> label
      .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
      // ***bold italic***, **bold**, __bold__
      .replace(/\*\*\*([^*]+)\*\*\*/g, "$1")
      .replace(/\*\*([^*]+)\*\*/g, "$1")
      .replace(/__([^_]+)__/g, "$1")
      // leading bullet "* item" / "- item" -> "• item" (keeps the list readable)
      .replace(/^[ \t]*[*-][ \t]+/gm, "• ")
      // remaining *italic* (not a bullet, since those are handled above)
      .replace(/\*([^*\n]+)\*/g, "$1")
      // ### headings
      .replace(/^#{1,6}[ \t]*/gm, "")
      // markdown tables collapse into pipe soup — turn separators into spaces
      .replace(/^\s*\|?[-: |]+\|[-: |]*$/gm, "")
      .replace(/[ \t]*\|[ \t]*/g, "  ")
      .replace(/\n{3,}/g, "\n\n")
      .trim()
  );
}

/**
 * Builds a short factual summary of the signed-in tenant's own account —
 * apartment, stay dates, what they've paid, what's outstanding, and any open
 * maintenance requests — so "Ciel" can answer "what do I still owe?" or "when
 * does my stay end?" directly instead of telling them to go and look.
 *
 * Returns "" for visitors, staff, or if anything is missing, in which case the
 * bot behaves exactly as it did before.
 */
async function buildAccountContext(role: string, userId: any): Promise<string> {
  if (role !== "tenant" || userId == null) return "";

  try {
    const idStr = String(userId);
    const idNum = Number(userId);
    if (!Number.isFinite(idNum)) return "";

    // bookings.tenant_id is varchar; tenant_payments.tenant_id is integer.
    const [tenantRes, bookingRes, paymentsRes, maintRes] = await Promise.all([
      supabase.from("tenants").select("full_name, email, phone").eq("id", idNum).maybeSingle(),
      supabase
        .from("bookings")
        .select("id, apartment_id, start_date, end_date, status")
        .eq("tenant_id", idStr)
        .order("start_date", { ascending: false })
        .limit(1),
      supabase
        .from("tenant_payments")
        .select("amount, status, due_date, reference_number, apartment_id")
        .eq("tenant_id", idNum),
      supabase
        .from("maintenance_requests")
        .select("issue_type, description, status, created_at")
        .eq("tenant_id", idStr)
        .order("created_at", { ascending: false })
        .limit(3),
    ]);

    const booking = bookingRes.data?.[0];
    const payments = paymentsRes.data || [];
    const lines: string[] = [];

    const tenant = tenantRes.data as any;
    if (tenant?.full_name) lines.push(`Name: ${tenant.full_name}`);
    if (tenant?.email) lines.push(`Email: ${tenant.email}`);

    let apartmentName = "";
    if (booking?.apartment_id != null) {
      const { data: apt } = await supabase
        .from("apartments")
        .select("name, price_per_month")
        .eq("id", booking.apartment_id)
        .maybeSingle();
      apartmentName = (apt as any)?.name || "";
      if (apartmentName) lines.push(`Apartment: ${apartmentName}`);
      if (booking.start_date || booking.end_date) {
        lines.push(`Stay: ${booking.start_date || "?"} to ${booking.end_date || "?"} (${booking.status || "unknown"})`);
      }

      // Recover the full price: newer rows store the total ("BKG-"), older ones
      // only the deposit ("DEP-").
      const paid = payments
        .filter((p: any) => p.status === "completed")
        .reduce((s: number, p: any) => s + (Number(p.amount) || 0), 0);
      const bookingPay = payments.find((p: any) => {
        const ref = String(p.reference_number || "");
        return ref.startsWith("BKG-") || ref.startsWith("DEP-");
      });
      let total = 0;
      if (bookingPay) {
        const ref = String(bookingPay.reference_number || "");
        const amt = Number(bookingPay.amount) || 0;
        total = ref.startsWith("DEP-") ? amt / DEPOSIT_RATE : amt;
      }
      if (!total) total = Number((apt as any)?.price_per_month) || 0;

      const outstanding = Math.max(0, Math.round(total - paid));
      lines.push(`Total for the stay: RWF ${Math.round(total).toLocaleString()}`);
      lines.push(`Paid so far: RWF ${Math.round(paid).toLocaleString()}`);
      lines.push(
        outstanding > 0
          ? `STILL OWES: RWF ${outstanding.toLocaleString()}`
          : `Balance: fully paid, nothing outstanding.`,
      );
    } else {
      lines.push("No confirmed booking on file yet.");
    }

    const pending = payments.filter((p: any) => p.status === "pending" || p.status === "processing");
    if (pending.length > 0) {
      const amt = pending.reduce((s: number, p: any) => s + (Number(p.amount) || 0), 0);
      lines.push(`Payments in progress: ${pending.length} totalling RWF ${Math.round(amt).toLocaleString()}`);
    }

    const openMaint = (maintRes.data || []).filter((m: any) => m.status !== "completed" && m.status !== "resolved");
    if (openMaint.length > 0) {
      lines.push(
        `Open maintenance requests: ` +
          openMaint.map((m: any) => `${m.issue_type || "issue"} (${m.status || "pending"})`).join("; "),
      );
    }

    if (lines.length === 0) return "";

    return `\n\n## THIS TENANT'S ACCOUNT (live data — you may use it directly)
${lines.join("\n")}

Use these figures when they ask about THEIR booking, balance, payments, or maintenance.
Quote the real numbers rather than telling them to go and look it up. Never reveal or
discuss any other tenant's information.`;
  } catch (e) {
    console.error("Failed to build tenant context for chat:", e);
    return "";
  }
}

async function callAIService(
  userMessage: string,
  chatHistory: Array<{ sender_role: string; message: string }>,
  userRole: string = "visitor",
  userName: string = "",
  page: string = "",
  accountContext: string = ""
) {
  const ollamaUrl = process.env.OLLAMA_API_URL;
  const ollamaModel = process.env.OLLAMA_MODEL || "gpt-oss:120b-cloud";

  // Fetch live data so the assistant always gives accurate, current answers
  let availabilityInfo = "There are currently no apartments listed as available. Invite the user to check back soon.";
  try {
    // select("*") so a missing price_per_day column (pre-migration) doesn't break the query
    const { data: apts } = await supabase
      .from("apartments")
      .select("*")
      .eq("is_available", true)
      .order("price_per_month", { ascending: true });
    if (apts && apts.length > 0) {
      availabilityInfo = apts
        .map((a: any) => {
          const dayPart = a.price_per_day
            ? ` or RWF ${Number(a.price_per_day).toLocaleString()}/day`
            : "";
          return `- ${a.name}${a.type ? ` (${a.type})` : ""}: ${a.bedrooms ?? "?"} bed / ${a.bathrooms ?? "?"} bath — RWF ${Number(
            a.price_per_month || 0
          ).toLocaleString()}/month${dayPart}.${a.description ? ` ${a.description}` : ""}`;
        })
        .join("\n");
    }
  } catch (e) {
    console.error("Failed to load live apartment data for chat:", e);
  }

  // Generate system prompt based on user role
  let systemPrompt = `You are "Ciel", the official AI assistant for Cielo Vista Apartments — a premium residential complex in Kigali, Rwanda. You help visitors, tenants, employees, and administrators. All prices are in Rwandan Francs (RWF).

## ABOUT CIELO VISTA
- Modern apartments in Kigali, Rwanda, in configurations such as studio, 1, 2, and 3-bedroom units.
- Each apartment has BOTH a per-month price and a per-day price, so guests can book short or long stays.
- Fully online booking and secure online payment.

## CURRENTLY AVAILABLE APARTMENTS (LIVE DATA — always use these exact names and prices; never invent others)
${availabilityInfo}

## HOW BOOKING WORKS
1. Browse available apartments on the "Apartments" page (or the homepage "Featured Listings").
2. Click "View Details" / "Book" to open the booking form.
3. Choose move-in and move-out dates, and pick a billing rate: **Per Day** or **Per Month**.
4. The total is calculated automatically (rate × number of days or months).
5. To confirm, the tenant pays a **40% deposit** of the total upfront; the remaining 60% is arranged with management.
6. Once booked, the apartment is marked occupied and removed from the available list.

## ACCOUNTS & APPROVAL
- New tenants register on the "Register" page (with email OTP verification).
- An admin must **approve** the account before the tenant can log in. The tenant gets an email when approved (or declined).
- After approval, tenants log in to their dashboard.

## PAYMENTS
- Payments are processed securely online by **Stripe** (Visa, Mastercard, and other major cards).
- After a successful payment, a **receipt with a QR code** is generated and emailed to the tenant.
- Tenants can view all payments and receipts under "Payment History".
- IMPORTANT: We do NOT use mobile money, MTN, Airtel, or IntouchPay — card payment via Stripe only.

## TENANT PORTAL FEATURES
Dashboard, Make a Payment, Payment History, Booked Apartments, Maintenance Requests, and Profile.

## ROLES
Visitors (browse/book), Tenants (portal), Employees & Managers (operations), Admin (full management).

## HOW TO BEHAVE
- Be warm, professional, and concise (usually 1–2 short paragraphs).
- For availability/pricing questions, use the LIVE list above — give the real apartment names and RWF prices. If the list is empty, say nothing is available right now and invite them to check back.
- Guide users step-by-step through booking, registration, or payment when asked.
- NEVER invent apartments, prices, amenities, or policies that aren't provided here. If unsure, suggest contacting support.
- Personalize responses when you know the user's name.

## HOW TO FORMAT YOUR REPLY (IMPORTANT)
Your reply is shown as PLAIN TEXT in a small chat bubble. Markdown is NOT rendered — it
appears literally on screen as raw symbols and looks broken to the user.
- NEVER use tables or pipe characters (|). They come out as an unreadable wall of pipes.
- NEVER use asterisks (*) for bold or bullets, and no #, backticks, or [links](url).
- To list apartments, write one per line as a plain sentence, like:
  kevin — 1 bed / 1 bath — RWF 1,200 per month or RWF 250 per day
- Keep it short: a sentence or two, then at most a handful of these lines.`;

  // Customize prompt based on user role
  if (userRole === "admin") {
    systemPrompt += `\n\n### ADMIN MODE (${userName})
You are assisting an Administrator with full system access. In this mode:
- Provide detailed operational insights and analytics
- Help with property management decisions
- Discuss tenant and system administration
- Provide strategic recommendations for business operations
- Be more technical and data-oriented in responses
- Help troubleshoot system issues and provide solutions
- Assist with staff management and workflows`;
  } else if (userRole === "manager") {
    systemPrompt += `\n\n### MANAGER MODE (${userName})
You are assisting a Manager. In this mode:
- Provide operational insights: occupancy, available vs occupied units, bookings, and revenue.
- Help interpret reports (daily/weekly/yearly) and refund requests.
- Assist with staff attendance, ticket scanning/check-ins, and tenant oversight.
- Be data-oriented and concise; give actionable recommendations.
- Help troubleshoot day-to-day operational issues.`;
  } else if (userRole === "employee") {
    systemPrompt += `\n\n### EMPLOYEE MODE (${userName})
You are assisting a Staff Member. In this mode:
- Help answer tenant inquiries professionally
- Assist with booking management and scheduling
- Provide operational guidance on processes
- Help resolve common tenant issues
- Escalate complex issues to management
- Stay within your assigned responsibilities
- Maintain professional boundaries with tenants`;
  } else if (userRole === "tenant") {
    systemPrompt += `\n\n### TENANT MODE (${userName})
You are assisting a Current Resident. In this mode:
- Focus on tenant-specific services and support
- Help with payment, maintenance, and account issues
- Provide personalized assistance
- Explain lease terms and tenant rights
- Guide them through tenant portal features
- Be extra helpful and attentive to their needs
- Prioritize quick issue resolution`;
  } else {
    systemPrompt += `\n\n### VISITOR MODE
You are assisting a Potential Resident. In this mode:
- Be warm and welcoming
- Highlight apartment features and amenities
- Guide them through the booking process
- Answer questions about availability and pricing
- Encourage them to schedule a tour
- Help them understand the rental application process`;
  }

  // Tell the assistant which page the user is currently viewing so it can tailor
  // help to their context (e.g. payment page → explain payment; apartments page →
  // help choose/book). The logged-in ROLE above still sets the overall tone.
  if (page) {
    const pageHints: Record<string, string> = {
      "/": "the public home page (treat as a visitor unless their role says otherwise)",
      "/apartments": "the apartments listing page — help them browse and choose",
      "/booking": "the booking page — guide them through booking and the deposit",
      "/tenant/dashboard": "their tenant dashboard",
      "/tenant/payments": "the Make a Payment page — help them pay",
      "/tenant/payment-history": "their Payment History (receipts, refunds)",
      "/tenant/maintenance": "the Maintenance Requests page",
      "/tenant/booked-apartments": "their Booked Apartments page",
      "/manager/dashboard": "the manager dashboard (operations, reports, refunds)",
      "/admin/dashboard": "the admin dashboard (full management)",
    };
    const hint = pageHints[page] || `the page "${page}"`;
    systemPrompt += `\n\n### CURRENT PAGE\nThe user is currently on ${hint}. Tailor your help to what they can do here.`;
  }

  // The signed-in tenant's own booking/balance/maintenance, appended last so it
  // takes precedence over the generic guidance above. Empty for everyone else.
  if (accountContext) {
    systemPrompt += accountContext;
  }

  // Build messages array
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

  // Use Ollama as the AI provider when it's available; otherwise fall back to a
  // rule-based reply built from the live data above so the assistant NEVER shows
  // a scary "service down" error to a visitor (important during the defense demo).
  if (ollamaUrl) {
    try {
      console.log(`Using Ollama model: ${ollamaModel} at ${ollamaUrl}`);

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
          // Reasoning models spend tokens thinking before answering, so the cap
          // must leave room for both — too low and the reply comes back empty.
          num_predict: 600,
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
      // Empty model response → fall through to the rule-based reply below.
    } catch (error) {
      console.error("Error calling Ollama API (using offline fallback):", error);
      // Fall through to the rule-based reply below.
    }
  }

  return localFallbackReply(userMessage, availabilityInfo, userName);
}

// Keyword-driven answers from the live data + known policies, used whenever the
// AI model is unavailable. Keeps the chatbot useful even with no model running.
function localFallbackReply(
  userMessage: string,
  availabilityInfo: string,
  userName: string,
): string {
  const q = userMessage.toLowerCase();
  const hi = userName ? `${userName}, ` : "";
  const has = (...words: string[]) => words.some((w) => q.includes(w));

  // Small talk — answer like a person before assuming it's an apartment question
  if (has("how are you", "are you good", "are you ok", "are you okay", "are you fine", "you good", "what's up", "whats up", "how is it going", "how's it going")) {
    return `I'm doing great, thanks for asking${userName ? `, ${userName}` : ""}! 😊 How can I help you today — apartments, booking, or payments?`;
  }
  if (has("thank you", "thanks", "thx", "merci", "murakoze")) {
    return `You're welcome${userName ? `, ${userName}` : ""}! Is there anything else I can help you with?`;
  }
  if (has("bye", "goodbye", "good night", "see you")) {
    return `Goodbye${userName ? `, ${userName}` : ""}! Feel free to come back any time. 👋`;
  }
  if (has("who are you", "your name", "what are you")) {
    return `I'm Ciel, the assistant for Cielo Vista Apartments. I can help you check availability and prices, book an apartment, create an account, and handle payments or refunds.`;
  }
  if (has("what can you do", "help me", "what do you do")) {
    return `${hi}I can help you with:\n• Apartment availability & prices\n• Booking a stay (per day or per month)\n• Registering a tenant account\n• Payments, receipts & refunds\n• Maintenance requests\n\nWhat would you like to do?`;
  }

  // Greetings
  if (/\b(hello|hi|hey|good morning|good afternoon|good evening|bonjour|muraho)\b/.test(q) && q.length < 25) {
    return `Hello ${userName || "there"}! 👋 I can help with apartment availability, prices, booking, registration, and payments. What would you like to know?`;
  }

  // Availability / pricing / what's open
  if (has("available", "availab", "price", "cost", "how much", "rent", "apartment", "room", "studio", "bedroom", "list", "vacant", "open")) {
    return `Here are the apartments currently available at Cielo Vista:\n\n${availabilityInfo}\n\nWould you like help booking one of these?`;
  }

  // Booking
  if (has("book", "reserve", "reservation", "move in", "move-in", "stay")) {
    return `${hi}booking is simple:\n1. Open the "Apartments" page and pick one.\n2. Click "Book" and choose your move-in / move-out dates and a Per-Day or Per-Month rate.\n3. The total is calculated automatically.\n4. Pay a 40% deposit online to confirm; the rest is arranged with management.\nOnce booked, the apartment is marked occupied. Want to see what's available?`;
  }

  // Registration / accounts
  if (has("register", "sign up", "signup", "create account", "account", "approve", "approval")) {
    return `${hi}to get a tenant account:\n1. Go to the "Register" page and sign up (you'll verify your email with a one-time code).\n2. An admin reviews and approves your account — you'll get an email once approved.\n3. After approval you can log in to your tenant dashboard.`;
  }

  // Payments / refunds
  if (has("pay", "payment", "deposit", "stripe", "card", "receipt", "refund", "money back")) {
    if (has("refund", "money back")) {
      return `${hi}for refunds: tenants can request one from "Payment History"; guests can request at the /refund page using their reference number and email. Refunds are processed and the money is returned to your card via Stripe, and you'll get an email confirmation.`;
    }
    return `${hi}payments are made securely online by card through Stripe (Visa, Mastercard, etc.). You pay a 40% deposit to confirm a booking, and a receipt with a QR code is emailed to you. You can view everything under "Payment History". We do not use mobile money.`;
  }

  // Maintenance
  if (has("maintenance", "repair", "broken", "fix", "leak", "problem with")) {
    return `${hi}if you're a tenant, log in and open "Maintenance Requests" in your dashboard to report the issue — staff will follow up. Need help logging in?`;
  }

  // Location / contact / hours
  if (has("where", "location", "address", "contact", "phone", "email", "reach")) {
    return `Cielo Vista is a residential complex in Kigali, Rwanda. For anything I can't answer here, please reach out to our support team and they'll be glad to help.`;
  }

  // Default — admit we didn't catch it instead of dumping the whole apartment list
  return `${hi}I'm not sure I understood that. I can help with:\n• Apartment availability & prices\n• Booking a stay\n• Registering an account\n• Payments, receipts & refunds\n\nCould you tell me a bit more about what you need?`;
}
