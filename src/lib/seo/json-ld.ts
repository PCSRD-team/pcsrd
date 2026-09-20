import type { RichText, RichTextNode } from '@/db/schema/_shared';
import { publicEnv } from '@/lib/env.public';
import { storageUrl } from '@/lib/format';
import { LOCALES, type Locale } from '@/lib/i18n/config';

/**
 * Structured-data builders — pure functions returning plain objects.
 *
 * The React components in `src/components/seo/json-ld.tsx` only serialise
 * what these return, which is what lets the builders be unit-tested with no
 * DOM (`tests/unit/seo-json-ld.test.ts`).
 *
 * Two rules, both from CLAUDE.md:
 *
 * - **No invented organisation facts.** Every value comes from
 *   `organization_settings` or the record. A property whose value is absent
 *   is **omitted** — never defaulted — because a wrong claim in structured
 *   data is exactly the kind of inconsistency a due-diligence check notices.
 * - **`sameAs` is the anti-impersonation claim in machine-readable form.** It
 *   lists only the channels the organisation marked `is_official`.
 */

export type JsonLdObject = Record<string, unknown>;

const SCHEMA = 'https://schema.org';

export const SITE_BASE = publicEnv.NEXT_PUBLIC_SITE_URL.replace(/\/$/, '');

/** The stable `@id` every node uses to point at the organisation. */
export const ORGANIZATION_ID = `${SITE_BASE}/#organization`;
export const WEBSITE_ID = `${SITE_BASE}/#website`;

/** Absolute URL from a locale-less or locale path. */
export function absoluteUrl(path: string): string {
  if (/^https?:\/\//.test(path)) return path;
  return `${SITE_BASE}${path.startsWith('/') ? path : `/${path}`}`;
}

/** Drops keys whose value is `undefined`, `null`, `''` or an empty array. */
export function compact<T extends JsonLdObject>(data: T): JsonLdObject {
  const out: JsonLdObject = {};
  for (const [key, value] of Object.entries(data)) {
    if (value === undefined || value === null) continue;
    if (typeof value === 'string' && value.trim() === '') continue;
    if (Array.isArray(value) && value.length === 0) continue;
    out[key] = value;
  }
  return out;
}

const iso = (value: Date | string | null | undefined): string | undefined => {
  if (!value) return undefined;
  return value instanceof Date ? value.toISOString() : value;
};

/**
 * Flattens a TipTap document to plain text for `description` fields.
 *
 * `JobPosting.description` and `Article.description` must be prose, not a
 * location string (SEO-015) and not JSON. Paragraph-level nodes become line
 * breaks; everything else concatenates.
 */
export function richTextToPlainText(doc: RichText | null | undefined, maxLength = 5000): string {
  if (!doc?.content) return '';
  const parts: string[] = [];
  const walk = (node: RichTextNode) => {
    if (node.type === 'text' && node.text) parts.push(node.text);
    if (node.type === 'hardBreak') parts.push('\n');
    node.content?.forEach(walk);
    if (['paragraph', 'heading', 'listItem', 'blockquote'].includes(node.type)) parts.push('\n');
  };
  doc.content.forEach(walk);
  const text = parts.join('').replace(/[ \t]+/g, ' ').replace(/\n{2,}/g, '\n').trim();
  return text.length > maxLength ? `${text.slice(0, maxLength - 1).trimEnd()}…` : text;
}

/**
 * Makes a JSON-LD payload safe to embed in `<script type="application/ld+json">`.
 *
 * `</script>` inside a JSON string value would end the script element early
 * and everything after it would be parsed as HTML. Escaping `<` closes that
 * route; `>` and `&` are escaped as well so the payload is also inert if it
 * is ever reflected into an attribute or an HTML comment.
 *
 * U+2028 and U+2029 are escaped too: they are ordinary characters in JSON but
 * line terminators in JavaScript, so a paragraph separator pasted into a body
 * field would otherwise produce a syntax error inside the embedded script.
 *
 * The replacements are DOUBLE-backslashed on purpose. A single backslash is a
 * TypeScript escape, so a single-backslash `u003c` in source is the character `<` itself and the
 * substitution would be a no-op — which is exactly the kind of escaping bug
 * that looks correct in review.
 */
export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

// ── Organisation ─────────────────────────────────────────────────────────

/** The subset of `getOrganization()` the builders read; every field is optional on purpose. */
export type OrganizationForJsonLd = {
  legalName: string | null;
  shortName?: string | null;
  acronym?: string | null;
  shortDescription?: string | null;
  foundedYear?: number | null;
  licenseNumber?: string | null;
  licenseAuthority?: string | null;
  primaryPhone?: string | null;
  email?: string | null;
  address?: string | null;
  socials?: { url: string; is_official: boolean }[] | null;
  officialChannels?: { url: string; is_official: boolean }[] | null;
  logoPrimaryBucket?: string | null;
  logoPrimaryPath?: string | null;
};

/** Public logo URL, or nothing when the organisation has not uploaded one. */
export function organizationLogoUrl(org: OrganizationForJsonLd): string | undefined {
  return org.logoPrimaryBucket && org.logoPrimaryPath
    ? storageUrl(publicEnv.NEXT_PUBLIC_SUPABASE_URL, org.logoPrimaryBucket, org.logoPrimaryPath)
    : undefined;
}

/** `sameAs`: official channels and official social profiles, deduplicated. */
export function officialSameAs(org: OrganizationForJsonLd): string[] {
  const urls = [...(org.officialChannels ?? []), ...(org.socials ?? [])]
    .filter((channel) => channel.is_official && /^https?:\/\//.test(channel.url))
    .map((channel) => channel.url);
  return [...new Set(urls)];
}

/**
 * The `NGO` node. Rendered once per page from the locale layout; every other
 * node points at it by `@id` instead of repeating it.
 */
export function organizationJsonLd(org: OrganizationForJsonLd, locale: Locale): JsonLdObject {
  const logo = organizationLogoUrl(org);
  return compact({
    '@context': SCHEMA,
    '@type': 'NGO',
    '@id': ORGANIZATION_ID,
    name: org.legalName ?? undefined,
    alternateName: [org.shortName, org.acronym].filter(
      (name, index, all): name is string => Boolean(name) && all.indexOf(name) === index,
    ),
    description: org.shortDescription ?? undefined,
    url: `${SITE_BASE}/${locale}`,
    logo: logo ? { '@type': 'ImageObject', url: logo } : undefined,
    foundingDate: org.foundedYear ? String(org.foundedYear) : undefined,
    identifier: org.licenseNumber
      ? compact({
          '@type': 'PropertyValue',
          name: org.licenseAuthority ?? undefined,
          value: org.licenseNumber,
        })
      : undefined,
    contactPoint:
      org.primaryPhone || org.email
        ? compact({
            '@type': 'ContactPoint',
            contactType: 'general',
            telephone: org.primaryPhone ?? undefined,
            email: org.email ?? undefined,
            // The locales the site is actually published in, not a literal
            // pair — a locale added to `LOCALES` appears here on its own.
            availableLanguage: [...LOCALES],
          })
        : undefined,
    // DNH-6: the address is published only when the organisation opted in,
    // and structured data is not an exception — `address` is already null
    // from the query when it did not.
    address: org.address ? { '@type': 'PostalAddress', streetAddress: org.address } : undefined,
    sameAs: officialSameAs(org),
  });
}

/** The `WebSite` node, with the locale's home as its URL. */
export function webSiteJsonLd(input: {
  siteName: string;
  locale: Locale;
  description?: string | null;
}): JsonLdObject {
  return compact({
    '@context': SCHEMA,
    '@type': 'WebSite',
    '@id': WEBSITE_ID,
    name: input.siteName,
    description: input.description ?? undefined,
    url: `${SITE_BASE}/${input.locale}`,
    inLanguage: input.locale,
    publisher: { '@id': ORGANIZATION_ID },
  });
}

// ── Navigation ───────────────────────────────────────────────────────────

export type BreadcrumbItem = { name: string; url: string };

export function breadcrumbJsonLd(items: BreadcrumbItem[]): JsonLdObject {
  return {
    '@context': SCHEMA,
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.url),
    })),
  };
}

