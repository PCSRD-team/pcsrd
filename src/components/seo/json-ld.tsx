import type { OrganizationChrome } from '@/components/layout/chrome';
import type { Locale } from '@/lib/i18n/config';
import {
  type ArticleInput,
  type BreadcrumbItem,
  type ImageForJsonLd,
  type JobPostingInput,
  type JsonLdObject,
  breadcrumbJsonLd,
  collectionPageJsonLd,
  imageObjectJsonLd,
  jobPostingJsonLd,
  newsArticleJsonLd,
  organizationJsonLd,
  organizationLogoUrl,
  programServiceJsonLd,
  projectJsonLd,
  serializeJsonLd,
  storyArticleJsonLd,
  webSiteJsonLd,
} from '@/lib/seo/json-ld';

export { serializeJsonLd };

/**
 * Structured data.
 *
 * **The one place `dangerouslySetInnerHTML` is permitted**, and the ESLint
 * override is scoped to this directory alone. The content of a
 * `<script type="application/ld+json">` is not an HTML parsing context, so the
 * usual injection route is closed — but the JSON still has to be safe to embed,
 * which is what `serialize` below is for.
 *
 * The objects themselves are built in `src/lib/seo/json-ld.ts`, which has no
 * React in it and is unit-tested — including `serializeJsonLd`, the escaping
 * step. These components only render.
 */

/** Renders any builder's output. Prefer the typed components below. */
export function JsonLd({ data }: { data: JsonLdObject | null | undefined }) {
  if (!data) return null;
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }} />;
}

// ── Site-wide ────────────────────────────────────────────────────────────

/**
 * The organisation record. Every field reads from `organization_settings` —
 * RULE 6 — and the node is rendered once, from the locale layout.
 */
export function OrganizationJsonLd({
  org,
  locale,
}: {
  org: OrganizationChrome | null;
  locale: Locale;
}) {
  if (!org) return null;
  return <JsonLd data={organizationJsonLd(org, locale)} />;
}

export function WebSiteJsonLd({
  siteName,
  locale,
  description,
}: {
  siteName: string;
  locale: Locale;
  description?: string | null;
}) {
  return <JsonLd data={webSiteJsonLd({ siteName, locale, description })} />;
}

/** Breadcrumbs, so a search result shows the path rather than a bare URL. */
export function BreadcrumbJsonLd({ items }: { items: BreadcrumbItem[] }) {
  if (items.length === 0) return null;
  return <JsonLd data={breadcrumbJsonLd(items)} />;
}

export function CollectionPageJsonLd(props: Parameters<typeof collectionPageJsonLd>[0]) {
  return <JsonLd data={collectionPageJsonLd(props)} />;
}

// ── Records ──────────────────────────────────────────────────────────────

/**
 * A news article.
 *
 * `publishedAt` is kept as the prop name the existing page passes; the
 * builder also takes `updatedAt` and `image` (SEO-016).
 */
export function ArticleJsonLd({
  publishedAt,
  ...rest
}: Omit<ArticleInput, 'publishedAt'> & { publishedAt?: Date | string | null }) {
  return <JsonLd data={newsArticleJsonLd({ ...rest, publishedAt })} />;
}

export function StoryJsonLd(props: ArticleInput) {
  return <JsonLd data={storyArticleJsonLd(props)} />;
}

export function ProgramJsonLd(props: Parameters<typeof programServiceJsonLd>[0]) {
  return <JsonLd data={programServiceJsonLd(props)} />;
}

export function ProjectJsonLd(props: Parameters<typeof projectJsonLd>[0]) {
  return <JsonLd data={projectJsonLd(props)} />;
}

export function ImageObjectJsonLd({ image }: { image: ImageForJsonLd }) {
  return <JsonLd data={imageObjectJsonLd(image)} />;
}

/**
 * A vacancy.
 *
 * `org` supplies `hiringOrganization` by name and logo; `url` is the
 * vacancy's own page. `description` must be plain text — pass
 * `richTextToPlainText(vacancy.description)`, never the location (SEO-015).
 */
export function JobPostingJsonLd({
  org,
  url,
  ...rest
}: Omit<JobPostingInput, 'hiringOrganization' | 'url'> & {
  org?: OrganizationChrome | null;
  url?: string;
}) {
  return (
    <JsonLd
      data={jobPostingJsonLd({
        ...rest,
        url: url ?? `/${rest.locale}/careers`,
        hiringOrganization: {
          name: org?.legalName ?? org?.shortName ?? null,
          logo: org ? organizationLogoUrl(org) : null,
        },
      })}
    />
  );
}
