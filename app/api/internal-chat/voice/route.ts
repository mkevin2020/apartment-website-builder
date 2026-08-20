import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireRole, STAFF } from "@/lib/auth/session";
import { signedUrl } from "@/lib/storage-signed-url";

// Uploads a recorded voice note (webm/ogg audio blob) to the public
// "voice-notes" storage bucket and returns its URL. The chat then sends a
// message of the form "[voice]<url>" which renders as an audio player.
export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB ≈ several minutes of opus audio

export async function POST(request: NextRequest) {
  try {
    // Uploads audio into staff chat — staff only.
    await requireRole(request, STAFF);

    const form = await request.formData();
    const file = form.get("audio");
    if (!(file instanceof Blob)) {
      return NextResponse.json({ error: "audio file is required" }, { status: 400 });
    }
    if (file.size === 0 || file.size > MAX_BYTES) {
      return NextResponse.json({ error: "Voice note is empty or too large" }, { status: 400 });
    }

    // Recorders report types like "audio/webm;codecs=opus" — strip the codec
    // suffix, the bucket's mime whitelist only accepts the base type.
    const contentType = (file.type || "audio/webm").split(";")[0].trim();
    const ext = contentType.includes("ogg") ? "ogg" : contentType.includes("mp4") ? "m4a" : "webm";
    const name = `vn-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

    const buffer = Buffer.from(await file.arrayBuffer());
    const { error } = await supabase.storage
      .from("voice-notes")
      .upload(name, buffer, { contentType, upsert: false });
    if (error) {
      console.error("voice upload error:", error);
      return NextResponse.json({ error: "Upload failed" }, { status: 500 });
    }

    // Signed, not public. scripts/035 makes this bucket private; until it is
    // run, signing still works and simply produces a URL that also happens to
    // be reachable publicly. `path` is what callers should persist — a signed
    // URL expires, so storing one would leave dead links in the database.
    const url = await signedUrl("voice-notes", name);
    return NextResponse.json({ url, path: name });
  } catch (err) {
    console.error("voice route error:", err);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
