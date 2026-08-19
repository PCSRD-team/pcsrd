# 04 — Design System & Components

Tokens are sampled from the organization's own brochure artwork (spec §13.2). Every component below has a stated props contract.

---

## 1. Tokens — `src/app/globals.css`

Tailwind v4, CSS-first configuration.

```css
@import "tailwindcss";

@theme {
  /* ── Brand — sampled from الملف_التعريفي_انجليزىPCSRD ─────────── */
  --color-navy-900: #182E5D;
  --color-navy-800: #1E3970;
  --color-navy-700: #254284;   /* dominant sampled colour */
  --color-navy-600: #2A4F9F;
  --color-navy-100: #E7EBF4;
  --color-navy-050: #F4F6FB;

  --color-gold-700: #B87B12;   /* darkened for AA text on white */
  --color-gold-600: #DD991C;   /* sampled */
  --color-gold-300: #FBD887;   /* sampled */
  --color-gold-050: #FEF7E7;

  --color-blue-200:  #C8CFE1;
  --color-neutral-500: #B0B0B0;

  /* ── Programme accents ───────────────────────────────────────── */
  --color-prog-protection: #254284;
  --color-prog-response:   #B3591B;
  --color-prog-recovery:   #1F6B54;

  /* ── Semantic ────────────────────────────────────────────────── */
  --color-surface:     #FFFFFF;
  --color-surface-alt: #F6F7FB;
  --color-surface-inv: #182E5D;
  --color-fg:          #12203F;
  --color-fg-muted:    #4A5773;
  --color-fg-inv:      #FFFFFF;
  --color-border:      #DDE3EE;
  --color-ring:        #DD991C;

  --color-success: #1F6B54;
  --color-warning: #B3591B;
  --color-danger:  #A32B2B;
  --color-info:    #254284;

  /* ── Type ────────────────────────────────────────────────────── */
  --font-sans: var(--font-arabic), var(--font-latin), system-ui, sans-serif;
  --font-latin-only: var(--font-latin), system-ui, sans-serif;

  --text-xs:   0.75rem;   --text-sm:   0.875rem;
  --text-base: 1rem;      --text-lg:   1.25rem;
  --text-xl:   1.5625rem; --text-2xl:  1.9375rem;
  --text-3xl:  2.4375rem; --text-4xl:  3.0625rem;

  /* ── Space (4px base) ────────────────────────────────────────── */
  --spacing-section:    4rem;
  --spacing-section-lg: 6rem;

  /* ── Radius ──────────────────────────────────────────────────── */
  --radius-sm: 0.375rem;
  --radius-md: 0.75rem;
  --radius-lg: 1.25rem;

  /* ── Shadow ──────────────────────────────────────────────────── */
  --shadow-sm: 0 1px 2px rgb(18 32 63 / 0.06), 0 1px 3px rgb(18 32 63 / 0.08);
  --shadow-md: 0 4px 12px rgb(18 32 63 / 0.10);
}

/* Arabic needs slightly more size and leading for equivalent legibility. */
:root[dir="rtl"] {
  --body-size: 1.0625rem;
  --body-leading: 1.8;
}
:root[dir="ltr"] {
  --body-size: 1rem;
  --body-leading: 1.65;
}

body { font-size: var(--body-size); line-height: var(--body-leading); }

/* Focus — one rule, everywhere. */
:where(a, button, input, select, textarea, [tabindex]):focus-visible {
  outline: 3px solid var(--color-ring);
  outline-offset: 2px;
  border-radius: var(--radius-sm);
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: .01ms !important;
    transition-duration: .01ms !important;
    scroll-behavior: auto !important;
  }
}
```

