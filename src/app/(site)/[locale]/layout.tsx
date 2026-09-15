import type { Metadata, Viewport } from 'next';
import { notFound } from 'next/navigation';
import { fontVariables } from '@/app/fonts';
import { ChannelsBar, SiteFooter, SiteHeader } from '@/components/layout/chrome';
import { OrganizationJsonLd } from '@/components/seo/json-ld';
import { getOrganization } from '@/db/queries/content';
import { DIR, HTML_LANG, LOCALES, isLocale } from '@/lib/i18n/config';
import { publicEnv } from '@/lib/env.public';
import { getDictionary } from '@/lib/i18n/get-dictionary';
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

export const metadata: Metadata = {
  // Without `metadataBase`, Next resolves every relative Open Graph and
  // canonical URL against `localhost:3000` and warns once per build. A social
  // card whose image URL points at localhost renders as a broken preview on
  // every platform that fetches it, which for an organisation whose /verify
  // page exists to counter impersonation is worse than having no card.
  metadataBase: new URL(publicEnv.NEXT_PUBLIC_SITE_URL),

  // Every organisational fact — including the name — comes from
  // organization_settings, so the real title is set per-locale downstream.
  title: { default: 'PCSRD', template: '%s — PCSRD' },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

/** Both locales are pre-rendered. There are only two. */
export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: LayoutProps<'/[locale]'>) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const [dict, org] = await Promise.all([getDictionary(locale), getOrganization(locale)]);

  return (
    <html lang={HTML_LANG[locale]} dir={DIR[locale]} suppressHydrationWarning>
      <body className={`${fontVariables} flex min-h-screen flex-col bg-paper-ground antialiased`}>
        <a href="#main" className="skip-link focus:start-4 focus:bg-paper focus:p-4">
          {dict.common.skipToContent}
        </a>

        <OrganizationJsonLd org={org} locale={locale} />

        <ChannelsBar locale={locale} dict={dict} org={org} />
        <SiteHeader locale={locale} dict={dict} org={org} />

        <main id="main" className="flex-1">
          {children}
        </main>

        <SiteFooter locale={locale} dict={dict} org={org} />
      </body>
    </html>
  );
}
