'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon } from '@/components/ui/icon';
import styles from './header.module.css';

export type HeaderItem = { label: string; href: string; children?: { label: string; href: string }[] };

function Chevron() {
  return <svg className={styles.chevron} aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="m6 9 6 6 6-6" /></svg>;
}

export function HeaderNavigation({ items, homeHref, navLabel, menuLabel, closeLabel, moreLabel, donateLabel, donateHref, partnerLabel, partnerHref }: {
  items: HeaderItem[];
  homeHref: string;
  navLabel: string;
  menuLabel: string;
  closeLabel: string;
  moreLabel: string;
  donateLabel: string;
  donateHref: string;
  partnerLabel: string;
  partnerHref: string;
}) {
  const pathname = usePathname();
  const root = useRef<HTMLDivElement>(null);
  const closeAll = () => root.current?.querySelectorAll('details[open]').forEach(node => { (node as HTMLDetailsElement).open = false; });

  useEffect(() => { closeAll(); }, [pathname]);
  useEffect(() => {
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !root.current?.contains(event.target)) closeAll();
    };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, []);

  const active = (href: string) => href === homeHref ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
  const list = (mobile: boolean) => items.map(item => {
    const selected = active(item.href) || item.children?.some(child => active(child.href));
    return (
      <li key={item.label}>
        {item.children?.length ? (
          <details className={styles.dropdown}
            onPointerEnter={event => {
              if (!mobile && event.pointerType === 'mouse') {
                root.current?.querySelectorAll(`.${styles.desktop} details[open]`).forEach(node => { if (node !== event.currentTarget) (node as HTMLDetailsElement).open = false; });
                event.currentTarget.open = true;
              }
            }}
            onPointerLeave={event => { if (!mobile && event.pointerType === 'mouse') event.currentTarget.open = false; }}
            onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) event.currentTarget.open = false; }}
          >
            <summary className={`${styles.navLink} ${selected ? styles.active : ''}`}>
              {item.label}<Chevron />
            </summary>
            <div className={styles.dropdownPanel}>
              <p className={styles.dropdownTitle}>{item.label}</p>
              <ul>
                {item.children.map(child => <li key={child.href}>
                  <Link href={child.href} onClick={closeAll} aria-current={pathname === child.href ? 'page' : undefined}>
                    <span>{child.label}</span><Icon name="arrow" size={16} />
                  </Link>
                </li>)}
              </ul>
            </div>
          </details>
        ) : (
          <Link href={item.href} onClick={closeAll} className={`${styles.navLink} ${selected ? styles.active : ''}`} aria-current={pathname === item.href ? 'page' : undefined}>
            {item.href === homeHref ? <svg aria-hidden="true" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="m3 10 9-7 9 7M5 9v12h5v-7h4v7h5V9" /></svg> : null}
            {item.label}
          </Link>
        )}
      </li>
    );
  });

  const donation = <Link href={donateHref} onClick={closeAll} className={styles.donate}>
    <svg aria-hidden="true" width="19" height="19" viewBox="0 0 24 24" fill="currentColor"><path d="M12 21 3.7 13a5.5 5.5 0 0 1 7.8-7.8L12 6l.5-.8a5.5 5.5 0 0 1 7.8 7.8Z" /></svg>
    {donateLabel}
  </Link>;

  return <div ref={root} className={styles.navigation} onKeyDown={event => {
    if (event.key === 'Escape' && event.target instanceof Element) {
      const opened = event.target.closest('details');
      if (opened) { opened.open = false; opened.querySelector('summary')?.focus(); event.stopPropagation(); }
      else closeAll();
    }
  }}>
    <nav className={styles.desktop} aria-label={navLabel}><ul>{list(false)}</ul></nav>
    <div className={styles.desktopActions}>
      <Link href={partnerHref} className={styles.partner}>{partnerLabel}<Icon name="arrow" size={16} /></Link>
      {donation}
    </div>
    <div className={styles.mobileDonate}>{donation}</div>
    <details className={styles.mobile}>
      <summary className={styles.menuToggle}>
        <span className={styles.menuClosed}><Icon name="menu" size={20} /><span>{menuLabel}</span></span>
        <span className={styles.menuOpened}><Icon name="close" size={20} /><span>{closeLabel}</span></span>
      </summary>
      <div className={styles.mobilePanel}>
        <div className={styles.mobileIntro}><span>{menuLabel}</span><span>{moreLabel}</span></div>
        <nav aria-label={navLabel}><ul>{list(true)}</ul></nav>
        <div className={styles.mobileActions}>
          <Link href={partnerHref} onClick={closeAll} className={styles.partner}>{partnerLabel}<Icon name="arrow" size={16} /></Link>
          {donation}
        </div>
      </div>
    </details>
  </div>;
}
