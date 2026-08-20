import { NextRequest, NextResponse } from "next/server";
import { requireRole, STAFF, errorResponse } from "@/lib/auth/session";
import { enforceRateLimit } from "@/lib/auth/rate-limit";
import { parseJson, z, phoneSchema } from "@/lib/auth/validate";
import { callPythonBackend } from "@/lib/python-backend";

/**
 * POST /api/intouch/sms/send
 * Send SMS notification
 *
 * Staff only and rate limited — this proxies straight to the SMS gateway, so
 * while it was open anyone could send texts to any number on your credit.
 */
const smsSchema = z.object({
  phone_number: phoneSchema,
  // 640 chars ≈ 4 SMS parts. Unbounded text here is billable by the segment.
  message: z.string().trim().min(1).max(640),
});

export async function POST(request: NextRequest) {
  try {
    await requireRole(request, STAFF);
    await enforceRateLimit(request, "intouch-sms", 20, 60 * 60);

    const body = await parseJson(request, smsSchema);

    const { ok, status, data } = await callPythonBackend("/api/sms/send", {
      method: "POST",
      body,
    });

    if (!ok) {
      return NextResponse.json(
        { error: "Message could not be sent." },
        { status: status === 401 ? 502 : status },
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    return errorResponse(error);
  }
}