/** A list page: `/news`, `/projects`, `/programs`, `/impact`, `/resources`. */
export function collectionPageJsonLd(input: {
  name: string;
  description?: string | null;
  url: string;
  locale: Locale;
  items?: { name: string | null; url: string }[];
}): JsonLdObject {
  const items = (input.items ?? []).filter((item) => item.name);
  return compact({
    '@context': SCHEMA,
    '@type': 'CollectionPage',
    name: input.name,
    description: input.description ?? undefined,
    url: absoluteUrl(input.url),
    inLanguage: input.locale,
    isPartOf: { '@id': WEBSITE_ID },
    mainEntity:
      items.length > 0
        ? {
            '@type': 'ItemList',
            itemListElement: items.map((item, index) => ({
              '@type': 'ListItem',
              position: index + 1,
              name: item.name,
              url: absoluteUrl(item.url),
            })),
          }
        : undefined,
  });
}

// ── Records ──────────────────────────────────────────────────────────────

export type ImageForJsonLd = {
  url: string;
  width?: number | null;
  height?: number | null;
  /** `alt_ar` / `alt_en`, resolved. */
  alt?: string | null;
  caption?: string | null;
  credit?: string | null;
};

export function imageObjectJsonLd(image: ImageForJsonLd): JsonLdObject {
  return compact({
    '@context': SCHEMA,
    '@type': 'ImageObject',
    contentUrl: absoluteUrl(image.url),
    url: absoluteUrl(image.url),
    width: image.width ?? undefined,
    height: image.height ?? undefined,
    name: image.alt ?? undefined,
    caption: image.caption ?? undefined,
    creditText: image.credit ?? undefined,
  });
}

export type ArticleInput = {
  title: string | null;
  description?: string | null;
  url: string;
  locale: Locale;
  publishedAt?: Date | string | null;
  updatedAt?: Date | string | null;
  image?: ImageForJsonLd | null;
  /** Article body as plain text; keep it short — a snippet, not the document. */
  articleBody?: string | null;
};

