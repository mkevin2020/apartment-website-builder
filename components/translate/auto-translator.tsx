"use client"

import { useEffect } from "react"
import { useLanguage } from "@/lib/language-context"

// Live, whole-page translator. When the user picks a language, it collects the
// visible text, translates it via /api/translate (LibreTranslate), and swaps it in
// place — no per-page rewriting. English restores the originals.
//
// Speed:
//  - Known strings paint INSTANTLY from cache (in-memory + localStorage), so a
//    language you've used before applies with no wait.
//  - New strings stream in progressively (text fills in batches, not one big freeze).

// Remember each text node's original (English) text so we can switch back.
const originals = new WeakMap<Text, string>()
// Cache: original string -> { [lang]: translated }
const cache = new Map<string, Record<string, string>>()

const CACHE_KEY = "cv_translate_cache"
const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "CODE", "PRE", "TEXTAREA", "INPUT", "SVG"])

// ---- localStorage persistence (so repeat languages are instant + survive reload) ----
let loaded = false
function loadCache() {
  if (loaded || typeof window === "undefined") return
  loaded = true
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (raw) {
      const obj = JSON.parse(raw) as Record<string, Record<string, string>>
      for (const [k, v] of Object.entries(obj)) cache.set(k, v)
    }
  } catch {
    /* ignore */
  }
}
let saveTimer: ReturnType<typeof setTimeout> | null = null
function saveCache() {
  if (typeof window === "undefined") return
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    try {
      const obj: Record<string, Record<string, string>> = {}
      cache.forEach((v, k) => (obj[k] = v))
      localStorage.setItem(CACHE_KEY, JSON.stringify(obj))
    } catch {
      /* quota / serialization issues — non-fatal */
    }
  }, 600)
}

function collectTextNodes(root: Node): Text[] {
  const nodes: Text[] = []
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const text = node.textContent || ""
      if (!text.trim()) return NodeFilter.FILTER_REJECT
      const parent = (node as Text).parentElement
      if (!parent) return NodeFilter.FILTER_REJECT
      if (SKIP_TAGS.has(parent.tagName)) return NodeFilter.FILTER_REJECT
      if (parent.closest("[data-no-translate]")) return NodeFilter.FILTER_REJECT
      // Skip pure numbers / money / symbols (e.g. "RWF 240,000", dates, refs)
      if (/^[\s\d.,:;%/$#@()+\-–—]+$/.test(text)) return NodeFilter.FILTER_REJECT
      return NodeFilter.FILTER_ACCEPT
    },
  })
  let n: Node | null
  while ((n = walker.nextNode())) nodes.push(n as Text)
  return nodes
}

// One batch -> { original: translated }. Failures/unsupported are omitted (not cached).
async function fetchChunk(chunk: string[], lang: string): Promise<Record<string, string>> {
  const out: Record<string, string> = {}
  try {
    const res = await fetch("/api/translate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ q: chunk, source: "en", target: lang }),
    })
    const data = await res.json()
    if (!res.ok || data.unsupported) return out
    const translations: string[] = data.translations || []
    chunk.forEach((s, idx) => {
      const t = translations[idx]
      if (t != null && t !== "") out[s] = t
    })
  } catch {
    /* network error — skip; will retry */
  }
  return out
}

export function AutoTranslator() {
  const { language } = useLanguage()

  useEffect(() => {
    loadCache()
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | null = null
    let retryTimer: ReturnType<typeof setTimeout> | null = null
    let retries = 0
    let observer: MutationObserver | null = null
    const root = document.body

    const apply = async () => {
      const nodes = collectTextNodes(root)
      for (const node of nodes) {
        if (!originals.has(node)) originals.set(node, node.textContent || "")
      }

      // English: restore originals and stop
      if (language === "en") {
        for (const node of nodes) {
          const orig = originals.get(node)
          if (orig != null && node.textContent !== orig) node.textContent = orig
        }
        return
      }

      // Paint whatever is currently cached. Returns whether anything is still missing.
      const paint = (): boolean => {
        observer?.disconnect()
        let missing = false
        for (const node of nodes) {
          const orig = originals.get(node) || ""
          const key = orig.trim()
          const tr = cache.get(key)?.[language]
          if (tr != null) {
            const next = orig.replace(key, tr)
            if (node.textContent !== next) node.textContent = next
          } else if (key) {
            missing = true
          }
        }
        if (!cancelled) observer?.observe(root, { childList: true, subtree: true })
        return missing
      }

      // 1) Instant paint from cache (no wait for already-known strings)
      paint()

      // 2) Collect the still-untranslated, de-duplicated strings
      const seen = new Set<string>()
      const need: string[] = []
      for (const node of nodes) {
        const key = (originals.get(node) || "").trim()
        if (!key || seen.has(key)) continue
        seen.add(key)
        if (cache.get(key)?.[language] == null) need.push(key)
      }

      // 3) Fetch in small batches, painting after EACH so text fills in progressively
      const CHUNK = 25
      for (let i = 0; i < need.length; i += CHUNK) {
        if (cancelled) return
        const chunk = need.slice(i, i + CHUNK)
        const fetched = await fetchChunk(chunk, language)
        for (const [src, tr] of Object.entries(fetched)) {
          const m = cache.get(src) || {}
          m[language] = tr
          cache.set(src, m)
        }
        if (Object.keys(fetched).length) saveCache()
        paint()
      }

      // 4) Self-heal: if some text is still missing (server slow/down), retry a few times
      const stillMissing = paint()
      if (stillMissing && !cancelled && retries < 5) {
        retries += 1
        if (retryTimer) clearTimeout(retryTimer)
        retryTimer = setTimeout(apply, 3000)
      }
    }

    const schedule = () => {
      if (timer) clearTimeout(timer)
      timer = setTimeout(apply, 250)
    }

    // Re-run when new content mounts (navigation, dialogs, etc.).
    // We don't watch characterData, so our own text edits don't loop.
    observer = new MutationObserver(schedule)
    observer.observe(root, { childList: true, subtree: true })
    apply()

    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
      if (retryTimer) clearTimeout(retryTimer)
      observer?.disconnect()
    }
  }, [language])

  return null
}
