import { NextRequest } from "next/server";
import jwt from "jsonwebtoken";
import { createClient } from "@supabase/supabase-js";
import { getSession, HttpError, type SessionPayload } from "./session";
import { jwtSecret } from "./secrets";

// ─────────────────────────────────────────────────────────────────────────────
// Who is allowed to read a receipt.
//
// Both receipt routes previously did `if (token) { verify… }` — the token was
// OPTIONAL, so omitting it entirely skipped the check and returned the receipt.
// `GET /api/receipt/1`, `/2`, `/3`… walked out with every guest's name, email,
// phone number and payment amount, unauthenticated.
//
// A receipt has two legitimate audiences, and both must be proven:
//
//   1. The bearer of a signed QR token — printed on the receipt, scanned at
//      reception. This is why the routes stay reachable without a login.
//   2. A signed-in tenant reading their own, or staff reading any.
//
// Anything else is a 404: an attacker enumerating ids must not be able to tell
// an existing receipt from a missing one.
// ─────────────────────────────────────────────────────────────────────────────

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || "",
);

/** Deliberately identical for "does not exist" and "not yours". */
const notFound = () => new HttpError(404, "Receipt not found.");

export type ReceiptGrant =
  | { via: "token"; session: null }
  | { via: "session"; session: SessionPayload };

interface ReceiptTokenClaims {
  booking_id?: number;
  tenant_payment_id?: number;
  type?: string;
}

/** Pull the QR token from `?token=` or an `Authorization: Bearer` header. */
export function receiptTokenFrom(req: NextRequest): string | null {
  const query = req.nextUrl.searchParams.get("token");
  if (query) return query;
  const header = req.headers.get("authorization");
  if (header?.startsWith("Bearer ")) return header.slice(7).trim();
  return null;
}

/**
 * Verify a QR token and confirm it was minted for this exact record.
 * Returns false rather than throwing so the caller can fall through to the
 * session check.
 */
function tokenGrants(
  token: string,
  kind: "booking" | "payment",
  id: number,
): boolean {
  try {
    const claims = jwt.verify(token, jwtSecret()) as ReceiptTokenClaims;

    if (kind === "booking") {
      // The booking QR is minted with an explicit type; keep requiring it so a
      // token issued for something else cannot be replayed here.
      if (claims.type && claims.type !== "receipt_verification") return false;
      return claims.booking_id === id;
    }
    // Payment receipts historically carried either claim.
    return claims.tenant_payment_id === id || claims.booking_id === id;
  } catch {
    // Expired, wrong key, or malformed — no grant.
    return false;
  }
}

/**
 * Authorise a *payment* receipt read.
 * Staff may read any; a tenant may read one whose payment is theirs.
 */
export async function authorizePaymentReceipt(
  req: NextRequest,
  paymentId: number,
): Promise<ReceiptGrant> {
  const token = receiptTokenFrom(req);
  if (token && tokenGrants(token, "payment", paymentId)) {
    return { via: "token", session: null };
  }

  const session = await getSession(req);
  if (!session) throw notFound();

  if (session.role === "admin" || session.role === "manager" || session.role === "employee") {
    return { via: "session", session };
  }

  if (session.role === "tenant") {
    const { data } = await supabase
      .from("tenant_payments")
      .select("tenant_id")
      .eq("id", paymentId)
      .single();
    if (data && String(data.tenant_id) === String(session.sub)) {
      return { via: "session", session };
    }
  }

  throw notFound();
}

/**
 * Authorise a *booking* receipt read.
 * Bookings are made by guests who may have no account at all, so ownership is
 * matched on the email attached to the booking.
 */
export async function authorizeBookingReceipt(
  req: NextRequest,
  bookingId: number,
): Promise<ReceiptGrant> {
  const token = receiptTokenFrom(req);
  if (token && tokenGrants(token, "booking", bookingId)) {
    return { via: "token", session: null };
  }

  const session = await getSession(req);
  if (!session) throw notFound();

  if (session.role === "admin" || session.role === "manager" || session.role === "employee") {
    return { via: "session", session };
  }

  if (session.role === "tenant" && session.email) {
    const { data } = await supabase
      .from("bookings")
      .select("email")
      .eq("id", bookingId)
      .single();
    if (
      data?.email &&
      String(data.email).trim().toLowerCase() === session.email.trim().toLowerCase()
    ) {
      return { via: "session", session };
    }
  }

  throw notFound();
}
