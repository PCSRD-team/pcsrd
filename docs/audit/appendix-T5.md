# Track T5 — Next.js Correctness (raw findings)

Working file. Merged into `01-AUDIT-REPORT.md`.

## Verification note — NEXT-006 REFUTED

The track reported (as T7 independently did) that the admin CSP nonce never reaches the
HTML and that two competing CSP headers are emitted on `/admin`. Both halves were checked
against `node_modules/next/dist/docs/` and were a reasonable reading. **Both are wrong in
Next 16.3.1.** Measured against the running production server, single request:

```
HEADER nonce: nonce-7b618f6c45f34bb8bd470b6d53af9caa
BODY   nonce: nonce="7b618f6c45f34bb8bd470b6d53af9caa"   → MATCH
script tags: 11 total, 11 carrying the nonce
curl -sI /admin/login | grep -ci content-security-policy → 1
curl -sI /ar          | grep -ci content-security-policy → 1
```

The proxy's `response.headers.set` replaces the `next.config.ts` header on `/admin`; the
config header applies unchanged on `(site)`. **NEXT-006 is struck** (with SEC-003 and
SEC-008, which are the same claim from the security track).

---

## NEXT-001 — Three slugged routes have no `generateStaticParams`, so `revalidate = 3600` is inert
**P1 · [VERIFIED-CODE]**

Evidence: `src/app/(site)/[locale]/careers/[slug]/page.tsx:15`,
`news/[slug]/page.tsx:15`, `impact/stories/[slug]/page.tsx:10` — each exports
`revalidate` with no `generateStaticParams`. Repo-wide, `generateStaticParams` exists only
in `[locale]/layout.tsx:20`, `legal/[slug]:19`, `programs/[slug]:19`, `projects/[slug]:17`.
`node_modules/next/dist/docs/.../generate-static-params.md:57` — a dynamic segment must
return at least an empty array to participate in ISR.

Impact: every visit to a news article, a vacancy or an impact story pays a live Supabase
round trip from `hnd1`. The build table confirms all three render as `ƒ`. Compounds
NEXT-012 — these pages are neither prerendered nor in the sitemap.

Fix: add `generateStaticParams` to each, following `projects/[slug]:17-22`; needs
`listPostSlugs` / `listStorySlugs` / `listVacancySlugs` in `src/db/queries/content.ts`.
`return []` alone is the documented minimum and converts them to ISR-on-first-visit.

Effort: M · Verification: `npm run build` — the three routes move from `ƒ` to `●`.

---

## NEXT-002 — No `loading.tsx` anywhere
**P2 · [VERIFIED-CODE]**

Evidence: `find src/app -name "loading.tsx"` → nothing. `docs/spec/03-FRONTEND.md:60,81`
requires it. The five dynamic routes each await a DB read with no Suspense boundary above
them (e.g. `projects/page.tsx:81-85`).

Impact: on `/projects` with filters — the slowest page, three queries plus facets — a
client-side navigation shows the previous page frozen until the server responds. Violates
the project's own non-negotiable #10.

Fix: `src/app/(site)/[locale]/loading.tsx` from the skeleton in
`docs/design_handoff/design/PCSRD States & Audit.dc.html`, plus
`src/app/(admin)/admin/loading.tsx` — the whole admin tree is `force-dynamic`.

Effort: M

---

## NEXT-003 — No `global-error.tsx`; the admin tree has no error boundary at all
**P2 · [VERIFIED-CODE]**

Evidence: only `src/app/(site)/[locale]/error.tsx` exists. `[locale]/layout.tsx:31` awaits
`getDictionary` + `getOrganization` **in the same segment** as that boundary, so the
boundary cannot catch it. `(admin)/admin/layout.tsx:48-51` awaits
`getCurrentProfileDetail()` and `getDashboard(actor)` with no boundary below the root.

Impact: a Supabase outage during `getOrganization` takes every `(site)` page to Next's
unstyled built-in error screen, not the bilingual boundary. Any admin throw does the same —
staff see a blank English error page on an Arabic-only RTL admin.

