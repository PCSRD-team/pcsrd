import { Suspense, type ReactNode } from 'react';
import { signOut } from '@/actions/admin/auth';
import { Button, ButtonLink, buttonClasses } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/layout';
import { Caption } from '@/components/ui/typography';
import { getAdminNavCounts } from '@/db/queries/admin';
import type { UserRole } from '@/db/schema/enums';
import type { Actor } from '@/services/_shared/actor';
import { can } from '@/services/_shared/permissions';
import { adminDict } from './admin-dict';
import { adminUi } from './admin-ui-dict';
import { AdminNav } from './nav';

/**
 * The admin shell.
 *
 * **Arabic-only and RTL.** The staff who use this work in Arabic, and a
 * bilingual admin doubles the surface for no benefit — the *content* stays
 * bilingual, which is a different axis entirely.
 *
 * Navigation is filtered by capability rather than hidden by CSS: a link an
 * editor cannot use is not rendered, so the sidebar is an honest map of what
 * this person can do. The actions guard again regardless.
 *
 * The sidebar is the navy surface from the design reference (the kit's
 * `Panel tone="navy"` ground). Its two controls override the kit button's
 * ink text with paper via `className`, which every kit component applies
 * last for exactly this case.
 */

export type NavItem = {
  href: string;
  label: string;
  icon?:
    | 'home'
    | 'content'
    | 'project'
    | 'news'
    | 'story'
    | 'job'
    | 'page'
    | 'metric'
    | 'partner'
    | 'people'
    | 'publication'
    | 'media'
    | 'inbox'
    | 'shield'
    | 'organization'
    | 'redirect'
    | 'users'
    | 'audit';
  /** Rendered only when the actor holds this capability. */
  capability?: Parameters<typeof can>[1];
  roles?: UserRole[];
  badge?: number;
  /** The badge's meaning: the confidential count is the one danger-toned badge. */
  badgeTone?: 'default' | 'danger';
};

export type NavGroup = { title: string; items: NavItem[] };

export function buildNav(
  actor: Actor,
  counts: { submissions?: number; sensitive?: number } = {},
): NavGroup[] {
  const n = adminUi.nav;
  const groups: NavGroup[] = [
    { title: n.overview, items: [{ href: '/admin', label: n.dashboard, icon: 'home' }] },
    {
      title: n.content,
      items: [
        { href: '/admin/programs', label: n.programs, icon: 'content' },
        { href: '/admin/projects', label: n.projects, icon: 'project' },
        { href: '/admin/posts', label: n.posts, icon: 'news' },
        { href: '/admin/stories', label: n.stories, icon: 'story' },
        { href: '/admin/vacancies', label: n.vacancies, icon: 'job' },
        { href: '/admin/pages', label: n.pages, icon: 'page' },
      ],
    },
    {
      title: n.data,
      items: [
        { href: '/admin/metrics', label: n.metrics, icon: 'metric' },
        { href: '/admin/partners', label: n.partners, icon: 'partner' },
        { href: '/admin/people', label: n.people, icon: 'people' },
        { href: '/admin/publications', label: n.publications, icon: 'publication' },
      ],
    },
    { title: n.media, items: [{ href: '/admin/media', label: n.mediaLibrary, icon: 'media' }] },
    {
      title: n.inbox,
      items: [
        {
          href: '/admin/submissions',
          label: n.submissions,
          icon: 'inbox',
          capability: 'submissions.read',
          badge: counts.submissions,
        },
        // Gated on `canViewSensitive`, which is granted per person and is not
        // implied by being an admin. Someone without it never sees the link,
        // and the count they cannot open is never rendered.
        ...(actor.canViewSensitive
          ? [
              {
                href: '/admin/submissions/sensitive',
                label: n.sensitive,
                icon: 'shield' as const,
                badge: counts.sensitive,
                badgeTone: 'danger' as const,
              },
            ]
          : []),
      ],
    },
    {
      title: n.settings,
      items: [
        { href: '/admin/organization', label: n.organization, icon: 'organization', capability: 'org.settings.contact' },
        { href: '/admin/redirects', label: n.redirects, icon: 'redirect', capability: 'redirects.manage' },
        { href: '/admin/users', label: n.users, icon: 'users', capability: 'users.manage' },
        { href: '/admin/audit', label: n.audit, icon: 'audit', capability: 'audit.read' },
      ],
    },
  ];

  return groups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => {
        if (item.roles && !item.roles.includes(actor.role)) return false;
        if (item.capability && !can(actor, item.capability)) return false;
        return true;
      }),
    }))
    .filter((group) => group.items.length > 0);
}

/** Paper text on the navy sidebar, for the two kit buttons that live there. */
const onNavy = 'w-full text-paper hover:bg-navy-700 hover:text-paper';

export function AdminShell({
  actor,
  children,
  footer,
}: {
  actor: Actor;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const fallbackNav = <AdminNav nav={buildNav(actor)} countsPending />;
  const t = adminUi.shell;

  return (
    // Column below `md:`, row above it. A fixed sidebar plus main padding
    // must never exceed a phone's width: the staff who use this work in
    // Gaza, where a phone is often the only reliable device.
    //
    // The mobile sidebar is a `<details>` disclosure, not a JavaScript toggle —
    // same reasoning as the public header: a menu that needs JS is a menu that
    // stops working exactly when the network is worst.
    <div className="flex min-h-screen flex-col bg-paper-ground md:flex-row">
      <aside className="shrink-0 bg-navy-900 text-paper md:sticky md:inset-bs-0 md:h-screen md:w-72 md:overflow-y-auto">
        <div className="border-be border-navy-700 p-5">
          <p className="text-h4 font-semibold text-paper">{t.brand}</p>
          <Caption className="mbs-1 text-paper/70">
            {actor.fullName ?? ''} — {adminDict.users.roles[actor.role]}
          </Caption>
          <ButtonLink href="/ar" tone="quiet" size="sm" className={`mbs-4 border border-navy-700 ${onNavy}`}>
            {t.visitSite}
          </ButtonLink>
        </div>

        <details className="md:hidden">
          <summary
            className={buttonClasses({
              tone: 'quiet',
              className: `cursor-pointer list-none justify-start border-be border-navy-700 ${onNavy}`,
            })}
          >
            {t.menu}
          </summary>
          <Suspense fallback={fallbackNav}>
            <AdminNavWithCounts actor={actor} />
          </Suspense>
        </details>

        <div className="hidden md:block">
          <Suspense fallback={fallbackNav}>
            <AdminNavWithCounts actor={actor} />
          </Suspense>
        </div>

        {footer ?? (
          <form action={signOut} className="border-bs border-navy-700 p-4">
            <Button type="submit" tone="quiet" size="sm" className={`border border-navy-700 ${onNavy}`}>
              {t.signOut}
            </Button>
          </form>
        )}
      </aside>

      <main id="main" className="min-w-0 flex-1 p-4 md:p-8 lg:p-10">
        {children}
      </main>
    </div>
  );
}

async function AdminNavWithCounts({ actor }: { actor: Actor }) {
  const counts = await getAdminNavCounts(actor);

  return <AdminNav nav={buildNav(actor, counts)} />;
}

/**
 * The page header every admin screen opens with: the kit's `PageHeader`
 * with the admin's slots — `description` as the lede, `meta` for a status
 * or translation badge, `action` for the primary link or button.
 */
export function AdminHeader({
  title,
  description,
  meta,
  action,
}: {
  title: string;
  description?: string;
  meta?: ReactNode;
  action?: ReactNode;
}) {
  return <PageHeader title={title} lede={description} meta={meta} actions={action} />;
}
