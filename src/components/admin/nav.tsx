'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
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

export function AdminNav({ nav }: { nav: NavGroup[] }) {
  const pathname = usePathname();
  const activeHref = activeHrefFor(pathname, nav);

  return (
    <nav aria-label="التنقّل الرئيسي" className="p-4">
      {nav.map((group) => (
        <div key={group.title} className="mbe-6">
          <p className="eyebrow mbe-2">{group.title}</p>
          <ul className="space-y-1">
            {group.items.map((item) => (
              <AdminNavItem key={item.href} item={item} active={item.href === activeHref} />
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function AdminNavItem({ item, active }: { item: NavItem; active: boolean }) {
  return (
    <li>
      <Link
        href={item.href}
        aria-current={active ? 'page' : undefined}
        className={cn(
          'flex items-center justify-between px-2 py-1.5 text-small text-ink no-underline hover:bg-paper-alt',
          active && 'bg-gold-050 font-medium text-gold-700',
        )}
      >
        <span>{item.label}</span>
        {item.badge ? (
          <span
            className={cn(
              'rounded-full px-2 py-0.5 font-mono text-eyebrow',
              'bg-gold-050 text-gold-700',
              active && 'bg-paper text-gold-700',
            )}
          >
            {item.badge}
          </span>
        ) : null}
      </Link>
    </li>
  );
}
