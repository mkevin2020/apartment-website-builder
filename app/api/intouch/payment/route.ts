import { NextRequest, NextResponse } from "next/server";
import { requireRole, ADMIN_OR_MANAGER, errorResponse } from "@/lib/auth/session";
import { enforceRateLimit } from "@/lib/auth/rate-limit";
import { parseJson, z, phoneSchema, amountSchema, shortText } from "@/lib/auth/validate";
import { callPythonBackend } from "@/lib/python-backend";
import { recordAudit } from "@/lib/audit";

/**
 * POST /api/intouch/payment — request a payment from a tenant via IntouchPay.
 *
 * Staff only. This endpoint was previously unauthenticated and forwarded the
 * request body verbatim, so anyone who found the URL could push a payment
 * prompt for any amount to any phone number, and trigger the accompanying SMS
 * on the business's SMS credit.
 */
const paymentSchema = z.object({
  amount: amountSchema,
  phone_number: phoneSchema,
  tenant_id: shortText(64),
  apartment_id: shortText(64),
  month: shortText(32),
  description: shortText(200).optional(),
  send_sms: z.boolean().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const session = await requireRole(request, ADMIN_OR_MANAGER);
    await enforceRateLimit(request, "intouch-payment", 30, 60 * 60);

    // Validated here as well as in FastAPI: the service trusts callers holding
    // the internal key, so this route is the boundary that faces the browser.
    const body = await parseJson(request, paymentSchema);

    const { ok, status, data } = await callPythonBackend("/api/payments/request", {
      method: "POST",
      body,
    });

    await recordAudit(
      {
        action: "payment.checkout.created",
        outcome: ok ? "success" : "failure",
        target: `tenant:${body.tenant_id}`,
        metadata: {
          provider: "intouchpay",
          amount: body.amount,
          apartment_id: body.apartment_id,
          month: body.month,
        },
      },
      { req: request, session },
    );

    if (!ok) {
      return NextResponse.json(
        { error: "Payment request failed. Please try again." },
        { status: status === 401 ? 502 : status },
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    return errorResponse(error);
  }
}
