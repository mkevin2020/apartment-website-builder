import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { requireRole, STAFF, errorResponse } from "@/lib/auth/session"

export const dynamic = "force-dynamic"

const BUCKET = "apartments"

// Only these may be stored, and the extension is derived from the sniffed type
// rather than from the client's filename.
const ALLOWED: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "video/mp4": "mp4",
  "video/webm": "webm",
}

/**
 * Identify a file from its leading bytes. `file.type` is supplied by the
 * browser and can claim anything, so a .html or .svg payload could previously
 * be stored and then served from your own domain — an XSS vector, since the
 * bucket is public. Magic bytes cannot be spoofed the same way.
 */
function sniffMime(bytes: Uint8Array): string | null {
  const startsWith = (...sig: number[]) => sig.every((b, i) => bytes[i] === b)
  const ascii = (offset: number, text: string) =>
    [...text].every((c, i) => bytes[offset + i] === c.charCodeAt(0))

  if (startsWith(0xff, 0xd8, 0xff)) return "image/jpeg"
  if (startsWith(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return "image/png"
  if (startsWith(0x47, 0x49, 0x46, 0x38)) return "image/gif"
  if (ascii(0, "RIFF") && ascii(8, "WEBP")) return "image/webp"
  if (ascii(4, "ftyp")) return "video/mp4"
  if (startsWith(0x1a, 0x45, 0xdf, 0xa3)) return "video/webm"
  return null
}

export async function POST(req: NextRequest) {
  try {
    // Writes into a public bucket — staff only. It was previously open to
    // anyone, so the storage could be filled by anonymous callers.
    await requireRole(req, STAFF)

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json(
        { error: "Server is missing Supabase configuration." },
        { status: 500 },
      )
    }

    const formData = await req.formData()
    const file = formData.get("file") as File | null

    if (!file) {
      return NextResponse.json({ error: "No file provided." }, { status: 400 })
    }

    // Check the size before reading the bytes, so an oversized upload is
    // rejected without being buffered into memory first.
    const claimedVideo = file.type.startsWith("video/")
    const maxBytes = claimedVideo ? 50 * 1024 * 1024 : 10 * 1024 * 1024
    if (file.size > maxBytes) {
      return NextResponse.json(
        { error: claimedVideo ? "Video must be 50MB or smaller." : "Image must be 10MB or smaller." },
        { status: 400 },
      )
    }

    const arrayBuffer = await file.arrayBuffer()
    const bytes = new Uint8Array(arrayBuffer)

    // Trust the file's own bytes, not the declared Content-Type.
    const detected = sniffMime(bytes)
    if (!detected || !(detected in ALLOWED)) {
      return NextResponse.json(
        { error: "Only JPEG, PNG, WebP, GIF, MP4 or WebM files are allowed." },
        { status: 400 },
      )
    }

    const isVideo = detected.startsWith("video/")
    if (file.size > (isVideo ? 50 * 1024 * 1024 : 10 * 1024 * 1024)) {
      return NextResponse.json(
        { error: isVideo ? "Video must be 50MB or smaller." : "Image must be 10MB or smaller." },
        { status: 400 },
      )
    }

    // Use the service-role key so the upload bypasses storage RLS policies
    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false },
    })

    // Make sure the bucket exists (create it on first use if needed)
    const { data: buckets } = await supabase.storage.listBuckets()
    if (!buckets?.some((b) => b.name === BUCKET)) {
      await supabase.storage.createBucket(BUCKET, { public: true })
    }

    // Build the stored name ourselves rather than sanitising theirs: the
    // extension comes from the sniffed type, so "evil.html" cannot survive as
    // an .html object in a public bucket, and path segments cannot be injected.
    const stem = file.name
      .replace(/\.[^.]*$/, "")
      .replace(/[^a-zA-Z0-9\-_]/g, "_")
      .slice(0, 60) || "upload"
    const filename = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}-${stem}.${ALLOWED[detected]}`

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(filename, arrayBuffer, {
        // Store the detected type, not the claimed one.
        contentType: detected,
        upsert: false,
      })

    if (uploadError) {
      return NextResponse.json(
        { error: "Upload failed: " + uploadError.message },
        { status: 500 },
      )
    }

    const { data } = supabase.storage.from(BUCKET).getPublicUrl(filename)

    return NextResponse.json({ url: data.publicUrl })
  } catch (err) {
    return errorResponse(err)
  }
}
