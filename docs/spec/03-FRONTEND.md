# 03 — Frontend Structure

Next.js App Router. Every file below is listed with its purpose, rendering mode, and data source.

**Legend** — `RSC` server component (default) · `CC` client component · `SSG` statically generated · `ISR` revalidated · `DYN` dynamic

---

## 1. Route inventory

24 public routes × 2 locales. Every one traces to a page spec in `PCSRD-Website-Specification.md §7`.

| Route | File | Mode | Data |
|---|---|---|---|
| `/{locale}` | `(site)/[locale]/page.tsx` | SSG+ISR | org, programs, featured metrics/projects/story/partners/posts |
| `/{locale}/about` | `about/page.tsx` | SSG+ISR | org, partners(memberships) |
| `/{locale}/about/vision-mission` | `about/vision-mission/page.tsx` | SSG+ISR | org |
| `/{locale}/about/governance` | `about/governance/page.tsx` | SSG+ISR | people(is_public), org |
| `/{locale}/about/strategy` | `about/strategy/page.tsx` | SSG+ISR | org, target metrics, publications(strategy) |
| `/{locale}/about/memberships` | `about/memberships/page.tsx` | SSG+ISR | partners(network,membership) |
| `/{locale}/programs` | `programs/page.tsx` | SSG+ISR | programs |
| `/{locale}/programs/[slug]` | `programs/[slug]/page.tsx` | SSG+ISR | program, metrics, projects, stories, partners |
| `/{locale}/projects` | `projects/page.tsx` | DYN (cached per filter) | projects + facets |
| `/{locale}/projects/[slug]` | `projects/[slug]/page.tsx` | SSG+ISR | project, partners, media, stories, posts |
| `/{locale}/impact` | `impact/page.tsx` | SSG+ISR | verified metrics, featured stories |
| `/{locale}/impact/stories/[slug]` | `impact/stories/[slug]/page.tsx` | SSG+ISR | story, project, media |
| `/{locale}/news` | `news/page.tsx` | DYN (cached per category/page) | posts |
| `/{locale}/news/[slug]` | `news/[slug]/page.tsx` | SSG+ISR | post, related |
| `/{locale}/partners` | `partners/page.tsx` | SSG+ISR | partners grouped by type |
| `/{locale}/get-involved` | `get-involved/page.tsx` | SSG | static |
| `/{locale}/get-involved/partner` | `get-involved/partner/page.tsx` | SSG | org, publications(dossier) |
| `/{locale}/get-involved/volunteer` | `get-involved/volunteer/page.tsx` | SSG+ISR | page content |
| `/{locale}/get-involved/support` | `get-involved/support/page.tsx` | SSG+ISR | org (WhatsApp) |
| `/{locale}/careers` | `careers/page.tsx` | ISR (300s) | open vacancies |
| `/{locale}/careers/[slug]` | `careers/[slug]/page.tsx` | ISR (300s) | vacancy |
| `/{locale}/verify` | `verify/page.tsx` | SSG+ISR | org.officialChannels, page('verify') |
| `/{locale}/contact` | `contact/page.tsx` | SSG+ISR | org |
| `/{locale}/resources` | `resources/page.tsx` | SSG+ISR | publications |
| `/{locale}/legal/[slug]` | `legal/[slug]/page.tsx` | SSG+ISR | page(key) |

`careers` uses a 300-second revalidate rather than the 3600 default: a deadline that has passed must stop showing quickly, and the cron job (`02-API §6.3`) is the belt to this suspenders.

---

## 2. Complete file tree

