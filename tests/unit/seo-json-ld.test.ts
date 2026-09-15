import { describe, expect, it } from 'vitest';
import {
  breadcrumbJsonLd,
  collectionPageJsonLd,
  compact,
  jobPostingJsonLd,
  newsArticleJsonLd,
  officialSameAs,
  organizationJsonLd,
  programServiceJsonLd,
  richTextToPlainText,
  serializeJsonLd,
  webSiteJsonLd,
} from '@/lib/seo/json-ld';

import { detailTags, TAGS, tagsFor } from '@/lib/cache/tags';

/**
 * Structured data is a set of claims about the organisation. The tests here
 * pin the two rules that matter most: nothing is invented (an absent value is
 * an absent property), and `sameAs` lists only official channels.
 */

const org = {
  legalName: 'الاسم القانوني',
  shortName: 'الاسم',
  acronym: 'ACR',
  shortDescription: null,
  foundedYear: 2005,
  licenseNumber: 'L-1',
  licenseAuthority: 'الجهة',
  primaryPhone: '+970000000000',
  email: 'a@example.org',
  address: null,
  socials: [
    { url: 'https://facebook.com/official', is_official: true },
    { url: 'https://facebook.com/impostor', is_official: false },
  ],
  officialChannels: [
    { url: 'https://facebook.com/official', is_official: true },
    { url: 'https://wa.me/970000000000', is_official: true },
    { url: 'not a url', is_official: true },
  ],
  logoPrimaryBucket: 'media',
  logoPrimaryPath: 'logo.png',
};

describe('organizationJsonLd', () => {
  it('reads every field from the record and points at the site URL', () => {
    const data = organizationJsonLd(org, 'ar');

    expect(data).toMatchObject({
      '@type': 'NGO',
      '@id': 'http://localhost:3000/#organization',
      name: 'الاسم القانوني',
      alternateName: ['الاسم', 'ACR'],
      url: 'http://localhost:3000/ar',
      foundingDate: '2005',
      identifier: { '@type': 'PropertyValue', name: 'الجهة', value: 'L-1' },
      contactPoint: { telephone: '+970000000000', email: 'a@example.org' },
      logo: { '@type': 'ImageObject', url: 'https://test.supabase.co/storage/v1/object/public/media/logo.png' },
    });
  });

  it('lists only official, well-formed channels in sameAs, deduplicated', () => {
    expect(officialSameAs(org)).toEqual([
      'https://facebook.com/official',
      'https://wa.me/970000000000',
    ]);
  });

  it('omits what the organisation has not provided instead of defaulting', () => {
    const data = organizationJsonLd(
      {
        legalName: null,
        socials: [],
        officialChannels: [],
      },
      'en',
    );

    expect(data).toEqual({
      '@context': 'https://schema.org',
      '@type': 'NGO',
      '@id': 'http://localhost:3000/#organization',
      url: 'http://localhost:3000/en',
    });
    expect(data).not.toHaveProperty('address');
    expect(data).not.toHaveProperty('logo');
    expect(data).not.toHaveProperty('sameAs');
  });

  it('never publishes an address the organisation did not opt in to', () => {
    expect(organizationJsonLd({ ...org, address: null }, 'ar')).not.toHaveProperty('address');
    expect(organizationJsonLd({ ...org, address: 'شارع' }, 'ar')).toMatchObject({
      address: { '@type': 'PostalAddress', streetAddress: 'شارع' },
    });
  });
});

