import { withSentryConfig } from '@sentry/nextjs/config';
import type { NextConfig } from 'next';
import { buildSiteCsp } from './src/lib/security/csp';

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
 * The site CSP is built in `src/lib/security/csp.ts`, next to the admin one, so
 * the two cannot drift and both can be unit-tested. `tests/unit/csp.test.ts`
 * asserts that neither carries `'unsafe-eval'` or a websocket in production.
 *
 * `headers()` is evaluated once at build time, and `next build` sets NODE_ENV to
 * `production` — so what a deployment serves is the production string.
 */
const siteCsp = buildSiteCsp(process.env.NODE_ENV !== 'production');

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
    serverActions: {
      // The job-application form posts a CV through a Server Action, and the
      // default limit is 1 MB. 4.5 MB is Vercel's platform ceiling; uploads are
      // rejected at 4 MB in src/lib/security/upload.ts so the message comes
      // from us rather than as an opaque 413 from the edge.
      bodySizeLimit: '4.5mb',
    },
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

/**
 * Sentry build integration.
 *
 * What it does here: injects the tree-shaking flags that strip the SDK's
 * debug logging, tracing and replay code from the client bundle (none of
 * which this project uses — `tracesSampleRate: 0`, no replay), and, only when
 * a `SENTRY_AUTH_TOKEN` is present, uploads source maps so a stack trace in
 * Sentry names the source line rather than a minified column.
 *
 * What it does not do: it adds no script tag (the SDK is bundled from
 * `src/instrumentation-client.ts`), no tunnel route, no route manifest in the
 * client bundle, no Vercel cron monitors, no telemetry to Sentry about the
 * build. Without a DSN the runtime never initialises; without an auth token
 * the build never contacts Sentry. CI has neither and builds green.
 */
export default withSentryConfig(config, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  telemetry: false,
  silent: !process.env.CI,

  sourcemaps: {
    disable: !process.env.SENTRY_AUTH_TOKEN,
    deleteSourcemapsAfterUpload: true,
  },
  widenClientFileUpload: false,
  tunnelRoute: undefined,
  routeManifestInjection: false,
  // Navigation tracing is off (`tracesSampleRate: 0`), so the client file
  // deliberately exports no `onRouterTransitionStart`; this silences the
  // build-time reminder to add one.
  suppressOnRouterTransitionStartWarning: true,

  bundleSizeOptimizations: {
    excludeDebugStatements: true,
    excludeTracing: true,
    excludeReplayShadowDom: true,
    excludeReplayIframe: true,
    excludeReplayWorker: true,
  },
});
