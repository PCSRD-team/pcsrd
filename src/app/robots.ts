import type { MetadataRoute } from 'next';
import { publicEnv } from '@/lib/env.public';

const SITE = new URL(publicEnv.NEXT_PUBLIC_SITE_URL);
const BASE = SITE.origin;

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        // `/admin` is behind a session guard already; this keeps it out of the
        // index so an admin login page never appears in a search result for the
        // organisation's name — which is itself an impersonation vector.
        // `/api` covers the cron, health and admin route handlers.
        disallow: ['/admin', '/api'],
      },
    ],
    sitemap: `${BASE}/sitemap.xml`,
    // `Host` takes a bare hostname — no scheme, no port, no trailing slash
    // (SEO-019). Using the full URL emitted `Host: http://localhost:3000`.
    host: SITE.hostname,
  };
}
