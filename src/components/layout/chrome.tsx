import { Suspense, type ReactNode } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Bidi } from '@/components/ui/bidi';
import { ButtonLink, buttonClasses } from '@/components/ui/button';
import { Container, Rule } from '@/components/ui/layout';
import { DefinitionList } from '@/components/ui/definition-list';
import { Icon } from '@/components/ui/icon';
import { LinkPendingMark } from '@/components/ui/link-pending';
import { Eyebrow } from '@/components/ui/typography';
import { publicEnv } from '@/lib/env.public';
import { storageUrl } from '@/lib/format';
import type { Dictionary } from '@/lib/i18n/get-dictionary';
import { type Locale, localePath } from '@/lib/i18n/config';
import { buildWhatsAppUrl } from '@/lib/utils';
import { LanguageSwitcher } from './language-switcher';

/**
 * Persistent chrome — Server Components throughout.
 *
 * Principle 4 of the design direction — "two doors, always open" — is why the
 * partnership CTA and the channel-verification link are in the chrome on every
 * page rather than on a landing page each. Those are the two jobs the site
 * exists to do, and a reader who arrives on a project page deep from a search
 * result must still find both.
 *
 * The official-channels bar sits **above** the header row and does not collapse
 * into the mobile menu. Hiding the anti-impersonation link behind a hamburger
 * would defeat its purpose for exactly the audience most at risk.
 *
 * The mobile menu is a `<details>` disclosure: it opens and closes with no
 * JavaScript, which is the same guarantee the six forms make. The only client
 * code in the chrome is `LanguageSwitcher` (it must read the current URL) and
 * the kit's `LinkPendingMark` (one hook, `useLinkStatus`).
 */

export type OrganizationChrome = {
  shortName: string | null;
  legalName: string | null;
  shortDescription: string | null;
  acronym: string;
  licenseNumber: string;
  licenseAuthority: string | null;
  legalForm?: string | null;
  foundedYear: number;
  primaryPhone: string | null;
  additionalPhones: string[];
  whatsappNumber: string | null;
  email: string | null;
  secondaryEmail: string | null;
  address: string | null;
  socials: { platform: string; url: string; is_official: boolean; visible?: boolean; display_order?: number | null }[];
  officialChannels: {
    platform: string;
    handle: string;
    url: string;
    is_official: boolean;
    visible?: boolean;
    display_order?: number | null;
  }[];
  footerCta: {
    enabled: boolean;
    fieldsAvailable: boolean;
    title: string | null;
    description: string | null;
    buttonLabel: string | null;
    url: string | null;
  };
  logoPrimaryBucket: string | null;
  logoPrimaryPath: string | null;
  logoPrimaryAlt: string | null;
  footerLogoBucket: string | null;
  footerLogoPath: string | null;
  footerLogoAlt: string | null;
};

export type ProgramLink = { id: string; slug: string | null; title: string | null };

// ── Shared helpers ────────────────────────────────────────────────────────

/** A value the organisation has not supplied yet is rendered as absent, not as its placeholder. */
export function visibleText(value: string | null | undefined): string | null {
  const text = value?.trim();
  if (!text || text.startsWith('TODO(org):')) return null;
  return text;
}

/** `shortName ?? legalName ?? acronym`, the same resolution `buildMetadata` callers use. */
export function organizationName(org: OrganizationChrome | null): string {
  return (
    visibleText(org?.shortName) ?? visibleText(org?.legalName) ?? visibleText(org?.acronym) ?? ''
  );
}

function sameVisibleText(left: string | null | undefined, right: string | null | undefined) {
  const first = visibleText(left)?.toLocaleLowerCase();
  const second = visibleText(right)?.toLocaleLowerCase();
  return Boolean(first && second && first === second);
}

function externalAttrs(url: string) {
  return url.startsWith('/') ? {} : { target: '_blank', rel: 'noopener noreferrer me' };
}

