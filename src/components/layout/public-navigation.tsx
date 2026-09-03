'use client';

import { useEffect, useId, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LinkPendingMark } from '@/components/ui/link-pending';
import { cn } from '@/lib/utils';

export type PublicNavItem = {
  label: string;
  href: string;
  exact?: boolean;
};

export type PublicNavGroup = {
  label: string;
  href: string;
  items: PublicNavItem[];
};

type PublicNavigationProps = {
  ariaLabel: string;
  closeLabel: string;
  cta: PublicNavItem;
  groups: PublicNavGroup[];
  home: PublicNavItem;
  links: PublicNavItem[];
  menuLabel: string;
  openLabel: string;
  verify: PublicNavItem;
};

function normalizePath(path: string) {
  const withoutQuery = path.split(/[?#]/)[0] ?? '/';
  const trimmed = withoutQuery.replace(/\/$/, '');
  return trimmed || '/';
}

function isActive(pathname: string, href: string, exact = false) {
  const current = normalizePath(pathname);
  const target = normalizePath(href);
  if (exact) return current === target;
  return current === target || (target !== '/' && current.startsWith(`${target}/`));
}

function NavLink({
  item,
  pathname,
  onNavigate,
  variant = 'desktop',
}: {
  item: PublicNavItem;
  pathname: string;
  onNavigate?: () => void;
  variant?: 'desktop' | 'mobile';
}) {
  const active = isActive(pathname, item.href, item.exact);
  return (
    <Link
      href={item.href}
      aria-current={active ? 'page' : undefined}
      onClick={onNavigate}
      className={cn(
        'motion-standard relative inline-flex items-center gap-2 text-ink no-underline transition-colors hover:text-gold-700',
        'focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink',
        variant === 'desktop'
          ? 'min-h-10 text-small'
          : 'min-h-12 w-full justify-between border-bs border-rule py-3 text-body',
        active && 'text-navy-700',
      )}
    >
      <span>{item.label}</span>
      <span
        aria-hidden="true"
        className={cn(
          'motion-standard block h-0.5 bg-gold-600 transition-all',
          variant === 'desktop' ? 'absolute -inset-be-0.5 start-0' : 'w-8',
          active ? (variant === 'desktop' ? 'w-full' : 'opacity-100') : variant === 'desktop' ? 'w-0' : 'opacity-0',
        )}
      />
      <LinkPendingMark />
    </Link>
  );
}

function ChevronIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" className="icon-16 fill-none stroke-current stroke-2">
      <path d="m5 7.5 5 5 5-5" />
    </svg>
  );
}

function groupIsActive(pathname: string, group: PublicNavGroup) {
  return isActive(pathname, group.href) || group.items.some((item) => isActive(pathname, item.href, item.exact));
}

function MenuIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="icon-20 fill-none stroke-current stroke-2">
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="icon-20 fill-none stroke-current stroke-2">
      <path d="m6 6 12 12M18 6 6 18" />
    </svg>
  );
}

