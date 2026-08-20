import type { MetadataRoute } from 'next';
import { publicEnv } from '@/lib/env.public';

const BASE = publicEnv.NEXT_PUBLIC_SITE_URL.replace(/\/$/, '');

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        // `/admin` is behind a session guard already; this keeps it out of the
        // index so an admin login page never appears in a search result for the
        // organisation's name — which is itself an impersonation vector.
        disallow: ['/admin', '/api/'],
      },
    ],
    sitemap: `${BASE}/sitemap.xml`,
    host: BASE,
  };
}
