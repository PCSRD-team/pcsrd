import { IBM_Plex_Mono, IBM_Plex_Sans_Arabic } from 'next/font/google';
import { AdminShell, buildNav } from '@/components/admin/shell';
import { getDashboard } from '@/db/queries/admin';
import { requireAuth } from '@/lib/auth/guard';
import { getCurrentProfileDetail } from '@/lib/auth/session';
import '../../globals.css';

/**
 * The admin root.
 *
 * `force-dynamic` because every page here is per-actor and RLS-scoped; caching
 * would serve one editor's drafts to another. `noindex` because an admin login
 * appearing in a search result for the organisation's name is itself an
 * impersonation surface.
 *
 * This is a **root layout** — the `(admin)` group renders its own `<html>` so
 * it can be `lang="ar" dir="rtl"` unconditionally, without inheriting the
 * public site's locale machinery.
 *
 * The login page is **not** in this group. It lives in `(admin-auth)` with its
 * own root layout, because a guard here that redirects to a page inside itself
 * is an infinite redirect. Two route groups can serve neighbouring paths under
 * `/admin` as long as no path exists in both.
 */
export const dynamic = 'force-dynamic';

export const metadata = {
  title: { default: 'لوحة التحكم', template: '%s — لوحة التحكم' },
  robots: { index: false, follow: false },
};

const plexArabic = IBM_Plex_Sans_Arabic({
  subsets: ['arabic', 'latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-plex-arabic',
  display: 'swap',
});

const plexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-plex-mono',
  display: 'swap',
});

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const actor = await requireAuth();
  const [profile, dashboard] = await Promise.all([
    getCurrentProfileDetail(),
    getDashboard(actor),
  ]);

  const nav = buildNav(actor, {
    submissions: dashboard.newSubmissions,
    sensitive: dashboard.sensitiveNew,
  });

  return (
    <html lang="ar" dir="rtl">
      <body className={`${plexArabic.variable} ${plexMono.variable}`}>
        <AdminShell actor={{ ...actor, fullName: profile?.fullName }} nav={nav}>
          {children}
        </AdminShell>
      </body>
    </html>
  );
}
