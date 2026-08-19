# 06 — Build Plan

Ordered so that every milestone ends in something demonstrable. Nothing is built twice.

**Assumption stated explicitly:** durations are for one full-stack developer working focused days, and exclude content collection and translation. `[ASM]`

---

## 1. Milestones

| M | Name | Duration | Ends with |
|---|---|---|---|
| M0 | Foundation | 2 days | Empty app deploys to Vercel; CI green |
| M1 | Data layer | 3 days | Schema migrated, seeded, Drizzle Studio browsable |
| M2 | Design system + i18n | 4 days | Layout shell renders both locales, RTL correct, tokens live |
| M3 | Public content routes | 7 days | All 24 routes render real seeded data |
| M4 | Forms + email | 3 days | Six forms submit, persist, notify, rate-limit |
| M5 | Admin CMS | 9 days | All 11 entities CRUD-able by a non-developer |
| M6 | SEO · a11y · perf | 4 days | Budgets met, axe clean, Lighthouse ≥ 90 |
| M7 | Content load + QA + launch | 4 days | Live |

**Total: ~36 working days (~7 weeks).** M5 is the largest single block and is the direct cost of choosing a self-built CMS over Sanity (`00-ARCHITECTURE §0.1`).

---

## 2. M0 — Foundation (2 days)

```bash
pnpm create next-app@latest pcsrd-web --typescript --app --tailwind --eslint --src-dir --import-alias "@/*"
cd pcsrd-web
pnpm add drizzle-orm postgres @supabase/ssr @supabase/supabase-js zod
pnpm add resend react-email @react-email/components
pnpm add @upstash/ratelimit @upstash/redis
pnpm add sharp file-type
pnpm add @tiptap/react @tiptap/starter-kit @tiptap/extension-link
pnpm add lucide-react clsx tailwind-merge date-fns
pnpm add -D drizzle-kit tsx vitest @vitejs/plugin-react
pnpm add -D @playwright/test @axe-core/playwright
pnpm add -D eslint-plugin-tailwindcss
pnpm dlx shadcn@latest init
```

Tasks:
1. Repo, branch protection, Conventional Commits, PR template
2. Supabase project (region: closest to Europe/MENA for latency); capture both connection strings
3. Vercel project linked; all env vars set for preview + production
4. Cloudflare DNS; domain pending the naming decision — **use a placeholder subdomain until then**, do not buy the wrong domain
5. `CLAUDE.md` at repo root: stack, conventions, the ten non-negotiable rules, "read the plan docs before changing architecture"
6. CI workflow: typecheck · lint · unit · build
7. Sentry wired, PII scrubbing configured

**DoD:** `main` auto-deploys; a PR runs CI; `/api/health` returns `{status:'ok'}`.

---

## 3. M1 — Data layer (3 days)

1. `src/db/schema/enums.ts` — all 22 enums
2. 16 schema files + `relations.ts`
3. `drizzle-kit generate` → review the SQL by hand before applying
4. `drizzle-kit migrate` against the dev project
5. `supabase/migrations/` — storage buckets, storage policies, `handle_new_user` trigger
6. RLS enable script + the CI assertion query
7. `scripts/seed.ts` — org, 3 programmes, 11 partners, 7 people, 4 pages, plus dev fixtures
8. Query modules for every entity, with `unstable_cache` tags

**DoD:** `pnpm db:reset` rebuilds from zero; Drizzle Studio shows seeded data; the RLS assertion returns zero rows; every query module has a passing unit test against a test database.

**Gotcha to check on day one:** confirm `postgres(url, { prepare: false })` against the `:6543` pooler. If prepared statements are left on, failures are intermittent and the error message will not point at the cause.

---

## 4. M2 — Design system + i18n (4 days)

1. `globals.css` with the full `@theme` block
2. Font subsetting (`scripts/subset-fonts.sh`), `src/styles/fonts.ts`, verify the WOFF2 sizes against the budget
3. `src/i18n/*` — config, dictionaries (start with ~120 keys, grow), `getDictionary`
4. `middleware.ts` — locale redirect, CSP nonce, security headers
5. shadcn primitives installed **and RTL-audited** (sheet, dropdown, dialog, table)
6. Layout components: `SiteHeader`, `MainNav`, `MobileNav`, `LanguageSwitcher`, `SiteFooter`, `OfficialChannelsBar`, `SkipLink`, `Container`, `Section`, `PageHeader`
7. `Bidi`, `formatNumber`, `formatDate`
8. ESLint rule banning physical CSS properties

**DoD:** `/ar` and `/en` render the shell; direction flips correctly; the language switcher preserves the path; a Playwright screenshot test passes in both directions; zero physical properties in the codebase.