```
src/app/
├── globals.css                              # Tailwind v4 @theme + tokens (04-DESIGN-SYSTEM)
├── layout.tsx                               # RSC — <html> shell only; no locale here
├── not-found.tsx                            # root 404 (non-localized paths)
├── global-error.tsx                         # CC — last-resort boundary
├── sitemap.ts                               # locale-aware, alternates.languages
├── robots.ts
├── manifest.ts
│
├── (site)/
│   └── [locale]/
│       ├── layout.tsx                       # RSC — lang/dir, fonts, header, footer, skip link
│       ├── loading.tsx                      # RSC — skeleton
│       ├── error.tsx                        # CC — localized error boundary
│       ├── not-found.tsx                    # RSC — localized 404
│       ├── page.tsx                         # HOME
│       ├── opengraph-image.tsx              # default OG (next/og)
│       │
│       ├── about/
│       │   ├── page.tsx
│       │   ├── vision-mission/page.tsx
│       │   ├── governance/page.tsx
│       │   ├── strategy/page.tsx
│       │   └── memberships/page.tsx
│       │
│       ├── programs/
│       │   ├── page.tsx
│       │   └── [slug]/
│       │       ├── page.tsx
│       │       └── opengraph-image.tsx
│       │
│       ├── projects/
│       │   ├── page.tsx                     # searchParams-driven facets
│       │   ├── loading.tsx
│       │   └── [slug]/
│       │       ├── page.tsx
│       │       └── opengraph-image.tsx
│       │
│       ├── impact/
│       │   ├── page.tsx
│       │   └── stories/[slug]/
│       │       ├── page.tsx
│       │       └── opengraph-image.tsx
│       │
│       ├── news/
│       │   ├── page.tsx
│       │   └── [slug]/
│       │       ├── page.tsx
│       │       └── opengraph-image.tsx
│       │
│       ├── partners/page.tsx
│       │
│       ├── get-involved/
│       │   ├── page.tsx
│       │   ├── partner/
│       │   │   ├── page.tsx
│       │   │   └── actions.ts               # submitPartnership
│       │   ├── volunteer/
│       │   │   ├── page.tsx
│       │   │   └── actions.ts               # submitVolunteer
│       │   └── support/page.tsx             # WhatsApp only
│       │
│       ├── careers/
│       │   ├── page.tsx
│       │   └── [slug]/
│       │       ├── page.tsx
│       │       └── actions.ts               # submitJobApplication
│       │
│       ├── verify/
│       │   ├── page.tsx
│       │   └── actions.ts                   # submitFraudReport
│       │
│       ├── contact/
│       │   ├── page.tsx
│       │   └── actions.ts                   # submitContact + submitComplaint
│       │
│       ├── resources/page.tsx
│       └── legal/[slug]/page.tsx
│
├── (admin)/
│   └── admin/                               # → 05-ADMIN
│
└── api/
    ├── health/route.ts
    ├── cron/
    │   ├── archive-expired/route.ts
    │   └── purge-submissions/route.ts
    └── admin/
        ├── media/route.ts
        └── submissions/[id]/attachment/route.ts

src/app/feed.xml/route.ts                    # RSS
```

---

## 3. Layouts

`src/app/layout.tsx` — deliberately minimal. `lang` and `dir` cannot be set here because the locale is not known at this level.
```tsx
import type { ReactNode } from 'react';
import '@/app/globals.css';

export default function RootLayout({ children }: { children: ReactNode }) {
  return children;   // (site)/[locale]/layout.tsx renders <html>
}
```

`src/app/(site)/[locale]/layout.tsx`
```tsx
import { notFound } from 'next/navigation';
import { headers } from 'next/headers';
import { locales, dirOf, type Locale } from '@/i18n/config';
import { getDictionary } from '@/i18n/get-dictionary';
import { getOrganization } from '@/db/queries/organization';
import { arabicFont, latinFont } from '@/styles/fonts';
import { SkipLink } from '@/components/layout/SkipLink';
import { SiteHeader } from '@/components/layout/SiteHeader';
import { SiteFooter } from '@/components/layout/SiteFooter';
import { OfficialChannelsBar } from '@/components/layout/OfficialChannelsBar';
import { Analytics } from '@/components/layout/Analytics';
import { OrganizationJsonLd } from '@/components/seo/OrganizationJsonLd';

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export default async function SiteLayout({
  children, params,
}: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!locales.includes(locale as Locale)) notFound();
  const l = locale as Locale;

  const [dict, org, nonce] = await Promise.all([
    getDictionary(l),
    getOrganization(l),
    headers().then((h) => h.get('x-nonce') ?? undefined),
  ]);

  return (
    <html lang={l} dir={dirOf(l)}
          className={`${arabicFont.variable} ${latinFont.variable}`}
          suppressHydrationWarning>
      <body className="min-h-dvh bg-surface text-fg antialiased font-sans">
        <SkipLink label={dict.a11y.skipToContent} />
        <SiteHeader locale={l} dict={dict} org={org} />
        <main id="main" className="min-h-[60vh]">{children}</main>
        <OfficialChannelsBar locale={l} dict={dict} org={org} />
        <SiteFooter locale={l} dict={dict} org={org} />
        <OrganizationJsonLd org={org} locale={l} />
        <Analytics nonce={nonce} />
      </body>
    </html>
  );
}
```

