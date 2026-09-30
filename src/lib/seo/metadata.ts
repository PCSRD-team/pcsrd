import type { Metadata } from 'next';
import { publicEnv } from '@/lib/env.public';
import { DEFAULT_LOCALE, LOCALES, type Locale, localePath, otherLocale } from '@/lib/i18n/config';

/**
 * One metadata builder for every public route.
 *
 * Every `generateMetadata` in `(site)` calls `buildMetadata` and nothing else,
 * so the rules below — canonical, hreflang, `x-default`, the untranslated
 * rule, `noindex`, Open Graph, Twitter — are written once and cannot drift
 * between the six slug routes and the eighteen static ones (SEO-001/002/003,
 * NEXT-011).
 *
 * No organisation facts live here. The site name is a parameter the caller
 * reads from `organization_settings`.
 */

export type TranslationStatus = 'ar_only' | 'machine_draft' | 'human_translated';

/**
 * A locale-less path, or one per locale when the two slugs differ.
 * `'/news/my-slug'` for a static route; `{ ar: '/news/عنوان', en: '/news/title' }`
 * for a record.
 */
export type LocalizedPath = string | Record<Locale, string>;

export type OgImageMeta = {
  url: string;
  width?: number;
  height?: number;
  alt?: string;
};

export type BuildMetadataInput = {
  locale: Locale;
  path: LocalizedPath;
  /** The page title without the site-name suffix; the root template appends it. */
  title: string;
  description?: string | null;
  /** From `organization_settings.short_name_*`, resolved for the locale. */
  siteName: string;
  /**
   * An explicit card image. Leave unset on any route that has an
   * `opengraph-image.tsx` and pass `ownCard` instead — an explicit image
   * would replace the route's own card.
   */
  ogImage?: OgImageMeta | null;
  /**
   * `true` on a route whose own segment has an `opengraph-image.tsx` (the five
   * record templates). Every other route gets the site-wide card by URL — see
   * `siteCardImage`.
   */
  ownCard?: boolean;
  /** The record's `translation_status`. Omit for static pages, which are always translated. */
  translationStatus?: TranslationStatus | null;
  /** The record's `no_index` column. */
  noIndex?: boolean;
  type?: 'website' | 'article';
  publishedTime?: Date | string | null;
  modifiedTime?: Date | string | null;
};

/** Open Graph locale tags (03-FRONTEND §5): `ar_PS` for Arabic, `en_US` for English. */
export const OG_LOCALE: Record<Locale, string> = { ar: 'ar_PS', en: 'en_US' };

export function ogLocale(locale: Locale): string {
  return OG_LOCALE[locale];
}

export const metadataBase = new URL(publicEnv.NEXT_PUBLIC_SITE_URL);

/**
 * The URL segment Next serves `src/app/(site)/[locale]/opengraph-image.tsx` at.
 *
 * A file-convention card is merged into the metadata of **its own segment
 * only**, and a child page that declares `openGraph` replaces the parent's
 * object wholesale (`mergeMetadata` in `next/dist/lib/metadata/resolve-metadata.js`
 * assigns, it does not deep-merge). So every static page — which all declare
 * `openGraph` through this builder — shipped with no `og:image` at all: the
 * `[locale]` card was built and referenced by nothing but the layout.
 *
 * The fix names the card explicitly. Because the file sits under a route group,
 * Next suffixes its segment with a hash of the parent path
 * (`getMetadataRouteSuffix` → `djb2Hash('/(site)/[locale]')`), which is
 * deterministic per path, not per build. `tests/unit/seo-site-card.test.ts`
 * recomputes it with Next's own function and fails if Next ever changes the
 * scheme or the file moves. `isSiteSection` already lets the `opengraph-image`
 * prefix through the proxy's 404 rule.
 */
export const SITE_CARD_SEGMENT = 'opengraph-image-1yhjss';
/** `generateImageMetadata` id in the `[locale]` card. */
export const SITE_CARD_ID = 'default';
const SITE_CARD_SIZE = { width: 1200, height: 630 };

/** The site-wide card for `locale`, as an `openGraph.images` entry. */
export function siteCardImage(locale: Locale, alt: string): OgImageMeta {
  return {
    url: `/${locale}/${SITE_CARD_SEGMENT}/${SITE_CARD_ID}`,
    ...SITE_CARD_SIZE,
    alt: alt || undefined,
  };
}

function pathFor(path: LocalizedPath, locale: Locale): string {
  return localePath(locale, typeof path === 'string' ? path : path[locale]);
}

function toIso(value: Date | string | null | undefined): string | undefined {
  if (!value) return undefined;
  return value instanceof Date ? value.toISOString() : value;
}

/** True when this locale's URL carries content that was written for it. */
export function isTranslatedFor(locale: Locale, status: TranslationStatus | null | undefined): boolean {
  return locale === DEFAULT_LOCALE || status !== 'ar_only';
}

