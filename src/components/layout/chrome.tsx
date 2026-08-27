import { Suspense, type ReactNode } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Bidi } from '@/components/ui/bidi';
import { publicEnv } from '@/lib/env.public';
import { storageUrl } from '@/lib/format';
import type { Dictionary } from '@/lib/i18n/get-dictionary';
import { type Locale, localePath } from '@/lib/i18n/config';
import { LanguageSwitcher } from './language-switcher';
import { buildWhatsAppUrl } from '@/lib/utils';

/**
 * Persistent chrome.
 *
 * Principle 4 of the design direction â€” "two doors, always open" â€” is why the
 * partnership CTA and the channel-verification link are in the chrome on every
 * page rather than on a landing page each. Those are the two jobs the site
 * exists to do, and a reader who arrives on a project page deep from a search
 * result must still find both.
 *
 * The official-channels bar sits **above** the header and does not collapse
 * into the mobile menu. Hiding the anti-impersonation link behind a hamburger
 * would defeat its purpose for exactly the audience most at risk.
 */

export type OrganizationChrome = {
  shortName: string | null;
  legalName: string | null;
  shortDescription: string | null;
  acronym: string;
  licenseNumber: string;
  licenseAuthority: string | null;
  foundedYear: number;
  primaryPhone: string | null;
  additionalPhones: string[];
  whatsappNumber: string | null;
  email: string | null;
  secondaryEmail: string | null;
  address: string | null;
  socials: { platform: string; url: string; is_official: boolean }[];
  officialChannels: { platform: string; handle: string; url: string; is_official: boolean }[];
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

// â”€â”€ Official-channels bar â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export function ChannelsBar({ locale, dict }: { locale: Locale; dict: Dictionary }) {
  return (
    <div className="border-be border-ink/15 bg-ink text-paper">
      <div className="container-content flex flex-wrap items-center justify-between gap-2 py-2">
        <p className="text-caption">
          <span className="font-mono text-eyebrow tracking-[0.16em] text-gold-600 uppercase">
            {dict.channels.barLabel}
          </span>
          <span className="ms-3">{dict.channels.barText}</span>
        </p>
        <Link
          href={localePath(locale, '/verify')}
          // Was ~23.2px tall with no padding â€” under SC 2.5.8's 24px floor, on
          // the only route to /verify, which is the page a beneficiary opens to
          // check an account against the real one.
          //
          // `border-be-2` rather than 1px: a 1px gold rule was a fourth weight
          // in a system that documents exactly three, and this is the marked-CTA
          // treatment the header link already uses.
          className="inline-flex min-h-11 items-center border-be-2 border-gold-600 text-caption text-paper no-underline hover:text-gold-600"
        >
          {dict.channels.barCta}
        </Link>
      </div>
    </div>
  );
}

// â”€â”€ Header â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const NAV: { key: keyof Dictionary['nav']; path: string }[] = [
  { key: 'about', path: '/about' },
  { key: 'programs', path: '/programs' },
  { key: 'projects', path: '/projects' },
  { key: 'impact', path: '/impact' },
  { key: 'news', path: '/news' },
  { key: 'partners', path: '/partners' },
  { key: 'careers', path: '/careers' },
  { key: 'contact', path: '/contact' },
];

