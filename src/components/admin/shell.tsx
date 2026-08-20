import Link from 'next/link';
import type { ReactNode } from 'react';
import { signOut } from '@/actions/admin/auth';
import type { UserRole } from '@/db/schema/enums';
import { cn } from '@/lib/utils';
import type { Actor } from '@/services/_shared/actor';
import { can } from '@/services/_shared/permissions';

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

type NavItem = {
  href: string;
  label: string;
  /** Rendered only when the actor holds this capability. */
  capability?: Parameters<typeof can>[1];
  roles?: UserRole[];
  badge?: number;
};

type NavGroup = { title: string; items: NavItem[] };

export function buildNav(
  actor: Actor,
  counts: { submissions: number; sensitive: number },
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
  nav,
  children,
}: {
  actor: Actor & { fullName?: string };
  nav: NavGroup[];
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-paper-ground">
      <aside className="w-64 shrink-0 border-ie border-rule bg-paper">
        <div className="border-be-2 border-ink p-5">
          <p className="text-h3 font-semibold text-ink">لوحة التحكم</p>
          <p className="mbs-1 text-caption text-ink-55">
            {actor.fullName ?? ''} — {ROLE_LABEL[actor.role]}
          </p>
        </div>

        <nav aria-label="التنقّل الرئيسي" className="p-4">
          {nav.map((group) => (
            <div key={group.title} className="mbe-6">
              <p className="eyebrow mbe-2">{group.title}</p>
              <ul className="space-y-1">
                {group.items.map((item) => (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className="flex items-center justify-between px-2 py-1.5 text-small text-ink no-underline hover:bg-paper-alt"
                    >
                      <span>{item.label}</span>
                      {item.badge ? (
                        <span
                          className={cn(
                            'rounded-full px-2 py-0.5 font-mono text-eyebrow',
                            'bg-gold-050 text-gold-700',
                          )}
                        >
                          {item.badge}
                        </span>
                      ) : null}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        <form action={signOut} className="border-bs border-rule p-4">
          <button type="submit" className="text-small text-ink-55 hover:text-gold-700">
            تسجيل الخروج
          </button>
        </form>
      </aside>

      <main className="min-w-0 flex-1 p-8">{children}</main>
    </div>
  );
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
