# Track T7 — Security (raw findings)

Working file. Merged into `01-AUDIT-REPORT.md`.

**No P0 security finding.** No unauthenticated path to data or mutation, no SQL injection,
no secret in a client bundle, no working XSS. The most consequential defects are broken
access-control *implementations* that fail closed — not attacker-exploitable, but they
render the confidential complaint channel unreadable.

## Verification note — two findings REFUTED by measurement

The track reported SEC-003 (admin CSP nonce never reaches the HTML, so `'strict-dynamic'`
blocks every admin script) and SEC-008 (two competing CSP headers on `/admin`). Both were
plausible readings of `next/dist/server/app-render/app-render.js`. **Both are wrong in
Next 16.3.1.** I measured them against the running production server:

```
$ curl -s -D hdr.txt http://localhost:3948/admin/login -o body.html
HEADER nonce: nonce-7b618f6c45f34bb8bd470b6d53af9caa
BODY   nonce: nonce="7b618f6c45f34bb8bd470b6d53af9caa"
MATCH — nonce propagates correctly
script tags total: 11 · script tags with nonce: 11

$ curl -sI /admin/login | grep -ci content-security-policy  → 1
$ curl -sI /ar          | grep -ci content-security-policy  → 1
```

The nonce set in `src/proxy.ts` reaches every script tag, and exactly one CSP header is
emitted per route — the proxy's `response.headers.set` replaces the `next.config.ts`
header on `/admin`, and the config header applies unchanged on `(site)`. All five static
security headers are present on both route groups.

**SEC-003 and SEC-008 are struck.** Recorded here because the reasoning was sound and the
next reader will otherwise re-derive it.

---

## SEC-001 — `app.can_view_sensitive` GUC never set → the confidential complaints inbox is permanently empty
**P1 · [VERIFIED-EXEC]** · duplicate root cause of **DATA-003**

Independently found by both the T6 and T7 tracks. Proven empirically against the repo's
own migrations in PGlite (real Postgres 17):

```
with the two GUCs withActor sets:
  app.can_view_sensitive() → false
  select … where is_sensitive → 0 rows
after adding the third GUC withActor never sets:
  app.can_view_sensitive() → true
  select … where is_sensitive → 1 row
```

Evidence: `drizzle/0001_app_runtime_layer.sql:86-94`, `:689-693`; `src/db/session.ts:30-33`.

Impact: safeguarding complaints from beneficiaries are accepted, encrypted, retained 24
months and purged without any human ever being able to read one. The dashboard badge
reads 0 for the same reason, so nothing signals the failure. PGlite tests connect as
`postgres` and match `pcsrd_owner_all`, so no existing test can catch it.

Fix: add the third `set_config` to `withActor` and widen `ActorContext` to carry
`canViewSensitive`. Do not relax the policy — `assertCanViewSensitive`
(`src/services/_shared/permissions.ts:59`) is the first line and the policy is the second.

Effort: S · **Application-only. Not gated.**

---

## SEC-002 — Submission service and attachment route use the bare `db` handle
**P1 · [VERIFIED-CODE]** · duplicate root cause of **DATA-004**

Evidence: `src/services/submission/submission.service.ts:158-162`, `:202-211`, `:270-280`;
`src/app/api/admin/submissions/[id]/attachment/route.ts:30-38`. `grep withActor|readAsActor`
in `submission.service.ts` returns nothing.

Impact: `/admin/submissions/[id]` 404s for every submission of every type; the attachment
route 404s for every CV; the dashboard count is always 0. The inbox *list* works, so the
CMS shows rows that cannot be opened — the failure presents as data corruption, and the
fastest-looking fix is to point `DATABASE_URL` back at `postgres`, which silently disables
all 85 policies.

Fix: wrap the four call sites in `withActor`/`readAsActor` and pass `tx` into `writeAudit`.
`createSubmission` and `purgeExpiredSubmissions` correctly stay unbound — both go through
`SECURITY DEFINER` functions.

Effort: M · **Application-only. Not gated.**

---

## SEC-004 — Admin login has no rate limit, no lockout, no failed-attempt accounting
**P1 · [VERIFIED-CODE]**

Evidence: `src/actions/admin/auth.ts:20-33` calls `signInWithPassword` directly.
`grep checkRateLimit src/` returns exactly two hits: the definition and
`src/actions/public/forms.ts:68`. The `global` limiter (`src/lib/security/rate-limit.ts:32`)
is defined and never used.

