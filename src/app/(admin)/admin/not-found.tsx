import { adminUi } from '@/components/admin/admin-ui-dict';
import { ButtonLink } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/feedback';

/**
 * The admin's 404 — an id that does not resolve (`notFound()` in an editor
 * page), or a mistyped admin URL. Rendered inside `admin/layout.tsx`, so the
 * shell and its navigation stay; without this file the site-wide not-found
 * document replaced the whole admin, in the public site's chrome.
 */
export default function AdminNotFound() {
  const t = adminUi.boundary;
  return (
    <EmptyState
      title={t.notFoundTitle}
      body={t.notFoundBody}
      action={<ButtonLink href="/admin">{t.toDashboard}</ButtonLink>}
    />
  );
}