/**
 * Builds the `Metadata` for one page.
 *
 * ### The untranslated rule (SEO-003 / NEXT-011 / 07-BRIEF §8)
 *
 * A record with `translation_status = 'ar_only'` still has an `/en/` URL, and
 * that URL renders the Arabic body inside a notice. The page must exist so
 * the language switcher never 404s, but it must **not** present itself to a
 * crawler as the English version of the Arabic page — that is duplicate
 * content wearing an `hreflang="en"` badge, and Google's response can be to
 * demote *both* URLs, the Arabic original included.
 *
 * So when `locale === 'en'` and the record is `ar_only`:
 *
 * - `robots` is `{ index: false, follow: true }` — stay out of the index, keep
 *   crawling the links;
 * - `alternates.canonical` points at the **Arabic** URL;
 * - `alternates.languages` carries only `ar` and `x-default` — there is no
 *   `en` hreflang because there is no English page to declare;
 * - `openGraph.locale` is still the page's own locale (the card is rendered in
 *   it), but no `alternateLocale` is claimed.
 *
 * And symmetrically, the Arabic page of an `ar_only` record also omits the
 * `en` hreflang: hreflang must be reciprocal, and a pair where one side says
 * "I am not an alternate" is worse than no pair.
 *
 * ### `x-default`
 *
 * Always the Arabic URL. Arabic is the default locale, not a translation, and
 * a visitor whose language matches neither should land there.
 *
 * ### `noIndex`
 *
 * The record's `no_index` column wins over everything above:
 * `{ index: false, follow: false }`, no alternates at all — a page that asks
 * not to be indexed should not be advertising its siblings either.
 */
export function buildMetadata(input: BuildMetadataInput): Metadata {
  const { locale, siteName } = input;
  const other = otherLocale(locale);
  const translated = isTranslatedFor(locale, input.translationStatus);
  const description = input.description?.trim() || undefined;

  /**
   * A blank title is never shippable, so it is caught here as well as at the
   * call sites.
   *
   * Every detail route resolved its title with `seoTitle ?? record.title ??
   * siteName`, and `??` falls back on `null`/`undefined` but not on `''`. The
   * SEO columns are empty strings in the database rather than nulls, so every
   * programme, project, post, story, vacancy and legal page shipped
   * `<title> — {org}</title>` with an empty `og:title` beside a correctly
   * populated `twitter:image:alt`. Found by fetching the served HTML, not by
   * reading the code — which is why the guard lives at the boundary too.
   */
  const title = input.title?.trim() || siteName;

  const ownUrl = pathFor(input.path, locale);
  const arabicUrl = pathFor(input.path, DEFAULT_LOCALE);
  const canonical = translated ? ownUrl : arabicUrl;

  const languages: Record<string, string> = {};
  for (const candidate of LOCALES) {
    if (isTranslatedFor(candidate, input.translationStatus)) {
      languages[candidate] = pathFor(input.path, candidate);
    }
  }
  languages['x-default'] = arabicUrl;

  // An explicit image wins; a route with its own card file is left to it; every
  // other route names the site card, because omitting `images` would not
  // inherit it (see `SITE_CARD_SEGMENT`).
  const image = input.ogImage ?? (input.ownCard ? null : siteCardImage(locale, siteName));
  const images = image
    ? [
        {
          url: image.url,
          width: image.width,
          height: image.height,
          alt: image.alt,
        },
      ]
    : undefined;

  const type = input.type ?? 'website';
  const alternateLocale =
    translated && isTranslatedFor(other, input.translationStatus) ? [ogLocale(other)] : undefined;

  /**
   * The `images` key is **omitted**, not set to `undefined`, when this route
   * has no explicit image.
   *
   * Next merges a route's file-convention `opengraph-image` into the metadata
   * only when the page's own metadata does not declare images, and the test it
   * uses is `source.openGraph.hasOwnProperty('images')` — a key present with
   * the value `undefined` counts as declared. Spreading `{ images: undefined }`
   * therefore suppressed the generated card on every route at once: the twelve
   * `opengraph-image` segments were built and never referenced, and no page
   * emitted `og:image`.
   */
  const openGraphBase = {
    title,
    description,
    url: canonical,
    siteName,
    locale: ogLocale(locale),
    alternateLocale,
    ...(images ? { images } : {}),
  };

  const openGraph: Metadata['openGraph'] =
    type === 'article'
      ? {
          ...openGraphBase,
          type: 'article',
          publishedTime: toIso(input.publishedTime),
          modifiedTime: toIso(input.modifiedTime),
        }
      : { ...openGraphBase, type: 'website' };

  const metadata: Metadata = {
    title,
    description,
    alternates: {
      canonical,
      languages,
      // Declared here, not in the layout: a page's `alternates` replaces the
      // layout's whole object, so the layout's RSS link never reached a page.
      types: { 'application/rss+xml': '/feed.xml' },
    },
    openGraph,
    // Same omission rule as `openGraph.images` above: an absent key lets the
    // file-convention `twitter-image` fill it in, and Next also copies
    // `openGraph.images` across when Twitter declares none.
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      ...(images ? { images: images.map((image) => image.url) } : {}),
    },
  };

  if (input.noIndex) {
    metadata.robots = { index: false, follow: false };
    metadata.alternates = { canonical: ownUrl, types: { 'application/rss+xml': '/feed.xml' } };
  } else if (!translated) {
    metadata.robots = { index: false, follow: true };
  }

  return metadata;
}