Two details that matter: `dict` and `org` are fetched **once per request in the layout** and passed down as props, so no child re-queries them; and the dictionary is a plain object passed to RSC children — it never crosses into a client bundle.

---

## 4. Client component allow-list

Everything else is a Server Component. Adding to this list requires a justification in the PR (`00-ARCHITECTURE §0.9 rule 3`).

| Component | Why it must be client |
|---|---|
| `LanguageSwitcher` | Reads `usePathname()` to build the mirrored URL |
| `MobileNav` | Sheet open/close state, focus trap |
| `ProjectFilters` | Writes `searchParams` via `useRouter().replace()` |
| `*Form` (6) | `useActionState`, `useFormStatus`, inline validation |
| `TurnstileWidget` | Third-party script + widget lifecycle |
| `MediaGallery` (Phase 2) | Lightbox |
| `CopyButton` | Clipboard API |
| `Analytics` | Injects the beacon |
| Admin: `DataTable`, `RichTextEditor`, `MediaPicker`, `BilingualField`, `PublishBar`, `ConfirmDialog` | Interactive by nature; admin is not perf-budgeted |

Estimated public-route client JS: **~28–45 KB gzipped**, well inside the 110 KB budget. The homepage ships only `LanguageSwitcher` + `MobileNav` + `Analytics`.

---

## 5. i18n implementation

```
src/i18n/
├── config.ts
├── get-dictionary.ts
├── dictionaries/
│   ├── ar.json
│   └── en.json
└── routing.ts        # localized slug ↔ canonical path mapping
```

`src/i18n/config.ts`
```ts
export const locales = ['ar', 'en'] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = 'ar';
export const dirOf = (l: Locale) => (l === 'ar' ? 'rtl' : 'ltr') as const;
export const isRtl  = (l: Locale) => l === 'ar';
export const otherLocale = (l: Locale): Locale => (l === 'ar' ? 'en' : 'ar');
export const ogLocale = (l: Locale) => (l === 'ar' ? 'ar_PS' : 'en_US');
```

`src/i18n/get-dictionary.ts`
```ts
import 'server-only';
import { cache } from 'react';
import type { Locale } from './config';

const loaders = {
  ar: () => import('./dictionaries/ar.json').then((m) => m.default),
  en: () => import('./dictionaries/en.json').then((m) => m.default),
} as const;

export const getDictionary = cache(async (locale: Locale) => loaders[locale]());
export type Dictionary = Awaited<ReturnType<typeof getDictionary>>;
```

`'server-only'` is the guard that makes rule 3 enforceable: importing a dictionary into a client component becomes a build error, not a review comment.

**Dictionary namespaces** (~220 keys): `nav` · `footer` · `common` · `home` · `about` · `programs` · `projects` · `impact` · `news` · `careers` · `getInvolved` · `verify` · `contact` · `forms` · `errors` · `a11y` · `seo` · `meta`.

**Number & date formatting** — `src/lib/format.ts`:
```ts
export const formatNumber = (n: number, locale: Locale) =>
  new Intl.NumberFormat(locale === 'ar' ? 'ar-EG-u-nu-latn' : 'en-US').format(n);

export const formatDate = (d: Date | string, locale: Locale) =>
  new Intl.DateTimeFormat(locale === 'ar' ? 'ar-EG-u-nu-latn' : 'en-GB',
    { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(d));
```
`-u-nu-latn` forces Latin digits inside Arabic formatting — the default for this project (spec §13.3, open question C8). Flipping to Eastern Arabic numerals later is a one-line change in this file, which is exactly why it lives here and not inline.