function ctaHref(locale: Locale, url: string) {
  if (/^https?:\/\//i.test(url) || url.startsWith('mailto:') || url.startsWith('tel:')) return url;
  return localePath(locale, url.startsWith('/') ? url : `/${url}`);
}

/** Official social links: `socials` and `official_channels`, de-duplicated, WhatsApp last. */
function officialSocialLinks(org: OrganizationChrome | null) {
  const whatsapp = visibleText(org?.whatsappNumber);
  return [
    ...(org?.socials ?? []).flatMap((link) => {
      const url = visibleText(link.url);
      return link.is_official && link.visible !== false && url
        ? [{ platform: link.platform, url, order: link.display_order ?? 100 }]
        : [];
    }),
    ...(org?.officialChannels ?? []).flatMap((channel) => {
      const url = visibleText(channel.url);
      return channel.is_official && channel.visible !== false && url
        ? [{ platform: channel.platform, url, order: channel.display_order ?? 100 }]
        : [];
    }),
    ...(whatsapp ? [{ platform: 'whatsapp', url: buildWhatsAppUrl(whatsapp), order: 999 }] : []),
  ]
    .filter(
      (link, index, all) =>
        all.findIndex(
          (candidate) =>
            candidate.url === link.url &&
            candidate.platform.toLowerCase() === link.platform.toLowerCase(),
        ) === index,
    )
    .sort((a, b) => a.order - b.order);
}

/** Platform names are proper nouns, not copy; they are the same in both locales. */
function platformLabel(platform: string) {
  const normalized = platform.toLowerCase();
  if (normalized === 'x' || normalized === 'twitter') return 'X';
  if (normalized === 'youtube') return 'YouTube';
  if (normalized === 'linkedin') return 'LinkedIn';
  if (normalized === 'facebook') return 'Facebook';
  if (normalized === 'instagram') return 'Instagram';
  if (normalized === 'whatsapp') return 'WhatsApp';
  if (normalized === 'telegram') return 'Telegram';
  return platform;
}

function SocialGlyph({ platform }: { platform: string }) {
  const name = platform.toLowerCase();
  if (name === 'facebook') return <path d="M14.5 8.2h2.2V4.5h-3c-3.4 0-4.8 2-4.8 5v2H6v4h2.9v8h4.1v-8h3.2l.5-4H13V9.8c0-1 .4-1.6 1.5-1.6Z" />;
  if (name === 'instagram') {
    return (
      <>
        <rect x="5" y="5" width="14" height="14" rx="4.2" fill="none" strokeWidth="1.9" />
        <circle cx="12" cy="12" r="3.4" fill="none" strokeWidth="1.9" />
        <circle cx="16.2" cy="7.8" r="0.9" stroke="none" />
      </>
    );
  }
  if (name === 'linkedin') {
    return (
      <>
        <path d="M6.5 10h3v8h-3zM8 6.3a1.6 1.6 0 1 1 0 3.2 1.6 1.6 0 0 1 0-3.2Z" />
        <path d="M11 10h2.9v1.1c.5-.8 1.3-1.3 2.5-1.3 2 0 3.1 1.4 3.1 3.8V18h-3v-4c0-1.1-.4-1.7-1.3-1.7s-1.4.7-1.4 1.7v4H11z" />
      </>
    );
  }
  if (name === 'youtube') {
    return (
      <>
        <path d="M20 8.2c.2.9.3 2.2.3 3.8s-.1 2.9-.3 3.8c-.2.8-.8 1.4-1.6 1.6-1.4.4-6.4.4-6.4.4s-5 0-6.4-.4c-.8-.2-1.4-.8-1.6-1.6-.2-.9-.3-2.2-.3-3.8s.1-2.9.3-3.8c.2-.8.8-1.4 1.6-1.6C7 6.2 12 6.2 12 6.2s5 0 6.4.4c.8.2 1.4.8 1.6 1.6Z" />
        <path d="m10.4 14.6 4.2-2.6-4.2-2.6z" className="fill-ink" />
      </>
    );
  }
  if (name === 'x' || name === 'twitter') return <path d="M5 5h4.1l3.4 4.8L16.6 5H19l-5.3 6.1L19.4 19h-4.1l-3.8-5.3L7 19H4.6l5.7-6.6z" />;
  if (name === 'whatsapp') return <path d="M12 4.2a7.7 7.7 0 0 0-6.7 11.5L4.4 20l4.4-1.1A7.7 7.7 0 1 0 12 4.2Zm4.5 10.9c-.2.5-1.1 1-1.5 1.1-.4.1-.9.2-3-.6-2.5-1-4.1-3.5-4.2-3.7-.1-.1-1-1.4-1-2.6 0-1.3.6-1.9.9-2.1.2-.3.5-.3.7-.3h.5c.2 0 .4 0 .6.5l.8 1.9c.1.2.1.4 0 .6l-.4.6c-.1.1-.2.3-.1.5.2.4.8 1.3 1.6 2 .9.8 1.7 1.1 2.1 1.2.2.1.4.1.5-.1l.7-.8c.2-.2.4-.2.6-.1l1.9.9c.2.1.4.2.4.4 0 .1 0 .4-.1.6Z" />;
  if (name === 'telegram') return <path d="M4.6 11.2 18.4 5.9c.6-.2 1.2.2 1 .9l-2.3 10.9c-.2.8-.7 1-1.3.6l-3.6-2.6-1.7 1.7c-.2.2-.4.3-.7.3l.2-3.6 6.5-5.9c.3-.3-.1-.4-.4-.2l-8 5-3.4-1.1c-.7-.2-.7-.7.1-1Z" />;
  return <path d="M12 5a7 7 0 1 0 0 14 7 7 0 0 0 0-14Zm-3.8 7h7.6M12 8.2v7.6" />;
}

/** Square, 44px, icon-only link named by the platform. Never a fill; hover darkens the ground. */
function SocialIconLink({ platform, url, tone }: { platform: string; url: string; tone: 'ink' | 'paper' }) {
  const label = platformLabel(platform);
  return (
    <a
      href={url}
      aria-label={label}
      title={label}
      className={
        tone === 'paper'
          ? 'motion-standard inline-flex min-h-target min-w-target items-center justify-center text-paper no-underline transition-colors hover:bg-navy-900 hover:text-paper'
          : 'motion-standard inline-flex min-h-target min-w-target items-center justify-center rule-edge text-ink no-underline transition-colors hover:bg-paper-alt hover:text-ink'
      }
      {...externalAttrs(url)}
    >
      <svg aria-hidden="true" viewBox="0 0 24 24" className="icon-16 fill-current stroke-current">
        <SocialGlyph platform={platform} />
      </svg>
    </a>
  );
}

// ── Official-channels bar ─────────────────────────────────────────────────

export function ChannelsBar({ locale, dict }: { locale: Locale; dict: Dictionary }) {
  const utility = secondaryNavItems(locale, dict);

  return (
    <nav aria-label={dict.siteChrome.channelsBarNav} className="bg-ink text-paper">
      <Container className="flex min-h-11 items-center justify-between gap-4">
        <p className="flex min-w-0 items-center gap-3 text-caption">
          <span aria-hidden="true" className="inline-block size-2 shrink-0 border-2 border-gold-600" />
          <span className="hidden truncate md:inline">{dict.channels.barText}</span>
          <Link
            href={localePath(locale, '/verify')}
            className="inline-flex min-h-target shrink-0 items-center gap-1.5 border-be-2 border-gold-600 font-medium text-paper no-underline hover:text-gold-050"
          >
            <Icon name="check" size={16} />
            <span className="hidden sm:inline">{dict.channels.barCta}</span>
            <span className="sm:hidden">{dict.nav.verify}</span>
            <LinkPendingMark />
          </Link>
        </p>

        <div className="flex shrink-0 items-center gap-4">
          <ul className="hidden items-center gap-4 text-caption lg:flex">
            {utility.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className="inline-flex min-h-target items-center text-paper no-underline hover:text-gold-050 hover:underline">
                  {item.label}
                  <LinkPendingMark />
                </Link>
              </li>
            ))}
          </ul>
          <Suspense fallback={<span className="inline-block min-h-target min-w-16" />}>
            <LanguageSwitcher locale={locale} label={dict.common.switchToEnglish} />
          </Suspense>
        </div>
      </Container>
    </nav>
  );
}

