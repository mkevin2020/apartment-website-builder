/**
 * Single source for the JWT signing secret used by receipt QR tokens and the
 * rotating attendance code.
 *
 * Previously five files each did `process.env.JWT_SECRET || "fallback-secret-…"`.
 * Any deployment that forgot to set JWT_SECRET therefore signed real check-in
 * tokens with a constant that is committed to the repository — meaning anyone
 * reading the source could mint a valid receipt or attendance token. Missing
 * configuration must fail loudly in production instead.
 */
let warned = false;

export function jwtSecret(): string {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "JWT_SECRET is not set. Generate one with: openssl rand -base64 48",
      );
    }
    return "dev-only-insecure-jwt-secret-change-me!!";
  }

  // Deliberately a warning rather than a hard failure on short secrets:
  // rotating this value invalidates every receipt QR code already issued to a
  // guest, so it has to be a decision the operator makes on purpose, not
  // something a deploy forces at 2am. Missing entirely is still fatal.
  if (secret.length < 32 && !warned) {
    warned = true;
    console.warn(
      "[security] JWT_SECRET is shorter than 32 characters. Consider rotating to " +
        "`openssl rand -base64 48` — note this invalidates existing receipt QR codes.",
    );
  }
  return secret;
}