Impact: unlimited online password guessing at Server Action speed against accounts whose
email addresses are guessable from the public contact page. One compromised
`content_manager` yields the full CMS plus the non-sensitive inbox — names, emails, phone
numbers and CVs of job applicants. Supabase's per-IP limit does not help: the call is made
from the Vercel function, so Supabase sees one egress IP for every user.

Fix: call `checkRateLimit('global', await getClientIp())` before touching Supabase, plus a
per-account limiter keyed on a **hashed** email (never plaintext — Upstash would then hold
a list of staff addresses). Key on both so neither a single-IP burst nor a distributed run
against one admin succeeds.

Effort: S · **Application-only. Not gated.**

---

## SEC-005 — `saveOrganization` is the only mutating action with no Zod schema
**P2 · [VERIFIED-CODE]** · same root cause as **DATA-011**

Evidence: `src/actions/admin/catalog.ts:139-149` — `input as Record<string, never>` is a
cast, erased at runtime; `src/services/content/catalog.service.ts:369-385` decides
permission from key *names* while values are uncontrolled.

Impact (T7 found the concrete exploit T6 did not): a `content_manager` can post
`{"officialChannels": "x"}` — a key inside `CONTACT_FIELDS`, so only `org.settings.contact`
is required — writing a string into a jsonb column the site expects to be an array.
`src/components/seo/json-ld.tsx:74` then calls `org.officialChannels.filter(...)` and
`src/app/(site)/[locale]/page.tsx:158` maps over it, throwing on **every public page**:
a full site outage from a non-admin account. The same gap admits unvalidated URLs into
`socials[].url` and `officialChannels[].url`, which are rendered as `href` on the homepage,
the footer and `/verify`, and emitted as schema.org `sameAs` — the exact fields the
anti-impersonation page exists to make trustworthy.

Fix: add a `.strict()` `organizationSchema` to `src/lib/validation/admin.ts` with closed
object shapes and `z.url({ protocol: /^https?$/ })` on every URL field; parse in the action
exactly as `savePartner` (`catalog.ts:40-43`) does.

Effort: M · **Application-only. Not gated.**

---

## SEC-006 — The complaint path sends the complainant's raw IP to Upstash and to Cloudflare
**P2 · [VERIFIED-CODE]**

Evidence: `src/actions/public/forms.ts:65-68` passes the raw `ip` to `checkRateLimit`;
`:91` passes it to `verifyTurnstile`; `src/lib/security/turnstile.ts:19` appends it as
`remoteip`; `src/lib/security/rate-limit.ts:47` uses it as the sliding-window key.

Root cause: the DNH-8 blanking happens inside `createSubmission`
(`submission.service.ts:83-84`), which is the *last* step; the two network calls that
precede it were never given the same rule.

Impact: a complainant's unhashed IP is written into Upstash Redis as `rl:form:<ip>` with a
one-hour TTL and posted to Cloudflare as `remoteip` — both timestamped, both correlated
with the moment a complaint was filed. The entire design of this channel (null `ip_hash`,
null `user_agent`, AES-256-GCM payload, a constraint named
`submissions_sensitive_unlinkable`) exists so no record links a complaint to a person. Two
third parties now hold the one datum that does. For a safeguarding or corruption complaint
against staff of an NGO operating in Gaza, that is precisely the risk the channel was built
to eliminate.

Fix: pass `hashIp(ip)` to `checkRateLimit` — the limiter needs a stable opaque key and
`src/lib/security/ip.ts:14` already produces one. Skip `remoteip` entirely when the type is
sensitive; it is optional in Cloudflare's siteverify API and omitting it costs a little
signal, not the verification.

Effort: S · **Application-only. Not gated.**

---

## SEC-007 — The unhandled-error path logs the whole thrown object; a postgres.js error carries the failing row
**P2 · [VERIFIED-CODE]**

Evidence: `src/lib/errors.ts:118-121` — `console.error('[unhandled]', e)`.
`node_modules/postgres/src/errors.js:1-6` — `Object.assign(this, x)` copies the complete
parsed Postgres ErrorResponse onto the error, including `detail`, which for a constraint
violation contains `Failing row contains (…)` with every column value.