// ── Header ────────────────────────────────────────────────────────────────

type NavItem = { label: string; href: string };

/**
 * The IA of the main navigation (design: header nav). The two "doors" —
 * verify and partner — are rendered apart from it, on every page.
 */
function mainNavItems(locale: Locale, dict: Dictionary): NavItem[] {
  return [
    { label: dict.nav.about, href: localePath(locale, '/about') },
    { label: dict.nav.programs, href: localePath(locale, '/programs') },
    { label: dict.nav.projects, href: localePath(locale, '/projects') },
    { label: dict.nav.impact, href: localePath(locale, '/impact') },
    { label: dict.nav.news, href: localePath(locale, '/news') },
    { label: dict.nav.partners, href: localePath(locale, '/partners') },
  ];
}

/** Utility routes: the channels bar on desktop, the mobile menu otherwise. */
function secondaryNavItems(locale: Locale, dict: Dictionary): NavItem[] {
  return [
    { label: dict.nav.careers, href: localePath(locale, '/careers') },
    { label: dict.nav.resources, href: localePath(locale, '/resources') },
    { label: dict.nav.contact, href: localePath(locale, '/contact') },
  ];
}

/** The `/about` cluster, as the footer's "organisation" column. */
function aboutNavItems(locale: Locale, dict: Dictionary): NavItem[] {
  return [
    { label: dict.nav.about, href: localePath(locale, '/about') },
    { label: dict.aboutPages.visionMissionTitle, href: localePath(locale, '/about/vision-mission') },
    { label: dict.about.governance, href: localePath(locale, '/about/governance') },
    { label: dict.about.strategy, href: localePath(locale, '/about/strategy') },
    { label: dict.about.membership, href: localePath(locale, '/about/memberships') },
  ];
}