function articleNode(type: 'NewsArticle' | 'Article', input: ArticleInput): JsonLdObject {
  const url = absoluteUrl(input.url);
  return compact({
    '@context': SCHEMA,
    '@type': type,
    '@id': `${url}#article`,
    headline: input.title ?? undefined,
    description: input.description ?? undefined,
    articleBody: input.articleBody ?? undefined,
    datePublished: iso(input.publishedAt),
    dateModified: iso(input.updatedAt) ?? iso(input.publishedAt),
    inLanguage: input.locale,
    url,
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
    image: input.image ? imageObjectJsonLd(input.image) : undefined,
    author: { '@id': ORGANIZATION_ID },
    publisher: { '@id': ORGANIZATION_ID },
  });
}

/** A news post (`posts`). */
export function newsArticleJsonLd(input: ArticleInput): JsonLdObject {
  return articleNode('NewsArticle', input);
}

/** An impact story (`stories`). */
export function storyArticleJsonLd(input: ArticleInput): JsonLdObject {
  return articleNode('Article', input);
}

/** A programme as a `Service` the organisation provides (03-FRONTEND §6.1). */
export function programServiceJsonLd(input: {
  name: string | null;
  description?: string | null;
  url: string;
  locale: Locale;
  /** `target_groups`, resolved to display labels. */
  audience?: string[] | null;
  areaServed?: string[] | null;
}): JsonLdObject {
  return compact({
    '@context': SCHEMA,
    '@type': 'Service',
    name: input.name ?? undefined,
    description: input.description ?? undefined,
    url: absoluteUrl(input.url),
    inLanguage: input.locale,
    provider: { '@id': ORGANIZATION_ID },
    audience: input.audience?.length
      ? input.audience.map((name) => ({ '@type': 'Audience', audienceType: name }))
      : undefined,
    areaServed: input.areaServed?.length ? input.areaServed : undefined,
  });
}

/** A project as a `Project` (schema.org/Project, an Organization subtype) run by the organisation. */
export function projectJsonLd(input: {
  name: string | null;
  description?: string | null;
  url: string;
  locale: Locale;
  startDate?: string | null;
  endDate?: string | null;
  areaServed?: string[] | null;
  funders?: { name: string | null; url?: string | null }[] | null;
  image?: ImageForJsonLd | null;
}): JsonLdObject {
  return compact({
    '@context': SCHEMA,
    '@type': 'Project',
    name: input.name ?? undefined,
    description: input.description ?? undefined,
    url: absoluteUrl(input.url),
    inLanguage: input.locale,
    foundingDate: input.startDate ?? undefined,
    dissolutionDate: input.endDate ?? undefined,
    areaServed: input.areaServed?.length ? input.areaServed : undefined,
    parentOrganization: { '@id': ORGANIZATION_ID },
    funder: input.funders
      ?.filter((funder) => funder.name)
      .map((funder) =>
        compact({ '@type': 'Organization', name: funder.name, url: funder.url ?? undefined }),
      ),
    image: input.image ? imageObjectJsonLd(input.image) : undefined,
  });
}

export type JobPostingInput = {
  title: string | null;
  /** Plain-text description — use `richTextToPlainText(vacancy.description)`. */
  description?: string | null;
  url: string;
  locale: Locale;
  /** `vacancies.deadline` (date). Always present in the schema — `not null`. */
  deadline: string;
  /** `vacancies.posted_at` (date). */
  postedAt: string;
  /** Already schema.org vocabulary in the column: FULL_TIME | PART_TIME | VOLUNTEER. */
  employmentType?: string | null;
  location?: string | null;
  /** From `organization_settings`, so the posting is attributed by name as well as `@id`. */
  hiringOrganization: { name: string | null; logo?: string | null };
  /** `true` when the vacancy is a `volunteer` type. */
  volunteer?: boolean;
};

/**
 * A vacancy.
 *
 * `validThrough` is always set from `deadline`: a job posting without one
 * stays in aggregators long after it closed. `description` must be the actual
 * description — a one-word string fails Rich Results (SEO-015) — and the
 * builder falls back to the title only so the node stays valid, never to the
 * location.
 */
export function jobPostingJsonLd(input: JobPostingInput): JsonLdObject {
  const description = input.description?.trim() || input.title || undefined;
  return compact({
    '@context': SCHEMA,
    '@type': 'JobPosting',
    title: input.title ?? undefined,
    description,
    url: absoluteUrl(input.url),
    inLanguage: input.locale,
    datePosted: input.postedAt,
    validThrough: input.deadline,
    employmentType: input.employmentType ?? (input.volunteer ? 'VOLUNTEER' : undefined),
    hiringOrganization: compact({
      '@type': 'NGO',
      '@id': ORGANIZATION_ID,
      name: input.hiringOrganization.name ?? undefined,
      logo: input.hiringOrganization.logo ?? undefined,
    }),
    jobLocation: input.location
      ? { '@type': 'Place', address: { '@type': 'PostalAddress', addressLocality: input.location } }
      : undefined,
  });
}
