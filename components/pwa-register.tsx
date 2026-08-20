"use client"

import { useEffect } from "react"

// In PRODUCTION: registers the service worker so the app is installable
// (Add to Home Screen) and has a basic offline shell.
// In DEVELOPMENT: actively unregisters any existing service worker and clears
// its caches, so editing code never serves stale JS (which breaks hydration).
export function PwaRegister() {
  useEffect(() => {
    if (typeof window === "undefined") return
    if (!("serviceWorker" in navigator)) return

    const isProd = process.env.NODE_ENV === "production"

    if (!isProd) {
      // Clean up any service worker left over from a previous prod/dev session.
      navigator.serviceWorker.getRegistrations().then((regs) => {
        regs.forEach((reg) => reg.unregister())
      })
      if (typeof caches !== "undefined") {
        caches.keys().then((keys) => keys.forEach((k) => caches.delete(k)))
      }
      return
    }

    const register = () => {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        .catch((err) => console.error("SW registration failed:", err))
    }

    if (document.readyState === "complete") register()
    else window.addEventListener("load", register)

    return () => window.removeEventListener("load", register)
  }, [])

  return null
}
