import type { NextConfig } from 'next';

/**
 * Static security headers.
 *
 * These live here rather than in `src/proxy.ts` for two reasons: they are
 * constant, so paying for them per request is waste; and config headers also
 * cover the paths the proxy matcher deliberately excludes (fonts, images,
 * `_next/static`).
 */
const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-Frame-Options', value: 'DENY' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), payment=()',
  },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=31536000; includeSubDomains; preload',
  },
];

/**
 * CSP for the public `(site)` routes — no nonce, deliberately.
 *
 * A nonce has to be read from `headers()`, which opts the whole subtree out of
 * static generation, and `(site)` is static + ISR by design
 * (`docs/spec/00-ARCHITECTURE.md` §0.5). `'unsafe-inline'` is what Next's inline
 * RSC bootstrap requires. The injection vector this would otherwise defend
 * against is already closed by the no-`dangerouslySetInnerHTML` rule and the
 * no-third-party-scripts rule.
 *
 * `(admin)` is `force-dynamic` and gets the strict nonce CSP from `src/proxy.ts`.
 */
const siteCsp = [
  `default-src 'self'`,
  `script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com`,
  `style-src 'self' 'unsafe-inline'`,
  `img-src 'self' data: blob: https://*.supabase.co`,
  `font-src 'self'`,
  `connect-src 'self' https://*.supabase.co https://challenges.cloudflare.com`,
  `frame-src https://challenges.cloudflare.com`,
  `frame-ancestors 'none'`,
  `base-uri 'self'`,
  `form-action 'self'`,
  `object-src 'none'`,
  `upgrade-insecure-requests`,
].join('; ');

const config: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,

  // DO NOT enable `cacheComponents`. It makes `unstable_cache`,
  // `export const revalidate` and `export const dynamic = 'force-dynamic'` all
  // error, and the entire caching design in docs/spec/02-API.md depends on
  // those three. See CLAUDE.md → "Next.js 16 — where the spec docs are stale".

  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [
      new URL('https://*.supabase.co/storage/v1/object/public/**'),
    ],
    deviceSizes: [360, 420, 640, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  },

  experimental: {
    optimizePackageImports: ['lucide-react'],
  },

  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          ...securityHeaders,
          { key: 'Content-Security-Policy', value: siteCsp },
        ],
      },
      {
        source: '/fonts/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
    ];
  },

  // The `eslint` config key was removed in Next 16 and `next build` no longer
  // runs linting — ESLint runs as its own CI step instead.
  typescript: { ignoreBuildErrors: false },
};

export default config;
