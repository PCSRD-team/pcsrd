# 05 — Health Gate: Before / After

## Baseline (Phase 1) — recorded before any edit

Commit at baseline: `5fb312a` · branch `chore/pre-launch-audit` · working tree clean.

| # | Gate | Command | Result |
|---|---|---|---|
| 1 | Install | `npm ci` | dependencies already installed; `package-lock.json` v3 agrees with `package.json` |
| 2 | Typecheck | `npx tsc --noEmit` | **PASS — 0 errors** |
| 3 | Lint | `npx eslint` | **PASS — 0 errors, 0 warnings** |
| 4 | Lint CSS | `npx stylelint "src/**/*.css"` | **PASS — 0 errors** |
| 5 | Unit tests | `vitest run --project unit` | **0 test files** (exits 0 only because of `--passWithNoTests`) |
| 6 | Integration tests | `vitest run --project integration` | **PASS — 2 files, 27 tests, 15.53 s** |
| 7 | Schema parity | `drizzle-kit check` | **PASS — "Everything's fine"** |
| 8 | Build | `SKIP_ENV_VALIDATION=1 next build` | **PASS — compiled in 7.0 s, 38 static pages generated in 2.3 s** |
| 9 | Secret leak | `grep -rl "SUPABASE_SERVICE_ROLE\|service_role" .next/static/` | **PASS — no match** |
| 10 | Vulnerabilities | `npm audit --omit=dev` | **0 vulnerabilities** |

### Build output notes

Next 16 with Turbopack does **not** print a First Load JS table, so bundle economics
were measured directly from the emitted client chunks.

`.next/static` total: **1.9 MB** (uncompressed).

| Rank | Size (raw) | Chunk |
|---|---|---|
| 1 | 392.2 KB | `chunks/1wt0r15ok22f3.js` |
| 2 | 297.7 KB | `chunks/2a-fqdzr22uvu.js` |
| 3 | 222.6 KB | `chunks/1bkxn6_6bcmga.js` |
| 4 | 131.5 KB | `chunks/0pz2kdepy91cm.js` |
| 5 | 110.0 KB | `chunks/0cz1d0mv5g_q7.js` |
| 6+ | ≤ 30.6 KB | long tail |

### Rendering strategy as built

- **SSG + ISR (revalidate 1 h, expire 1 y):** `/ar`, `/en`, `/about`, `/careers`,
  `/contact`, `/get-involved/partner`, `/get-involved/volunteer`, `/impact`,
  `/legal/[slug]` (6 paths), `/partners`, `/programs`, `/programs/[slug]`,
  `/projects/[slug]`, `/resources`, `/verify`, `/feed.xml`, `/sitemap.xml`.
- **Static:** `/robots.txt`, `/_not-found`.
- **Dynamic (server-rendered on demand):** `/[locale]/careers/[slug]`,
  `/[locale]/impact/stories/[slug]`, `/[locale]/news`, `/[locale]/news/[slug]`,
  `/[locale]/projects`, all `/admin/**`, all `/api/**`.
- The build loaded `.env.local`, so static generation ran against the real database.

---

## After (Phase 5)

Head commit `1ba0d99` · branch `chore/pre-launch-audit` · 8 commits.

| # | Gate | Before | After | Delta |
|---|---|---|---|---|
| 1 | Install | lockfile agrees | lockfile agrees | — (no dependency added or removed) |
| 2 | Typecheck | PASS, 0 errors | **PASS, 0 errors** | held |
| 3 | Lint | PASS, 0 errors | **PASS, 0 errors** | held **with one more rule on** — `no-unknown-classes` |
| 4 | Lint CSS | PASS, 0 errors | **PASS, 0 errors** | held |
| 5 | Unit tests | 0 files | 0 files | unchanged — see note |
| 6 | Integration | 2 files, 27 tests | **2 files, 27 tests** | held; `submission.test.ts` rewritten to stop depending on a field that was always empty in production |
| 7 | Schema parity | `drizzle-kit check` clean | **clean** | held, and now backed by a journal-resolves-to-files check that `drizzle-kit check` does not perform |
| 8 | Build (local) | PASS, 7.0 s, 38 pages | **PASS, 54 s, 38 pages** | held. Slower because this run was a cold build after `rm -rf .next`; the baseline reused a warm Turbopack cache |
| 8b | **Build (CI conditions)** | **FAIL** — `TypeError` at `src/app/robots.ts:4` | **PASS** | **the material change**; see below |
| 9 | Secret leak | no match | **no match**, and now also no match for the injected canary **value** | strengthened |
| 10 | Vulnerabilities | 0 | **0** | held |