function NavLink({ item, className }: { item: NavItem; className?: string }) {
  return (
    <Link
      href={item.href}
      className={
        className ??
        'motion-standard relative inline-flex min-h-target items-center px-2 text-small text-ink no-underline transition-colors hover:text-gold-700'
      }
    >
      {item.label}
      <LinkPendingMark />
    </Link>
  );
}

function VerifyLink({ locale, dict, className }: { locale: Locale; dict: Dictionary; className?: string }) {
  return (
    <ButtonLink href={localePath(locale, '/verify')} tone="marked" size="sm" pendingMark className={className}>
      {dict.nav.verify}
    </ButtonLink>
  );
}

function PartnerCta({ locale, dict, className }: { locale: Locale; dict: Dictionary; className?: string }) {
  return (
    <ButtonLink href={localePath(locale, '/get-involved/partner')} tone="primary" size="sm" pendingMark className={className}>
      {dict.nav.partner}
    </ButtonLink>
  );
}

/**
 * The mobile disclosure. `<details>` gives open/close, keyboard operation and
 * `aria-expanded` semantics natively, with JavaScript off. The panel is
 * absolutely positioned under the header row so the header keeps its height.
 */
function MobileNav({ locale, dict, items }: { locale: Locale; dict: Dictionary; items: NavItem[] }) {
  return (
    <details className="group lg:hidden">
      <summary
        className={buttonClasses({
          tone: 'quiet',
          size: 'sm',
          className: 'cursor-pointer list-none rule-edge [&::-webkit-details-marker]:hidden',
        })}
      >
        <span className="group-open:hidden">
          <Icon name="menu" size={20} />
        </span>
        <span className="hidden group-open:inline">
          <Icon name="close" size={20} />
        </span>
        <span>{dict.common.menu}</span>
      </summary>
      <div className="absolute start-0 end-0 inset-bs-full z-40 max-h-[calc(100dvh-7rem)] overflow-y-auto rule-section bg-paper">
        <Container className="pbs-2 pbe-6">
          <nav aria-label={dict.a11y.mainNav}>
            <ul className="border-be border-rule">
              {[{ label: dict.nav.home, href: localePath(locale, '/') }, ...items].map((item) => (
                <li key={item.href} className="border-bs border-rule">
                  <NavLink
                    item={item}
                    className="motion-standard relative flex min-h-12 items-center text-body text-ink no-underline transition-colors hover:text-gold-700"
                  />
                </li>
              ))}
            </ul>
          </nav>
          <nav aria-label={dict.siteChrome.secondaryNav} className="mbs-4">
            <ul className="flex flex-wrap gap-x-5 gap-y-1">
              {secondaryNavItems(locale, dict).map((item) => (
                <li key={item.href}>
                  <NavLink
                    item={item}
                    className="motion-standard relative inline-flex min-h-target items-center text-small text-ink-70 no-underline transition-colors hover:text-gold-700"
                  />
                </li>
              ))}
            </ul>
          </nav>
          <div className="mbs-4 flex flex-wrap gap-3 border-bs border-rule pbs-4">
            <VerifyLink locale={locale} dict={dict} />
            <PartnerCta locale={locale} dict={dict} />
          </div>
        </Container>
      </div>
    </details>
  );
}

