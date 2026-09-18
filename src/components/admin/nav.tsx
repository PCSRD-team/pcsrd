'use client';
// Client Component: `usePathname()` marks the current section, which the
// server cannot know for a layout that is shared by every admin route.

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Icon } from '@/components/ui/icon';
import { LinkPendingMark } from '@/components/ui/link-pending';
import { SkeletonBlock } from '@/components/ui/skeleton';
import { Eyebrow } from '@/components/ui/typography';
import { cn } from '@/lib/utils';
import { adminUi } from './admin-ui-dict';
import type { NavGroup, NavItem } from './shell';

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
    <nav aria-label={adminUi.shell.navLabel} className="p-4">
      {nav.map((group) => (
        <div key={group.title} className="mbe-6">
          <Eyebrow className="mbe-2 px-3 text-paper/60">{group.title}</Eyebrow>
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

/**
 * The current section is marked by the gold rule along its inline-start
 * edge and the lighter navy ground — the marking colour used as a rule,
 * never as a fill. Every item carries a transparent rule of the same width
 * so the label does not shift when the mark arrives.
 */
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
          'motion-standard flex min-h-target items-center justify-between gap-3 border-s-2 border-transparent px-3 py-2 text-small text-paper/85 no-underline transition-colors hover:bg-navy-700 hover:text-paper',
          active && 'border-gold-600 bg-navy-700 font-medium text-paper',
        )}
      >
        <span className="flex min-w-0 items-center gap-3">
          {item.icon ? <Icon name={item.icon} /> : null}
          <span className="truncate">{item.label}</span>
        </span>
        <span className="flex shrink-0 items-center gap-2">
          <LinkPendingMark />
          {item.badge ? (
            <Badge tone={item.badgeTone === 'danger' ? 'danger' : 'verified'}>
              <span dir="ltr">{item.badge}</span>
            </Badge>
          ) : countsPending && item.href.startsWith('/admin/submissions') ? (
            <SkeletonBlock className="h-5 w-7" />
          ) : null}
        </span>
      </Link>
    </li>
  );
}