### Gate 8b is the one that moved

The baseline build passed **locally** only because `.env.local` was present on disk and Next
loads it regardless of the process environment. CI has no `.env.local`. Reproduced under CI
conditions, with `SKIP_ENV_VALIDATION=1` and nothing else set:

```
$ env -i PATH=... npx tsx _probe.ts
THROWS: TypeError: Cannot read properties of undefined (reading 'replace')
```

So gate 9 — the service-role-leak assertion, which runs after the build in the same job —
had never executed in CI. It now does.

### Bundle: unchanged, as intended

`.next/static` total: **1.9 MB**, the same as baseline.

| Rank | Before | After |
|---|---|---|
| 1 | 392.2 KB | 392.1 KB |
| 2 | 297.7 KB | 297.7 KB |
| 3 | 222.6 KB | 227.7 KB |
| 4 | 131.5 KB | 132.1 KB |
| 5 | 110.0 KB | 110.0 KB |

Chunk hashes changed because the module graph did; the sizes did not. Nothing here was a
performance fix, and nothing regressed. The one real performance change —
three `next/font` instances collapsed to one — shows up in served bytes rather than in
`.next/static`: `/ar` and `/admin/login` now resolve to the **same** font CSS chunk.

### Runtime checks, which the gate does not cover

Against `next start`, before and after:

| Check | Before | After |
|---|---|---|
| `/ar` root element | `<html>` — no `lang`, no `dir` | `<html lang="ar" dir="rtl">` |
| `/en` root element | `<html>` — no `lang`, no `dir` | `<html lang="en" dir="ltr">` |
| `<html>` count on `/admin/login` | **2** | **1** |
| `<body>` count on `/admin/login` | **2** | **1** |
| `/api/health` | 200 | 200 |
| `/` → `/ar` | 307 | 307 |
| `/admin` → `/admin/login` | 307 | 307 |

### Database checks, against a real Postgres as `app_runtime`

| Check | Before | After |
|---|---|---|
| identity lookup with no actor | `rows=0` — nobody can sign in | `rows=1`, own row only, 0 others visible |
| `app.can_view_sensitive()` | `false` — inbox permanently empty | `true` → `rows=1` |
| insert into `audit_logs` | `permission denied for sequence audit_logs_id_seq` | `INSERT OK id=1` |
| migrations applied as whole scripts | journal named a missing file | 4/4 apply; 21 tables, 85 policies, 0 unforced |

---

## Findings vs fixed

| Severity | Found (raw) | Fixed | Remaining |
|---|---:|---:|---:|
| P0 | 4 | **4** | **0** in code; 1 awaits a production `GRANT` |
| P1 | 45 | 19 | 26 |
| P2 | 77 | 3 | 74 |
| P3 | 58 | 1 | 57 |
| **Total** | **184** | **27** | **157** |

Raw counts, before cross-track de-duplication — the same defect was found by up to five
tracks independently. The fixed column counts distinct defects, so the two columns are not
directly comparable; the honest reading is *every P0, and the P1s that block a launch*.

### The one gate that did not improve

**Unit tests: still 0 files.** `test:unit` passes only because of `--passWithNoTests`. The
untested pure functions are `slugify`/`deriveSlugs`, `computeDiff`, `addMonths` (which has a
documented month-clamping edge case), `negotiateLocale`, `tagsFor` and `formDataToObject`.

More pointedly: **no test exercises RLS**, and that is where all four P0s lived. The
integration suite connects as `postgres` and matches `pcsrd_owner_all`, so it tests the
service rules and never the policies. I proved the P0s with a role-switching PGlite harness
written for this audit; making that a standing suite is new test tooling, which the brief
gates. It is the single highest-value thing to add next.
