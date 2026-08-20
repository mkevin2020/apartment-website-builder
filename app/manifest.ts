import type { MetadataRoute } from "next"

// PWA manifest — makes the app installable on Android & iOS.
// Next.js serves this at /manifest.webmanifest automatically.
export default function manifest(): MetadataRoute.Manifest {
  return {
    // Stable, unchanging identifier so the app stays "the same app" to the OS
    // even if start_url ever changes.
    id: "/?source=pwa",
    name: "Cielo Vista - Luxury Apartments",
    short_name: "Cielo Vista",
    description:
      "Discover premium apartment rentals in Kigali. Browse, book, pay, and manage your stay with Cielo Vista.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0f172a",
    theme_color: "#0f172a",
    screenshots: [
      {
        src: "/luxury-apartment-exterior.png",
        sizes: "1024x680",
        type: "image/png",
        form_factor: "wide",
      },
      {
        src: "/luxury-apartment-living-room.png",
        sizes: "1024x573",
        type: "image/png",
        form_factor: "wide",
      },
      {
        src: "/luxury-apartment-exterior.png",
        sizes: "1024x680",
        type: "image/png",
      },
    ],
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  }
}
