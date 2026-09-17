import type { Metadata, Viewport } from 'next';
import { notFound } from 'next/navigation';
import { fontVariables } from '@/app/fonts';
import { SiteFooter, SiteHeader, organizationName } from '@/components/layout/chrome';
import { OrganizationJsonLd, WebSiteJsonLd } from '@/components/seo/json-ld';
import { SkipLink } from '@/components/ui/skip-link';
import { getOrganization, listPrograms } from '@/db/queries/content';
import { DIR, HTML_LANG, LOCALES, isLocale } from '@/lib/i18n/config';
import { getDictionary } from '@/lib/i18n/get-dictionary';
import { metadataBase, ogLocale } from '@/lib/seo/metadata';
import '../../globals.css';

/**
 * The public site's **root layout**.
 *
 * There is no `src/app/layout.tsx`. Any layout with no layout above it is a
 * root layout, and a root layout is allowed to sit under a dynamic segment —
 * `[locale]` is then a root parameter. That is what makes this the first place
 * `lang` and `dir` are known *and* the place `<html>` is emitted, which is the
 * whole point.
 *
 * Previously a root layout did exist and rendered a bare `<html>` with no
 * `lang` and no `dir`, on the reasoning that guessing a direction and
 * correcting it downstream would flash the wrong one. The reasoning was sound;
 * the conclusion — put them on a wrapper `<div>` instead — was not. `<title>`
 * lives in `<head>`, outside any wrapper, so assistive technology announced
 * every Arabic page title in an English voice, and `<html>` computed to `ltr`
 * on Arabic pages: the viewport scrollbar rendered on the wrong side and
 * `text-align: start` on `<body>` resolved to `left`. That is WCAG 2.2 SC 3.1.1
 * — Level A, the lowest bar in the specification — failing on every public
 * page, in the locale that is the default.
 */

export const revalidate = 3600;

/**
 * The title template carries the organisation's own name (SEO-022), read from
 * `organization_settings` rather than typed here. Pages override `title`,
 * `description`, `alternates`, `openGraph` and `robots` through
 * `buildMetadata`; what is set here is only the fallback for a page that
 * forgets — and the `robots` default is why every page that must be `noindex`
 * has to go through the builder.
 */
export async function generateMetadata({ params }: LayoutProps<'/[locale]'>): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const org = await getOrganization(locale);
  const siteName = organizationName(org);

  return {
    metadataBase,
    title: { default: siteName, template: `%s — ${siteName}` },
    description: org?.shortDescription ?? undefined,
    applicationName: siteName,
    robots: { index: true, follow: true },
    openGraph: { siteName, locale: ogLocale(locale), type: 'website' },
    twitter: { card: 'summary_large_image' },
    alternates: {
      types: { 'application/rss+xml': '/feed.xml' },
    },
  };
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

/** Both locales are pre-rendered. There are only two. */
export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

export default async function LocaleLayout({ children, params }: LayoutProps<'/[locale]'>) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  // `dict` and `org` are fetched once per request here and passed down as
  // props; children re-query `getOrganization` through the request cache, so
  // the database is still hit once.
  const [dict, org, programs] = await Promise.all([
    getDictionary(locale),
    getOrganization(locale),
    listPrograms(locale),
  ]);
  const siteName = organizationName(org);

  return (
    <html lang={HTML_LANG[locale]} dir={DIR[locale]} suppressHydrationWarning>
      <body className={`${fontVariables} flex min-h-screen flex-col bg-paper-ground antialiased`}>
        <SkipLink label={dict.common.skipToContent} />

        <OrganizationJsonLd org={org} locale={locale} />
        <WebSiteJsonLd siteName={siteName} locale={locale} description={org?.shortDescription} />

        <SiteHeader locale={locale} dict={dict} org={org} />

        {/* `tabIndex={-1}` so the skip link actually moves focus into the region. */}
        <main id="main" tabIndex={-1} className="flex-1 outline-none">
          {children}
        </main>

        <SiteFooter locale={locale} dict={dict} org={org} programs={programs} />
      </body>
    </html>
  );
}
