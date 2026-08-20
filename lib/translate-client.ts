// Client helper to translate a batch of strings via the LibreTranslate proxy.
// Returns a map of { original -> translated }. Falls back to the originals if the
// language is English or the server is unavailable (so callers never break).
export async function translateMany(
  strings: string[],
  target: string,
): Promise<Record<string, string>> {
  const out: Record<string, string> = {}
  const unique = Array.from(new Set(strings.filter(Boolean)))
  if (!target || target === "en" || unique.length === 0) {
    unique.forEach((s) => (out[s] = s))
    return out
  }
  try {
    const res = await fetch("/api/translate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ q: unique, source: "en", target }),
    })
    const data = await res.json()
    const translations: string[] = data.translations || unique
    unique.forEach((s, i) => (out[s] = translations[i] ?? s))
  } catch {
    unique.forEach((s) => (out[s] = s))
  }
  return out
}

// Translate the VALUES of a label object, returning a same-keyed object of translations.
export async function translateLabels<T extends Record<string, string>>(
  labels: T,
  target: string,
): Promise<T> {
  const map = await translateMany(Object.values(labels), target)
  const result: Record<string, string> = {}
  for (const [k, v] of Object.entries(labels)) result[k] = map[v] ?? v
  return result as T
}
