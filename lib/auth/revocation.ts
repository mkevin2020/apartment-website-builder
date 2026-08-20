import { createClient } from "@supabase/supabase-js";
import type { SessionPayload } from "./session";

// ─────────────────────────────────────────────────────────────────────────────
// Session revocation.
//
// Session tokens are stateless, so a signature check alone cannot tell a live
// session from one that was logged out ten seconds ago. This module is the
// missing half: a denylist consulted alongside the signature.
//
// Design constraint: this runs on the Edge runtime (proxy.ts) as well as in
// Node route handlers, and it must not add a database round-trip to every
// request. So the denylist is cached in module memory with a short TTL. That
// means revocation can take up to CACHE_TTL_MS to propagate to an instance
// that has already cached a clean answer — an acceptable trade for not paying
// a query per request. Logout on the current device is immediate regardless,
// because the cookie is cleared.
//
// Requires scripts/034-session-revocation.sql.
// ─────────────────────────────────────────────────────────────────────────────

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || "",
);

const CACHE_TTL_MS = 30_000;

interface RevocationSnapshot {
  jtis: Set<string>;
  /** "role:sub" -> cutoff epoch ms. Tokens issued before this are dead. */
  cutoffs: Map<string, number>;
  fetchedAt: number;
}

let snapshot: RevocationSnapshot | null = null;
let inflight: Promise<RevocationSnapshot> | null = null;

async function loadSnapshot(): Promise<RevocationSnapshot> {
  const now = Date.now();
  if (snapshot && now - snapshot.fetchedAt < CACHE_TTL_MS) return snapshot;
  // Collapse concurrent refreshes into one query.
  if (inflight) return inflight;

  inflight = (async () => {
    try {
      const [revoked, cutoffs] = await Promise.all([
        supabase.from("revoked_sessions").select("jti").gt("expires_at", new Date().toISOString()),
        supabase.from("session_cutoffs").select("role, subject_id, not_before"),
      ]);

      const next: RevocationSnapshot = {
        jtis: new Set((revoked.data || []).map((r: { jti: string }) => r.jti)),
        cutoffs: new Map(
          (cutoffs.data || []).map((c: { role: string; subject_id: number; not_before: string }) => [
            `${c.role}:${c.subject_id}`,
            new Date(c.not_before).getTime(),
          ]),
        ),
        fetchedAt: Date.now(),
      };
      snapshot = next;
      return next;
    } catch {
      // Tables missing (migration not run) or transient failure. Fail OPEN:
      // treating every session as revoked would lock the whole app out.
      const empty: RevocationSnapshot = {
        jtis: new Set(),
        cutoffs: new Map(),
        fetchedAt: Date.now(),
      };
      snapshot = empty;
      return empty;
    } finally {
      inflight = null;
    }
  })();

  return inflight;
}

/** True when this token must no longer be accepted. */
export async function isRevoked(payload: SessionPayload): Promise<boolean> {
  const snap = await loadSnapshot();

  if (payload.jti && snap.jtis.has(payload.jti)) return true;

  const cutoff = snap.cutoffs.get(`${payload.role}:${payload.sub}`);
  if (cutoff && payload.iat != null && payload.iat * 1000 < cutoff) return true;

  return false;
}

/** Revoke one token — the logout path. */
export async function revokeToken(
  payload: SessionPayload,
  reason = "logout",
): Promise<void> {
  if (!payload.jti) return;
  try {
    await supabase.from("revoked_sessions").upsert({
      jti: payload.jti,
      expires_at: new Date(payload.exp * 1000).toISOString(),
      reason,
    });
    snapshot = null; // force a refresh on this instance
  } catch (err) {
    console.error("[revocation] could not revoke token:", err);
  }
}

/**
 * Invalidate every session for an account issued before now.
 * Called on password change and forced sign-out.
 */
export async function revokeAllForAccount(
  role: string,
  subjectId: number,
  reason = "password changed",
): Promise<void> {
  try {
    await supabase.from("session_cutoffs").upsert(
      {
        role,
        subject_id: subjectId,
        not_before: new Date().toISOString(),
        reason,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "role,subject_id" },
    );
    snapshot = null;
  } catch (err) {
    console.error("[revocation] could not set account cutoff:", err);
  }
}