Fix: add `src/app/global-error.tsx` and `src/app/(admin)/admin/error.tsx`; consider moving
the org read out of the layout so `error.tsx` can catch it.

Effort: M

---

## NEXT-004 — No root `not-found.tsx`
**P2 · [VERIFIED-CODE]**

Evidence: only `[locale]/not-found.tsx` exists. `src/proxy.ts:23-33` lets `/api/*`,
`/feed.xml`, `/sitemap.xml`, `/robots.txt`, `/favicon.ico`, `/opensearch.xml` through
unprefixed; a miss on any falls to the root 404, which renders inside
`src/app/layout.tsx`'s `<html>` with no `lang` and no `dir`.

Fix: add `src/app/not-found.tsx`; the existing bilingual `[locale]/not-found.tsx` can be
re-exported verbatim.

Effort: S

---

## NEXT-005 — No `manifest.ts`, no `opengraph-image.tsx`, no favicon or app icon
**P2 · [VERIFIED-CODE]**

Evidence: `find` for `manifest.ts`, `opengraph-image*`, `icon*`, `apple-icon*` → nothing.
`ls public` → the five untouched create-next-app SVGs. `docs/spec/03-FRONTEND.md:55`
requires `manifest.ts`; `:64,77,84,90,96` require per-template OG images; `:329` shows
metadata pointing at `${path}/opengraph-image`. No page sets `openGraph.images`.

Impact: every share of a PCSRD link on WhatsApp, Facebook or X — the exact channels
`/verify` exists to authenticate — renders as a bare text link with no image and no site
icon. For an organisation whose stated threat model is impersonation, an unbranded link
preview is a material weakness, not polish.

Fix: add `src/app/icon.svg`, `apple-icon.png`, `manifest.ts`, and
`(site)/[locale]/opengraph-image.tsx` using `next/og` (spec `:516` documents that Arabic
in Satori needs the font as an `ArrayBuffer`). Delete the scaffold SVGs.

Effort: L

---

## NEXT-007 — Detail queries register the *list* tag; the per-slug item tags are computed but registered by nothing
**P2 · [VERIFIED-CODE]**

Evidence: `src/db/queries/content.ts:228` — `getPostBySlug` is cached with
`{ tags: [TAGS.postList] }`. Same at `:283`, `:350`, `:487`, and
`src/db/queries/projects.ts:226`. All 17 `tags:` registrations repo-wide are `*List`
constants. `src/lib/cache/tags.ts:103-109` computes `TAGS.post(slug)` etc. regardless.

Impact: not staleness — the list tag is a superset, so content is always fresh. It is
over-invalidation plus dead code: publishing one news item drops the cache entry for every
post detail page and every post list. And the "both slugs are always busted" comment at
`tags.ts:94-97` describes behaviour that does not happen, so a future reader trusts
granularity that is not there.

Fix: either register the item tag per detail query, or delete `ITEM_TAG` and the slug
branch and document that invalidation is list-granular. The second is honest and is one
commit.

Effort: M

---

## NEXT-008 — Media mutations do not revalidate the pages that embed the media
**P2 · [VERIFIED-CODE]**

Evidence: `src/actions/admin/catalog.ts:113-115` and `:123-134` call
`revalidateEntity('media')`. `src/lib/cache/tags.ts:114` maps that to
`TAGS.partnerList, TAGS.personList` only. But the hero image is baked into the cached
detail payload — `src/db/queries/content.ts:204-216` selects `path`/`alt`/`blur` inside
`_getPostBySlug`, cached under `TAGS.postList` alone (`:228`). `registerMedia` in
`src/app/api/admin/media/route.ts:64-83` calls no revalidation at all.

Impact: an editor deletes a photograph — most likely because consent was withdrawn or it
shows an identifiable minor, the safeguarding case this codebase takes most seriously — the
storage object is removed immediately (`catalog.ts:129-131`) while the cached article keeps
pointing at a now-404 URL for up to an hour. Fixing `alt_ar` has the same lag.

Fix: extend `tags.ts:114` to include `projectList`, `postList`, `storyList`, `programList`,
`publicationList`. Media mutations are rare, so a broad bust costs nothing.

Effort: S

---