export function SiteHeader({
  locale,
  dict,
  org,
}: {
  locale: Locale;
  dict: Dictionary;
  org: OrganizationChrome | null;
}) {
  return (
    <header className="border-be-2 border-ink bg-paper">
      {/* `flex-wrap` so the nav drops to its own line on a narrow viewport
          instead of squeezing the logo out. The logo gets `min-w-0` and
          `truncate` because it renders `organization_settings.short_name_ar`,
          which is real content of unknown length â€” at `text-h3` semibold a
          two-word name alone can exceed a 320px viewport, and without
          `min-w-0` a flex item refuses to shrink below its min-content width. */}
      <div className="container-content flex flex-wrap items-center justify-between gap-x-6 gap-y-3 py-5">
        <Link
          href={localePath(locale, '/')}
          className="min-w-0 truncate text-h3 font-semibold text-ink no-underline"
        >
          {org?.shortName ?? org?.acronym ?? 'PCSRD'}
        </Link>

        {/*
          The nav is a plain list of links with no JavaScript. On mobile it
          scrolls horizontally rather than collapsing into a toggle: a menu
          button is the one piece of chrome that stops working when JS fails,
          and rule 7 says every page must work without it.
        */}
        {/* `order-last` below `sm:` puts the nav on its own row under the logo
            and the language switcher, rather than competing with them for the
            same 280px. The scroller keeps a `scroll-snap` and an end-edge fade
            so there is a visual cue that more navigation exists â€” an
            `overflow-x-auto` list on a touch device shows no scrollbar at rest,
            so items 4 to 8 were simply invisible with nothing to suggest
            otherwise. */}
        <nav
          aria-label={dict.a11y.mainNav}
          className="order-last w-full min-w-0 sm:order-none sm:w-auto sm:flex-1"
        >
          <ul className="scroll-fade flex snap-x items-center gap-5 overflow-x-auto py-1 text-small">
            {NAV.map((item) => (
              <li key={item.path} className="shrink-0 snap-start">
                <Link
                  href={localePath(locale, item.path)}
                  className="whitespace-nowrap text-ink no-underline hover:text-gold-700"
                >
                  {dict.nav[item.key]}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex shrink-0 items-center gap-4">
          <Suspense fallback={<span className="font-mono text-caption text-ink-55" />}>
            <LanguageSwitcher locale={locale} label={dict.common.switchToEnglish} />
          </Suspense>
          <Link
            href={localePath(locale, '/get-involved/partner')}
            className="border-be-2 border-gold-600 py-1 text-small font-medium text-ink no-underline hover:bg-gold-050"
          >
            {dict.nav.partner}
          </Link>
        </div>
      </div>
    </header>
  );
}

// â”€â”€ Footer â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * The identity record is the single most-reused due-diligence element on the
 * site: a funder checking whether the organisation is real reads exactly these
 * five lines. Every value is read from `organization_settings`, so none of it
 * needs a deploy to correct.
 */
const QUICK_LINKS: { key: keyof Dictionary['nav']; path: string }[] = [
  { key: 'about', path: '/about' },
  { key: 'programs', path: '/programs' },
  { key: 'projects', path: '/projects' },
  { key: 'impact', path: '/impact' },
  { key: 'news', path: '/news' },
  { key: 'partners', path: '/partners' },
];

const INVOLVEMENT_LINKS: { label: (dict: Dictionary) => string; path: string }[] = [
  { label: (dict) => dict.nav.contact, path: '/contact' },
  { label: (dict) => dict.nav.partner, path: '/get-involved/partner' },
  { label: (dict) => dict.nav.careers, path: '/careers' },
  { label: (dict) => dict.footer.complaints, path: '/contact#complaint' },
];

const LEGAL_LINKS: { label: (dict: Dictionary) => string; path: string }[] = [
  { label: (dict) => dict.footer.privacy, path: '/legal/privacy' },
  { label: (dict) => dict.footer.accessibility, path: '/legal/accessibility' },
  { label: (dict) => dict.footer.terms, path: '/legal/terms' },
];

function visibleText(value: string | null | undefined) {
  const text = value?.trim();
  if (!text || text.startsWith('TODO(org):')) return null;
  return text;
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

function developmentFooterCta(locale: Locale) {
  if (process.env.NODE_ENV === 'production') return null;
  return locale === 'en'
    ? {
        title: 'Stand with communities rebuilding daily life',
        description:
          'Development-only preview copy for evaluating the completed footer CTA before the CMS fields are migrated.',
        buttonLabel: 'Start a partnership',
        url: '/get-involved/partner',
      }
    : {
        title: 'ساند المجتمعات في استعادة حياتها اليومية',
        description:
          'نص معاينة للتطوير فقط لتقييم دعوة التذييل قبل ترحيل حقولها في نظام الإدارة.',
        buttonLabel: 'ابدأ شراكة',
        url: '/get-involved/partner',
      };
}

function developmentSocialLinks() {
  if (process.env.NODE_ENV === 'production') return [];
  return ['facebook', 'instagram', 'linkedin', 'youtube', 'whatsapp'].map((platform) => ({
    platform,
    url: `https://example.org/preview/${platform}`,
  }));
}

function platformLabel(platform: string) {
  const normalized = platform.toLowerCase();
  if (normalized === 'x' || normalized === 'twitter') return 'X / Twitter';
  if (normalized === 'youtube') return 'YouTube';
  if (normalized === 'linkedin') return 'LinkedIn';
  if (normalized === 'facebook') return 'Facebook';
  if (normalized === 'instagram') return 'Instagram';
  if (normalized === 'whatsapp') return 'WhatsApp';
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
  return <path d="M12 5a7 7 0 1 0 0 14 7 7 0 0 0 0-14Zm-3.8 7h7.6M12 8.2v7.6" />;
}

function SocialIconLink({ platform, url }: { platform: string; url: string }) {
  const label = platformLabel(platform);
  return (
    <a
      href={url}
      aria-label={label}
      title={label}
      className="inline-flex size-8 items-center justify-center rounded-full border border-paper/25 bg-paper/5 text-paper no-underline transition hover:border-gold-600 hover:bg-gold-050 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-600"
      {...externalAttrs(url)}
    >
      <svg aria-hidden="true" viewBox="0 0 24 24" className="size-3.5 fill-current stroke-current">
        <SocialGlyph platform={platform} />
      </svg>
    </a>
  );
}

function ContactGlyph({ type }: { type: 'email' | 'phone' | 'location' }) {
  if (type === 'email') {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4 fill-none stroke-current stroke-2">
        <path d="M4 6.5h16v11H4z" />
        <path d="m4.5 7 7.5 6 7.5-6" />
      </svg>
    );
  }
  if (type === 'phone') {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4 fill-none stroke-current stroke-2">
        <path d="M8.5 5.5 6.8 7.2c-.7.7-.6 2 .2 3.5a17.4 17.4 0 0 0 6.3 6.3c1.5.8 2.8.9 3.5.2l1.7-1.7-3-3-1.5 1.4c-.9-.4-1.8-1-2.7-1.9-.9-.9-1.5-1.8-1.9-2.7l1.4-1.5z" />
      </svg>
    );
  }
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4 fill-none stroke-current stroke-2">
      <path d="M12 21s6-5.3 6-10a6 6 0 0 0-12 0c0 4.7 6 10 6 10Z" />
      <circle cx="12" cy="11" r="2" />
    </svg>
  );
}

function ContactRow({
  icon,
  children,
}: {
  icon: 'email' | 'phone' | 'location';
  children: ReactNode;
}) {
  return (
    <li className="flex items-start gap-3">
      <span className="mbs-0.5 shrink-0 text-gold-600">
        <ContactGlyph type={icon} />
      </span>
      <span className="min-w-0">{children}</span>
    </li>
  );
}

function FooterLinkList({ title, children }: { title: string; children: ReactNode }) {
  return (
    <nav aria-label={title}>
      <h2 className="eyebrow mbe-5 text-gold-600">{title}</h2>
      <ul className="space-y-3 text-small text-paper/82">{children}</ul>
    </nav>
  );
}

export function SiteFooter({
  locale,
  dict,
  org,
}: {
  locale: Locale;
  dict: Dictionary;
  org: OrganizationChrome | null;
}) {
  const year = new Date().getUTCFullYear();
  const acronym = visibleText(org?.acronym);
  const organizationName =
    [visibleText(org?.legalName), visibleText(org?.shortName)].find(
      (value) => value && !sameVisibleText(value, acronym),
    ) ?? null;
  const copyrightName = organizationName ?? acronym;
  const description = visibleText(org?.shortDescription);
  const licenseNumber = visibleText(org?.licenseNumber);
  const phone = visibleText(org?.primaryPhone);
  const additionalPhones = (org?.additionalPhones ?? []).flatMap((item) => {
    const value = visibleText(item);
    return value ? [value] : [];
  });
  const whatsapp = visibleText(org?.whatsappNumber);
  const email = visibleText(org?.email);
  const secondaryEmail = visibleText(org?.secondaryEmail);
  const address = visibleText(org?.address);
  const foundedYear = org?.foundedYear && org.foundedYear > 1900 ? String(org.foundedYear) : null;
  const logoAlt = visibleText(org?.footerLogoAlt) ?? visibleText(org?.logoPrimaryAlt) ?? organizationName ?? acronym ?? '';
  const logoSrc =
    org?.footerLogoBucket && org.footerLogoPath
      ? storageUrl(publicEnv.NEXT_PUBLIC_SUPABASE_URL, org.footerLogoBucket, org.footerLogoPath)
      : null;
  const ctaTitle = visibleText(org?.footerCta?.title);
  const ctaDescription = visibleText(org?.footerCta?.description);
  const ctaButtonLabel = visibleText(org?.footerCta?.buttonLabel);
  const ctaUrl = visibleText(org?.footerCta?.url);
  const ctaData =
    org?.footerCta?.enabled && ctaTitle && ctaDescription && ctaButtonLabel && ctaUrl
      ? { title: ctaTitle, description: ctaDescription, buttonLabel: ctaButtonLabel, url: ctaUrl }
      : org?.footerCta?.fieldsAvailable
        ? null
        : developmentFooterCta(locale);
  const socialLinks = [
    ...(org?.socials ?? []).flatMap((link) => {
      const url = visibleText(link.url);
      return link.is_official && url ? [{ platform: link.platform, url }] : [];
    }),
    ...(org?.officialChannels ?? []).flatMap((channel) => {
      const url = visibleText(channel.url);
      return channel.is_official && url ? [{ platform: channel.platform, url }] : [];
    }),
    ...(whatsapp ? [{ platform: 'whatsapp', url: buildWhatsAppUrl(whatsapp) }] : []),
  ].filter(
    (link, index, all) =>
      all.findIndex(
        (candidate) =>
          candidate.url === link.url && candidate.platform.toLowerCase() === link.platform.toLowerCase(),
      ) === index,
  );
  const displayedSocialLinks = socialLinks.length > 0 ? socialLinks : developmentSocialLinks();
  const ctaGridClass =
    locale === 'ar'
      ? 'md:grid-cols-[minmax(14rem,0.3fr)_minmax(0,0.65fr)]'
      : 'md:grid-cols-[minmax(0,0.65fr)_minmax(14rem,0.3fr)]';

  return (
    <footer className="mbs-auto overflow-hidden bg-paper-ground text-paper">
      <svg
        aria-hidden="true"
        viewBox="0 0 1440 48"
        className="block h-9 w-full text-ink md:h-11"
        preserveAspectRatio="none"
      >
        <path
          d="M0 18C430 30 850 4 1440 18V48H0Z"
          fill="currentColor"
        />
      </svg>
      <div className="relative bg-ink">
        <div className="container-content relative pbe-6 md:pbe-8">
          {ctaData ? (
            <section className="mx-auto max-w-[1052px] py-6 md:py-8">
              <div className={`grid gap-6 md:items-center md:gap-12 ${ctaGridClass}`} dir="ltr">
                <div className={`max-w-2xl ${locale === 'ar' ? 'md:order-2' : 'md:order-1'}`} dir={locale}>
                  <p className="eyebrow mbe-2 text-gold-600">{dict.nav.support}</p>
                  <h2 className="text-h3 font-semibold leading-tight text-paper md:text-h2">{ctaData.title}</h2>
                  <p className="mbs-2 text-small leading-7 text-paper/66">{ctaData.description}</p>
                </div>
                <a
                  href={ctaHref(locale, ctaData.url)}
                  className={`inline-flex min-h-12 w-full items-center justify-center gap-3 rounded-sm border border-gold-600 bg-navy-900/35 px-6 py-2.5 text-small font-medium text-paper no-underline transition hover:bg-navy-700/65 hover:text-paper focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-600 md:max-w-64 ${locale === 'ar' ? 'md:order-1' : 'md:order-2'}`}
                  {...externalAttrs(ctaData.url)}
                >
                  {locale === 'ar' ? <span aria-hidden="true">‹</span> : null}
                  {ctaData.buttonLabel}
                  {locale === 'en' ? <span aria-hidden="true">›</span> : null}
                </a>
              </div>
            </section>
          ) : null}

          <div
            className="mx-auto grid max-w-[1052px] gap-8 border-bs border-paper/12 py-10 md:grid-cols-2 md:gap-x-10 md:gap-y-9 lg:grid-cols-[1.45fr_0.75fr_0.8fr_1fr] lg:gap-x-12"
            dir="ltr"
          >
            <section className="max-w-2xl" dir={locale}>
              <h2 className="eyebrow mbe-5 text-gold-600">{dict.footer.brandTitle}</h2>
              <div className="space-y-5">
                <div className="inline-flex min-h-12 max-w-72 items-center text-paper">
                  {logoSrc ? (
                    <Image
                      src={logoSrc}
                      alt={logoAlt}
                      width={260}
                      height={96}
                      className="max-h-20 w-auto max-w-full object-contain"
                    />
                  ) : (
                    <span className="border-be border-gold-600/80 pbe-1 font-mono text-small font-semibold tracking-[0.16em] text-paper/80 uppercase">
                      {acronym}
                    </span>
                  )}
                </div>
                {organizationName ? (
                  <p className="text-h3 font-semibold leading-tight text-paper">{organizationName}</p>
                ) : null}
                {description ? <p className="max-w-md text-small leading-7 text-paper/68">{description}</p> : null}
              </div>

              <ul className="mbs-5 space-y-2.5 text-small text-paper/74">
                {email ? (
                  <ContactRow icon="email">
                    <a className="text-paper underline hover:text-gold-600" href={`mailto:${email}`}>
                      <Bidi>{email}</Bidi>
                    </a>
                  </ContactRow>
                ) : null}
                {secondaryEmail ? (
                  <ContactRow icon="email">
                    <span className="text-paper/55">{dict.footer.secondaryEmail}: </span>
                    <a className="text-paper underline hover:text-gold-600" href={`mailto:${secondaryEmail}`}>
                      <Bidi>{secondaryEmail}</Bidi>
                    </a>
                  </ContactRow>
                ) : null}
                {phone ? (
                  <ContactRow icon="phone">
                    <a className="text-paper underline hover:text-gold-600" href={`tel:${phone}`}>
                      <Bidi>{phone}</Bidi>
                    </a>
                  </ContactRow>
                ) : null}
                {additionalPhones.map((item) => (
                  <ContactRow key={item} icon="phone">
                    <a className="text-paper underline hover:text-gold-600" href={`tel:${item}`}>
                      <Bidi>{item}</Bidi>
                    </a>
                  </ContactRow>
                ))}
                {address ? <ContactRow icon="location">{address}</ContactRow> : null}
              </ul>

              {licenseNumber || foundedYear ? (
                <p className="text-caption text-paper/48">
                  {foundedYear ? (
                    <>
                      {dict.about.foundedYear} <Bidi>{foundedYear}</Bidi>
                    </>
                  ) : null}
                  {foundedYear && licenseNumber ? <span aria-hidden="true"> · </span> : null}
                  {licenseNumber ? (
                    <>
                      {dict.about.licenseNumber} <Bidi>{licenseNumber}</Bidi>
                    </>
                  ) : null}
                </p>
              ) : null}
            </section>

            <div dir={locale}>
              <FooterLinkList title={dict.footer.quickLinksTitle}>
                {QUICK_LINKS.map((item) => (
                  <li key={item.path}>
                    <Link className="text-paper no-underline hover:text-gold-600" href={localePath(locale, item.path)}>
                      {dict.nav[item.key]}
                    </Link>
                  </li>
                ))}
              </FooterLinkList>
            </div>

            <div dir={locale}>
              <FooterLinkList title={dict.footer.getInvolvedTitle}>
                {INVOLVEMENT_LINKS.map((item) => (
                  <li key={item.path}>
                    <Link className="text-paper no-underline hover:text-gold-600" href={localePath(locale, item.path)}>
                      {item.label(dict)}
                    </Link>
                  </li>
                ))}
              </FooterLinkList>
            </div>

            <section dir={locale}>
              <h2 className="eyebrow mbe-5 text-gold-600">{dict.footer.contactTitle}</h2>
              {displayedSocialLinks.length > 0 ? (
                <ul className="mbe-4 flex flex-nowrap gap-2.5">
                  {displayedSocialLinks.map((link) => (
                    <li key={`${link.platform}:${link.url}`}>
                      <SocialIconLink platform={link.platform} url={link.url} />
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mbe-5 text-small leading-7 text-paper/62">{dict.footer.noSocialLinks}</p>
              )}
              <Link
                href={localePath(locale, '/verify')}
                className="inline-flex min-h-9 items-center border-be border-gold-600 text-caption text-paper/78 no-underline hover:text-gold-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-600"
              >
                {dict.nav.verify}
              </Link>
            </section>
          </div>
        </div>
      </div>

      <div className="border-bs border-paper/15 bg-ink">
        <div
          className="container-content flex flex-col gap-3 py-3 text-caption text-paper/58 md:flex-row md:items-center md:justify-between md:py-3.5"
          dir={locale}
        >
          <p>
            © <Bidi>{String(year)}</Bidi> {copyrightName ?? ''} - {dict.footer.rights}
          </p>
          <nav aria-label={dict.footer.legalTitle}>
            <ul className="flex flex-wrap gap-x-5 gap-y-2">
              {LEGAL_LINKS.map((item) => (
                <li key={item.path}>
                  <Link className="text-paper/72 no-underline hover:text-gold-600" href={localePath(locale, item.path)}>
                    {item.label(dict)}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </div>
    </footer>
  );
}
