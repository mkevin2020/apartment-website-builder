import { NextRequest, NextResponse } from "next/server"

export const dynamic = "force-dynamic"

// LibreTranslate server. Self-host with:  docker run -ti -p 5000:5000 libretranslate/libretranslate
// Override with env LIBRETRANSLATE_URL (and LIBRETRANSLATE_API_KEY if your instance needs one).
const LT_URL = (process.env.LIBRETRANSLATE_URL || "http://localhost:5000").replace(/\/$/, "")
const LT_API_KEY = process.env.LIBRETRANSLATE_API_KEY || ""

// Cache which target languages the server actually supports (so we don't waste
// round-trips translating into Kinyarwanda/Swahili if there's no model).
let supportedTargets: Set<string> | null = null
let supportedFetchedAt = 0

async function getSupported(): Promise<Set<string> | null> {
  // refresh hourly
  if (supportedTargets && Date.now() - supportedFetchedAt < 3_600_000) return supportedTargets
  try {
    const res = await fetch(`${LT_URL}/languages`, { cache: "no-store" })
    if (!res.ok) return supportedTargets
    const langs = (await res.json()) as { code: string }[]
    supportedTargets = new Set(langs.map((l) => l.code))
    supportedFetchedAt = Date.now()
    return supportedTargets
  } catch {
    return supportedTargets // server unreachable — let the translate call fail gracefully
  }
}

export async function POST(req: NextRequest) {
  // Parse the body ONCE up front so we always have the originals to fall back to.
  let q: any, source = "en", target: string | undefined
  try {
    const body = await req.json()
    q = body.q
    source = body.source || "en"
    target = body.target
  } catch {
    return NextResponse.json({ translations: [], unsupported: true, error: "bad request" })
  }
  const list: string[] = Array.isArray(q) ? q : q != null ? [q] : []

  try {
    // Nothing to do — same language or missing target
    if (!target || target === source) {
      return NextResponse.json({ translations: list, unsupported: false })
    }

    // If we know the server can't do this language, return the originals (UI stays English).
    // Match on the base code too, since the server may list e.g. "zh-Hans" for "zh".
    const supported = await getSupported()
    if (supported) {
      const base = (c: string) => c.split("-")[0]
      const ok = supported.has(target) || Array.from(supported).some((c) => base(c) === base(target))
      if (!ok) return NextResponse.json({ translations: list, unsupported: true })
    }

    const res = await fetch(`${LT_URL}/translate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        q: list,
        source,
        target,
        format: "text",
        ...(LT_API_KEY ? { api_key: LT_API_KEY } : {}),
      }),
    })

    if (!res.ok) {
      // Server error / language not installed — degrade to originals
      return NextResponse.json({ translations: list, unsupported: true, error: `LibreTranslate ${res.status}` })
    }

    const data = await res.json()
    // For an array `q`, LibreTranslate returns translatedText as an array; for a string, a string.
    const translated = Array.isArray(data.translatedText)
      ? data.translatedText
      : [data.translatedText ?? list[0]]

    return NextResponse.json({ translations: translated, unsupported: false })
  } catch (err: any) {
    // LibreTranslate not running / unreachable — keep originals so the UI never breaks
    return NextResponse.json({ translations: list, unsupported: true, error: err?.message || "translate failed" })
  }
}
