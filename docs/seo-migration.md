# SEO migration note — phase 2 (route agents)

Temporary. Delete after every route under `src/app/(site)/[locale]/**` has been migrated.

The shared machinery is in place:

| What | Where |
|---|---|
| `buildMetadata`, `withPagination`, `ogLocale`, `isTranslatedFor`, `metadataBase` | `src/lib/seo/metadata.ts` |
| `renderOgImage`, `serveStoredOgImage`, `OG_SIZE`, `OG_CONTENT_TYPE` | `src/lib/seo/og.tsx` |
| Pure JSON-LD builders + `richTextToPlainText` + `serializeJsonLd` | `src/lib/seo/json-ld.ts` |
| JSON-LD components (`JsonLd`, `OrganizationJsonLd`, `WebSiteJsonLd`, `BreadcrumbJsonLd`, `CollectionPageJsonLd`, `ArticleJsonLd`, `StoryJsonLd`, `ProgramJsonLd`, `ProjectJsonLd`, `ImageObjectJsonLd`, `JobPostingJsonLd`) | `src/components/seo/json-ld.tsx` |
| Site-wide default card (`/{locale}/opengraph-image`, `/twitter-image`) | `src/app/(site)/[locale]/opengraph-image.tsx` |
| Slug lists for `generateStaticParams` and the sitemap: `listProgramSlugs`, `listPostSlugs`, `listStorySlugs`, `listVacancySlugs`, `listPageKeys`, `listProjectSlugs`; `getOgMedia(id)` | `src/db/queries/content.ts`, `projects.ts` |

## Rules that apply to every route

1. **`generateMetadata` returns `buildMetadata(...)` and nothing else.** No hand-written `alternates`, `robots`, `openGraph`. If a route needs something the builder does not produce, add it to the builder — do not fork the rule.
2. **`siteName` is `org.shortName ?? org.legalName ?? org.acronym`** from `getOrganization(locale)`. Never a string.
3. **`title` is the page title without the site name.** The layout template appends ` — {siteName}`.
4. **Record routes pass `translationStatus: record.translationStatus` and `noIndex: record.noIndex`.** That is the whole untranslated rule; the builder does the rest.
5. **Record routes pass `path: { ar: '/…/' + record.slugAr, en: '/…/' + record.slugEn }`.** The detail queries return both slugs (`select()` full row). Static routes pass a plain string.
6. **Do not pass `ogImage` on a route that has (or gets) an `opengraph-image.tsx`.** File-based metadata overrides `generateMetadata` (Next docs, `generate-metadata.md:114`), so the two would disagree. `ogImage` exists for a route with no image file of its own — none at present.
7. **SEO title/description**: `record.seoTitle ?? record.title`, `record.seoDescription ?? record.excerpt/tagline/summary`. The project query already resolves `seoTitle`/`seoDescription` per locale; the other detail queries return the raw `seoTitleAr/En` columns — resolve with `locale === 'ar' ? seoTitleAr : (seoTitleEn?.trim() || seoTitleAr)` (SEO-013: `seoTitleEn` must be read on English pages).
8. **Per-template `opengraph-image.tsx`** (posts, stories, programmes, projects, vacancies): the pattern is in §2. Lists and static pages use the site default and add nothing.
9. **JSON-LD**: the `NGO` node is rendered once from the layout. Pages render only their own node(s); never a second organisation node.

## 1. Route table

`L` = list/static page (site default OG, `CollectionPageJsonLd` where noted). `R` = record route (own `opengraph-image.tsx`).