---

## 5. M3 — Public content routes (7 days)

Build in dependency order — each day ends with a working page.

| Day | Routes |
|---|---|
| 1 | `content/` renderers: `RichText`, `MediaFigure`, `Prose`, `EmptyState`, `Pagination`, `Breadcrumbs` |
| 2 | `/programs`, `/programs/[slug]` + `ProgramCard`, `MetricCard`, `CrossProgramRail` |
| 3 | `/projects` faceted + `/projects/[slug]` + `ProjectFilters`, `ProjectCard`, `ProjectMeta` |
| 4 | `/impact`, `/impact/stories/[slug]`, `/news`, `/news/[slug]` |
| 5 | `/about` ×5 + `OrgChart`, `GovernanceBoard`, `MembershipList` |
| 6 | `/partners`, `/careers` ×2, `/resources`, `/verify`, `/contact`, `/legal/[slug]` |
| 7 | Home — all 11 sections, in the spec §8 order |

Build the homepage **last**. It composes components from every other page; building it first means building each one twice.

**DoD:** all 24 routes render seeded data in both locales; `generateStaticParams` covers every published slug; 404 works for unknown slugs; the untranslated-content state renders correctly on an English route whose record is `ar_only`.

---

## 6. M4 — Forms + email (3 days)

1. `src/lib/security/*` — rate limit, Turnstile, IP hashing, upload validation
2. Six Zod schemas in `src/lib/validation/*`
3. Six Server Actions
4. Six form components + `TurnstileWidget`, `FormField`, `FieldError`, `FormStatus`, `SubmitButton`, `HoneypotField`
5. React Email templates (7 senders)
6. `buildWhatsAppUrl` + `WhatsAppCta`, wired into support, contact, official-channels bar, and every programme CTA

**DoD:** every form submits **with JavaScript disabled**; rate limiting returns a localized message; a failed Turnstile is rejected; complaint submissions store `ip_hash = null` and fire no analytics event; the CV upload rejects a `.exe` renamed to `.pdf`.

Test the JS-disabled path explicitly. It is the reason Server Actions were chosen and it is the thing that silently regresses.

---

## 7. M5 — Admin CMS (9 days)

| Day | Work |
|---|---|
| 1 | Auth: login, `requireAuth`/`requireRole`/`requireSensitiveAccess`, `AdminShell`, sidebar |
| 2 | Generic layer: `DataTable`, `EntityForm`, `PublishBar`, `StatusBadge`, `ConfirmDialog` |
| 3 | `BilingualField`, `SlugField`, `ArrayField`, `RelationField`, `EnumSelect`, `DateRangeField` |
| 4 | `RichTextEditor` (TipTap, RTL) + `MediaPicker` + `MediaUploader` + upload route |
| 5 | Projects CRUD end to end — the template for everything else |
| 6 | Programmes · Posts · Stories · Vacancies |
| 7 | Metrics · Partners · People · Publications · Pages |
| 8 | Organization singleton · media library · redirects |
| 9 | Submissions inbox + sensitive route + users + audit log + dashboard |

Do Projects first and completely. It is the most complex entity (two junction tables, arrays, media gallery, SEO block) — once it works, the remaining ten are field configs.

**DoD:** a non-developer can create, edit, publish, and unpublish every entity; publishing busts the correct cache tags and the public page updates within seconds; an editor cannot publish; a user without `can_view_sensitive` cannot reach `/admin/submissions/sensitive` by typing the URL; media without `alt_ar` cannot be uploaded.

---

## 8. M6 — SEO · accessibility · performance (4 days)

| Day | Work |
|---|---|
| 1 | `generateMetadata` on all routes, `hreflang`, canonicals, `sitemap.ts`, `robots.ts`, `feed.xml` |
| 2 | JSON-LD components; per-template `opengraph-image.tsx` (verify the Arabic font loads in Satori) |
| 3 | Accessibility pass: axe in CI, keyboard-only walkthrough, NVDA in Arabic, VoiceOver iOS, contrast audit in both locales |
| 4 | Performance: bundle analysis, image audit, Lighthouse CI budgets, real-device test on 3G throttling |

**DoD:** Lighthouse mobile ≥ 90 performance / ≥ 95 a11y / 100 best practices / ≥ 95 SEO on five sampled routes; zero axe violations; LCP < 2.5s on Slow 4G; content-route JS ≤ 110 KB gzipped; the OG image renders Arabic text correctly (this fails silently if the font is not passed as an `ArrayBuffer`).

---

## 9. M7 — Content, QA, launch (4 days)