Impact: a constraint or trigger failure inside `app.submit_form()` writes an applicant's
name, email, phone and message body into Vercel's function logs — different retention,
wider readership than `form_submissions`, whose rows are purged on a 12–24 month schedule
by design. This contradicts the stated purpose of the project's own ESLint rule
(`eslint.config.mjs:80` — "a form payload must never reach a log").

Fix: log a redacted projection — `{ name, message, code, stack }` — explicitly omitting
`detail`, `where`, `query` and `parameters`. Keep `code`; it is what makes a Postgres
failure diagnosable.

Effort: S · **Application-only. Not gated.**

---

## SEC-009 — `z.url()` accepts `javascript:` and `data:`, and `partner.website` is rendered as an href
**P3 · [VERIFIED-CODE]**

Evidence: `src/lib/validation/common.ts:36-38`; `src/lib/validation/admin.ts:260`;
`src/app/(site)/[locale]/partners/page.tsx:77-79`. Zod 4 only checks the scheme when a
`protocol` parameter is given (`node_modules/zod/v4/core/schemas.js:226`).

Impact: not currently XSS — React 19 rewrites a `javascript:` href through `sanitizeURL`.
What remains is a stored phishing surface an `editor` can create, and a dependency on
React's sanitiser continuing to exist.

Fix: constrain the primitive once — `z.url({ protocol: /^https?$/, hostname: z.regexes.domain })`
in `common.ts:36`, which also covers `evidenceUrl` and `portfolioUrl`.

Effort: S

---

## SEC-010 — The rich-text link allow-list admits protocol-relative `//host` URLs
**P3 · [VERIFIED-CODE]**

Evidence: `src/components/content/rich-text.tsx:42-51` — the final `\/` alternative in
`/^(https?:|mailto:|tel:|\/)/i` matches `//evil.example`, which is an absolute URL, not a
path. That branch renders a `<Link>` and omits `rel="noopener noreferrer"`.

Fix: tighten to `\/(?!\/)`.

Effort: S

---

## SEC-011 — The honeypot returns a validation error instead of the decoy
**P3 · [VERIFIED-CODE]**

Evidence: `src/lib/validation/common.ts:76` — `z.string().max(0)` makes a filled honeypot a
schema failure, so `safeParse` short-circuits at `src/actions/public/forms.ts:78-80` and the
decoy branch at `:89` is unreachable.

Impact: a bot receives `fieldErrors:{website:['errors.field.tooLong']}` — a precise,
machine-readable signal naming the trap field, which is exactly what the DECOY comment
(`forms.ts:45-47`) says must not be given.

Fix: change the primitive to `z.string().optional()` and let the existing
`if (input.website) return DECOY;` make the decision.

Effort: S

---

## SEC-012 — The leftmost `x-forwarded-for` entry is trusted for rate-limit identity
**P3 · [ASSUMPTION]**

Evidence: `src/lib/security/ip.ts:25-32`. Unverifiable from the repo: whether Vercel
overwrites rather than appends the header.

Impact: if any client-supplied XFF survives, an attacker rotates the header per request and
the limiter never fires — 5/hour on six forms and 3/hour on 4 MB CV uploads become
unlimited.

Fix: prefer `x-vercel-forwarded-for`, falling back to the leftmost `x-forwarded-for` for
local development. Keep `clientIpFrom` pure so the unit-test seam survives.

Effort: S

---

## SEC-013 — `.env.example` deleted, but three places still reference it
**P3 · [VERIFIED-CODE]** · same root cause as **OPS** findings

Evidence: deleted in `9a11a5b`; `.gitignore:33-35` still allow-lists it;
`src/lib/env.ts:78-81` and `src/lib/env.public.ts:44-47` still tell the developer to copy it.

Impact: no secret exposed. The risk is operational — there is no committed inventory of the
21 required variables, so a deployment omitting `SUBMISSION_ENC_KEY`, `IP_HASH_SALT` or
`CRON_SECRET` is discovered at runtime, and the error message points at a file that does not
exist. The `!.env.example` rule also means a developer who reconstructs it by trimming
`.env.local` has it staged by default — the one path by which a real value could be committed.

Fix: restore from `git show 9a11a5b^:.env.example`, replace every value with a placeholder,
reconcile against both schemas.

Effort: S

---

## SEC-014 — Cron bearer token compared with non-constant-time equality
**P3 · [VERIFIED-CODE]**

