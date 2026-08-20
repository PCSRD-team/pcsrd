import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PostCard } from '@/components/content/cards';
import { SectionHeading } from '@/components/ui/primitives';
import { EmptyState } from '@/components/ui/states';
import { listPosts } from '@/db/queries/content';
import { postCategory, type PostCategory } from '@/db/schema/enums';
import { isLocale } from '@/lib/i18n/config';
import { getDictionary } from '@/lib/i18n/get-dictionary';

export const revalidate = 3600;

export async function generateMetadata({ params }: PageProps<'/[locale]/news'>): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const dict = await getDictionary(locale);
  return {
    title: dict.news.title,
    description: dict.news.lead,
    alternates: {
      canonical: `/${locale}/news`,
      languages: { ar: '/ar/news', en: '/en/news' },
      types: { 'application/rss+xml': '/feed.xml' },
    },
  };
}

export default async function NewsPage({ params, searchParams }: PageProps<'/[locale]/news'>) {
  const [{ locale }, search] = await Promise.all([params, searchParams]);
  if (!isLocale(locale)) notFound();

  const raw = Array.isArray(search.category) ? search.category[0] : search.category;
  const category = (postCategory.enumValues as readonly string[]).includes(raw ?? '')
    ? (raw as PostCategory)
    : undefined;

  const page = Number(search.page);
  const [dict, result] = await Promise.all([
    getDictionary(locale),
    listPosts(locale, { category, page: Number.isInteger(page) && page > 0 ? page : 1 }),
  ]);

  return (
    <div className="container-content section-gap">
      <SectionHeading as="h1" title={dict.news.title} lead={dict.news.lead} />

      {result.items.length === 0 ? (
        <EmptyState
          title={dict.states.emptyTitle}
          body={category ? dict.states.emptyFiltered : dict.states.emptyBody}
        />
      ) : (
        <div className="grid gap-4">
          {result.items.map((post) => (
            <PostCard key={post.id} post={post} locale={locale} dict={dict} />
          ))}
        </div>
      )}
    </div>
  );
}
