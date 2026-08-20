import { NextRequest, NextResponse } from "next/server";
import { requireRole, STAFF, errorResponse } from "@/lib/auth/session";
import { enforceRateLimit } from "@/lib/auth/rate-limit";
import { parseJson, z, phoneSchema, amountSchema, shortText } from "@/lib/auth/validate";
import { callPythonBackend } from "@/lib/python-backend";

/**
 * POST /api/intouch/sms/confirmation — send a payment confirmation SMS.
 *
 * Staff only and rate limited. Every field here lands inside a text message
 * sent from the business's registered sender ID; while this route was open,
 * anyone could compose that message and address it to any number, which is a
 * ready-made smishing channel wearing your brand.
 */
const confirmationSchema = z.object({
  phone_number: phoneSchema,
  tenant_name: shortText(120),
  amount: amountSchema,
  apartment: shortText(120),
  month: shortText(32),
  reference_id: shortText(64),
});

export async function POST(request: NextRequest) {
  try {
    await requireRole(request, STAFF);
    await enforceRateLimit(request, "intouch-sms-confirmation", 30, 60 * 60);

    const body = await parseJson(request, confirmationSchema);

    const { ok, status, data } = await callPythonBackend(
      "/api/sms/payment-confirmation",
      { method: "POST", body },
    );

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