Evidence: `src/app/api/cron/archive-expired/route.ts:19-21`;
`src/app/api/cron/purge-submissions/route.ts:15-17`.

Impact: theoretical — recovering a ≥16-character secret through network timing on a
serverless function is not practical. Worth fixing on the purge route regardless, as it is
the one endpoint that destroys complainant data on a schedule.

Fix: `crypto.timingSafeEqual` behind a shared `assertCronSecret(request)` helper, with a
length check first.

Effort: S

---

## SEC-015 — `updateSubmissionState` has no Zod schema and an unbounded internal note
**P3 · [VERIFIED-CODE]**

Evidence: `src/actions/admin/catalog.ts:151-161`. `state` and `id` are safe (enum cast and
Drizzle parameterisation), but `internalNote` is uncontrolled free text attached to a record
that may be a safeguarding complaint.

Fix: add `submissionStateSchema` with `z.uuid()`, an enum, and `.max(2000)`.

Effort: S

---

## SEC-016 — `listSubmissions` takes `sensitive` as a caller-supplied flag with no check of its own
**P3 · [VERIFIED-CODE]**

Evidence: `src/db/queries/admin/index.ts:274-280`. Correct today — both callers guard
(`submissions/page.tsx:9` and `sensitive/page.tsx:15`) and the general inbox excludes
sensitive rows **in SQL**, not in the UI. The exposure is a third caller that guards only
with `requireAuth()`. The RLS backstop is not currently available to catch that — see
SEC-001.

Fix: move the check into the query, as `getSubmission` (`submission.service.ts:156`)
already does.

Effort: S

---

## SEC-017 — `setStatus` writes a row and an audit entry with no capability assertion when the status is unchanged
**P3 · [VERIFIED-CODE]**

Evidence: `src/services/_shared/content-service.ts:150-168` has no top-level `assertCan`;
`src/services/_shared/publish.ts:22-23` returns early when `from === to`.

Impact: not exploitable today (all three roles hold `content.write`), but it writes with no
authorisation decision behind it and appends an audit entry claiming a transition that never
occurred — polluting the one table whose value is being trustworthy.

Fix: `assertCan(actor, 'content.write')` as the first statement, and return early without
writing when the status is unchanged.

Effort: S

---

## SEC-018 — `/api/admin/media` has no rate limit and no origin check
**P3 · [VERIFIED-CODE]**

Evidence: `src/app/api/admin/media/route.ts:22-25`, `maxDuration = 30` at `:9-10`. Server
Actions carry Next's built-in Origin/Host check; route handlers do not, and this one accepts
`multipart/form-data`, a CORS-simple request with no preflight.

Impact: bounded — `@supabase/ssr` writes `SameSite=Lax` cookies, which blocks a cross-site
POST. What is missing is any limit on an endpoint that runs `sharp` for up to 30 s on a 4 MB
image: one compromised `editor` session can exhaust function CPU and fill the buckets.

Fix: `checkRateLimit('upload', actor.id)` immediately after `requireActor()`, plus an
explicit `origin` check against `NEXT_PUBLIC_SITE_URL` on both route handlers.

Effort: S

---

## SEC-019 — The proxy never refreshes the Supabase session, contradicting the comment that justifies swallowing the cookie-write failure
**P3 · [VERIFIED-CODE]**

Evidence: `src/lib/auth/supabase-server.ts:27-31` justifies an empty `catch` by saying
"Refreshes still happen in the proxy"; `src/proxy.ts:54-65` returns from the admin branch
without doing any Supabase work.

Impact: not a hole — `getUser()` is used throughout rather than `getSession()`, which is the
decision that matters. An editor's session expires mid-edit and the next action redirects to
login, losing unsaved work.

Fix: either refresh in the proxy's admin branch, or correct the comment. Given the proxy's
stated reason for not touching the database, correcting the comment is the more honest change.

Effort: S

---

## CLEAN (T7)