| Route | Kind | `generateMetadata` | JSON-LD | OG file |
|---|---|---|---|---|
| `/` | L | `buildMetadata({ locale, path: '/', title: siteName, description: org.shortDescription ?? org.mission, siteName })` | `WebSiteJsonLd({ siteName, locale, description })` | default |
| `/about` | L | `path: '/about'`, `title: dict.about.title`, `description: dict.about.lead` (SEO-010) | `BreadcrumbJsonLd` | default |
| `/programs` | L | `path: '/programs'`, `title: dict.programs.title`, `description: dict.programs.lead` | `CollectionPageJsonLd({ name, url: '/{locale}/programs', locale, items: programs.map(p => ({ name: p.title, url: '/{locale}/programs/' + p.slug })) })` | default |
| `/programs/[slug]` | R | `path: { ar: '/programs/' + program.slugAr, en: '/programs/' + program.slugEn }`, `title: seoTitle ?? program.title`, `description: seoDescription ?? program.tagline`, `translationStatus`, `noIndex` | `ProgramJsonLd({ name: program.title, description: program.tagline, url, locale, audience: targetGroups labels })` + `BreadcrumbJsonLd` | **yes** — `eyebrow: dict.programs.title`, `accent: program.accentToken` |
| `/projects` | L, paginated | `withPagination(buildMetadata({ locale, path: '/projects', title: dict.projects.title, description: dict.projects.lead, siteName }), { page: filters.page, hasNext: page < totalPages, hasPrev: page > 1, params: { program, state, year, gov: …, theme: … } })` — canonical must carry the active filters (SEO-009) | `CollectionPageJsonLd` (items = current page) | default |
| `/projects/[slug]` | R | `path: { ar: '/projects/' + project.slugAr, en: '/projects/' + project.slugEn }`, `title: project.seoTitle ?? project.title`, `description: project.seoDescription ?? project.summary`, `translationStatus`, `noIndex: project.noIndex` | `ProjectJsonLd({ name, description: summary, url, locale, startDate, endDate, areaServed: governorate labels, funders: project.donors, image: hero })` + `BreadcrumbJsonLd` | **yes** — `eyebrow: project.program?.title`, `accent: project.program?.accentToken` |
| `/impact` | L | `path: '/impact'`, `title: dict.impact.title`, `description: dict.impact.lead` | `CollectionPageJsonLd` (stories) | default |
| `/impact/stories/[slug]` | R | `path: { ar: '/impact/stories/' + story.slugAr, en: … }`, `title: seoTitle ?? story.title`, `description: seoDescription ?? story.summary`, `type: 'article'`, `publishedTime: story.publishedAt`, `modifiedTime: story.updatedAt`, `translationStatus`, `noIndex` | `StoryJsonLd({ title, description: summary, url, locale, publishedAt, updatedAt, image })` + `BreadcrumbJsonLd` | **yes** — `eyebrow: dict.impact.storiesTitle` (or equivalent key) |
| `/news` | L, paginated | `withPagination(buildMetadata({ …, path: '/news', title: dict.news.title, description: dict.news.lead }), { page, hasNext, hasPrev, params: { category } })` | `CollectionPageJsonLd` (items = current page) | default |
| `/news/[slug]` | R | `path: { ar: '/news/' + post.slugAr, en: '/news/' + post.slugEn }`, `title: seoTitle ?? post.title`, `description: seoDescription ?? post.excerpt`, `type: 'article'`, `publishedTime: post.publishedAt`, `modifiedTime: post.updatedAt`, `translationStatus`, `noIndex` | `ArticleJsonLd({ title, description: excerpt, url, locale, publishedAt, updatedAt, image: post.hero ? { url: storageUrl(...), width, height, alt } : null })` + `BreadcrumbJsonLd` | **yes** — `eyebrow: dict.news.category*` label |
| `/partners` | L | `path: '/partners'`, `title: dict.partners.title`, `description: dict.partners.lead` | — | default |
| `/get-involved/partner` | L | `path: '/get-involved/partner'`, title/description from `dict` (SEO-010) | `BreadcrumbJsonLd` | default |
| `/get-involved/volunteer` | L | `path: '/get-involved/volunteer'`, **title from a nav/page key, not `dict.forms.motivation`** (SEO-011 — request `dict.getInvolved.volunteerTitle` if absent) | `BreadcrumbJsonLd` | default |
| `/careers` | L | `path: '/careers'`, `title: dict.careers.title`, `description: dict.careers.lead` | `CollectionPageJsonLd` (open vacancies) | default |
| `/careers/[slug]` | R | `path: { ar: '/careers/' + vacancy.slugAr, en: … }`, `title: seoTitle ?? vacancy.title`, `description: seoDescription ?? richTextToPlainText(vacancy.description, 160)`, `translationStatus`, `noIndex`; add `noIndex: vacancy.noIndex \|\| vacancy.isClosed` — a closed posting must leave the index | `JobPostingJsonLd({ title, description: richTextToPlainText(vacancy.description), url: '/{locale}/careers/' + slug, locale, deadline, postedAt, employmentType, location, org, volunteer: vacancy.type === 'volunteer' })` — **pass `org` and `url`; never `location` as description** (SEO-015) | **yes** — `eyebrow: dict.careers.title` |
| `/verify` | L | `path: '/verify'`, `title: page?.title ?? dict.verify.title`, `description: dict.verify.lead` | `BreadcrumbJsonLd` | default |
| `/contact` | L | `path: '/contact'`, `title: dict.contactPage.title`, `description: dict.contactPage.lead` (SEO-010) | `BreadcrumbJsonLd` | default |
| `/resources` | L | `path: '/resources'`, `title: dict.resources.title`, `description: dict.resources.lead` | `CollectionPageJsonLd` (publications, `url` = the list — no `#fragment` items) | default |
| `/legal/[slug]` | R (by key) | `path: '/legal/' + key` (same in both locales), `title: page.seoTitle ?? page.title`, `description: page.seoDescription`, `translationStatus: page.translationStatus`, `noIndex: page.noIndex` (SEO-014) | `BreadcrumbJsonLd` | default |

Dictionary keys named above that do not exist yet are requests to the i18n owner, listed in the final report.

## 2. Per-template `opengraph-image.tsx` — the pattern