---

## 6. Page implementation patterns

### 6.1 Static content page — `/programs/[slug]`

```tsx
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { locales, ogLocale, type Locale } from '@/i18n/config';
import { getDictionary } from '@/i18n/get-dictionary';
import { getProgramBySlug, listProgramSlugs } from '@/db/queries/programs';
import { listPublicMetrics } from '@/db/queries/metrics';
import { listProjects } from '@/db/queries/projects';

type Props = { params: Promise<{ locale: Locale; slug: string }> };

export const revalidate = 3600;

export async function generateStaticParams() {
  const slugs = await listProgramSlugs();          // [{ ar, en }, …]
  return locales.flatMap((locale) =>
    slugs.map((s) => ({ locale, slug: locale === 'ar' ? s.ar : s.en })));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  const program = await getProgramBySlug(slug, locale);
  if (!program) return {};

  const path = `/${locale}/programs/${slug}`;
  return {
    title: program.seoTitle ?? program.title,
    description: program.seoDescription ?? program.tagline ?? undefined,
    alternates: {
      canonical: path,
      languages: {
        ar: `/ar/programs/${program.slugAr}`,
        en: `/en/programs/${program.slugEn}`,
        'x-default': `/ar/programs/${program.slugAr}`,
      },
    },
    openGraph: {
      type: 'article',
      locale: ogLocale(locale),
      alternateLocale: ogLocale(locale === 'ar' ? 'en' : 'ar'),
      images: [{ url: `${path}/opengraph-image`, width: 1200, height: 630 }],
    },
    robots: program.noIndex ? { index: false, follow: false } : undefined,
  };
}

export default async function ProgramPage({ params }: Props) {
  const { locale, slug } = await params;

  const program = await getProgramBySlug(slug, locale);
  if (!program) notFound();

  // Dependent queries run in parallel once the program id is known.
  const [dict, metrics, projects] = await Promise.all([
    getDictionary(locale),
    listPublicMetrics(locale, { programKey: program.key }),
    listProjects(locale, { program: program.key, page: 1 }),
  ]);

  return (
    <>
      <ProgramHero program={program} dict={dict} />
      {metrics.length > 0 && <MetricStrip metrics={metrics} locale={locale} />}
      <ProgramAccess program={program} dict={dict} locale={locale} />   {/* eligibility + how to access */}
      <ProgramNarrative program={program} dict={dict} />
      <ProgramInterventions program={program} />
      {projects.items.length > 0 && (
        <RelatedProjects items={projects.items} locale={locale} dict={dict} />
      )}
      <CrossProgramRail current={program.key} locale={locale} dict={dict} />
      <ProgramCta program={program} locale={locale} dict={dict} />
      <ServiceJsonLd program={program} locale={locale} />
    </>
  );
}
```

`ProgramAccess` sits high on the page — above the institutional narrative — because the beneficiary persona needs eligibility and contact before a donor needs the rationale (spec §7.1).

### 6.2 Faceted page — `/projects`

```tsx
type Props = {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ProjectsPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const raw = await searchParams;

  // Never trust searchParams — parse through Zod, drop anything invalid.
  const filters = parseProjectFilters(raw);

  const [dict, data, facets] = await Promise.all([
    getDictionary(locale),
    listProjects(locale, filters),
    getProjectFacets(locale),
  ]);

  return (
    <>
      <PageHeader title={dict.projects.title} subtitle={dict.projects.subtitle} />
      <div className="container grid gap-8 lg:grid-cols-[280px_1fr]">
        <ProjectFilters facets={facets} active={filters} dict={dict} locale={locale} />
        <div>
          <ResultCount total={data.total} dict={dict} locale={locale} />
          <ProjectGrid items={data.items} locale={locale} dict={dict} />
          <Pagination total={data.total} page={data.page} perPage={data.perPage} dict={dict} />
        </div>
      </div>
    </>
  );
}
```

