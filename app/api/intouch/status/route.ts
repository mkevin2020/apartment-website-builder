import { NextRequest, NextResponse } from "next/server";
import { requireSession, errorResponse } from "@/lib/auth/session";
import { enforceRateLimit } from "@/lib/auth/rate-limit";
import { parseQuery, z, shortText } from "@/lib/auth/validate";
import { callPythonBackend } from "@/lib/python-backend";

/**
 * GET /api/intouch/status?request_transaction_id=...&transaction_id=...
 *
 * Any signed-in user may poll a transaction they are in the middle of paying,
 * so this is requireSession rather than staff-only. It was previously open to
 * anyone, which allowed transaction-id enumeration against the gateway.
 */
const statusSchema = z.object({
  request_transaction_id: shortText(128),
  transaction_id: shortText(128),
});

export async function GET(request: NextRequest) {
  try {
    await requireSession(request);
    // Polling endpoint: the ceiling is generous but stops an enumeration sweep.
    await enforceRateLimit(request, "intouch-status", 120, 60 * 60);

    const query = parseQuery(request, statusSchema);

    const { ok, status, data } = await callPythonBackend("/api/payments/status", {
      method: "GET",
      query: {
        request_transaction_id: query.request_transaction_id,
        transaction_id: query.transaction_id,
      },
    });

    if (!ok) {
      return NextResponse.json(
        { error: "Could not check transaction status." },
        { status: status === 401 ? 502 : status },
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    return errorResponse(error);
  }
}