1. Load real content through the admin — this is also the admin's real usability test
2. Cross-browser: Chrome, Safari, Firefox, Samsung Internet; iOS Safari and Android Chrome on real devices
3. Full Playwright suite in both locales
4. Domain cutover, DNS, SSL, `www` redirect
5. Search Console: verify both `/ar` and `/en`, submit the sitemap
6. Analytics goals configured
7. Uptime monitor + Sentry alerts
8. **Handover**: an Arabic admin guide (screenshots), a credentials handover under organizational accounts, a backup/restore runbook

**DoD:** live on the canonical domain; sitemap submitted; a non-developer publishes a news post unaided while you watch.

---

## 10. Testing strategy

| Layer | Tool | Scope |
|---|---|---|
| Unit | Vitest | `lib/*` — validation, formatters, `buildWhatsAppUrl`, `parseProjectFilters`, `hashIp`, upload validation |
| Integration | Vitest + test DB | Query modules: locale fallback, published filtering, facet counts, junction hydration |
| Server Actions | Vitest | Each action: happy path, validation failure, rate limit, captcha failure, honeypot |
| E2E | Playwright | Six journeys × two locales |
| Accessibility | `@axe-core/playwright` | Every route, both locales |
| Visual | Playwright screenshots | Key pages, both directions — the only reliable RTL regression net |
| Performance | Lighthouse CI | Budgets from `03-FRONTEND §9` as gates |

E2E journeys (spec §12.1): J1 donor diligence path · J2 beneficiary to WhatsApp · J3 partner filtered projects · J4 volunteer application · J5 job application with CV · J6 verify-channels lookup.

`.github/workflows/ci.yml`
```yaml
name: CI
on: [push, pull_request]
jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm typecheck
      - run: pnpm lint
      - run: pnpm test:unit
      - run: pnpm build
      - name: Assert no service-role key in client bundle
        run: |
          if grep -rl "SUPABASE_SERVICE_ROLE\|service_role" .next/static/ 2>/dev/null; then
            echo "Service role key leaked into the client bundle"; exit 1
          fi
      - run: pnpm exec playwright install --with-deps chromium
      - run: pnpm test:e2e
      - run: pnpm lhci autorun
```

---

## 11. Definition of Done — every PR

- [ ] TypeScript passes with `strict`, no `any`, no `@ts-ignore`
- [ ] ESLint passes, including the physical-properties rule
- [ ] Both locales verified in the browser
- [ ] RTL verified visually
- [ ] Keyboard-navigable; focus visible
- [ ] Zero new axe violations
- [ ] Server Component unless on the client allow-list, with a reason in the PR
- [ ] No new third-party script on a `(site)` route
- [ ] Loading, empty, and untranslated states handled
- [ ] Mutations revalidate the correct tags
- [ ] Admin actions guard first, and write an audit entry
- [ ] Conventional Commit message

---

## 12. Risk register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Naming decision (spec D1) delayed | High | **Blocks the domain** | Build on a placeholder subdomain. Every name reads from `organization_settings` — one row edit at launch, no code change |
| Content not delivered on schedule | High | Delays M7, not M0–M6 | Seed fixtures let all development finish without real content. Build against seeds and load late |
| Translation budget not approved | Medium | English quality | Untranslated state is implemented from M3, so an Arabic-complete launch is viable |
| Admin CMS underestimated | Medium | M5 overruns | Generic layer first; entities are configs. If M5 slips, launch with programmes/posts/projects editable and add the rest post-launch |
| Arabic font in Satori (OG images) | Medium | Blank OG text | Test on day 1 of M6, not day 3 |
| Supavisor prepared-statement failures | Medium | Intermittent 500s | `prepare: false` verified in M1 |
| Photo consent unresolved | Medium | Cannot publish imagery | Design every component to work without images; ship with fewer photos rather than delaying |
| shadcn RTL defects | Medium | Visual breakage | Audit at install time in M2, not at QA |
| Vercel/Supabase free-tier limits | Low | Cost surprise | Estimate: well within free tiers at this traffic. Budget ~$45/mo if paid tiers become necessary |

---

## 13. Post-launch

**Week 1** — daily error and uptime checks; verify form submissions arrive; monitor Search Console indexing; confirm the cron jobs actually archived something.

**Month 1** — Core Web Vitals from real users, **segmented to the Gaza p75, not global**; review the first analytics against the §23 KPIs; fix whatever the staff found confusing in the admin.

**Handover package** — Arabic admin guide with screenshots; a runbook covering "the site is down", "restore from backup", "add a user", "rotate a key"; all credentials under organizational accounts; a documented monthly backup export the organization holds itself.

**Deferred to Phase 2** (unchanged from spec §26.2, minus donations): media centre, publications library, site search, newsletter, expanded impact views, content-parity pass, WhatsApp Business templated intents.
