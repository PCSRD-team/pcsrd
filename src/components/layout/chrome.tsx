import { Suspense } from 'react';
import Link from 'next/link';
import { Bidi } from '@/components/ui/bidi';
import { DefinitionList } from '@/components/ui/primitives';
import type { Dictionary } from '@/lib/i18n/get-dictionary';
import { type Locale, localePath } from '@/lib/i18n/config';
import { LanguageSwitcher } from './language-switcher';
import { buildWhatsAppUrl } from '@/lib/utils';

/**
 * Persistent chrome.
 *
 * Principle 4 of the design direction — "two doors, always open" — is why the
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
  acronym: string;
  licenseNumber: string;
  licenseAuthority: string | null;
  foundedYear: number;
  primaryPhone: string | null;
  whatsappNumber: string | null;
  email: string | null;
  address: string | null;
  officialChannels: { platform: string; handle: string; url: string; is_official: boolean }[];
};

// ── Official-channels bar ────────────────────────────────────────────────

export function ChannelsBar({ locale, dict }: { locale: Locale; dict: Dictionary }) {
  return (
    <div className="border-be border-ink/15 bg-ink text-paper">
      <div className="container-content flex flex-wrap items-center justify-between gap-2 py-2">
        <p className="text-caption">
          <span className="font-mono text-eyebrow tracking-[0.16em] text-gold-600 uppercase">
            {dict.channels.barLabel}
          </span>
          <span className="mis-3">{dict.channels.barText}</span>
        </p>
        <Link
          href={localePath(locale, '/verify')}
          className="border-be border-gold-600 text-caption text-paper no-underline hover:text-gold-600"
        >
          {dict.channels.barCta}
        </Link>
      </div>
    </div>
  );
}

// ── Header ───────────────────────────────────────────────────────────────

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
      <div className="container-content flex items-center justify-between gap-6 py-5">
        <Link
          href={localePath(locale, '/')}
          className="text-h3 font-semibold text-ink no-underline"
        >
          {org?.shortName ?? org?.acronym ?? 'PCSRD'}
        </Link>

        {/*
          The nav is a plain list of links with no JavaScript. On mobile it
          scrolls horizontally rather than collapsing into a toggle: a menu
          button is the one piece of chrome that stops working when JS fails,
          and rule 7 says every page must work without it.
        */}
        <nav aria-label={dict.a11y.mainNav} className="min-w-0 flex-1">
          <ul className="flex items-center gap-5 overflow-x-auto py-1 text-small">
            {NAV.map((item) => (
              <li key={item.path} className="shrink-0">
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

// ── Footer ───────────────────────────────────────────────────────────────

/**
 * The identity record is the single most-reused due-diligence element on the
 * site: a funder checking whether the organisation is real reads exactly these
 * five lines. Every value is read from `organization_settings`, so none of it
 * needs a deploy to correct.
 */
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
  const official = org?.officialChannels.filter((channel) => channel.is_official) ?? [];

  return (
    <footer className="mbs-auto border-bs-2 border-ink bg-paper">
      <div className="container-content grid gap-10 py-14 md:grid-cols-4">
        <section className="md:col-span-2">
          <h2 className="eyebrow mbe-4">{dict.footer.identityTitle}</h2>
          <DefinitionList
            items={[
              { term: dict.about.legalName, value: org?.legalName },
              {
                term: dict.about.licenseNumber,
                value: org?.licenseNumber ? <Bidi>{org.licenseNumber}</Bidi> : null,
              },
              { term: dict.about.licenseAuthority, value: org?.licenseAuthority },
              {
                term: dict.about.foundedYear,
                value: org?.foundedYear ? <Bidi>{String(org.foundedYear)}</Bidi> : null,
              },
              {
                term: dict.forms.phone,
                value: org?.primaryPhone ? (
                  <a href={`tel:${org.primaryPhone}`}>
                    <Bidi>{org.primaryPhone}</Bidi>
                  </a>
                ) : null,
              },
              {
                term: dict.forms.email,
                value: org?.email ? (
                  <a href={`mailto:${org.email}`}>
                    <Bidi>{org.email}</Bidi>
                  </a>
                ) : null,
              },
              { term: dict.forms.location, value: org?.address },
            ]}
          />
        </section>

        <nav aria-label={dict.footer.channelsTitle}>
          <h2 className="eyebrow mbe-4">{dict.footer.channelsTitle}</h2>
          <ul className="space-y-2 text-small">
            {official.map((channel) => (
              <li key={`${channel.platform}:${channel.handle}`}>
                <a href={channel.url} rel="noopener noreferrer me" target="_blank">
                  {channel.platform} <Bidi>{channel.handle}</Bidi>
                </a>
              </li>
            ))}
            <li>
              <Link href={localePath(locale, '/verify')}>{dict.nav.verify}</Link>
            </li>
            {org?.whatsappNumber ? (
              <li>
                <a href={buildWhatsAppUrl(org.whatsappNumber)} rel="noopener noreferrer" target="_blank">
                  WhatsApp <Bidi>{org.whatsappNumber}</Bidi>
                </a>
              </li>
            ) : null}
          </ul>
        </nav>

        <nav aria-label={dict.footer.legalTitle}>
          <h2 className="eyebrow mbe-4">{dict.footer.legalTitle}</h2>
          <ul className="space-y-2 text-small">
            <li>
              <Link href={localePath(locale, '/legal/privacy')}>{dict.footer.privacy}</Link>
            </li>
            <li>
              <Link href={localePath(locale, '/legal/accessibility')}>
                {dict.footer.accessibility}
              </Link>
            </li>
            <li>
              <Link href={localePath(locale, '/legal/terms')}>{dict.footer.terms}</Link>
            </li>
            <li>
              <Link href={localePath(locale, '/contact#complaint')}>
                {dict.footer.complaints}
              </Link>
            </li>
          </ul>
        </nav>
      </div>

      <div className="border-bs border-rule">
        <p className="container-content py-5 text-caption text-ink-55">
          <Bidi>{String(year)}</Bidi> © {org?.legalName ?? org?.acronym ?? ''} —{' '}
          {dict.footer.rights}
        </p>
      </div>
    </footer>
  );
}
