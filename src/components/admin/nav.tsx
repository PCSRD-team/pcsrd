'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LinkPendingMark } from '@/components/ui/link-pending';
import { cn } from '@/lib/utils';
import type { NavGroup, NavItem } from './shell';

function NavIcon({ icon }: { icon: NavItem['icon'] }) {
  const common = 'size-5 fill-none stroke-current stroke-[1.8]';
  const paths: Record<NonNullable<NavItem['icon']>, React.ReactNode> = {
    home: <><path d="m3 11 9-8 9 8" /><path d="M5 10v10h14V10M9 20v-6h6v6" /></>,
    content: <><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M8 8h8M8 12h8M8 16h5" /></>,
    project: <><path d="M4 7h6l2 2h8v11H4z" /><path d="M4 7V5h7l2 2" /></>,
    news: <><path d="M5 4h14v16H5z" /><path d="M8 8h8M8 12h8M8 16h5" /></>,
    story: <><path d="M4 5h7a3 3 0 0 1 3 3v12H7a3 3 0 0 0-3 1z" /><path d="M20 5h-4" /></>,
    job: <><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M9 7V4h6v3M3 12h18" /></>,
    page: <><path d="M6 3h9l4 4v14H6z" /><path d="M15 3v5h4M9 13h7M9 17h5" /></>,
    metric: <><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></>,
    partner: <><path d="M8 12 5 9l3-3 4 4M16 12l3-3-3-3-4 4" /><path d="m9 13 3 3 3-3" /></>,
    people: <><circle cx="9" cy="8" r="3" /><circle cx="17" cy="9" r="2" /><path d="M3 20c.5-4 2.5-6 6-6s5.5 2 6 6M15 15c3 0 5 1.7 5.5 5" /></>,
    publication: <><path d="M5 4h14v16H5z" /><path d="M9 4v16M12 8h4M12 12h4" /></>,
    media: <><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="9" cy="9" r="2" /><path d="m3 17 5-5 4 4 3-3 6 5" /></>,
    inbox: <><path d="M4 5h16l2 10v5H2v-5z" /><path d="M3 15h5l2 3h4l2-3h5" /></>,
    shield: <><path d="M12 3 5 6v5c0 5 3 8 7 10 4-2 7-5 7-10V6z" /><path d="m9 12 2 2 4-4" /></>,
    organization: <><path d="M4 21h16M6 21V8l6-5 6 5v13M9 11h2M13 11h2M9 15h2M13 15h2" /></>,
    redirect: <><path d="M4 7h11a5 5 0 0 1 5 5v1" /><path d="m16 9 4 4 4-4M20 17H9a5 5 0 0 1-5-5v-1" /></>,
    users: <><circle cx="9" cy="8" r="3" /><path d="M3 20c.5-4 2.5-6 6-6s5.5 2 6 6M17 8v6M14 11h6" /></>,
    audit: <><path d="M5 3h14v18H5z" /><path d="M8 8h8M8 12h8M8 16h5" /></>,
  };
  if (!icon) return null;
  return <svg aria-hidden="true" viewBox="0 0 24 24" className={common}>{paths[icon]}</svg>;
}

function normalizePath(pathname: string) {
  return pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
}

function matchesPath(pathname: string, href: string) {
  const current = normalizePath(pathname);
  const target = normalizePath(href);
  if (target === '/admin') return current === target;
  return current === target || current.startsWith(`${target}/`);
}

function activeHrefFor(pathname: string, nav: NavGroup[]) {
  return nav
    .flatMap((group) => group.items)
    .filter((item) => matchesPath(pathname, item.href))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;
}

export function AdminNav({
  nav,
  countsPending = false,
}: {
  nav: NavGroup[];
  countsPending?: boolean;
}) {
  const pathname = usePathname();
  const activeHref = activeHrefFor(pathname, nav);

  return (
    <nav aria-label="التنقّل الرئيسي" className="p-4">
      {nav.map((group) => (
        <div key={group.title} className="mbe-6">
          <p className="mbe-2 px-3 text-eyebrow font-semibold text-ink-55">{group.title}</p>
          <ul className="space-y-1">
            {group.items.map((item) => (
              <AdminNavItem
                key={item.href}
                item={item}
                active={item.href === activeHref}
                countsPending={countsPending}
              />
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function AdminNavItem({
  item,
  active,
  countsPending,
}: {
  item: NavItem;
  active: boolean;
  countsPending: boolean;
}) {
  return (
    <li>
      <Link
        href={item.href}
        aria-current={active ? 'page' : undefined}
        className={cn(
          'motion-standard flex min-h-11 items-center justify-between gap-3 rounded-xl px-3 py-2 text-small text-ink no-underline transition-[background-color,color,transform] hover:translate-x-0.5 hover:bg-paper-alt rtl:hover:-translate-x-0.5',
          active && 'bg-navy-700 font-medium text-paper shadow-[0_10px_24px_rgb(37_66_132/0.18)] hover:bg-navy-900',
        )}
      >
        <span className="flex min-w-0 items-center gap-3">
          <NavIcon icon={item.icon} />
          <span className="truncate">{item.label}</span>
        </span>
        <span className="flex shrink-0 items-center gap-2">
          <LinkPendingMark />
          {item.badge ? (
            <span
              className={cn(
                'rounded-full px-2 py-0.5 font-mono text-eyebrow',
                'bg-gold-050 text-gold-700',
                active && 'bg-paper text-navy-900',
              )}
            >
              {item.badge}
            </span>
          ) : countsPending && item.href.startsWith('/admin/submissions') ? (
            <span className="loading-surface h-5 w-7 rounded-full" aria-hidden="true" />
          ) : null}
        </span>
      </Link>
    </li>
  );
}