`ProjectFilters` is the only client component here, and it does exactly one thing: rewrite `searchParams`. The grid stays server-rendered, so filtered views are crawlable, shareable, and back-button-correct.

`src/lib/filters/projects.ts`
```ts
import { z } from 'zod';

const filtersSchema = z.object({
  program:      z.enum(['protection','humanitarian_response','early_recovery']).optional(),
  gov:          z.union([z.string(), z.array(z.string())]).optional(),
  theme:        z.union([z.string(), z.array(z.string())]).optional(),
  year:         z.coerce.number().int().min(2015).max(2100).optional(),
  state:        z.enum(['planned','active','completed']).optional(),
  page:         z.coerce.number().int().min(1).max(500).default(1),
});

const toArray = (v: unknown) => (Array.isArray(v) ? v : v ? [v as string] : []);

export function parseProjectFilters(raw: Record<string, unknown>) {
  const p = filtersSchema.safeParse(raw);
  if (!p.success) return { page: 1 };
  return {
    program: p.data.program,
    governorates: toArray(p.data.gov).filter(isGovernorate),
    themes: toArray(p.data.theme).filter(isThemeTag),
    year: p.data.year,
    state: p.data.state,
    page: p.data.page,
  };
}
```

### 6.3 The support page — WhatsApp only

```tsx
export default async function SupportPage({ params }: Props) {
  const { locale } = await params;
  const [dict, org] = await Promise.all([getDictionary(locale), getOrganization(locale)]);

  return (
    <>
      <PageHeader title={dict.getInvolved.support.title} />
      <Prose>{/* how support currently reaches the organization */}</Prose>

      <WhatsAppCta
        number={org.whatsappNumber}
        message={dict.getInvolved.support.waMessage}
        label={dict.getInvolved.support.waCta}
        locale={locale}
        eventName="support_whatsapp_click"
      />

      <VerifyChannelsCallout locale={locale} dict={dict} />
    </>
  );
}
```

`src/lib/whatsapp.ts`
```ts
import type { Locale } from '@/i18n/config';

/** wa.me requires digits only — no +, no spaces, no dashes. */
export function buildWhatsAppUrl(opts: {
  number: string | null;
  message?: string;
  context?: string;
}): string | null {
  if (!opts.number) return null;
  const digits = opts.number.replace(/\D/g, '');
  if (digits.length < 8) return null;
  const text = [opts.message, opts.context].filter(Boolean).join('\n\n');
  const qs = text ? `?text=${encodeURIComponent(text)}` : '';
  return `https://wa.me/${digits}${qs}`;
}
```

Prefilled messages live in the dictionaries, so an Arabic visitor opens WhatsApp with an Arabic message already typed — a small thing that measurably raises completion.

Used in four places: `/get-involved/support`, `OfficialChannelsBar`, `/contact`, and every programme page CTA (with `context` set to the programme name so the org knows what the enquiry is about before reading it).

---

## 7. Metadata, sitemap, OG

`src/app/sitemap.ts`
```ts
import type { MetadataRoute } from 'next';
import { locales } from '@/i18n/config';
import { getAllSitemapEntries } from '@/db/queries/sitemap';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.NEXT_PUBLIC_SITE_URL!;
  const entries = await getAllSitemapEntries();   // static routes + every published slug pair

  return entries.flatMap((e) =>
    locales.map((locale) => ({
      url: `${base}/${locale}${e.path[locale]}`,
      lastModified: e.updatedAt,
      changeFrequency: e.changeFrequency,
      priority: e.priority,
      alternates: {
        languages: {
          ar: `${base}/ar${e.path.ar}`,
          en: `${base}/en${e.path.en}`,
        },
      },
    })),
  );
}
```

**OG images** — `opengraph-image.tsx` per template using `next/og`. Arabic text in Satori requires the font as an `ArrayBuffer`:
```tsx
import { ImageResponse } from 'next/og';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function OgImage({ params }: { params: Promise<{ locale: Locale; slug: string }> }) {
  const { locale, slug } = await params;
  const project = await getProjectBySlug(slug, locale);
  const font = await fetch(new URL('../../../../public/fonts/ibm-plex-arabic-600.ttf', import.meta.url))
    .then((r) => r.arrayBuffer());

  return new ImageResponse(
    (
      <div style={{ display:'flex', flexDirection:'column', justifyContent:'space-between',
                    width:'100%', height:'100%', padding:64, background:'#254284', color:'#fff',
                    direction: locale === 'ar' ? 'rtl' : 'ltr' }}>
        <div style={{ fontSize:28, opacity:.8 }}>{project?.programTitle}</div>
        <div style={{ fontSize:64, lineHeight:1.2, fontWeight:600 }}>{project?.title}</div>
        <div style={{ fontSize:24, opacity:.8 }}>{ORG_SHORT[locale]}</div>
      </div>
    ),
    { ...size, fonts: [{ name: 'IBMPlexArabic', data: font, weight: 600, style: 'normal' }] },
  );
}
```

Social sharing is this organization's dominant distribution channel, so per-template OG is not a nicety — it is the highest-CTR surface on the project.

---

## 8. `next.config.ts`

```ts
import type { NextConfig } from 'next';
import { getRedirects } from './scripts/build-redirects';   // reads the redirects table at build

