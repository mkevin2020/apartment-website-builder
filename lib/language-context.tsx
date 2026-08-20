"use client"

import { createContext, useContext, useState, useEffect, ReactNode } from "react"

export type Language = "en" | "fr" | "ar" | "es" | "zh" | "pt"

const VALID: Language[] = ["en", "fr", "ar", "es", "zh", "pt"]
const RTL: Language[] = ["ar"]

export const LANGUAGES: { code: Language; label: string; native: string; supported: boolean }[] = [
  { code: "en", label: "English", native: "English", supported: true },
  { code: "fr", label: "French", native: "Français", supported: true },
  { code: "ar", label: "Arabic", native: "العربية", supported: true },
  { code: "es", label: "Spanish", native: "Español", supported: true },
  { code: "zh", label: "Chinese", native: "中文", supported: true },
  { code: "pt", label: "Portuguese", native: "Português", supported: true },
]

interface LanguageContextType {
  language: Language
  setLanguage: (language: Language) => void
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined)

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>("en")

  // Restore the saved language on first load
  useEffect(() => {
    const saved = typeof window !== "undefined" ? (localStorage.getItem("app_lang") as Language | null) : null
    if (saved && VALID.includes(saved)) setLanguageState(saved)
  }, [])

  // Flip the page direction for right-to-left languages (Arabic)
  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.dir = RTL.includes(language) ? "rtl" : "ltr"
      document.documentElement.lang = language
    }
  }, [language])

  const setLanguage = (lang: Language) => {
    setLanguageState(lang)
    if (typeof window !== "undefined") localStorage.setItem("app_lang", lang)
  }

  return (
    <LanguageContext.Provider value={{ language, setLanguage }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  const context = useContext(LanguageContext)
  if (!context) {
    throw new Error("useLanguage must be used within LanguageProvider")
  }
  return context
}