## NEXT-009 — `saveOrganization` skips validation
**P2 · [VERIFIED-CODE]** · same root cause as **SEC-005** / **DATA-011** (three tracks, one finding)

Evidence: `src/actions/admin/catalog.ts:140-146`. Every sibling validates (`:65-68`,
`:87-90`, `:109-112`).

Impact adds to SEC-005: `organization_settings` is the single source of every
organisational fact — legal name, licence number, licence authority, official channels
(`verify/page.tsx:44-46`) — and `officialChannels` is rendered as `<a href={channel.url}>`
at `page.tsx:163` and `verify/page.tsx:77` with no scheme check at the render site.
Validation here is the only gate.

Effort: M

---

## NEXT-010 — The inline `'use server'` action casts an arbitrary string into the `submission_state` enum and discards the result
**P2 · [VERIFIED-CODE]**

Evidence: `src/app/(admin)/admin/submissions/[id]/page.tsx:95-104` —
`next as (typeof submissionState.enumValues)[number]`. `submissionState.enumValues` is
imported at `:11` and used to render the `<option>` list at `:118`, but never to check the
posted value. The `ActionResult` is discarded at `:99`.

Impact: (a) a crafted POST sends `state=anything`; Postgres rejects the enum cast and the
action throws unhandled — a 500 on a staff screen instead of a field error. (b) When
`setSubmissionState` legitimately fails, the form silently re-renders with the old state
and the operator believes the change saved.

Fix: validate against `enumValues`, or move the body into `src/actions/admin/catalog.ts`
where `safeParse` and `runAction` already live. Cap `internalNote`.

Effort: S

---

## NEXT-011 — An `ar_only` record still emits `index: true` and bidirectional hreflang on its English URL; no route emits `x-default`
**P2 · [VERIFIED-CODE]**

Evidence: `src/app/(site)/[locale]/news/[slug]/page.tsx:31-35` — `robots` keys off
`post.noIndex` only, while `post.isTranslated` is available and is used in the body at `:66`
to render `<UntranslatedNotice>`. Identical shape at `impact/stories/[slug]:23-30`,
`careers/[slug]:29-33`, `programs/[slug]:40-47`, `projects/[slug]:35-42`,
`legal/[slug]:31-35`. `grep -rn "x-default" src/` → no matches; `sitemap.ts:44-48` emits
only `ar`/`en`.

Impact: Google indexes `/en/news/<slug>` as an English page containing Arabic body copy,
with a reciprocal hreflang claiming it is the English alternate of the Arabic page — the
textbook trigger for a duplicate-content demotion that can suppress **the Arabic original**,
the page that actually matters. `docs/spec/07` §8 requires exactly the opposite behaviour.

Fix: when `locale === 'en' && !record.isTranslated`, set `robots: { index: false, follow: true }`
and emit only the `ar` alternate. Add `x-default` pointing at the Arabic URL everywhere.
Factor into one helper so the six call sites cannot drift.

Effort: M

---

## NEXT-012 — `sitemap.ts` omits news posts, impact stories and vacancies
**P2 · [VERIFIED-CODE]**

Evidence: `src/app/sitemap.ts:52-83` returns `STATIC_PATHS`, `programs`, `projects` and
`publications` only; `listPosts`, `listStories` and `listOpenVacancies` are never imported.

Impact: compounds NEXT-001 — those three families are neither prerendered nor listed, so
the only discovery path is an internal link from a paginated list. Older articles fall out
of crawl reach; a vacancy is time-boxed by definition, so if it is not indexed within days
it is never indexed.

Effort: S

---

## NEXT-013 — `controls.tsx` and `fields.tsx` claim to be Server Components but are imported only from client modules, so TipTap ships to every admin editor screen
**P2 · [VERIFIED-CODE]**

Evidence: `src/components/admin/controls.tsx:10-12` states "Server Components … ship no
JavaScript"; it has no `'use client'` and no hooks, but its only importers are
`content-form.tsx:1` (`'use client'`) and `project-form.tsx:1`. Same for
`src/components/forms/fields.tsx:22` vs `form-shell.tsx:1` and `public-forms.tsx:1`.
`content-form.tsx:13` imports `RichTextEditor` **unconditionally**, while
`field-configs.ts:120` (`PUBLICATION_FIELDS`) has no `richtext` entry. `du -sh node_modules/@tiptap` → **7.7 MB**.

