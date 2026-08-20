import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { RichText } from '@/components/content/rich-text';
import { Prose, SectionHeading } from '@/components/ui/primitives';
import { UntranslatedNotice } from '@/components/ui/states';
import { getPageByKey } from '@/db/queries/content';
import { isLocale } from '@/lib/i18n/config';
import { getDictionary } from '@/lib/i18n/get-dictionary';

export const revalidate = 3600;

/**
 * Legal and policy pages. `key` is the stable identifier the route looks up by;
 * the slug is only what the URL shows, so the organisation can rename a page in
 * either language without breaking this route.
 */
const KEYS = ['privacy', 'accessibility', 'terms'] as const;

export function generateStaticParams() {
  return KEYS.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/legal/[slug]'>): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!isLocale(locale)) return {};
  const page = await getPageByKey(slug, locale);
  if (!page) return {};
  return {
    title: page.title ?? undefined,
    alternates: {
      canonical: `/${locale}/legal/${slug}`,
      languages: { ar: `/ar/legal/${slug}`, en: `/en/legal/${slug}` },
    },
  };
}

export default async function LegalPage({ params }: PageProps<'/[locale]/legal/[slug]'>) {
  const { locale, slug } = await params;
  if (!isLocale(locale)) notFound();

  const [dict, page] = await Promise.all([getDictionary(locale), getPageByKey(slug, locale)]);
  if (!page) notFound();

  return (
    <article className="container-content section-gap">
      {!page.isTranslated ? (
        <UntranslatedNotice
          title={dict.states.untranslatedTitle}
          body={dict.states.untranslatedBody}
        />
      ) : null}

      <SectionHeading as="h1" title={page.title ?? ''} />
      <Prose>
        <RichText doc={page.body} />
      </Prose>
    </article>
  );
}
