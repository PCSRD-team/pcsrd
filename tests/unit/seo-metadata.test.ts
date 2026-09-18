import { describe, expect, it } from 'vitest';
import { buildMetadata, isTranslatedFor, ogLocale, withPagination } from '@/lib/seo/metadata';

/**
 * `buildMetadata` is the one place the canonical / hreflang / untranslated
 * rules live, so it gets the thorough treatment: both locales, the
 * `ar_only` case on each, `noIndex`, `x-default`, pagination.
 *
 * `NEXT_PUBLIC_SITE_URL` is `http://localhost:3000` from `tests/setup/env.ts`;
 * every URL here is relative and resolved by `metadataBase` in the layout.
 */

const base = {
  siteName: 'المركز',
  title: 'عنوان',
  description: 'وصف',
};

const languagesOf = (meta: ReturnType<typeof buildMetadata>) =>
  meta.alternates?.languages as Record<string, string> | undefined;

describe('buildMetadata — static routes', () => {
  it('emits canonical, both hreflangs and x-default → Arabic for an Arabic page', () => {
    const meta = buildMetadata({ ...base, locale: 'ar', path: '/about' });

    expect(meta.alternates?.canonical).toBe('/ar/about');
    expect(languagesOf(meta)).toEqual({
      ar: '/ar/about',
      en: '/en/about',
      'x-default': '/ar/about',
    });
    expect(meta.robots).toBeUndefined();
  });

  it('emits the English canonical with x-default still pointing at Arabic', () => {
    const meta = buildMetadata({ ...base, locale: 'en', path: '/about' });

    expect(meta.alternates?.canonical).toBe('/en/about');
    expect(languagesOf(meta)?.['x-default']).toBe('/ar/about');
    expect(languagesOf(meta)?.en).toBe('/en/about');
  });

  it('maps the home path to the bare locale prefix', () => {
    const meta = buildMetadata({ ...base, locale: 'ar', path: '/' });
    expect(meta.alternates?.canonical).toBe('/ar');
    expect(languagesOf(meta)?.en).toBe('/en');
  });

  it('uses per-locale paths when the slugs differ', () => {
    const meta = buildMetadata({
      ...base,
      locale: 'en',
      path: { ar: '/news/عنوان', en: '/news/title' },
      translationStatus: 'human_translated',
    });

    expect(meta.alternates?.canonical).toBe('/en/news/title');
    expect(languagesOf(meta)).toEqual({
      ar: '/ar/news/عنوان',
      en: '/en/news/title',
      'x-default': '/ar/news/عنوان',
    });
  });
});

describe('buildMetadata — the untranslated rule', () => {
  const paths = { ar: '/news/عنوان', en: '/news/title' };

  it('on the English URL of an ar_only record: noindex,follow; canonical → Arabic; no en hreflang', () => {
    const meta = buildMetadata({ ...base, locale: 'en', path: paths, translationStatus: 'ar_only' });

    expect(meta.robots).toEqual({ index: false, follow: true });
    expect(meta.alternates?.canonical).toBe('/ar/news/عنوان');
    expect(languagesOf(meta)).toEqual({
      ar: '/ar/news/عنوان',
      'x-default': '/ar/news/عنوان',
    });
    expect(meta.openGraph?.url).toBe('/ar/news/عنوان');
    expect(meta.openGraph && 'alternateLocale' in meta.openGraph && meta.openGraph.alternateLocale).toBeFalsy();
  });

  it('on the Arabic URL of an ar_only record: indexable, but no reciprocal en hreflang either', () => {
    const meta = buildMetadata({ ...base, locale: 'ar', path: paths, translationStatus: 'ar_only' });

    expect(meta.robots).toBeUndefined();
    expect(meta.alternates?.canonical).toBe('/ar/news/عنوان');
    expect(languagesOf(meta)).toEqual({
      ar: '/ar/news/عنوان',
      'x-default': '/ar/news/عنوان',
    });
  });

  it('treats machine_draft and human_translated as translated', () => {
    for (const status of ['machine_draft', 'human_translated'] as const) {
      const meta = buildMetadata({ ...base, locale: 'en', path: paths, translationStatus: status });
      expect(meta.robots).toBeUndefined();
      expect(meta.alternates?.canonical).toBe('/en/news/title');
      expect(languagesOf(meta)?.en).toBe('/en/news/title');
    }
  });

  it('isTranslatedFor: Arabic is always translated', () => {
    expect(isTranslatedFor('ar', 'ar_only')).toBe(true);
    expect(isTranslatedFor('en', 'ar_only')).toBe(false);
    expect(isTranslatedFor('en', undefined)).toBe(true);
  });
});

