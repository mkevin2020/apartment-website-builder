import crypto from "crypto"
import { jwtSecret } from "@/lib/auth/secrets"

// Rotating, signed attendance code shown on the office screen.
// It changes every WINDOW_MS and is an HMAC of the time-window with the server
// secret — so it can't be forged, and a screenshot stops working after ~2 minutes.
const SECRET = jwtSecret()
const WINDOW_MS = 60_000 // code rotates every 60s

function windowFor(ts: number): number {
  return Math.floor(ts / WINDOW_MS)
}

export function attendanceTokenFor(win: number): string {
  return crypto.createHmac("sha256", SECRET).update(`attendance:${win}`).digest("hex").slice(0, 16)
}

export function currentAttendanceToken() {
  const now = Date.now()
  const win = windowFor(now)
  return {
    token: attendanceTokenFor(win),
    expiresIn: WINDOW_MS - (now % WINDOW_MS), // ms left before it rotates
    windowMs: WINDOW_MS,
  }
}

// How long the previous code stays usable after the display has rotated.
// This only covers someone who was mid-scan as the code flipped — it is NOT a
// second lifetime for the old code. Accepting the whole previous window (the
// old behaviour) let a photographed code keep working for a further 60s, which
// defeats the point of "verified" attendance.
const GRACE_MS = 10_000

// Valid if it matches the current window, or the previous one but only within
// GRACE_MS of the rotation.
export function isValidAttendanceToken(token: string): boolean {
  if (!token) return false
  const now = Date.now()
  const w = windowFor(now)
  if (token === attendanceTokenFor(w)) return true

  const intoWindow = now % WINDOW_MS // ms since the current code appeared
  if (intoWindow <= GRACE_MS && token === attendanceTokenFor(w - 1)) return true

  return false
}
