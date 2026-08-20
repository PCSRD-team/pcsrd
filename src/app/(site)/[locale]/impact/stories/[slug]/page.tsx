import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { RichText } from '@/components/content/rich-text';
import { Panel, Prose } from '@/components/ui/primitives';
import { UntranslatedNotice } from '@/components/ui/states';
import { getStoryBySlug } from '@/db/queries/content';
import { isLocale } from '@/lib/i18n/config';
import { getDictionary } from '@/lib/i18n/get-dictionary';

export const revalidate = 3600;

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/impact/stories/[slug]'>): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!isLocale(locale)) return {};
  const story = await getStoryBySlug(slug, locale);
  if (!story) return {};

  return {
    title: story.title ?? undefined,
    description: story.summary ?? undefined,
    robots: story.noIndex ? { index: false, follow: false } : undefined,
    alternates: {
      canonical: `/${locale}/impact/stories/${slug}`,
      languages: {
        ar: `/ar/impact/stories/${story.slugAr}`,
        en: `/en/impact/stories/${story.slugEn}`,
      },
    },
  };
}

export default async function StoryPage({
  params,
}: PageProps<'/[locale]/impact/stories/[slug]'>) {
  const { locale, slug } = await params;
  if (!isLocale(locale)) notFound();

  const [dict, story] = await Promise.all([getDictionary(locale), getStoryBySlug(slug, locale)]);
  if (!story) notFound();

  return (
    <article className="container-content section-gap">
      {!story.isTranslated ? (
        <UntranslatedNotice
          title={dict.states.untranslatedTitle}
          body={dict.states.untranslatedBody}
        />
      ) : null}

      <h1 className="text-h1 font-semibold text-ink">{story.title}</h1>
      <span className="rule-mark mbs-5 block" aria-hidden="true" />

      {/*
        The anonymisation notice is shown to the reader, not hidden as an
        internal flag. Saying plainly that a subject's identity was withheld is
        part of the story's credibility — and it explains the absence of a name
        or a photograph rather than leaving it looking like an omission.
      */}
      {story.subjectAnonymized ? (
        <p className="mbs-6 text-small text-ink-55">{dict.impact.storyAnonymized}</p>
      ) : null}

      {story.summary ? (
        <p className="measure-lead mbs-6 text-lead text-ink-70">{story.summary}</p>
      ) : null}

      {story.quote ? (
        <Panel tone="gold" className="mbs-10">
          <blockquote className="text-lead text-ink">{story.quote}</blockquote>
          {story.quoteAttribution ? (
            <p className="mbs-4 font-mono text-caption text-mono-muted">
              — {story.quoteAttribution}
            </p>
          ) : null}
        </Panel>
      ) : null}

      <Prose className="mbs-10">
        <RichText doc={story.body} />
      </Prose>
    </article>
  );
}
