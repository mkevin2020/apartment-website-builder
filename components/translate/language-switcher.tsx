"use client"

import { useEffect, useRef, useState } from "react"
import { Globe, Check, Loader2 } from "lucide-react"
import { useLanguage, LANGUAGES, type Language } from "@/lib/language-context"

// Floating globe button that lets any visitor switch the whole site's language.
// Sits bottom-left so it doesn't collide with the chat widget (bottom-right).
export function LanguageSwitcher() {
  const { language, setLanguage } = useLanguage()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Mark as "translating" briefly so the user gets feedback on slow first loads
  useEffect(() => {
    if (language === "en") return
    setBusy(true)
    const t = setTimeout(() => setBusy(false), 1500)
    return () => clearTimeout(t)
  }, [language])

  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", onClick)
    return () => document.removeEventListener("mousedown", onClick)
  }, [open])

  const current = LANGUAGES.find((l) => l.code === language) || LANGUAGES[0]

  const pick = (code: Language) => {
    setLanguage(code)
    setOpen(false)
  }

  return (
    <div ref={ref} className="fixed bottom-5 left-5 z-[60]" data-no-translate>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-lg px-3.5 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-200 hover:shadow-xl transition-shadow"
        title="Change language"
        aria-label="Change language"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin text-blue-600" /> : <Globe className="h-4 w-4 text-blue-600" />}
        <span className="uppercase">{current.code}</span>
      </button>

      {open && (
        <div className="absolute bottom-14 left-0 w-56 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden">
          <div className="px-4 py-2.5 text-xs font-semibold text-slate-400 uppercase border-b border-slate-100 dark:border-slate-800">
            Language
          </div>
          {LANGUAGES.map((l) => (
            <button
              key={l.code}
              onClick={() => pick(l.code)}
              className="w-full flex items-center justify-between px-4 py-2.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200"
            >
              <span className="flex flex-col items-start">
                <span className="font-medium">{l.native}</span>
                <span className="text-xs text-slate-400">
                  {l.label}
                  {!l.supported && " · limited"}
                </span>
              </span>
              {language === l.code && <Check className="h-4 w-4 text-green-600" />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
