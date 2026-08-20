import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSession, HttpError, type SessionPayload } from "./session";

// ─────────────────────────────────────────────────────────────────────────────
// Shared ownership check for the payment endpoints.
//
// Every checkout route used to take `paymentId` (and often `tenantId` and
// `amount`) straight from the request body, so a signed-in tenant could drive
// someone else's invoice — pay it, cancel it, or read the tenant details
// attached to it. These helpers make the caller prove the payment is theirs,
// and make the amount come from the database rather than the browser.
// ─────────────────────────────────────────────────────────────────────────────

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || "",
);

export interface OwnedPayment {
  id: number;
  amount: number;
  status: string;
  reference_number: string;
  apartment_id: number | null;
  tenant_id: number | null;
  transaction_id: string | null;
  [key: string]: unknown;
}

/**
 * Load a payment the caller is entitled to act on.
 *
 * - staff (admin/manager) may act on any payment
 * - a tenant may act only on payments whose tenant_id is their own
 * - guests (no session) are rejected
 *
 * Always returns the *stored* row, so callers should price from
 * `payment.amount` and never from a client-supplied amount.
 */
export async function loadOwnedPayment(
  req: NextRequest,
  paymentId: number | string,
  opts: { columns?: string } = {},
): Promise<{ payment: OwnedPayment; session: SessionPayload }> {
  const session = await getSession(req);
  if (!session) throw new HttpError(401, "You must be signed in to do this.");

  const { data, error } = await supabase
    .from("tenant_payments")
    .select(opts.columns || "*")
    .eq("id", Number(paymentId))
    .single();

  if (error || !data) throw new HttpError(404, "Payment not found.");
  const payment = data as unknown as OwnedPayment;

  const isStaff = session.role === "admin" || session.role === "manager";
  const isOwner =
    session.role === "tenant" &&
    payment.tenant_id != null &&
    String(payment.tenant_id) === String(session.sub);

  if (!isStaff && !isOwner) {
    // Same message either way — don't reveal whether the id exists.
    throw new HttpError(403, "You do not have access to this payment.");
  }

  return { payment, session };
}

/** Reject a payment that has already been settled. */
export function assertPayable(payment: OwnedPayment): void {
  if (payment.status === "completed") {
    throw new HttpError(409, "This payment has already been completed.");
  }
  if (payment.status === "refunded" || payment.status === "cancelled") {
    throw new HttpError(409, "This payment is no longer payable.");
  }
}
