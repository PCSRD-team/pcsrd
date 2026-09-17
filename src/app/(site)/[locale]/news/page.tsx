import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PostCard, postCategoryLabel } from '@/components/content/cards';
import { ContentBreadcrumbs } from '@/components/content/page-chrome';
import { getSiteName } from '@/components/content/site';
import { CollectionPageJsonLd } from '@/components/seo/json-ld';
import { ButtonLink } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/feedback';
import { Container, PageHeader } from '@/components/ui/layout';
import { Pagination } from '@/components/ui/pagination';
import { Tabs } from '@/components/ui/tabs';
import { listPosts } from '@/db/queries/content';
import { postCategory, type PostCategory } from '@/db/schema/enums';
import { isLocale, localePath, type Locale } from '@/lib/i18n/config';
import { getDictionary } from '@/lib/i18n/get-dictionary';
import { buildMetadata, withPagination } from '@/lib/seo/metadata';

export const revalidate = 3600;

type SearchParams = Record<string, string | string[] | undefined>;

/** `?category=` and `?page=` are user input; anything unknown falls back. */
function readQuery(search: SearchParams): { category: PostCategory | undefined; page: number } {
  const raw = Array.isArray(search.category) ? search.category[0] : search.category;
  const category = (postCategory.enumValues as readonly string[]).includes(raw ?? '')
    ? (raw as PostCategory)
    : undefined;
  const page = Number(search.page);
  return { category, page: Number.isInteger(page) && page > 0 ? page : 1 };
}

function listHref(locale: Locale, category: PostCategory | undefined, page: number): string {
  const query = new URLSearchParams();
  if (category) query.set('category', category);
  if (page > 1) query.set('page', String(page));
  const qs = query.toString();
  return localePath(locale, `/news${qs ? `?${qs}` : ''}`);
}

export async function generateMetadata({ params, searchParams }: PageProps<'/[locale]/news'>): Promise<Metadata> {
  const [{ locale }, search] = await Promise.all([params, searchParams]);
  if (!isLocale(locale)) return {};
  const { category, page } = readQuery(search);
  const [dict, siteName, result] = await Promise.all([
    getDictionary(locale),
    getSiteName(locale),
    listPosts(locale, { category, page }),
  ]);

  return withPagination(
    buildMetadata({
      locale,
      path: '/news',
      title: dict.news.title,
      description: dict.news.lead,
      siteName,
    }),
    {
      page: result.page,
      hasNext: result.page < result.totalPages,
      hasPrev: result.page > 1,
      params: { category },
    },
  );
}

export default async function NewsPage({ params, searchParams }: PageProps<'/[locale]/news'>) {
  const [{ locale }, search] = await Promise.all([params, searchParams]);
  if (!isLocale(locale)) notFound();

  const { category, page } = readQuery(search);
  const [dict, result] = await Promise.all([getDictionary(locale), listPosts(locale, { category, page })]);

  // Category tabs are links, so the filter is the URL: crawlable, shareable,
  // and working with scripting off.
  const tabs = [
    { label: dict.filters.all, href: listHref(locale, undefined, 1), current: !category },
    ...postCategory.enumValues.map((value) => ({
      label: postCategoryLabel(value, dict),
      href: listHref(locale, value, 1),
      current: category === value,
    })),
  ];

  return (
    <Container className="section-gap">
      <CollectionPageJsonLd
        name={dict.news.title}
        description={dict.news.lead}
        url={listHref(locale, category, result.page)}
        locale={locale}
        items={result.items.map((post) => ({ name: post.title, url: localePath(locale, `/news/${post.slug}`) }))}
      />

      <PageHeader
        title={dict.news.title}
        lede={dict.news.lead}
        breadcrumbs={<ContentBreadcrumbs locale={locale} dict={dict} trail={[{ label: dict.news.title }]} />}
      />

      <Tabs items={tabs} label={dict.filters.newsCategories} className="mbe-8" />

      {result.items.length === 0 ? (
        <EmptyState
          title={dict.states.emptyTitle}
          body={category ? dict.states.emptyFiltered : dict.states.emptyBody}
          action={
            category ? (
              <ButtonLink href={listHref(locale, undefined, 1)} tone="secondary" size="sm">
                {dict.filters.all}
              </ButtonLink>
            ) : null
          }
        />
      ) : (
        <>
          <ul className="grid gap-4">
            {result.items.map((post) => (
              <li key={post.id} className="flex">
                <PostCard post={post} locale={locale} dict={dict} />
              </li>
            ))}
          </ul>

          <Pagination
            page={result.page}
            totalPages={result.totalPages}
            hrefFor={(target) => listHref(locale, category, target)}
            label={dict.a11y.pagination}
            previousLabel={dict.common.previous}
            nextLabel={dict.common.next}
            pageLabel={(target) => `${dict.common.page} ${target}`}
          />
        </>
      )}
    </Container>
  );
}