const config: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  compress: true,

  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [{ protocol: 'https', hostname: '*.supabase.co', pathname: '/storage/v1/object/public/**' }],
    deviceSizes: [360, 420, 640, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 2592000,
  },

  experimental: {
    optimizePackageImports: ['lucide-react'],
  },

  async redirects() {
    return [
      { source: '/', destination: '/ar', permanent: false },
      ...(await getRedirects()),          // build-time DB read, zero runtime cost
    ];
  },

  async headers() {
    return [{
      source: '/fonts/:path*',
      headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
    }];
  },

  typescript: { ignoreBuildErrors: false },
  eslint: { ignoreDuringBuilds: false },
};

export default config;
```

---

## 9. Performance implementation

| Budget item | How it is met |
|---|---|
| JS ≤ 110 KB | RSC by default; 9-item client allow-list (§4) |
| Fonts ≤ 120 KB | `next/font/local`, subsetted WOFF2, 2 weights per script, `display: 'swap'`, `adjustFontFallback` |
| Hero ≤ 120 KB | AVIF via `next/image`, `priority`, explicit `sizes`, `placeholder="blur"` from the stored `blurDataUrl` |
| LCP < 2.5 s | Hero **text** renders from HTML — never blocked on the image. Static HTML from the CDN edge |
| CLS < 0.05 | Every image has width/height; font fallback metrics matched; no injected banners; no count-up |
| No third-party JS | No maps, no social embeds, no tag manager, no chat widget. Turnstile loads **only** on the four routes that have forms |
| RTL without a second bundle | Logical properties throughout (`04-DESIGN-SYSTEM §2`) |

`src/styles/fonts.ts`
```ts
import localFont from 'next/font/local';

export const arabicFont = localFont({
  src: [
    { path: '../../public/fonts/ibm-plex-arabic-400.woff2', weight: '400', style: 'normal' },
    { path: '../../public/fonts/ibm-plex-arabic-600.woff2', weight: '600', style: 'normal' },
  ],
  variable: '--font-arabic',
  display: 'swap',
  preload: true,
  adjustFontFallback: 'Arial',
});

export const latinFont = localFont({
  src: [
    { path: '../../public/fonts/ibm-plex-sans-400.woff2', weight: '400', style: 'normal' },
    { path: '../../public/fonts/ibm-plex-sans-600.woff2', weight: '600', style: 'normal' },
  ],
  variable: '--font-latin',
  display: 'swap',
  preload: true,
});
```

`scripts/subset-fonts.sh` runs `pyftsubset` over Arabic + Latin + digits + punctuation ranges. Unsubsetted Arabic families routinely exceed 300 KB per weight — subsetting is what makes the budget reachable at all.