describe('buildMetadata — noIndex', () => {
  it('sets noindex,nofollow and drops every alternate', () => {
    const meta = buildMetadata({
      ...base,
      locale: 'en',
      path: { ar: '/projects/a', en: '/projects/b' },
      noIndex: true,
    });

    expect(meta.robots).toEqual({ index: false, follow: false });
    expect(meta.alternates).toEqual({ canonical: '/en/projects/b' });
  });

  it('wins over the untranslated rule', () => {
    const meta = buildMetadata({
      ...base,
      locale: 'en',
      path: '/x',
      noIndex: true,
      translationStatus: 'ar_only',
    });
    expect(meta.robots).toEqual({ index: false, follow: false });
  });
});

describe('buildMetadata — Open Graph and Twitter', () => {
  it('fills the website card from the inputs, with the site name as a parameter', () => {
    const meta = buildMetadata({ ...base, locale: 'ar', path: '/about' });

    expect(meta.openGraph).toMatchObject({
      title: 'عنوان',
      description: 'وصف',
      url: '/ar/about',
      siteName: 'المركز',
      locale: 'ar_PS',
      alternateLocale: ['en_US'],
      type: 'website',
    });
    expect(meta.twitter).toMatchObject({ card: 'summary_large_image', title: 'عنوان' });
    // The key must be ABSENT, not undefined. Next merges a route's
    // file-convention `opengraph-image` only when the page's own metadata does
    // not declare images, and it tests that with `hasOwnProperty('images')` —
    // so `{ images: undefined }` silently suppresses every generated card.
    expect(meta.openGraph && 'images' in meta.openGraph).toBe(false);
    expect(meta.twitter && 'images' in meta.twitter).toBe(false);
  });

  it('emits article times only for articles', () => {
    const published = new Date('2026-01-02T03:04:05.000Z');
    const article = buildMetadata({
      ...base,
      locale: 'en',
      path: '/news/x',
      type: 'article',
      publishedTime: published,
      modifiedTime: '2026-02-01T00:00:00.000Z',
    });
    expect(article.openGraph).toMatchObject({
      type: 'article',
      publishedTime: '2026-01-02T03:04:05.000Z',
      modifiedTime: '2026-02-01T00:00:00.000Z',
    });

    const website = buildMetadata({ ...base, locale: 'en', path: '/about', publishedTime: published });
    expect(website.openGraph).not.toHaveProperty('publishedTime');
  });

  it('passes an explicit image through to both cards', () => {
    const meta = buildMetadata({
      ...base,
      locale: 'en',
      path: '/x',
      ogImage: { url: '/en/x/opengraph-image', width: 1200, height: 630, alt: 'card' },
    });
    expect(meta.openGraph && 'images' in meta.openGraph ? meta.openGraph.images : null).toEqual([
      { url: '/en/x/opengraph-image', width: 1200, height: 630, alt: 'card' },
    ]);
    expect(meta.twitter && 'images' in meta.twitter ? meta.twitter.images : null).toEqual(['/en/x/opengraph-image']);
  });

  it('drops a blank description rather than emitting an empty tag', () => {
    const meta = buildMetadata({ ...base, description: '   ', locale: 'ar', path: '/x' });
    expect(meta.description).toBeUndefined();
  });

  it('ogLocale maps the two locales', () => {
    expect(ogLocale('ar')).toBe('ar_PS');
    expect(ogLocale('en')).toBe('en_US');
  });
});

describe('withPagination', () => {
  const list = buildMetadata({ ...base, locale: 'ar', path: '/news' });

  it('leaves page 1 canonical to the bare URL with only a next link', () => {
    const meta = withPagination(list, { page: 1, hasNext: true, hasPrev: false });

    expect(meta.alternates?.canonical).toBe('/ar/news');
    expect(meta.pagination).toEqual({ previous: null, next: '/ar/news?page=2' });
    expect(meta.title).toBe('عنوان');
  });

  it('canonicalises page 3 to itself, never to page 1', () => {
    const meta = withPagination(list, { page: 3, hasNext: true, hasPrev: true });

    expect(meta.alternates?.canonical).toBe('/ar/news?page=3');
    expect(meta.pagination).toEqual({ previous: '/ar/news?page=2', next: '/ar/news?page=4' });
    expect(languagesOf(meta)).toEqual({
      ar: '/ar/news?page=3',
      en: '/en/news?page=3',
      'x-default': '/ar/news?page=3',
    });
    expect(meta.openGraph?.url).toBe('/ar/news?page=3');
    expect(meta.title).toBe('عنوان (3)');
  });

  it('links page 2 back to the bare URL, not ?page=1', () => {
    const meta = withPagination(list, { page: 2, hasNext: false, hasPrev: true });
    expect(meta.pagination).toEqual({ previous: '/ar/news', next: null });
  });

  it('keeps filter parameters on canonical and the prev/next links', () => {
    const meta = withPagination(list, {
      page: 2,
      hasNext: true,
      hasPrev: true,
      params: { category: 'news', governorate: undefined, page: '9' },
    });

    expect(meta.alternates?.canonical).toBe('/ar/news?category=news&page=2');
    expect(meta.pagination).toEqual({
      previous: '/ar/news?category=news',
      next: '/ar/news?category=news&page=3',
    });
  });
});
