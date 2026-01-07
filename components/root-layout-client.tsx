"use client"

import { LanguageProvider } from "@/lib/language-context"

export function RootLayoutClient({ children }: { children: React.ReactNode }) {
  return <LanguageProvider>{children}</LanguageProvider>
}
