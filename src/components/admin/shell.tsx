import { Suspense, type ReactNode } from 'react';
import Link from 'next/link';
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
  icon?: 'home' | 'content' | 'project' | 'news' | 'story' | 'job' | 'page' | 'metric' | 'partner' | 'people' | 'publication' | 'media' | 'inbox' | 'shield' | 'organization' | 'redirect' | 'users' | 'audit';
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
    { title: 'نظرة عامة', items: [{ href: '/admin', label: 'لوحة التحكم', icon: 'home' }] },
    {
      title: 'المحتوى',
      items: [
        { href: '/admin/programs', label: 'البرامج', icon: 'content' },
        { href: '/admin/projects', label: 'المشاريع', icon: 'project' },
        { href: '/admin/posts', label: 'الأخبار', icon: 'news' },
        { href: '/admin/stories', label: 'القصص', icon: 'story' },
        { href: '/admin/vacancies', label: 'الوظائف', icon: 'job' },
        { href: '/admin/pages', label: 'الصفحات', icon: 'page' },
      ],
    },
    {
      title: 'البيانات',
      items: [
        { href: '/admin/metrics', label: 'مؤشرات الأثر', icon: 'metric' },
        { href: '/admin/partners', label: 'الشركاء', icon: 'partner' },
        { href: '/admin/people', label: 'الأشخاص', icon: 'people' },
        { href: '/admin/publications', label: 'الإصدارات', icon: 'publication' },
      ],
    },
    { title: 'الوسائط', items: [{ href: '/admin/media', label: 'مكتبة الوسائط', icon: 'media' }] },
    {
      title: 'الوارد',
      items: [
        {
          href: '/admin/submissions',
          label: 'الطلبات',
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
                label: 'الشكاوى السرّية',
                icon: 'shield' as const,
                badge: counts.sensitive,
              },
            ]
          : []),
      ],
    },
    {
      title: 'الإعدادات',
      items: [
        { href: '/admin/organization', label: 'بيانات المؤسسة', icon: 'organization', capability: 'org.settings.contact' },
        { href: '/admin/redirects', label: 'التحويلات', icon: 'redirect', capability: 'redirects.manage' },
        { href: '/admin/users', label: 'المستخدمون', icon: 'users', capability: 'users.manage' },
        { href: '/admin/audit', label: 'سجل التدقيق', icon: 'audit', capability: 'audit.read' },
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
    <div className="flex min-h-screen flex-col bg-[linear-gradient(145deg,#f7f4ec_0%,#eef1f7_100%)] md:flex-row">
      <aside className="shrink-0 border-be border-rule bg-white/95 shadow-[0_0_45px_rgb(20_33_63/0.06)] backdrop-blur md:sticky md:inset-bs-0 md:h-screen md:w-72 md:overflow-y-auto md:border-be-0 md:border-e">
        <div className="border-be border-rule p-5">
          <div className="flex items-center gap-3">
            <span className="flex size-11 items-center justify-center rounded-xl bg-navy-700 text-paper shadow-[0_10px_24px_rgb(37_66_132/0.22)]">
              <svg aria-hidden="true" viewBox="0 0 24 24" className="size-6 fill-none stroke-current stroke-2">
                <path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z" strokeLinejoin="round" />
              </svg>
            </span>
            <div>
              <p className="text-h4 font-semibold text-navy-900">لوحة التحكم</p>
              <p className="mbs-0.5 text-caption text-ink-55">
            {actor.fullName ?? ''} — {ROLE_LABEL[actor.role]}
              </p>
            </div>
          </div>
          <Link
            href="/ar"
            className="mbs-4 flex min-h-10 items-center justify-center rounded-xl border border-rule bg-paper-alt/60 px-4 text-caption font-medium text-ink no-underline transition hover:border-gold-600 hover:bg-gold-050 hover:text-gold-700"
          >
            زيارة الموقع
          </Link>
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
            <button type="submit" className="flex min-h-10 w-full items-center justify-center rounded-xl bg-navy-100 px-4 text-small font-medium text-navy-900 transition hover:bg-navy-700 hover:text-paper">
              تسجيل الخروج
            </button>
          </form>
        )}
      </aside>

      <main className="min-w-0 flex-1 p-4 md:p-8 lg:p-10">{children}</main>
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
    <header className="mbe-8 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/80 bg-white/85 p-5 shadow-[0_14px_38px_rgb(20_33_63/0.06)] backdrop-blur md:p-6">
      <div>
        <h1 className="text-h2 font-semibold text-navy-900">{title}</h1>
        {description ? <p className="mbs-2 text-small text-ink-55">{description}</p> : null}
      </div>
      {action}
    </header>
  );
}
