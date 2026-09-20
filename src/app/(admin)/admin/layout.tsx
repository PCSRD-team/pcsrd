import { fontVariables } from '@/app/fonts';
import { AdminShell } from '@/components/admin/shell';
import { requireAuth } from '@/lib/auth/guard';
import { adminUi } from '@/components/admin/admin-ui-dict';
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
 * public site's locale machinery. That is true now: `src/app/layout.tsx` has
 * been removed, so this layout has nothing above it. While that file existed
 * the comment was aspirational and this `<html>` was nested inside another
 * one, which the HTML parser discards along with the `lang` and `dir` it
 * carried — an Arabic-only CMS rendering left-to-right.
 *
 * The login page is **not** in this group. It lives in `(admin-auth)` with its
 * own root layout, because a guard here that redirects to a page inside itself
 * is an infinite redirect. Two route groups can serve neighbouring paths under
 * `/admin` as long as no path exists in both.
 */
export const dynamic = 'force-dynamic';

export const metadata = {
  title: {
    default: adminUi.shell.brand,
    template: `%s — ${adminUi.shell.brand}`,
  },
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const actor = await requireAuth();

  return (
    <html lang="ar" dir="rtl">
      <body className={`${fontVariables} bg-paper-ground antialiased`}>
        <AdminShell actor={actor}>{children}</AdminShell>
      </body>
    </html>
  );
}