export function SiteHeader({
  locale,
  dict,
  org,
}: {
  locale: Locale;
  dict: Dictionary;
  org: OrganizationChrome | null;
}) {
  const name = organizationName(org);
  const logoAlt = visibleText(org?.logoPrimaryAlt) ?? name;
  const logoSrc =
    org?.logoPrimaryBucket && org.logoPrimaryPath
      ? storageUrl(publicEnv.NEXT_PUBLIC_SUPABASE_URL, org.logoPrimaryBucket, org.logoPrimaryPath)
      : '/pcsrd-logo.jpeg';
  const items = mainNavItems(locale, dict);

  return (
    <header className="sticky inset-bs-0 z-50">
      <ChannelsBar locale={locale} dict={dict} />
      <div className="relative border-be border-rule bg-paper">
        <Container className="flex min-h-20 items-center justify-between gap-4 py-2">
          <Link
            href={localePath(locale, '/')}
            aria-label={`${name} — ${dict.siteChrome.homeLinkLabel}`}
            className="flex min-w-0 items-center gap-3 text-ink no-underline"
          >
            <Image
              src={logoSrc}
              alt={logoAlt}
              width={112}
              height={48}
              sizes="112px"
              preload
              className="h-12 w-auto shrink-0 object-contain"
            />
            <span className="min-w-0">
              <span className="block truncate text-small font-semibold leading-tight sm:text-body">{name}</span>
              <span className="hidden truncate text-caption text-ink-55 sm:block">{dict.home.heroEyebrow}</span>
            </span>
          </Link>

          <nav aria-label={dict.a11y.mainNav} className="hidden lg:block">
            <ul className="flex items-center gap-1">
              {items.map((item) => (
                <li key={item.href}>
                  <NavLink item={item} />
                </li>
              ))}
            </ul>
          </nav>

          <div className="hidden shrink-0 items-center gap-3 lg:flex">
            <VerifyLink locale={locale} dict={dict} />
            <PartnerCta locale={locale} dict={dict} />
          </div>

          <MobileNav locale={locale} dict={dict} items={items} />
        </Container>
      </div>
    </header>
  );
}

// ── Footer ────────────────────────────────────────────────────────────────

function FooterLinkList({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <nav aria-label={title}>
      <Eyebrow as="p" className="mbe-4 text-paper">
        {title}
      </Eyebrow>
      <ul className="space-y-2 text-small">{children}</ul>
    </nav>
  );
}

function FooterLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="motion-standard text-paper no-underline transition-colors hover:text-gold-050 hover:underline">
      {children}
    </Link>
  );
}

/**
 * The identity record is the single most-reused due-diligence element on the
 * site: a funder checking whether the organisation is real reads exactly these
 * lines. Every value is read from `organization_settings`, so none of it
 * needs a deploy to correct.
 */
