"use client"

import { LanguageProvider } from "@/lib/language-context"
import { ChatWidget } from "@/components/ChatWidget"
import { ThemeProvider } from "@/components/theme-provider"

export function RootLayoutClient({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <LanguageProvider>
        {children}
        <ChatWidget />
      </LanguageProvider>
    </ThemeProvider>
  )
}