Root cause: a module without `'use client'` is not a Server Component — it inherits the
environment of whoever imports it. Two docstrings assert the opposite.

Impact: `/admin/publications/[id]`, `/admin/partners`, `/admin/people` and `/admin/metrics`
download the full TipTap bundle for editors who will never see an editor. This is the most
likely explanation for the 392 KB and 298 KB client chunks measured at baseline.

Fix: correct both docstrings, and load the editor with `next/dynamic({ ssr: false })` — it
is already `immediatelyRender: false` (`rich-text-editor.tsx:52`) and the hidden input at
`:141` carries the value pre-mount, so nothing regresses.

Effort: M

---

## NEXT-014 — The language switcher does not exist without JavaScript
**P2 · [VERIFIED-CODE]**

Evidence: `src/components/layout/chrome.tsx:115-117` wraps it in `<Suspense>` with an
**empty span** fallback; `language-switcher.tsx:1-4` is `'use client'` and calls
`useSearchParams`, which per `use-search-params.md:82` forces client rendering up to the
boundary. It is the only locale control in the codebase.

Impact: the switcher is absent from every prerendered page's initial HTML and never appears
at all with JS disabled. The codebase treats no-JS as first-class (non-negotiable #7, and
`chrome.tsx:93-98` explicitly refuses a JS menu toggle for that reason), so a JS-only
language switch contradicts its own standard — on the one control a reader needs when they
land in the wrong locale.

Fix: render a plain server `<Link>` as the Suspense **fallback**; the client version then
upgrades it to preserve the query string. Same markup, same position, no layout shift.

Effort: M

---

## NEXT-015 — `CRON_SECRET` compared with `!==`
**P3 · [VERIFIED-CODE]** · duplicate of **SEC-014**

---

## NEXT-016 — `revalidate = 3600` on `/news` and `/projects` is dead configuration
**P3 · [VERIFIED-CODE]**

Evidence: `news/page.tsx:11` + `:29` reads `searchParams`; `projects/page.tsx:14` + `:76`
same. Both are correctly dynamic; the data behind them is still cached at the query layer.
The cost is a misleading declaration.

Fix: replace with a comment, or make the intent explicit with `dynamic = 'force-dynamic'`.

Effort: S

---

## NEXT-017 — `(site)/[locale]/error.tsx` ignores the `error` prop, so no digest reaches the reader
**P3 · [VERIFIED-CODE]**

Evidence: `error.tsx:14` declares `error: Error` in the type and never uses it; the output
at `:15-44` has no digest and no reporting call.

Impact: when a reader reports "the page won't load" there is no identifier tying the report
to a server log line. The boundary is otherwise good — bilingual, per-block `lang`/`dir`,
no dependency on a fetch succeeding.

Effort: S

---

## NEXT-018 — `MediaUploader` calls `window.location.reload()` instead of `router.refresh()`
**P3 · [VERIFIED-CODE]**

Evidence: `src/components/admin/media-uploader.tsx:45-47`. The comment assumes a Server
Component cannot be refreshed from the client; `router.refresh()` exists for exactly that.

Impact: a full document reload after every upload — refetching fonts, CSS, the admin shell
and the `getDashboard` query — and it discards the `?q=` / `?needsConsent=1` filter state.

Effort: S

---

## CLEAN (T5)

