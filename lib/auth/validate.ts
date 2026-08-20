import { NextRequest } from "next/server";
import { z } from "zod";
import { HttpError } from "./session";

// ─────────────────────────────────────────────────────────────────────────────
// Input validation for route handlers.
//
// Beyond rejecting malformed input, parsing through a schema is what stops
// field tampering: zod strips keys the schema does not declare, so a client
// cannot smuggle `{ role: "admin" }` or `{ status: "completed" }` into an
// object that gets spread into a database update.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Ceiling on a JSON request body. Every body in this app is a small object;
 * the largest legitimate one is a maintenance description at a few KB. Without
 * a limit, an unauthenticated POST can make the server buffer an arbitrarily
 * large payload before validation ever runs.
 *
 * Note this does NOT apply to file uploads, which stream through FormData —
 * see the size check in app/api/upload-apartment-image/route.ts.
 */
const MAX_JSON_BODY_BYTES = 128 * 1024; // 128 KB

export async function parseJson<T extends z.ZodTypeAny>(
  req: NextRequest,
  schema: T,
  opts: { maxBytes?: number } = {},
): Promise<z.infer<T>> {
  const maxBytes = opts.maxBytes ?? MAX_JSON_BODY_BYTES;

  // Cheap rejection first: trust the declared length only to say "no".
  const declared = req.headers.get("content-length");
  if (declared && Number(declared) > maxBytes) {
    throw new HttpError(413, "Request body is too large.");
  }

  let raw: unknown;
  try {
    // Read as text so the actual size can be checked — a Content-Length header
    // that lies, or is absent under chunked encoding, must not get past.
    const text = await req.text();
    if (text.length > maxBytes) {
      throw new HttpError(413, "Request body is too large.");
    }
    raw = JSON.parse(text);
  } catch (err) {
    if (err instanceof HttpError) throw err;
    throw new HttpError(400, "Request body must be valid JSON.");
  }

  const result = schema.safeParse(raw);
  if (!result.success) {
    const first = result.error.issues[0];
    const path = first.path.join(".");
    throw new HttpError(400, path ? `${path}: ${first.message}` : first.message);
  }
  return result.data;
}

/** Validate query-string params the same way as a JSON body. */
export function parseQuery<T extends z.ZodTypeAny>(
  req: NextRequest,
  schema: T,
): z.infer<T> {
  const params = Object.fromEntries(req.nextUrl.searchParams.entries());
  const result = schema.safeParse(params);
  if (!result.success) {
    const first = result.error.issues[0];
    const path = first.path.join(".");
    throw new HttpError(400, path ? `${path}: ${first.message}` : first.message);
  }
  return result.data;
}

// ── Reusable field schemas ───────────────────────────────────────────────────

/** Accepts 12 or "12" — Postgres bigint ids arrive as both across this app. */
export const idSchema = z.coerce.number().int().positive();

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email("Please enter a valid email address.")
  .max(254);

/**
 * Phone numbers. Deliberately permissive on format (the app takes Rwandan
 * mobiles as 078…, 2507…, +2507…) — it only enforces "digits, plausible
 * length", which is what keeps junk out of the SMS provider.
 */
export const phoneSchema = z
  .string()
  .trim()
  .regex(/^\+?[0-9\s-]{9,20}$/, "Please enter a valid phone number.")
  .transform((v) => v.replace(/[\s-]/g, ""));

export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters.")
  .max(128, "Password must be 128 characters or fewer.");

/** Free-text that will be stored and later displayed to staff. */
export const shortText = (max = 200) => z.string().trim().min(1).max(max);
export const longText = (max = 4000) => z.string().trim().min(1).max(max);

export const amountSchema = z.coerce
  .number()
  .positive("Amount must be greater than zero.")
  .max(100_000_000, "Amount is too large.");

export { z };
