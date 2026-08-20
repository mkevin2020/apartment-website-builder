import type { Metadata, Viewport } from 'next'
import { Fraunces, Public_Sans } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import './globals.css'

// ─────────────────────────────────────────────────────────────────────────────
// Two faces, deliberately paired.
//
// Fraunces — headings and prices. Its soft, slightly irregular serifs carry
// warmth at large sizes without tipping into decoration, so a price reads as a
// considered offer rather than a system output.
//
// Public Sans — interface, body, tables and forms. Open apertures and
// unambiguous digits at 13–15px on a mid-range Android, where misreading a date
// or an amount has a real cost.
//
// Loaded through next/font so they are self-hosted and preloaded: no request to
// fonts.googleapis.com at runtime, and no layout shift as they swap in.
// ─────────────────────────────────────────────────────────────────────────────
const fraunces = Fraunces({
  subsets: ['latin'],
  // Variable weight rather than a fixed set: Fraunces is a variable font, and
  // the whole reason it was chosen is the optical-size and SOFT axes, which
  // next/font only exposes when the weight is variable too.
  weight: 'variable',
  variable: '--font-display-face',
  display: 'swap',
  axes: ['SOFT', 'WONK', 'opsz'],
})

const publicSans = Public_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-ui-face',
  display: 'swap',
})
import { RootLayoutClient } from "@/components/root-layout-client"

export const metadata: Metadata = {
  title: 'Cielo Vista - Luxury Apartments in Kigali',
  description: 'Discover premium apartment rentals in Karama Sector, Kigali. Experience luxury living with Cielo Vista.',
  applicationName: 'Cielo Vista',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Cielo Vista',
  },
  // Force the legacy Apple tag iOS Safari needs to launch as a standalone app.
  // (Next currently only emits `mobile-web-app-capable`, which iOS ignores.)
  other: {
    'apple-mobile-web-app-capable': 'yes',
  },
  icons: {
    icon: [
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: '/icon-192.png',
  },
}

export const viewport: Viewport = {
  themeColor: '#0f172a',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1, // stops iOS standalone from zooming in on input focus and getting stuck
  userScalable: false,
  viewportFit: 'cover',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${fraunces.variable} ${publicSans.variable}`}>
        <RootLayoutClient>
          {children}
        </RootLayoutClient>
        <Analytics />
      </body>
    </html>
  )
}
