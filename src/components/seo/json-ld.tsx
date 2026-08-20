import type { OrganizationChrome } from '@/components/layout/chrome';
import { publicEnv } from '@/lib/env.public';
import type { Locale } from '@/lib/i18n/config';

/**
 * Structured data.
 *
 * **The one place `dangerouslySetInnerHTML` is permitted**, and the ESLint
 * override is scoped to this directory alone. The content of a
 * `<script type="application/ld+json">` is not an HTML parsing context, so the
 * usual injection route is closed — but the JSON still has to be safe to embed,
 * which is what `serialize` below is for.
 */

/**
 * `</script>` inside a JSON string value would end the script element early
 * and everything after it would be parsed as HTML. Escaping the `<` closes
 * that route.
 *
 * U+2028 and U+2029 are escaped too: they are ordinary characters in JSON but
 * line terminators in JavaScript, so a paragraph separator pasted into a body
 * field would otherwise produce a syntax error inside the embedded script.
 *
 * The replacements are DOUBLE-backslashed on purpose. A single backslash is a
 * TypeScript escape, so `'\u003c'` is the character `<` itself and the
 * substitution would be a no-op — which is exactly the kind of escaping bug
 * that looks correct in review.
 */
function serialize(data: unknown): string {
  return JSON.stringify(data)
    .replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

function JsonLd({ data }: { data: unknown }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: serialize(data) }}
    />
  );
}

/**
 * The organisation record.
 *
 * Every field reads from `organization_settings` — RULE 6. Nothing here is
 * written into the code, including the name, because getting the legal name
 * wrong in structured data is exactly the kind of inconsistency a due-diligence
 * check notices.
 */
export function OrganizationJsonLd({
  org,
  locale,
}: {
  org: OrganizationChrome | null;
  locale: Locale;
}) {
  if (!org) return null;
  const base = publicEnv.NEXT_PUBLIC_SITE_URL.replace(/\/$/, '');

  const data: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'NGO',
    '@id': `${base}/#organization`,
    name: org.legalName,
    alternateName: org.acronym,
    url: `${base}/${locale}`,
    foundingDate: org.foundedYear ? String(org.foundedYear) : undefined,
    // `sameAs` is the anti-impersonation claim in machine-readable form: it
    // tells a search engine which accounts are genuinely ours, and only the
    // ones the organisation marked official are listed.
    sameAs: org.officialChannels.filter((c) => c.is_official).map((c) => c.url),
  };

  if (org.licenseNumber) {
    data.identifier = {
      '@type': 'PropertyValue',
      name: org.licenseAuthority ?? 'License',
      value: org.licenseNumber,
    };
  }

  if (org.primaryPhone || org.email) {
    data.contactPoint = {
      '@type': 'ContactPoint',
      contactType: 'general',
      telephone: org.primaryPhone ?? undefined,
      email: org.email ?? undefined,
      availableLanguage: ['ar', 'en'],
    };
  }

  // DNH-6 again: the address is published only when the organisation opted in,
  // and structured data is not an exception to that.
  if (org.address) {
    data.address = { '@type': 'PostalAddress', streetAddress: org.address };
  }

  return <JsonLd data={data} />;
}

/** A news article. */
export function ArticleJsonLd({
  title,
  description,
  publishedAt,
  url,
  locale,
}: {
  title: string | null;
  description?: string | null;
  publishedAt?: Date | null;
  url: string;
  locale: Locale;
}) {
  const base = publicEnv.NEXT_PUBLIC_SITE_URL.replace(/\/$/, '');
  return (
    <JsonLd
      data={{
        '@context': 'https://schema.org',
        '@type': 'NewsArticle',
        headline: title,
        description: description ?? undefined,
        datePublished: publishedAt?.toISOString(),
        inLanguage: locale,
        mainEntityOfPage: url,
        publisher: { '@id': `${base}/#organization` },
      }}
    />
  );
}

/**
 * A vacancy.
 *
 * `validThrough` is always present because `deadline` is `not null` in the
 * schema. A job posting without one stays in aggregators long after it closed.
 */
export function JobPostingJsonLd({
  title,
  description,
  deadline,
  postedAt,
  employmentType,
  location,
  locale,
}: {
  title: string | null;
  description?: string | null;
  deadline: string;
  postedAt: string;
  employmentType?: string | null;
  location?: string | null;
  locale: Locale;
}) {
  const base = publicEnv.NEXT_PUBLIC_SITE_URL.replace(/\/$/, '');
  return (
    <JsonLd
      data={{
        '@context': 'https://schema.org',
        '@type': 'JobPosting',
        title,
        description: description ?? title,
        datePosted: postedAt,
        validThrough: deadline,
        employmentType: employmentType ?? undefined,
        inLanguage: locale,
        hiringOrganization: { '@id': `${base}/#organization` },
        jobLocation: location
          ? { '@type': 'Place', address: { '@type': 'PostalAddress', addressLocality: location } }
          : undefined,
      }}
    />
  );
}

/** Breadcrumbs, so a search result shows the path rather than a bare URL. */
export function BreadcrumbJsonLd({ items }: { items: { name: string; url: string }[] }) {
  return (
    <JsonLd
      data={{
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: items.map((item, index) => ({
          '@type': 'ListItem',
          position: index + 1,
          name: item.name,
          item: item.url,
        })),
      }}
    />
  );
}
