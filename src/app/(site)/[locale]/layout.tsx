import { notFound } from 'next/navigation';
import { ChannelsBar, SiteFooter, SiteHeader } from '@/components/layout/chrome';
import { getOrganization } from '@/db/queries/content';
import { DIR, HTML_LANG, LOCALES, isLocale } from '@/lib/i18n/config';
import { getDictionary } from '@/lib/i18n/get-dictionary';

/**
 * The locale layout.
 *
 * This is the first place `lang` and `dir` are known, so this is where they are
 * set. They go on a wrapper rather than on `<html>` because the root layout
 * renders before the segment is resolved; a `dir` guessed at the root and
 * corrected here would flash the wrong direction on first paint.
 */

export const revalidate = 3600;

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
    <div
      lang={HTML_LANG[locale]}
      dir={DIR[locale]}
      className="flex min-h-screen flex-col bg-paper-ground"
    >
      <a href="#main" className="skip-link focus:inset-inline-start-4 focus:bg-paper focus:p-4">
        {dict.common.skipToContent}
      </a>

      <ChannelsBar locale={locale} dict={dict} />
      <SiteHeader locale={locale} dict={dict} org={org} />

      <main id="main" className="flex-1">
        {children}
      </main>

      <SiteFooter locale={locale} dict={dict} org={org} />
    </div>
  );
}