export function PublicNavigation({
  ariaLabel,
  closeLabel,
  cta,
  groups,
  home,
  links,
  menuLabel,
  openLabel,
  verify,
}: PublicNavigationProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const [mobileGroup, setMobileGroup] = useState<string | null>(null);
  const drawerId = useId();
  const navRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!openGroup) return;

    function onPointerDown(event: PointerEvent) {
      if (!navRef.current?.contains(event.target as Node)) setOpenGroup(null);
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpenGroup(null);
    }

    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [openGroup]);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeButtonRef.current?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <>
      <nav ref={navRef} aria-label={ariaLabel} className="hidden items-center gap-5 xl:flex">
        <Link
          href={home.href}
          aria-current={isActive(pathname, home.href, home.exact) ? 'page' : undefined}
          className="motion-standard relative inline-flex min-h-10 items-center gap-2 text-small text-ink no-underline transition-colors hover:text-gold-700"
        >
          {home.label}
          <LinkPendingMark />
        </Link>
        <ul className="flex items-center gap-1">
          {links.slice(0, 1).map((item) => (
            <li key={item.href}>
              <NavLink item={item} pathname={pathname} />
            </li>
          ))}
          {groups.map((group) => {
            const active = groupIsActive(pathname, group);
            return (
              <li key={group.label} className="relative">
                <div
                  onMouseEnter={() => setOpenGroup(group.label)}
                  onMouseLeave={() => setOpenGroup((current) => (current === group.label ? null : current))}
                  className={cn(
                    'motion-standard inline-flex min-h-10 items-center text-ink transition-colors hover:text-gold-700',
                    active && 'text-navy-700',
                  )}
                >
                  <Link
                    href={group.href}
                    aria-current={active ? 'page' : undefined}
                    onClick={() => setOpenGroup(null)}
                    className="motion-standard relative inline-flex min-h-10 items-center px-2 text-small text-current no-underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink"
                  >
                    <span>{group.label}</span>
                    <span
                      aria-hidden="true"
                      className={cn(
                        'motion-standard absolute -inset-be-0.5 start-0 block h-0.5 bg-gold-600 transition-all',
                        active ? 'w-full' : 'w-0',
                      )}
                    />
                    <LinkPendingMark />
                  </Link>
                  <button
                    type="button"
                    id={`nav-trigger-${group.label}`}
                    aria-expanded={openGroup === group.label}
                    aria-controls={`nav-menu-${group.label}`}
                    aria-label={group.label}
                    onClick={() => setOpenGroup((current) => (current === group.label ? null : group.label))}
                    className={cn(
                      'motion-standard flex min-h-10 min-w-8 cursor-pointer items-center justify-center text-current transition-colors hover:text-gold-700',
                      'focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink',
                    )}
                  >
                    <span className={cn('motion-standard transition-transform duration-200', openGroup === group.label && 'rotate-180')}>
                      <ChevronIcon />
                    </span>
                  </button>
                  {openGroup === group.label ? (
                    <div
                      id={`nav-menu-${group.label}`}
                      role="menu"
                      aria-labelledby={`nav-trigger-${group.label}`}
                      className="animate-dropdown-in absolute end-0 z-[60] mbs-3 min-w-56 rounded-md border border-rule bg-paper p-2 text-start shadow-[0_18px_45px_rgb(20_33_63/0.12)]"
                    >
                      <ul className="grid gap-1">
                        {group.items.map((item) => (
                          <li key={item.href} role="none">
                            <NavLink item={item} pathname={pathname} onNavigate={() => setOpenGroup(null)} />
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </div>
              </li>
            );
          })}
          {links.slice(1).map((item) => (
            <li key={item.href}>
              <NavLink item={item} pathname={pathname} />
            </li>
          ))}
        </ul>
        <Link
          href={verify.href}
          className="motion-standard inline-flex min-h-10 items-center gap-2 border-be-2 border-gold-600 text-small font-medium text-ink no-underline transition-colors hover:bg-gold-050"
        >
          {verify.label}
          <LinkPendingMark />
        </Link>
      </nav>

      <div className="flex items-center gap-2 xl:hidden">
        <Link
          href={verify.href}
          className="motion-standard hidden min-h-11 items-center border-be-2 border-gold-600 text-caption font-medium text-ink no-underline transition-colors hover:bg-gold-050 sm:inline-flex"
        >
          {verify.label}
        </Link>
        <button
          type="button"
          aria-controls={drawerId}
          aria-expanded={open}
          aria-label={openLabel}
          className="icon-button rule-control bg-paper text-ink hover:bg-paper-alt"
          onClick={() => setOpen(true)}
        >
          <MenuIcon />
          <span className="sr-only">{menuLabel}</span>
        </button>
      </div>

      {open ? (
        <div className="fixed inset-0 z-50 xl:hidden" role="presentation">
          <button
            type="button"
            aria-label={closeLabel}
            className="absolute inset-0 bg-ink/45"
            onClick={() => setOpen(false)}
          />
          <aside
            id={drawerId}
            aria-label={ariaLabel}
            className="inset-block-fill rule-inline-start-strong absolute end-0 flex w-[min(100%,24rem)] flex-col overflow-y-auto bg-paper text-ink"
          >
            <div className="flex min-h-16 items-center justify-between gap-4 border-be border-rule px-5">
              <p className="font-mono text-caption text-mono-muted">{menuLabel}</p>
              <button
                ref={closeButtonRef}
                type="button"
                aria-label={closeLabel}
                className="icon-button bg-paper text-ink hover:bg-paper-alt"
                onClick={() => setOpen(false)}
              >
                <CloseIcon />
              </button>
            </div>

            <nav aria-label={ariaLabel} className="px-5 py-4">
              <ul className="grid gap-2">
                <li>
                  <NavLink item={home} pathname={pathname} onNavigate={() => setOpen(false)} variant="mobile" />
                </li>
                {[...links.slice(0, 1), ...groups, ...links.slice(1)].map((entry) => {
                  if (!('items' in entry)) {
                    return (
                      <li key={entry.href}>
                        <NavLink item={entry} pathname={pathname} onNavigate={() => setOpen(false)} variant="mobile" />
                      </li>
                    );
                  }

                  const active = groupIsActive(pathname, entry);
                  return (
                    <li key={entry.label} className="pbs-3">
                      <div
                        className={cn(
                          'flex min-h-12 w-full items-center justify-between border-bs border-rule text-start text-small font-medium text-ink',
                          active && 'text-navy-700',
                        )}
                      >
                        <Link
                          href={entry.href}
                          aria-current={active ? 'page' : undefined}
                          onClick={() => setOpen(false)}
                          className="motion-standard relative inline-flex min-h-12 flex-1 items-center py-3 text-current no-underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink"
                        >
                          <span>{entry.label}</span>
                          <span
                            aria-hidden="true"
                            className={cn('motion-standard block h-0.5 bg-gold-600 transition-all', active ? 'w-8 opacity-100' : 'w-0 opacity-0')}
                          />
                          <LinkPendingMark />
                        </Link>
                        <button
                          type="button"
                          aria-expanded={mobileGroup === entry.label}
                          aria-controls={`mobile-nav-menu-${entry.label}`}
                          aria-label={entry.label}
                          onClick={() => setMobileGroup((current) => (current === entry.label ? null : entry.label))}
                          className="motion-standard flex min-h-12 min-w-12 items-center justify-center text-current focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink"
                        >
                          <span className={cn('motion-standard transition-transform duration-200', mobileGroup === entry.label && 'rotate-180')}>
                            <ChevronIcon />
                          </span>
                        </button>
                      </div>
                      {mobileGroup === entry.label ? (
                        <ul id={`mobile-nav-menu-${entry.label}`} className="animate-dropdown-in pbs-2">
                          {entry.items.map((item) => (
                            <li key={item.href}>
                              <NavLink item={item} pathname={pathname} onNavigate={() => setOpen(false)} variant="mobile" />
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </nav>

            <div className="mbs-auto grid gap-3 border-bs border-rule px-5 py-5">
              <Link
                href={verify.href}
                onClick={() => setOpen(false)}
                className="motion-standard inline-flex min-h-12 items-center justify-center border-be-2 border-gold-600 px-4 text-small font-medium text-ink no-underline transition-colors hover:bg-gold-050"
              >
                {verify.label}
              </Link>
              <Link
                href={cta.href}
                onClick={() => setOpen(false)}
                className="motion-standard inline-flex min-h-12 items-center justify-center bg-navy-700 px-4 text-small font-medium text-paper no-underline transition-colors hover:bg-navy-900 hover:text-paper"
              >
                {cta.label}
              </Link>
            </div>
          </aside>
        </div>
      ) : null}
    </>
  );
}