- **`revalidateTag` second argument** — `src/lib/cache/revalidate.ts:25-26` is the only call site repo-wide, and both branches pass it. Verified against `next/dist/server/web/spec-extension/revalidate.d.ts:13`, where the parameter is non-optional.
- **No server-only leakage into client bundles** — all 11 `'use client'` files and their transitive imports traced. `content-form.tsx:14-15` and `project-form.tsx:14-15` import from `@/db/schema/*` as `import type` only, so they erase. `turnstile.tsx:4` imports the browser-safe `env.public`. The single `import 'server-only'` (`get-dictionary.ts:1`) is never reached from a client file — a serialised dictionary slice is passed down instead. No `'use client'` file value-imports `@/db`, `@/lib/env` or `@/services`.
- **`useSearchParams` Suspense boundary** — present and correct at `chrome.tsx:115`. (The fallback's quality is NEXT-014; the boundary itself is right.)
- **`next/image`** — `grep -rn "<img" src/` returns **zero**. All six image sites use `next/image` with explicit `sizes`, and `news/[slug]:94-103` uses `preload`, correctly the Next 16 spelling rather than the deprecated `priority`.
- **`next/link`** — every internal navigation uses `Link`. All 15 raw `<a>` classified: `mailto:`, `tel:`, `#`-fragment skip link, external with `rel="noopener noreferrer"`, or a storage download. The attachment link is correctly `<a>` — it is a 302 to a signed URL, not a client navigation.
- **`generateMetadata` coverage** — all 19 `(site)` pages export it and set `canonical` plus both-locale `alternates.languages`. The gaps are `x-default` and the untranslated case (NEXT-011).
- **No request waterfalls** — every `page.tsx` in both groups audited. Independent reads are batched, including a seven-way `Promise.all` on the homepage (`page.tsx:45-53`). The two remaining sequential awaits are genuine data dependencies, not waterfalls.
- **No hydration-mismatch risk** — grep for `new Date()`, `Date.now()`, `Math.random()`, `toLocale*`, `Intl.`, `window.` found nothing evaluated during render in a component that also runs on the client. `src/lib/format.ts:17-29` is exemplary: locales pinned to `ar-u-ca-gregory-nu-latn` / `en-GB` and `timeZone: 'UTC'` forced, which is what prevents Tokyo-server / Gaza-browser divergence.
- **Route handlers** — all six export exactly the verbs they implement; `dynamic`/`revalidate` correct throughout; status codes well chosen (422/415/500/201/401/503/403, and 404 deliberately indistinguishable for "no attachment" vs "signing failed"); `feed.xml:16-23` escapes all five XML entities on every editor-supplied field; `health:12-14` deliberately swallows the error text so a public probe cannot leak the connection host.
- **Guard-first in `src/actions/**`** — `requireActor()` is the first statement in all 16 admin actions. `runAction` only catches, it does not weaken the guard. `redirect()` is correctly placed *outside* `runAction` (it throws and would otherwise be swallowed). Every action returns `ActionResult`.
- **Zod in actions** — every action that accepts structured input `safeParse`s it, except `saveOrganization` (NEXT-009). The public pipeline's ordering — rate limit, validate, honeypot, Turnstile, persist, `after()` for mail — is correct.
- **Proxy correctness** — no redirect loop is reachable (three independent early returns); the negative-lookahead matcher correctly excludes static assets; `307` rather than `308` is right for a per-visitor negotiated redirect; no I/O per request. The trailing `export { LOCALES, DEFAULT_LOCALE }` is safe — the docs restrict only `runtime`.
- **`[locale]/not-found.tsx` quality** — bilingual with per-block `lang`/`dir` so a screen reader switches voice, and its docstring correctly explains why it cannot read `params`.

## COVERAGE (T5)

Exhaustive: all 11 `'use client'` files and their transitive imports; all 6 route handlers;
all 5 `src/actions/**` files plus the inline `'use server'`; all 3 cache modules
cross-checked against every `tags:` registration (17) and every `revalidateEntity` call
(18); all 19 `(site)` pages for metadata and segment config; special-file inventory by
`find`; `<img>`/`<a>` audit by grep with all 15 anchors individually classified; hydration
grep; `proxy.ts`, `next.config.ts`, `sitemap.ts`, `robots.ts`, both layouts, `guard.ts`,
`errors.ts`. Every API claim was checked against `node_modules/next/dist/docs/` rather than
from memory — and the one claim that survived that check (NEXT-006) still failed the
runtime test, which is why it is struck.

Sampled: 4 of 32 admin pages read in full, with guard placement and `dynamic` verified
across all 32 by grep; `content.ts` caching wrappers read, per-entity select bodies not;
services read only where an action crosses into them.