```tsx
// src/app/(site)/[locale]/news/[slug]/opengraph-image.tsx
import { getOgMedia, getOrganization, getPostBySlug } from '@/db/queries/content';
import { prerenderData } from '@/lib/build-time';
import { DEFAULT_LOCALE, isLocale } from '@/lib/i18n/config';
import { getDictionary } from '@/lib/i18n/get-dictionary';
import { OG_CONTENT_TYPE, OG_SIZE, renderOgImage, serveStoredOgImage } from '@/lib/seo/og';

export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const revalidate = 3600;

type Params = { locale: string; slug: string };

export async function generateImageMetadata({ params }: { params: Params }) {
  const locale = isLocale(params.locale) ? params.locale : DEFAULT_LOCALE;
  const post = await prerenderData('og post', () => getPostBySlug(params.slug, locale), null);
  return [{ id: 'card', alt: post?.title ?? '', size: OG_SIZE, contentType: OG_CONTENT_TYPE }];
}

export default async function Image({ params }: { params: Promise<Params> }) {
  const { locale: raw, slug } = await params;
  const locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  const [post, org, dict] = await Promise.all([
    prerenderData('og post', () => getPostBySlug(slug, locale), null),
    prerenderData('og org', () => getOrganization(locale), null),
    getDictionary(locale),
  ]);
  const siteName = org?.shortName ?? org?.legalName ?? org?.acronym ?? '';

  // An editor-chosen card wins over the rendered one.
  if (post?.ogMediaId) {
    const media = await getOgMedia(post.ogMediaId);
    const stored = media ? await serveStoredOgImage(media) : null;
    if (stored) return stored;
  }

  return renderOgImage({
    locale,
    title: post?.title ?? siteName,
    eyebrow: post ? dict.news.title : null,
    siteName,
  });
}
```

Notes:

- `renderOgImage` handles Arabic itself (shaping + word-level RTL layout). Pass plain strings; do not pre-process.
- `accent` accepts a programme `accent_token` (`--color-prog-*`) or a hex; the 2px rule takes that colour. Gold otherwise.
- `twitter-image.tsx` next to it: `export { default, contentType, generateImageMetadata, revalidate, size } from './opengraph-image';`
- No `twitter-image.tsx` is needed on routes that use the site default — `[locale]/twitter-image.tsx` covers them.
- The site-wide default card currently uses the organisation name as its `alt`. When `dict.seo.ogImageAlt` exists, switch `generateImageMetadata` in `[locale]/opengraph-image.tsx` to it.

## 3. `generateStaticParams` (NEXT-001)

News, stories and vacancies have none, so `revalidate` is inert and they are neither prerendered nor ISR. Add, following `projects/[slug]`:

```ts
export async function generateStaticParams() {
  const rows = await prerenderData('static params posts', () => listPostSlugs(), []);
  return rows.flatMap((row) => [
    { locale: 'ar', slug: row.slugAr },
    ...(row.translationStatus === 'ar_only' ? [] : [{ locale: 'en', slug: row.slugEn }]),
  ]);
}
```

(`ar_only` English URLs still render on demand — `dynamicParams` defaults to `true` — they are just not prerendered, matching the sitemap.)

## 4. Layout metadata (route owner — `src/app/(site)/[locale]/layout.tsx`)

Replace the static `metadata` export with `generateMetadata` so the title template carries the organisation's own name (SEO-022):

```tsx
import type { Metadata } from 'next';
import { getOrganization } from '@/db/queries/content';
import { isLocale } from '@/lib/i18n/config';
import { metadataBase, ogLocale } from '@/lib/seo/metadata';

export async function generateMetadata({ params }: LayoutProps<'/[locale]'>): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const org = await getOrganization(locale);
  const siteName = org?.shortName ?? org?.legalName ?? org?.acronym ?? '';

  return {
    metadataBase,
    title: { default: siteName, template: `%s — ${siteName}` },
    description: org?.shortDescription ?? undefined,
    applicationName: siteName,
    robots: { index: true, follow: true },
    openGraph: { siteName, locale: ogLocale(locale), type: 'website' },
    twitter: { card: 'summary_large_image' },
    alternates: {
      types: { 'application/rss+xml': '/feed.xml' },
    },
  };
}
```

Pages override `title`, `description`, `alternates`, `openGraph` and `robots` through `buildMetadata`; the layout's `openGraph` is only the fallback for a page that forgets. The `robots` default here is why every page that must be `noindex` **must** call `buildMetadata` — the static `metadata` export the layout has today would otherwise re-index it.

Also render `<WebSiteJsonLd siteName={siteName} locale={locale} description={org?.shortDescription} />` next to `<OrganizationJsonLd>` in the layout body.

## 5. Verification per route

- `npm run typecheck` · `npm run lint` · `npm run test:unit`.
- In the built HTML: one `<link rel="canonical">`; `hreflang="ar"`, `"en"` and `"x-default"` on a translated page; **no** `hreflang="en"` and `<meta name="robots" content="noindex, follow">` on `/en/…` of an `ar_only` record; `og:image` pointing at `…/opengraph-image/card`; `og:locale` `ar_PS`/`en_US`.
- `curl -I /ar/news/<slug>/opengraph-image/card` → `200 image/png`, and the PNG shows connected, right-to-left Arabic.