export type PaginationInput = {
  /** 1-based current page. */
  page: number;
  hasNext: boolean;
  hasPrev: boolean;
  /** The current page's other query parameters (category, filters), kept on the prev/next links. */
  params?: Record<string, string | undefined>;
};

/**
 * Pagination for `/news` and `/projects` (SEO-009).
 *
 * Each page canonicalises to **itself**, with `?page=n` for every page after
 * the first — a `?page=1` canonical would be a duplicate of the bare URL. A
 * list that canonicalised every page to page one told Google that pages two
 * onward were copies, which de-indexes every item that is not on page one.
 *
 * `pagination.previous` / `.next` render `<link rel="prev">` / `<link
 * rel="next">`. Google stopped using them as an indexing signal in 2019 but
 * still recognises them, Bing uses them, and they cost nothing.
 *
 * Filtered views keep their query on canonical and the prev/next links, so a
 * filter combination is its own, consistently addressed page rather than a
 * variant that canonicalises to the unfiltered list and disappears.
 */
export function withPagination(metadata: Metadata, input: PaginationInput): Metadata {
  const page = Math.max(1, Math.floor(input.page));
  const canonical = metadata.alternates?.canonical;
  const base = typeof canonical === 'string' ? canonical : canonical instanceof URL ? canonical.pathname : null;
  if (!base) return metadata;

  const pathOnly = base.split('?')[0] ?? base;

  const url = (target: number): string => {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(input.params ?? {})) {
      if (value !== undefined && value !== '' && key !== 'page') query.set(key, value);
    }
    if (target > 1) query.set('page', String(target));
    const search = query.toString();
    return search ? `${pathOnly}?${search}` : pathOnly;
  };

  const self = url(page);
  const search = self.includes('?') ? self.slice(self.indexOf('?')) : '';

  // Hreflang alternates are rewritten with the same query so that page 3 of
  // the Arabic list pairs with page 3 of the English list, not page 1.
  const existing = metadata.alternates?.languages;
  const languages = existing
    ? Object.fromEntries(
        Object.entries(existing).map(([lang, value]) =>
          typeof value === 'string' ? [lang, `${value.split('?')[0] ?? value}${search}`] : [lang, value],
        ),
      )
    : undefined;

  const openGraph = metadata.openGraph ? { ...metadata.openGraph, url: self } : undefined;
  const title =
    page > 1 && typeof metadata.title === 'string' ? `${metadata.title} (${page})` : metadata.title;

  return {
    ...metadata,
    title,
    alternates: { ...metadata.alternates, canonical: self, languages },
    openGraph,
    pagination: {
      previous: input.hasPrev && page > 1 ? url(page - 1) : null,
      next: input.hasNext ? url(page + 1) : null,
    },
  };
}

/**
 * Resolves an SEO field against its fallbacks, skipping blanks.
 *
 * The SEO columns hold **empty strings**, not nulls: `optionalText` in
 * `src/lib/validation/common.ts` preserves `''` deliberately, so an untouched
 * textarea in the CMS is stored as `''`. `??` falls back on `null` and
 * `undefined` but not on `''`, which is why every detail route once shipped an
 * empty `<title>`.
 *
 * That was fixed for the title and left in place for the description — so
 * every published detail page went on shipping with **no** `meta description`
 * and **no** `og:description`, silently, because `buildMetadata` turns `''`
 * into `undefined` and there was nothing left to fall back to. Verified by
 * fetching the served HTML of the two published pages, not by reading code.
 *
 * One function, so the title path and the description path cannot drift apart
 * a second time.
 */
// A call whose LAST candidate is a definite string cannot return undefined, and
// the title call sites end in `siteName`. The overload says so, which is why
// `title` stays a required `string` on `BuildMetadataInput` and no call site
// needs a cast to prove what it already guarantees.
export function seoFallback(...candidates: [...(string | null | undefined)[], string]): string;
export function seoFallback(...candidates: (string | null | undefined)[]): string | undefined;
export function seoFallback(...candidates: (string | null | undefined)[]): string | undefined {
  for (const candidate of candidates) {
    const trimmed = candidate?.trim();
    if (trimmed) return trimmed;
  }
  return undefined;
}
