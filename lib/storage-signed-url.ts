import { createClient } from "@supabase/supabase-js";

// ─────────────────────────────────────────────────────────────────────────────
// Short-lived signed URLs for private storage objects.
//
// `voice-notes` and `tenant-profiles` hold personal data — internal staff audio
// and tenant photographs — and were served from PUBLIC buckets, so anyone with
// (or guessing) an object URL could fetch them with no session. scripts/035
// makes those buckets private; this is how the app reads from them afterwards.
//
// A signed URL is a time-limited capability, so the expiry is the security
// control: long enough for a page to load and an image to render, short enough
// that a URL copied out of devtools or a shared screenshot is dead by the time
// anyone tries it.
//
// `apartments` stays public on purpose (marketing photography on anonymous
// pages) and must NOT be routed through here — see scripts/035 Stage 4.
// ─────────────────────────────────────────────────────────────────────────────

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || "",
);

/** Buckets this helper is allowed to sign for. Anything else is a mistake. */
export type PrivateBucket = "voice-notes" | "tenant-profiles";

/** Five minutes: comfortably covers a page load, useless once shared. */
const DEFAULT_TTL_SECONDS = 300;

/**
 * Reduce whatever is stored to a bare object path.
 *
 * Rows written before scripts/035 hold a full public URL; rows written after
 * hold just the object name. Accepting both means the migration does not have
 * to be perfectly complete before the app keeps working.
 */
export function toObjectPath(stored: string, bucket: PrivateBucket): string {
  if (!stored) return "";
  const marker = `/object/public/${bucket}/`;
  const index = stored.indexOf(marker);
  if (index !== -1) return stored.slice(index + marker.length);
  // Already a bare path, or a signed URL we should not re-sign.
  return stored.replace(/^\/+/, "");
}

/**
 * Sign one object. Returns null rather than throwing: a missing avatar should
 * render a placeholder, not break the page it appears on.
 */
export async function signedUrl(
  bucket: PrivateBucket,
  stored: string | null | undefined,
  ttlSeconds = DEFAULT_TTL_SECONDS,
): Promise<string | null> {
  if (!stored) return null;

  const path = toObjectPath(stored, bucket);
  if (!path) return null;

  try {
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(path, ttlSeconds);

    if (error || !data?.signedUrl) {
      console.warn(`[storage] could not sign ${bucket}/${path}:`, error?.message);
      return null;
    }
    return data.signedUrl;
  } catch (err) {
    console.error(`[storage] signing failed for ${bucket}/${path}:`, err);
    return null;
  }
}

/** Sign several objects at once, preserving order. */
export async function signedUrls(
  bucket: PrivateBucket,
  stored: Array<string | null | undefined>,
  ttlSeconds = DEFAULT_TTL_SECONDS,
): Promise<Array<string | null>> {
  return Promise.all(stored.map((s) => signedUrl(bucket, s, ttlSeconds)));
}