describe('record builders', () => {
  it('webSite links back to the organisation by @id', () => {
    expect(webSiteJsonLd({ siteName: 'S', locale: 'en' })).toMatchObject({
      '@type': 'WebSite',
      name: 'S',
      url: 'http://localhost:3000/en',
      publisher: { '@id': 'http://localhost:3000/#organization' },
    });
  });

  it('breadcrumbs are positioned from 1 and absolute', () => {
    const data = breadcrumbJsonLd([
      { name: 'الرئيسية', url: '/ar' },
      { name: 'الأخبار', url: '/ar/news' },
    ]);
    expect(data.itemListElement).toEqual([
      { '@type': 'ListItem', position: 1, name: 'الرئيسية', item: 'http://localhost:3000/ar' },
      { '@type': 'ListItem', position: 2, name: 'الأخبار', item: 'http://localhost:3000/ar/news' },
    ]);
  });

  it('collection page drops unnamed items and omits an empty list', () => {
    const data = collectionPageJsonLd({
      name: 'الأخبار',
      url: '/ar/news',
      locale: 'ar',
      items: [
        { name: 'أ', url: '/ar/news/a' },
        { name: null, url: '/ar/news/b' },
      ],
    });
    expect(data.mainEntity).toMatchObject({ '@type': 'ItemList' });
    expect((data.mainEntity as { itemListElement: unknown[] }).itemListElement).toHaveLength(1);

    expect(collectionPageJsonLd({ name: 'x', url: '/ar/x', locale: 'ar' })).not.toHaveProperty('mainEntity');
  });

  it('news article carries dates, image and the organisation as author and publisher', () => {
    const data = newsArticleJsonLd({
      title: 'عنوان',
      url: '/ar/news/slug',
      locale: 'ar',
      publishedAt: new Date('2026-03-01T00:00:00.000Z'),
      updatedAt: new Date('2026-03-02T00:00:00.000Z'),
      image: { url: 'https://cdn/x.jpg', width: 1200, height: 630, alt: 'بديل' },
    });

    expect(data).toMatchObject({
      '@type': 'NewsArticle',
      headline: 'عنوان',
      datePublished: '2026-03-01T00:00:00.000Z',
      dateModified: '2026-03-02T00:00:00.000Z',
      inLanguage: 'ar',
      mainEntityOfPage: { '@id': 'http://localhost:3000/ar/news/slug' },
      image: { '@type': 'ImageObject', contentUrl: 'https://cdn/x.jpg', name: 'بديل', width: 1200 },
      author: { '@id': 'http://localhost:3000/#organization' },
      publisher: { '@id': 'http://localhost:3000/#organization' },
    });
  });

  it('programme service names the organisation as provider', () => {
    expect(
      programServiceJsonLd({ name: 'برنامج', url: '/ar/programs/x', locale: 'ar', audience: ['الأطفال'] }),
    ).toMatchObject({
      '@type': 'Service',
      provider: { '@id': 'http://localhost:3000/#organization' },
      audience: [{ '@type': 'Audience', audienceType: 'الأطفال' }],
    });
  });

  it('job posting always has validThrough and never uses the location as its description', () => {
    const data = jobPostingJsonLd({
      title: 'وظيفة',
      description: '',
      url: '/ar/careers/x',
      locale: 'ar',
      deadline: '2026-12-31',
      postedAt: '2026-09-01',
      employmentType: 'FULL_TIME',
      location: 'غزة',
      hiringOrganization: { name: 'الاسم', logo: null },
    });

    expect(data).toMatchObject({
      '@type': 'JobPosting',
      validThrough: '2026-12-31',
      datePosted: '2026-09-01',
      description: 'وظيفة',
      employmentType: 'FULL_TIME',
      hiringOrganization: { '@type': 'NGO', '@id': 'http://localhost:3000/#organization', name: 'الاسم' },
      jobLocation: { address: { addressLocality: 'غزة' } },
    });
    expect(data.description).not.toBe('غزة');
  });

  it('volunteer postings default employmentType to VOLUNTEER when the column is empty', () => {
    const data = jobPostingJsonLd({
      title: 'متطوع',
      url: '/ar/careers/v',
      locale: 'ar',
      deadline: '2026-12-31',
      postedAt: '2026-09-01',
      volunteer: true,
      hiringOrganization: { name: null },
    });
    expect(data.employmentType).toBe('VOLUNTEER');
    expect(data.hiringOrganization).not.toHaveProperty('name');
  });
});

describe('richTextToPlainText', () => {
  it('flattens a TipTap document to prose with paragraph breaks', () => {
    const text = richTextToPlainText({
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'الفقرة ' }, { type: 'text', text: 'الأولى' }] },
        { type: 'bulletList', content: [{ type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'بند' }] }] }] },
      ],
    });
    expect(text).toBe('الفقرة الأولى\nبند');
  });

  it('returns an empty string for nothing, and truncates long bodies', () => {
    expect(richTextToPlainText(null)).toBe('');
    const long = richTextToPlainText(
      { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'ب'.repeat(100) }] }] },
      20,
    );
    expect(long).toHaveLength(20);
    expect(long.endsWith('…')).toBe(true);
  });
});

describe('compact and serialisation', () => {
  it('compact removes undefined, null, blank strings and empty arrays only', () => {
    expect(compact({ a: undefined, b: null, c: '', d: '  ', e: [], f: 0, g: false, h: 'x' })).toEqual({
      f: 0,
      g: false,
      h: 'x',
    });
  });

  it('serialisation escapes the characters that could break out of the script element', () => {
    const out = serializeJsonLd({ t: '</script><b>&amp;\u2028' });
    expect(out).not.toContain('<');
    expect(out).not.toContain('>');
    expect(out).not.toContain('&');
    expect(out).not.toContain('\u2028');
    expect(out).toContain('\\u003c/script\\u003e');
    expect(JSON.parse(out)).toEqual({ t: '</script><b>&amp;\u2028' });
  });
});

describe('cache tags', () => {
  it('detailTags registers the item and its list', () => {
    expect(detailTags('post', 'x')).toEqual(['post:x', 'post:list']);
    expect(detailTags('page', 'privacy')).toEqual(['page:privacy', 'page:list']);
  });

  it('every tag a detail query registers is one the admin action revalidates', () => {
    for (const entity of ['program', 'project', 'post', 'story', 'vacancy', 'publication'] as const) {
      const registered = detailTags(entity, 'slug-ar');
      const revalidated = tagsFor(entity, { ar: 'slug-ar', en: 'slug-en' });
      for (const tag of registered) expect(revalidated).toContain(tag);
    }
    expect(tagsFor('program')).toContain(TAGS.programList);
  });
});