> `--color-gold-600` on white is ≈2.4:1 — **large text and UI surfaces only.** `--color-gold-700` (#B87B12) is the AA-compliant variant for gold text on white. This distinction is why there are two gold tokens; do not collapse them.

---

## 2. RTL rules

**One stylesheet serves both directions.** No `[dir]`-duplicated CSS, no second bundle.

| Never | Always |
|---|---|
| `ml-4` / `mr-4` | `ms-4` / `me-4` |
| `pl-6` / `pr-6` | `ps-6` / `pe-6` |
| `left-0` / `right-0` | `start-0` / `end-0` |
| `text-left` / `text-right` | `text-start` / `text-end` |
| `border-l` / `border-r` | `border-s` / `border-e` |
| `rounded-l-*` | `rounded-s-*` |

Directional icons:
```css
[dir="rtl"] .icon-directional { transform: scaleX(-1); }
```
Applied to: chevrons, arrows, back/next controls, breadcrumb separators, pagination arrows. **Not** applied to: logos, checkmarks, external-link icons, the WhatsApp glyph.

**Bidi isolation** — the single most common bilingual bug. Latin text or digits inside an Arabic sentence renders in the wrong order without it:
```tsx
export const Bidi = ({ children }: { children: React.ReactNode }) => (
  <bdi dir="ltr" className="font-[var(--font-latin-only)]">{children}</bdi>
);
```
Mandatory around: phone numbers, email addresses, URLs, latin donor names inside Arabic prose (`UNICEF`, `OCHA`, `ANERA`), licence numbers, and every numeral rendered inside Arabic body copy.

**Testing** — every Playwright visual test runs twice, `ar` and `en`. An RTL break is invisible to an LTR-reading reviewer, so it must be caught by machine.

---

## 3. Component inventory

```
src/components/
├── ui/                      # shadcn primitives (generated)
├── layout/
├── sections/                # homepage + page-level compositions
├── content/                 # entity renderers
├── forms/
├── seo/
└── admin/                   # → 05-ADMIN
```

### 3.1 `ui/` — shadcn primitives to install

`button` · `input` · `textarea` · `select` · `checkbox` · `radio-group` · `label` · `badge` · `card` · `sheet` · `dialog` · `dropdown-menu` · `table` · `tabs` · `sonner` · `alert` · `skeleton` · `separator` · `avatar` · `popover` · `command` (admin search)

**Post-install RTL audit is required** — shadcn ships physical properties in several components. Fix `sheet` (slide direction), `dropdown-menu` (alignment), `dialog` (close-button position), `table` (cell alignment). Do this once, in the generated source, and commit it.

### 3.2 `layout/`

| Component | Type | Props |
|---|---|---|
| `SiteHeader` | RSC | `{ locale, dict, org }` |
| `MainNav` | RSC | `{ locale, dict }` |
| `MobileNav` | CC | `{ locale, dict, org }` |
| `LanguageSwitcher` | CC | `{ locale, alternates?: { ar: string; en: string } }` |
| `SiteFooter` | RSC | `{ locale, dict, org }` |
| `OfficialChannelsBar` | RSC | `{ locale, dict, org }` |
| `SkipLink` | RSC | `{ label }` |
| `Breadcrumbs` | RSC | `{ items: { label, href? }[], locale }` |
| `Container` | RSC | `{ size?: 'default'\|'narrow'\|'wide', children }` |
| `Section` | RSC | `{ tone?: 'default'\|'alt'\|'inverse', spacing?, children }` |
| `PageHeader` | RSC | `{ title, subtitle?, breadcrumbs?, media? }` |
| `Analytics` | CC | `{ nonce? }` |

`LanguageSwitcher` — the equivalent-page requirement:
```tsx
'use client';
import { usePathname, useRouter } from 'next/navigation';
import { otherLocale, type Locale } from '@/i18n/config';

export function LanguageSwitcher({ locale, alternates }: {
  locale: Locale;
  alternates?: { ar: string; en: string };
}) {
  const pathname = usePathname();
  const router = useRouter();
  const target = otherLocale(locale);

  // Prefer the page's own alternate (handles localized slugs);
  // fall back to a prefix swap for static routes.
  const href = alternates?.[target] ?? pathname.replace(`/${locale}`, `/${target}`);

  return (
    <button
      type="button"
      onClick={() => router.push(href)}
      lang={target}
      dir={target === 'ar' ? 'rtl' : 'ltr'}
      className="rounded-full border border-border px-3 py-1.5 text-sm font-medium hover:bg-navy-050"
      aria-label={target === 'ar' ? 'التبديل إلى العربية' : 'Switch to English'}
    >
      {target === 'ar' ? 'ع' : 'EN'}
    </button>
  );
}
```
Pages with localized slugs pass `alternates` down from `generateMetadata`'s data. Without this, switching language on `/ar/programs/الحماية` would produce a 404.

### 3.3 `sections/` — homepage, in render order

Matches spec §8 exactly.

| # | Component | Props |
|---|---|---|
| 1 | `HomeHero` | `{ org, locale, dict, media }` |
| 2 | `CredibilityStrip` | `{ org, membershipCount, locale, dict }` |
| 3 | `AboutTeaser` | `{ org, locale, dict, media }` |
| 4 | `ProgramsGrid` | `{ programs, locale, dict }` |
| 5 | `ImpactStrip` | `{ metrics, locale, dict }` |
| 6 | `WhereWeWork` | `{ governorates, locale, dict }` |
| 7 | `FeaturedProjects` | `{ projects, locale, dict }` |
| 8 | `FeaturedStory` | `{ story, locale, dict }` |
| 9 | `PartnersGrid` | `{ partners, locale, dict }` |
| 10 | `GetInvolvedPanels` | `{ locale, dict, org }` |
| 11 | `LatestNews` | `{ posts, locale, dict }` |

Other page sections: `ProgramHero` · `ProgramAccess` · `ProgramNarrative` · `ProgramInterventions` · `CrossProgramRail` · `ProgramCta` · `GovernanceBoard` · `OrgChart` · `StrategyOverview` · `MembershipList` · `RelatedProjects` · `VerifyChannels` · `ContactRouting` · `WhatsAppCta` · `VerifyChannelsCallout`.

`WhereWeWork` uses an **inline SVG** of the five governorates — not a mapping library. Leaflet or Google Maps would cost 150–300 KB against a 110 KB budget, and this map has five static shapes.

### 3.4 `content/` — entity renderers

| Component | Type | Props |
|---|---|---|
| `ProgramCard` | RSC | `{ program, locale, dict }` |
| `ProjectCard` | RSC | `{ project, locale, dict, variant?: 'default'\|'compact' }` |
| `ProjectGrid` | RSC | `{ items, locale, dict, emptyMessage? }` |
| `ProjectFilters` | CC | `{ facets, active, locale, dict }` |
| `ProjectMeta` | RSC | `{ project, locale, dict }` — dates, governorates, partners, donors |
| `StoryCard` | RSC | `{ story, locale, dict }` |
| `PostCard` | RSC | `{ post, locale, dict, variant?: 'card'\|'list' }` |
| `VacancyCard` | RSC | `{ vacancy, locale, dict }` — renders a deadline state |
| `MetricCard` | RSC | **see below** |
| `PartnerLogo` | RSC | `{ partner, locale }` — text fallback when permission ≠ granted |
| `PersonCard` | RSC | `{ person, locale }` |
| `PublicationCard` | RSC | `{ publication, locale, dict }` |
| `MediaFigure` | RSC | `{ media, locale, sizes, priority? }` |
| `RichText` | RSC | `{ doc: TipTapDoc \| null, locale }` |
| `Prose` | RSC | `{ children }` — typographic wrapper |
| `TargetBadge` | RSC | `{ periodStart, periodEnd, locale, dict }` |
| `EmptyState` | RSC | `{ title, description?, action? }` |
| `Pagination` | RSC | `{ total, page, perPage, dict }` |

`MetricCard` — the period is a required prop, so a bare number cannot be rendered:
```tsx
type MetricCardProps = {
  label: string;
  value: number;
  unit: string;
  displayPrefix?: '+' | '~' | null;
  periodStart: string;      // required
  periodEnd: string;        // required
  status: 'verified' | 'reported' | 'target';
  verificationSource?: string | null;
  locale: Locale;
  dict: Dictionary;
};

export function MetricCard(p: MetricCardProps) {
  return (
    <div className="rounded-md border border-border bg-surface p-6 text-center">
      <div className="text-3xl font-semibold text-navy-700 tabular-nums">
        {p.displayPrefix}<Bidi>{formatNumber(p.value, p.locale)}</Bidi>
      </div>
      <div className="mt-1 text-sm font-medium text-fg">{p.label}</div>
      <div className="mt-2 text-xs text-fg-muted">
        {formatDateRange(p.periodStart, p.periodEnd, p.locale)}
      </div>
      {p.status === 'target' && <TargetBadge {...p} />}
    </div>
  );
}
```

`VacancyCard` deadline states — three, not two:
```tsx
const daysLeft = differenceInDays(new Date(vacancy.deadline), new Date());
// daysLeft < 0   → 'closed'  (muted, "applications closed")
// daysLeft <= 7  → 'closing' (warning tone, "N days remaining")
// otherwise      → 'open'
```

`RichText` — the TipTap node map. This is what makes `dangerouslySetInnerHTML` unnecessary:
```tsx
import type { TipTapDoc, TipTapNode } from '@/types/richtext';

const nodeMap: Record<string, (n: TipTapNode, k: string) => React.ReactNode> = {
  paragraph:  (n, k) => <p key={k} className="mb-4">{renderChildren(n)}</p>,
  heading:    (n, k) => {
    const Tag = `h${Math.min((n.attrs?.level ?? 2) + 1, 6)}` as 'h3';
    return <Tag key={k} className="mt-8 mb-3 font-semibold">{renderChildren(n)}</Tag>;
  },
  bulletList: (n, k) => <ul key={k} className="mb-4 list-disc ps-6">{renderChildren(n)}</ul>,
  orderedList:(n, k) => <ol key={k} className="mb-4 list-decimal ps-6">{renderChildren(n)}</ol>,
  listItem:   (n, k) => <li key={k} className="mb-1">{renderChildren(n)}</li>,
  blockquote: (n, k) => (
    <blockquote key={k} className="my-6 border-s-4 border-gold-600 ps-4 text-fg-muted">
      {renderChildren(n)}
    </blockquote>
  ),
  hardBreak:  (_, k) => <br key={k} />,
  text:       (n, k) => applyMarks(n, k),
  // Unknown node types render NOTHING. Unknown input cannot become output.
};

export function RichText({ doc }: { doc: TipTapDoc | null }) {
  if (!doc?.content) return null;
  return <>{doc.content.map((n, i) => nodeMap[n.type]?.(n, `n-${i}`) ?? null)}</>;
}
```
Marks are allow-listed too: `bold`, `italic`, `link` (external links get `rel="noopener noreferrer"`), `underline`. Anything else is dropped.

### 3.5 `forms/`

| Component | Type | Notes |
|---|---|---|
| `PartnershipForm` | CC | `useActionState(submitPartnership, null)` |
| `ContactForm` | CC | enquiry-type routing |
| `VolunteerForm` | CC | age band + governorate only |
| `JobApplicationForm` | CC | file input, client-side size check before upload |
| `ComplaintForm` | CC | anonymous permitted; **no analytics event** |
| `FraudReportForm` | CC | optional reporter contact |
| `TurnstileWidget` | CC | loads the script once, per-form instance |
| `FormField` | RSC | label + control + error, `aria-describedby` wired |
| `FieldError` | RSC | icon + text; never colour alone |
| `FormStatus` | CC | `aria-live="polite"` result region |
| `SubmitButton` | CC | `useFormStatus()` pending state |
| `HoneypotField` | RSC | visually hidden, `tabIndex={-1}`, `autoComplete="off"` |

Reference form:
```tsx
'use client';
import { useActionState } from 'react';
import { submitPartnership } from '@/app/(site)/[locale]/get-involved/partner/actions';

export function PartnershipForm({ locale, dict }: { locale: Locale; dict: Dictionary }) {
  const [state, formAction] = useActionState(submitPartnership, null);

  if (state?.ok) {
    return (
      <FormSuccess
        title={dict.forms.partnership.successTitle}
        body={dict.forms.partnership.successBody}
        reference={state.data.reference}
      />
    );
  }

  return (
    <form action={formAction} noValidate className="grid gap-5">
      <input type="hidden" name="locale" value={locale} />
      <HoneypotField />

      <FormField
        name="organizationName"
        label={dict.forms.partnership.organizationName}
        required
        error={state?.fieldErrors?.organizationName?.[0]}
      >
        <Input name="organizationName" required minLength={2} maxLength={120} autoComplete="organization" />
      </FormField>

      {/* … remaining fields … */}

      <TurnstileWidget locale={locale} />

      <FormStatus state={state} dict={dict} />
      <SubmitButton label={dict.forms.submit} pendingLabel={dict.forms.submitting} />

      <p className="text-sm text-fg-muted">
        {dict.forms.emailFallback}{' '}
        <Bidi><a href={`mailto:${ORG_EMAIL}`} className="underline">{ORG_EMAIL}</a></Bidi>
      </p>
    </form>
  );
}
```

The email fallback line is not decoration — on the connections described in spec §12.3, a form submission can fail and the visitor needs a route that does not depend on the site working.

### 3.6 `seo/`

`OrganizationJsonLd` · `BreadcrumbJsonLd` · `ServiceJsonLd` · `ArticleJsonLd` · `JobPostingJsonLd` · `WebSiteJsonLd`.

All render a `<script type="application/ld+json">` with `JSON.stringify` — never string concatenation, which is a JSON-injection vector when content contains quotes.

```tsx
export function OrganizationJsonLd({ org, locale }: { org: Organization; locale: Locale }) {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'NGO',
    name: locale === 'ar' ? org.legalNameAr : org.legalNameEn,
    alternateName: org.alternateNames,          // every historic variant — spec C1c
    foundingDate: String(org.foundedYear),
    identifier: org.licenseNumber,
    url: process.env.NEXT_PUBLIC_SITE_URL,
    logo: org.logoUrl,
    areaServed: { '@type': 'AdministrativeArea', name: 'Gaza Strip' },
    contactPoint: [{
      '@type': 'ContactPoint',
      telephone: org.primaryPhone,
      email: org.email,
      contactType: 'general',
      availableLanguage: ['ar', 'en'],
    }],
    sameAs: org.socials.filter(s => s.isOfficial).map(s => s.url),
  };
  return <script type="application/ld+json"
    dangerouslySetInnerHTML={undefined}
    // eslint-disable-next-line react/no-danger  -- JSON-LD only, JSON.stringify escaped
    {...{ dangerouslySetInnerHTML: { __html: JSON.stringify(data) } }} />;
}
```
> This is the **single** permitted exception to rule 1, and it is annotated as such. `JSON.stringify` output inside a `ld+json` script is not an HTML parsing context. Add an ESLint override scoped to `src/components/seo/*` only.

---

## 4. Responsive & breakpoints

| Token | Width | Notes |
|---|---|---|
| base | 0–639 | Design target. Single column throughout |
| `sm` | 640 | 2-col cards |
| `md` | 768 | Desktop nav appears |
| `lg` | 1024 | 3-col grids; filter sidebar |
| `xl` | 1280 | Max content width 1200px |

Container: `w-full max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8`. Narrow variant `max-w-[720px]` for prose (65–75ch measure).

---

## 5. Accessibility checklist per component

Enforced in review; `axe-core` runs in CI and in the Playwright suite.

| Component | Requirement |
|---|---|
| `MobileNav` | Focus trapped while open; `Esc` closes; focus returns to the trigger; `aria-expanded` on the trigger |
| `LanguageSwitcher` | `aria-label` in the **target** language; `lang` attribute on the control |
| `ProjectFilters` | `fieldset`/`legend` per group; result count in an `aria-live="polite"` region |
| `Pagination` | `<nav aria-label>`; current page `aria-current="page"` |
| `MetricCard` | Period is text, not a `title` attribute |
| `VacancyCard` | Deadline state conveyed by text, not colour alone |
| `MediaFigure` | `alt` required by TypeScript; `alt=""` only when explicitly `decorative` |
| Forms | Programmatic labels; `aria-describedby` errors; focus to the first invalid field; `aria-live` summary |
| `RichText` | Heading levels shift down one (`h2` in the editor → `h3` in the page) so page `h1` uniqueness holds |
| `SkipLink` | First focusable element; visible on focus |
| Icon-only buttons | `aria-label` always |

---

## 6. Content-state matrix

Every list and detail component handles four states. Missing the last two is the most common source of production bugs on a bilingual, partially-translated site.

| State | Handling |
|---|---|
| Loading | `loading.tsx` skeletons matching the final layout (prevents CLS) |
| Loaded | Normal |
| Empty | `EmptyState` with a localized message and a route out — never a blank region |
| **Untranslated** | English route, `translation_status = 'ar_only'` → render the Arabic body inside a bordered notice: *"English translation coming soon"*. `hreflang` omitted for that page and `robots: noindex` set. **Never** auto-translate, never show a blank page (spec §21.5) |
