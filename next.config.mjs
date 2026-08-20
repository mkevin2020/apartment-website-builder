import path from 'node:path'
import { fileURLToPath } from 'node:url'

// Directory containing this config file — i.e. the real project root.
const projectRoot = path.dirname(fileURLToPath(import.meta.url))

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Pin the Turbopack workspace root instead of letting it be inferred.
  // Inference walks the filesystem looking for lockfiles and can land on the
  // wrong directory (it reported `…/app` and then failed to resolve
  // next/package.json from there). This path contains a space and parentheses,
  // which makes that inference more fragile still, so state it explicitly.
  turbopack: {
    root: projectRoot,
  },
  // `typescript.ignoreBuildErrors: true` used to sit here. It was hiding 25 real
  // errors, one of which mattered: app/tenant/payments/page.tsx declared an
  // Apartment interface with building_number / floor_number / apartment_number,
  // none of which exist in the table — so the code read `apartment.name`, the
  // column that IS there, and the type never agreed with reality.
  //
  // With the flag gone, a type error now fails the build. That is the point:
  // the compiler can only protect you if you let it stop you.
  images: {
    unoptimized: true,
  },
  // /tenant/login was a second, tenant-only sign-in page. It was removed
  // because /login already authenticates all four roles and routes each to its
  // own dashboard — two login pages was just a way to send people to the wrong
  // one. This keeps old bookmarks, emails and any printed links working.
  async redirects() {
    return [
      {
        source: '/tenant/login',
        destination: '/login',
        permanent: true,
      },
    ]
  },

  // Top-level in Next.js 15+/16 (it is NOT an `experimental` key).
  // Whitelists origins allowed to make cross-origin dev requests — needed when
  // accessing the dev server through ngrok or another LAN host.
  allowedDevOrigins: [
    'localhost',
    '127.0.0.1',
    '192.168.56.1',
    // ngrok tunnel(s) — the wildcards cover future ngrok URLs so you don't
    // have to edit this every time the tunnel restarts.
    '*.ngrok-free.dev',
    '*.ngrok-free.app',
    'mistier-jibingly-torrie.ngrok-free.dev',
  ],
}

export default nextConfig
