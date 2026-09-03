import { Suspense, type ReactNode } from 'react';
import { signOut } from '@/actions/admin/auth';
import { getAdminNavCounts } from '@/db/queries/admin';
import type { UserRole } from '@/db/schema/enums';
import type { Actor } from '@/services/_shared/actor';
import { can } from '@/services/_shared/permissions';
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
 */

export type NavItem = {
  href: string;
  label: string;
  /** Rendered only when the actor holds this capability. */
  capability?: Parameters<typeof can>[1];
  roles?: UserRole[];
  badge?: number;
};

export type NavGroup = { title: string; items: NavItem[] };

export function buildNav(
  actor: Actor,
  counts: { submissions?: number; sensitive?: number } = {},
): NavGroup[] {
  const groups: NavGroup[] = [
    { title: 'نظرة عامة', items: [{ href: '/admin', label: 'لوحة التحكم' }] },
    {
      title: 'المحتوى',
      items: [
        { href: '/admin/programs', label: 'البرامج' },
        { href: '/admin/projects', label: 'المشاريع' },
        { href: '/admin/posts', label: 'الأخبار' },
        { href: '/admin/stories', label: 'القصص' },
        { href: '/admin/vacancies', label: 'الوظائف' },
        { href: '/admin/pages', label: 'الصفحات' },
      ],
    },
    {
      title: 'البيانات',
      items: [
        { href: '/admin/metrics', label: 'مؤشرات الأثر' },
        { href: '/admin/partners', label: 'الشركاء' },
        { href: '/admin/people', label: 'الأشخاص' },
        { href: '/admin/publications', label: 'الإصدارات' },
      ],
    },
    { title: 'الوسائط', items: [{ href: '/admin/media', label: 'مكتبة الوسائط' }] },
    {
      title: 'الوارد',
      items: [
        {
          href: '/admin/submissions',
          label: 'الطلبات',
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
                label: 'الشكاوى السرّية',
                badge: counts.sensitive,
              },
            ]
          : []),
      ],
    },
    {
      title: 'الإعدادات',
      items: [
        { href: '/admin/organization', label: 'بيانات المؤسسة', capability: 'org.settings.contact' },
        { href: '/admin/redirects', label: 'التحويلات', roles: ['admin'] },
        { href: '/admin/users', label: 'المستخدمون', capability: 'users.manage' },
        { href: '/admin/audit', label: 'سجل التدقيق', capability: 'audit.read' },
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

const ROLE_LABEL: Record<UserRole, string> = {
  admin: 'مدير',
  content_manager: 'مسؤول محتوى',
  editor: 'محرّر',
};

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

  return (
    // Column below `md:`, row above it. The shell had no responsive treatment
    // whatsoever: a `w-64 shrink-0` sidebar plus `p-8` on main is 256 + 64 =
    // 320px, so at a 320px viewport the content area was **zero pixels wide**
    // and at 375px it was 55. Nothing anywhere said the CMS was desktop-only,
    // and the staff who use it work in Gaza, where a phone is often the only
    // reliable device.
    //
    // The mobile sidebar is a `<details>` disclosure, not a JavaScript toggle —
    // same reasoning as the public header: a menu that needs JS is a menu that
    // stops working exactly when the network is worst.
    <div className="flex min-h-screen flex-col bg-paper-ground md:flex-row">
      <aside className="shrink-0 border-be border-rule bg-paper md:w-64 md:border-be-0 md:border-e">
        <div className="border-be-2 border-ink p-5">
          <p className="text-h3 font-semibold text-ink">لوحة التحكم</p>
          <p className="mbs-1 text-caption text-ink-55">
            {actor.fullName ?? ''} — {ROLE_LABEL[actor.role]}
          </p>
        </div>

        <details className="md:hidden">
          <summary className="cursor-pointer border-be border-rule p-4 text-small font-medium text-ink">
            القائمة
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
          <form action={signOut} className="border-bs border-rule p-4">
            <button type="submit" className="text-small text-ink-55 hover:text-gold-700">
              تسجيل الخروج
            </button>
          </form>
        )}
      </aside>

      <main className="min-w-0 flex-1 p-4 md:p-8">{children}</main>
    </div>
  );
}

async function AdminNavWithCounts({ actor }: { actor: Actor }) {
  const counts = await getAdminNavCounts(actor);

  return <AdminNav nav={buildNav(actor, counts)} />;
}

/** Page header with a title, optional description and an action slot. */
export function AdminHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <header className="mbe-8 flex flex-wrap items-start justify-between gap-4 border-be-2 border-ink pbe-5">
      <div>
        <h1 className="text-h2 font-semibold text-ink">{title}</h1>
        {description ? <p className="mbs-2 text-small text-ink-55">{description}</p> : null}
      </div>
      {action}
    </header>
  );
}