export function SiteFooter({
  locale,
  dict,
  org,
  programs = [],
}: {
  locale: Locale;
  dict: Dictionary;
  org: OrganizationChrome | null;
  programs?: ProgramLink[];
}) {
  const year = new Date().getUTCFullYear();
  const acronym = visibleText(org?.acronym);
  const legalName = visibleText(org?.legalName);
  const shortName = visibleText(org?.shortName);
  const displayName = [legalName, shortName].find((value) => value && !sameVisibleText(value, acronym)) ?? acronym;
  const description = visibleText(org?.shortDescription);
  const licenseNumber = visibleText(org?.licenseNumber);
  const licenseAuthority = visibleText(org?.licenseAuthority);
  const legalForm = visibleText(org?.legalForm);
  const foundedYear = org?.foundedYear && org.foundedYear > 1900 ? String(org.foundedYear) : null;
  const phones = [visibleText(org?.primaryPhone), ...(org?.additionalPhones ?? []).map(visibleText)].filter(
    (value): value is string => Boolean(value),
  );
  const whatsapp = visibleText(org?.whatsappNumber);
  const emails = [visibleText(org?.email), visibleText(org?.secondaryEmail)].filter(
    (value): value is string => Boolean(value),
  );
  const address = visibleText(org?.address);
  const logoAlt = visibleText(org?.footerLogoAlt) ?? visibleText(org?.logoPrimaryAlt) ?? displayName ?? '';
  const logoSrc =
    org?.footerLogoBucket && org.footerLogoPath
      ? storageUrl(publicEnv.NEXT_PUBLIC_SUPABASE_URL, org.footerLogoBucket, org.footerLogoPath)
      : null;
  const officialChannels = (org?.officialChannels ?? [])
    .filter((channel) => channel.is_official && channel.visible !== false && visibleText(channel.url))
    .sort((a, b) => (a.display_order ?? 100) - (b.display_order ?? 100))
    .slice(0, 6);
  const socialLinks = officialSocialLinks(org);

  const ctaTitle = visibleText(org?.footerCta?.title);
  const ctaDescription = visibleText(org?.footerCta?.description);
  const ctaButtonLabel = visibleText(org?.footerCta?.buttonLabel);
  const ctaUrl = visibleText(org?.footerCta?.url);
  const cta =
    org?.footerCta?.enabled && ctaTitle && ctaButtonLabel && ctaUrl
      ? { title: ctaTitle, description: ctaDescription, buttonLabel: ctaButtonLabel, url: ctaUrl }
      : null;

  const programLinks = programs.flatMap((program) => {
    const title = visibleText(program.title);
    const slug = visibleText(program.slug);
    return title && slug ? [{ id: program.id, title, href: localePath(locale, `/programs/${slug}`) }] : [];
  });

  return (
    <footer className="mbs-auto bg-ink text-paper">
      {cta ? (
        <div className="border-be border-paper/20">
          <Container className="flex flex-wrap items-center justify-between gap-6 py-8">
            <div className="max-w-2xl">
              <Eyebrow as="p" className="mbe-2 text-paper">
                {dict.nav.support}
              </Eyebrow>
              <p className="text-h3 font-semibold text-paper">{cta.title}</p>
              {cta.description ? <p className="mbs-2 text-small text-paper">{cta.description}</p> : null}
            </div>
            <ButtonLink
              href={ctaHref(locale, cta.url)}
              external={!cta.url.startsWith('/')}
              tone="secondary"
              className="border-paper text-paper hover:bg-navy-900 hover:text-paper"
            >
              {cta.buttonLabel}
            </ButtonLink>
          </Container>
        </div>
      ) : null}

      <Container className="grid gap-10 py-12 md:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <section aria-labelledby="footer-identity">
          <Eyebrow as="p" id="footer-identity" className="mbe-4 text-paper">
            {dict.footer.identityTitle}
          </Eyebrow>
          {logoSrc ? (
            <Image src={logoSrc} alt={logoAlt} width={200} height={72} sizes="200px" className="mbe-4 h-16 w-auto object-contain" />
          ) : null}
          {displayName ? <p className="text-h4 font-semibold text-paper">{displayName}</p> : null}
          {description ? <p className="mbs-2 max-w-md text-small text-paper">{description}</p> : null}

          <div className="mbs-5 text-paper [&_dd]:text-paper [&_dt]:text-paper/80">
            <DefinitionList
              layout="stack"
              items={[
                { term: dict.about.legalName, value: legalName },
                { term: dict.about.licenseNumber, value: licenseNumber ? <Bidi>{licenseNumber}</Bidi> : null },
                { term: dict.about.licenseAuthority, value: licenseAuthority },
                { term: dict.about.legalForm, value: legalForm },
                { term: dict.about.foundedYear, value: foundedYear ? <Bidi>{foundedYear}</Bidi> : null },
              ]}
            />
          </div>
        </section>

        <FooterLinkList title={dict.footer.brandTitle}>
          {aboutNavItems(locale, dict).map((item) => (
            <li key={item.href}>
              <FooterLink href={item.href}>{item.label}</FooterLink>
            </li>
          ))}
        </FooterLinkList>

        <div className="space-y-8">
          <FooterLinkList title={dict.footer.quickLinksTitle}>
            {[
              ...mainNavItems(locale, dict).slice(1),
              { label: dict.nav.resources, href: localePath(locale, '/resources') },
              { label: dict.nav.careers, href: localePath(locale, '/careers') },
            ].map((item) => (
              <li key={item.href}>
                <FooterLink href={item.href}>{item.label}</FooterLink>
              </li>
            ))}
          </FooterLinkList>
          {programLinks.length > 0 ? (
            <FooterLinkList title={dict.footer.programsTitle}>
              {programLinks.map((program) => (
                <li key={program.id}>
                  <FooterLink href={program.href}>{program.title}</FooterLink>
                </li>
              ))}
            </FooterLinkList>
          ) : null}
        </div>

        <div className="space-y-8">
          <section aria-labelledby="footer-contact">
            <Eyebrow as="p" id="footer-contact" className="mbe-4 text-paper">
              {dict.footer.contactTitle}
            </Eyebrow>
            <ul className="space-y-2 text-small">
              {phones.map((phone) => (
                <li key={phone} className="flex items-center gap-2">
                  <Icon name="phone" size={16} />
                  <a href={`tel:${phone}`} className="text-paper hover:text-gold-050">
                    <Bidi>{phone}</Bidi>
                  </a>
                </li>
              ))}
              {whatsapp ? (
                <li className="flex flex-wrap items-center gap-2">
                  <Icon name="phone" size={16} />
                  <span className="text-paper/80">{dict.siteChrome.whatsapp}</span>
                  <a href={buildWhatsAppUrl(whatsapp)} className="text-paper hover:text-gold-050" {...externalAttrs('https://wa.me')}>
                    <Bidi>{whatsapp}</Bidi>
                  </a>
                </li>
              ) : null}
              {emails.map((email) => (
                <li key={email} className="flex items-center gap-2">
                  <Icon name="mail" size={16} />
                  <a href={`mailto:${email}`} className="text-paper hover:text-gold-050">
                    <Bidi>{email}</Bidi>
                  </a>
                </li>
              ))}
              {address ? (
                <li className="flex items-start gap-2">
                  <Icon name="pin" size={16} className="mbs-1" />
                  <span className="text-paper">{address}</span>
                </li>
              ) : null}
              {[
                { label: dict.nav.contact, href: localePath(locale, '/contact') },
                { label: dict.nav.partner, href: localePath(locale, '/get-involved/partner') },
                { label: dict.getInvolved.volunteerTitle, href: localePath(locale, '/get-involved/volunteer') },
                { label: dict.nav.support, href: localePath(locale, '/get-involved/support') },
                { label: dict.footer.complaints, href: `${localePath(locale, '/contact')}#complaint` },
              ].map((item) => (
                <li key={item.href}>
                  <FooterLink href={item.href}>{item.label}</FooterLink>
                </li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="footer-channels">
            <Eyebrow as="p" id="footer-channels" className="mbe-4 text-paper">
              {dict.footer.channelsTitle}
            </Eyebrow>
            {officialChannels.length > 0 ? (
              <ul className="space-y-2 text-small">
                {officialChannels.map((channel) => (
                  <li key={`${channel.platform}:${channel.handle}`} className="flex flex-wrap items-baseline gap-x-2">
                    <span className="text-paper/80">{platformLabel(channel.platform)}</span>
                    <a
                      href={channel.url}
                      className="font-mono text-caption text-paper no-underline hover:text-gold-050 hover:underline"
                      {...externalAttrs(channel.url)}
                    >
                      <Bidi>{channel.handle}</Bidi>
                    </a>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-small text-paper/80">{dict.footer.noSocialLinks}</p>
            )}
            {socialLinks.length > 0 ? (
              <ul className="mbs-3 flex flex-wrap">
                {socialLinks.map((link) => (
                  <li key={`${link.platform}:${link.url}`}>
                    <SocialIconLink platform={link.platform} url={link.url} tone="paper" />
                  </li>
                ))}
              </ul>
            ) : null}
            <p className="mbs-4">
              <Link
                href={localePath(locale, '/verify')}
                className="inline-flex min-h-target items-center border-be-2 border-gold-600 text-small font-medium text-paper no-underline hover:text-gold-050"
              >
                {dict.nav.verify}
              </Link>
            </p>
          </section>
        </div>
      </Container>

      <Rule className="border-paper/20" />
      <Container className="flex flex-col gap-3 py-4 text-caption text-paper md:flex-row md:items-center md:justify-between">
        <p>
          © <Bidi>{String(year)}</Bidi> {displayName ?? ''} — {dict.footer.rights}
        </p>
        <nav aria-label={dict.footer.legalTitle}>
          <ul className="flex flex-wrap gap-x-5 gap-y-2">
            {[
              { label: dict.footer.privacy, href: localePath(locale, '/legal/privacy') },
              { label: dict.footer.accessibility, href: localePath(locale, '/legal/accessibility') },
              { label: dict.footer.terms, href: localePath(locale, '/legal/terms') },
            ].map((item) => (
              <li key={item.href}>
                <FooterLink href={item.href}>{item.label}</FooterLink>
              </li>
            ))}
          </ul>
        </nav>
      </Container>
    </footer>
  );
}
