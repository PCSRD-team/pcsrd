import { ogImageMetadata, ogLocaleOf, recordOgCard } from '@/components/content/og';
import { getProjectBySlug } from '@/db/queries/projects';
import { prerenderData } from '@/lib/build-time';
import { OG_CONTENT_TYPE, OG_SIZE } from '@/lib/seo/og';

/** The card for one project: its programme as the eyebrow, in the programme colour. */

export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const revalidate = 3600;

type Params = { locale: string; slug: string };

export async function generateImageMetadata({ params }: { params: Params }) {
  const locale = ogLocaleOf(params.locale);
  const project = await prerenderData('og project', () => getProjectBySlug(params.slug, locale), null);
  return ogImageMetadata(project?.title);
}

export default async function Image({ params }: { params: Promise<Params> }) {
  const { locale: raw, slug } = await params;
  const locale = ogLocaleOf(raw);
  const project = await prerenderData('og project', () => getProjectBySlug(slug, locale), null);

  // The project detail query does not expose `ogMediaId` (it selects a named
  // shape); the rendered card is used until it does.
  return recordOgCard({
    locale,
    record: project ? { title: project.title } : null,
    eyebrow: project?.program?.title ?? null,
    accent: project?.program?.accentToken,
  });
}
