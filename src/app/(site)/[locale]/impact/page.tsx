import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { MetricCard } from '@/components/content/cards';
import { Panel, Section, SectionHeading } from '@/components/ui/primitives';
import { EmptyState } from '@/components/ui/states';
import { listMetrics, listStories } from '@/db/queries/content';
import { isLocale, localePath } from '@/lib/i18n/config';
import { getDictionary } from '@/lib/i18n/get-dictionary';

export const revalidate = 3600;

export async function generateMetadata({ params }: PageProps<'/[locale]/impact'>): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const dict = await getDictionary(locale);
  return {
    title: dict.impact.title,
    description: dict.impact.lead,
    alternates: { canonical: `/${locale}/impact`, languages: { ar: '/ar/impact', en: '/en/impact' } },
  };
}

export default async function ImpactPage({ params }: PageProps<'/[locale]/impact'>) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const [dict, metrics, stories] = await Promise.all([
    getDictionary(locale),
    // `/impact` shows verified figures only. Targets live on the strategy page,
    // where the reader knows they are looking at an intention rather than a
    // result — the same table, two contexts, no editorial process required.
    listMetrics(locale, { status: 'verified' }),
    listStories(locale, { limit: 12 }),
  ]);

  return (
    <div className="container-content section-gap">
      <SectionHeading as="h1" title={dict.impact.title} lead={dict.impact.lead} />

      {metrics.length === 0 ? (
        <EmptyState title={dict.states.emptyTitle} body={dict.states.emptyBody} />
      ) : (
        <ul className="grid gap-6 md:grid-cols-3">
          {metrics.map((metric) => (
            <MetricCard key={metric.id} metric={metric} locale={locale} dict={dict} />
          ))}
        </ul>
      )}

      {stories.length > 0 ? (
        <Section labelledBy="impact-stories">
          <SectionHeading id="impact-stories" title={dict.impact.storiesTitle} />
          <ul className="grid gap-6 md:grid-cols-2">
            {stories.map((story) => (
              <Panel as="li" key={story.id} className="flex flex-col gap-3">
                <h3 className="text-h3 font-semibold">
                  <Link
                    href={localePath(locale, `/impact/stories/${story.slug}`)}
                    className="text-ink no-underline hover:text-gold-700"
                  >
                    {story.title}
                  </Link>
                </h3>
                {story.quote ? (
                  <blockquote className="border-s-2 border-gold-600 ps-4 text-lead text-ink">
                    {story.quote}
                  </blockquote>
                ) : null}
                {story.summary ? (
                  <p className="text-small text-ink-70">{story.summary}</p>
                ) : null}
              </Panel>
            ))}
          </ul>
        </Section>
      ) : null}
    </div>
  );
}
