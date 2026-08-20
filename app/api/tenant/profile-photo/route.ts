import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireRole, errorResponse, HttpError } from "@/lib/auth/session";
import { enforceRateLimit } from "@/lib/auth/rate-limit";
import { signedUrl } from "@/lib/storage-signed-url";

// ─────────────────────────────────────────────────────────────────────────────
// Tenant profile photo upload.
//
// This was done in the browser (components/ProfileCard.tsx):
//
//     const fileName = `${tenant.id}-${Date.now()}.${ext}`
//     supabase.storage.from("tenant-profiles").upload(fileName, file, { upsert: true })
//
// `tenant.id` came from the localStorage session copy, which the user controls,
// and the bucket was public with `upsert: true` — so a tenant could write into
// another tenant's filename namespace, and anyone could read any photo by URL.
//
// Here the filename is derived from the SIGNED SESSION, the file is validated by
// its leading bytes rather than its claimed type, and the response is a
// short-lived signed URL.
// ─────────────────────────────────────────────────────────────────────────────

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const BUCKET = "tenant-profiles";
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB — a profile photo, not an album

/** Extensions keyed by the type we actually detect, never by the client's claim. */
const ALLOWED: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

/**
 * Identify an image from its magic bytes.
 *
 * `file.type` is supplied by the browser and can claim anything. Without this,
 * an SVG (which can carry script) or an HTML file could be stored and then
 * served from your own origin. Deliberately does NOT accept SVG for that reason.
 */
function sniffMime(bytes: Uint8Array): string | null {
  const startsWith = (...sig: number[]) => sig.every((b, i) => bytes[i] === b);
  const ascii = (offset: number, text: string) =>
    [...text].every((c, i) => bytes[offset + i] === c.charCodeAt(0));

  if (startsWith(0xff, 0xd8, 0xff)) return "image/jpeg";
  if (startsWith(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return "image/png";
  if (ascii(0, "RIFF") && ascii(8, "WEBP")) return "image/webp";
  return null;
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireRole(request, ["tenant"]);
    await enforceRateLimit(request, "profile-photo", 10, 60 * 60, String(session.sub));

    const form = await request.formData();
    const file = form.get("file");

    if (!(file instanceof File)) {
      throw new HttpError(400, "Choose an image to upload.");
    }
    if (file.size === 0) {
      throw new HttpError(400, "That file is empty.");
    }
    if (file.size > MAX_BYTES) {
      throw new HttpError(413, "That image is larger than 5 MB. Please choose a smaller one.");
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const detected = sniffMime(new Uint8Array(buffer.subarray(0, 16)));
    const extension = detected ? ALLOWED[detected] : undefined;

    if (!detected || !extension) {
      throw new HttpError(400, "Please upload a JPEG, PNG or WebP image.");
    }

    // Filename from the session, NOT from anything the client sent. A tenant
    // can only ever write to their own object name.
    const filename = `${session.sub}-${Date.now()}.${extension}`;

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(filename, buffer, { contentType: detected, upsert: false });

    if (uploadError) {
      console.error("profile photo upload failed:", uploadError.message);
      throw new HttpError(500, "Could not upload your photo. Please try again.");
    }

    // Store the object PATH. A signed URL expires, so persisting one would
    // leave a dead link in the database.
    const { error: updateError } = await supabase
      .from("tenants")
      .update({ profile_picture_url: filename })
      .eq("id", session.sub);

    if (updateError) {
      console.error("profile photo record update failed:", updateError.message);
      throw new HttpError(500, "Your photo was uploaded but could not be saved.");
    }

    return NextResponse.json({
      path: filename,
      url: await signedUrl(BUCKET, filename),
    });
  } catch (err) {
    return errorResponse(err);
  }
}
