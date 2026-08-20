"use client"

import { useEffect, useRef, useState } from "react"
import { Headset } from "lucide-react"

const TAWK_PROPERTY_ID = process.env.NEXT_PUBLIC_TAWK_PROPERTY_ID || "6a47fa5cbb890f1d47e70d64"
const TAWK_WIDGET_ID = process.env.NEXT_PUBLIC_TAWK_WIDGET_ID || "1jskijv4r"
// Slow connections need generous time before we give up on tawk.
const LOAD_TIMEOUT_MS = 25000

// Visitor details shown to the manager in the tawk dashboard. `name` and
// `email` label the conversation itself; everything else appears as custom
// attributes on the visitor card.
export interface TawkVisitor {
  name?: string
  email?: string
  [attribute: string]: string | undefined
}

// Tenant ↔ manager live chat (tawk.to), mounted only on the tenant dashboard.
// We hide tawk's default green bubble and show a "Chat with Manager" pill
// button instead, placed above the site-wide robot chatbot so they don't
// overlap. The manager answers from dashboard.tawk.to or the tawk mobile app.
//
// Clicking before tawk finishes loading shows a spinner and opens the chat
// automatically once ready. If the script fails to load (ad blocker, network
// block), the button opens tawk's hosted chat page in a new tab instead.
export function TawkChat({ visitor }: { visitor?: TawkVisitor }) {
  const [status, setStatus] = useState<"loading" | "ready" | "failed">("loading")
  const [chatOpen, setChatOpen] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const pendingOpen = useRef(false)
  const visitorRef = useRef<TawkVisitor | undefined>(visitor)
  visitorRef.current = visitor

  // tawk only accepts non-empty strings. Any undefined value that reaches it
  // makes its internal login formatter call Object.keys() on nothing and throw
  // ("Cannot convert undefined or null to object"), which surfaces as a runtime
  // error on the tenant dashboard. So we strip blanks before handing anything over.
  const cleanVisitor = (details: TawkVisitor | undefined): Record<string, string> => {
    const out: Record<string, string> = {}
    if (!details) return out
    for (const [key, value] of Object.entries(details)) {
      if (typeof value === "string" && value.trim()) out[key] = value.trim()
    }
    return out
  }

  // Send the tenant's identity to tawk so the manager sees who is writing.
  const applyVisitorAttributes = () => {
    const win = window as any
    if (typeof win.Tawk_API?.setAttributes !== "function") return
    const attrs = cleanVisitor(visitorRef.current)
    if (Object.keys(attrs).length === 0) return
    try {
      win.Tawk_API.setAttributes(attrs, (error: unknown) => {
        if (error) console.error("tawk setAttributes error:", error)
      })
    } catch (error) {
      // A tawk-side failure must never take down the dashboard.
      console.error("tawk setAttributes threw:", error)
    }
  }

  useEffect(() => {
    if (typeof window === "undefined") return
    if (!TAWK_PROPERTY_ID) {
      setStatus("failed")
      return
    }

    const win = window as any

    const isTawkLoaded = () => typeof win.Tawk_API?.hideWidget === "function"

    const openNow = () => {
      win.Tawk_API.showWidget()
      win.Tawk_API.maximize()
      setConnecting(false)
      setChatOpen(true)
    }

    const attachHandlers = () => {
      // Pre-load identity: tawk picks this up as soon as the widget boots.
      // Both fields are required — tawk's login formatter throws on a visitor
      // that carries a name without an email (or any undefined value).
      const details = cleanVisitor(visitorRef.current)
      if (details.name && details.email) {
        win.Tawk_API.visitor = { name: details.name, email: details.email }
      }
      win.Tawk_API.onLoad = () => {
        win.Tawk_API.hideWidget()
        applyVisitorAttributes()
        setStatus("ready")
        if (pendingOpen.current) {
          pendingOpen.current = false
          openNow()
        }
      }
      win.Tawk_API.onChatMinimized = () => {
        win.Tawk_API.hideWidget()
        setChatOpen(false)
      }
    }

    // Give up and use the hosted chat page link if tawk never loads.
    const timer = setTimeout(() => {
      if (!isTawkLoaded()) setStatus("failed")
    }, LOAD_TIMEOUT_MS)

    if (win.Tawk_API) {
      // Script already injected (e.g. dev double-mount or page revisit);
      // reattach handlers and keep the default bubble hidden.
      attachHandlers()
      if (isTawkLoaded()) {
        win.Tawk_API.hideWidget()
        applyVisitorAttributes()
        setStatus("ready")
      }
      return () => clearTimeout(timer)
    }

    win.Tawk_API = {}
    win.Tawk_LoadStart = new Date()
    attachHandlers()

    const script = document.createElement("script")
    script.async = true
    script.src = `https://embed.tawk.to/${TAWK_PROPERTY_ID}/${TAWK_WIDGET_ID}`
    script.charset = "UTF-8"
    // No crossorigin attribute: with it, the browser enforces CORS on the script
    // fetch, and proxies/AV tools that strip Access-Control-Allow-Origin make the
    // widget silently fail to load. A classic script tag needs no CORS at all.
    script.onerror = () => setStatus("failed")

    const firstScript = document.getElementsByTagName("script")[0]
    firstScript?.parentNode?.insertBefore(script, firstScript)

    return () => clearTimeout(timer)
  }, [])

  // Tenant/apartment data often arrives after tawk has loaded — resend then.
  useEffect(() => {
    if (status === "ready") applyVisitorAttributes()
  }, [visitor, status])

  const openChat = () => {
    const win = window as any
    if (status === "failed") {
      // Embedded widget unavailable in this browser — use tawk's hosted page.
      window.open(`https://tawk.to/chat/${TAWK_PROPERTY_ID}/${TAWK_WIDGET_ID}`, "_blank")
      return
    }
    if (status === "ready" && typeof win.Tawk_API?.maximize === "function") {
      win.Tawk_API.showWidget()
      win.Tawk_API.maximize()
      setChatOpen(true)
    } else {
      // Still loading: remember the click and show feedback until it opens.
      pendingOpen.current = true
      setConnecting(true)
    }
  }

  if (chatOpen) return null

  return (
    <button
      onClick={openChat}
      aria-label="Chat with the manager"
      className="fixed bottom-24 right-4 sm:right-6 z-[100] flex items-center gap-2 rounded-full bg-gradient-to-r from-emerald-600 to-emerald-700 px-4 py-3 text-sm font-semibold text-white shadow-xl transition-all duration-300 hover:shadow-2xl hover:-translate-y-1"
    >
      {connecting ? (
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
      ) : (
        <Headset className="h-4 w-4" />
      )}
      {connecting ? "Connecting…" : "Chat with Manager"}
    </button>
  )
}