- **Secret isolation** — `env.ts:18-23` throws on browser import; all 11 `'use client'` files and all 9 `@/lib/env` importers enumerated; no client component imports `serverEnv`. The service-role key reaches only `createSupabaseAdminClient`, built with `persistSession: false` and empty cookies, called from four places, all behind a guard or a cron secret. Confirmed at runtime: no `service_role` string in `.next/static`.
- **Guard-first** — all 34 exported actions and all 5 route handlers checked individually. `requireActor()`/`requireAuth()` is the first statement everywhere except `signIn`/`signOut`, correctly. `requireActor` throws rather than redirects (right for an action) and enforces the deactivated path. `signIn` returns one indistinguishable message for a bad password and an unknown address.
- **Authorisation beyond authentication** — a capability matrix in `permissions.ts:29-42` asserted in every service entry point. An `editor` cannot publish, delete, read submissions, or touch org settings. `assertCanViewSensitive` is deliberately not derived from role.
- **IDOR** — every id-taking surface loads the row and re-decides; `handledBy` is set from `actor.id`, never from input. No row in this schema is user-owned, so "belongs to the caller" reduces to a capability question, which is what the code asks.
- **SQL injection** — no string-concatenated SQL. Both raw `sql` templates use Drizzle's tagged template, which emits bind parameters. Public filters are allow-listed against `enumValues` before reaching the query.
- **XSS** — exactly one `dangerouslySetInnerHTML`, inside `<script type="application/ld+json">`, whose `serialize` escapes `<` to `<` plus U+2028/U+2029. ESLint enforces `react/no-danger` globally with the override scoped to `src/components/seo/**`. The TipTap map is genuinely closed: unknown nodes render as a bare `<div>`, `attrs` are never spread onto DOM, heading level is clamped to h2–h4. No `innerHTML`, `eval` or `new Function` anywhere.
- **Open redirect / SSRF** — login takes no redirect parameter; all 16 `redirect()` sites pass literals or server-generated UUIDs; `proxy.ts` mutates only `pathname`. Only two `fetch` calls exist: a hardcoded Cloudflare constant and a same-origin relative path.
- **Security headers** — measured on both route groups: all five present, exactly one CSP each.
- **File upload** — magic-byte sniff via `fileTypeFromBuffer` (never the filename or browser `Content-Type`); 4 MB cap in three layers, correctly below Vercel's 4.5 MB ceiling; sharp re-encode with `.rotate()` and no `withMetadata()`, so EXIF/GPS is discarded; `storagePath` emits `prefix/<uuid>.<ext>` with no user-supplied component; alt text validated before any byte is written.
- **Turnstile** — fails closed on all five failure modes, including an 8-second `AbortSignal.timeout`.
- **Rate limiting posture** — fails **closed**: an Upstash outage propagates through `runAction` as `internal` and the submission is refused. The gaps are coverage (SEC-004, SEC-018), not posture.
- **Crypto** — AES-256-GCM, 12-byte IV from `randomBytes` generated inside the function and never caller-supplied (so IV reuse is structurally impossible), auth tag stored and verified before `final()`, key length validated at load, `payload_key_id` stored for rotation.
- **Complaint path DNH-8** — verified at all four layers: null `ip_hash` and null `user_agent` in both the service and `app.submit_form`; payload encrypted before the call with the plaintext column passed `null`; the function refuses an unencrypted sensitive payload with `PCSRD_SENSITIVE_PLAINTEXT`; **no analytics library exists anywhere in the repo**, so there is no event to suppress; and sensitive rows are excluded from the general inbox by a SQL predicate, not a UI filter.

## Out of scope but observed

`src/db/schema/redirects.ts:10-11` documents the `redirects` table as read at build time by
`next.config.ts` `redirects()`. **`next.config.ts` defines no `redirects()`**, so the admin's
redirect manager is inert. Functional gap, not security — carried into the T1/T3 merge.

## COVERAGE (T7)

All 13 sub-areas reported, none silent. Exhaustive: both env modules; all 34 exported
actions across 5 files; all 5 route handlers; all 4 validation modules; `rich-text.tsx`;
`upload.ts`; `crypto.ts`; `ip.ts`; `turnstile.ts`; `rate-limit.ts`; `guard.ts`;
`session.ts`; `supabase-server.ts`; all 3 `dangerouslySetInnerHTML` sites; all 57
`href=`/`src=` sites; all 16 `redirect()` sites; all 4 `console.*` sites; all 5 empty
`catch` blocks. Next 16 nonce behaviour and React 19's `sanitizeURL` were checked against
`node_modules` source, then the nonce claim was tested against the running server.

Not verifiable from source: SEC-012 (platform header behaviour). SEC-001 and SEC-002 were
verified against the migrations and, for SEC-001, empirically in PGlite.
