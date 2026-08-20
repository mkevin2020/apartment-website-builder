"use client"

import { LanguageProvider } from "@/lib/language-context"
import { ChatWidget } from "@/components/ChatWidget"
import { ThemeProvider } from "@/components/theme-provider"
import { PwaRegister } from "@/components/pwa-register"
import { AutoTranslator } from "@/components/translate/auto-translator"
import { LanguageSwitcher } from "@/components/translate/language-switcher"

export function RootLayoutClient({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <LanguageProvider>
        {children}
        {/* Site-wide AI chatbot (Ollama). Tenant↔manager live chat (tawk) is
            mounted separately on the tenant dashboard via <TawkChat />. */}
        <ChatWidget />
        <PwaRegister />
        <AutoTranslator />
        <LanguageSwitcher />
      </LanguageProvider>
    </ThemeProvider>
  )
}
