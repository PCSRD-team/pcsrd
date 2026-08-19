# 02 — Backend / API Layer

The "backend" is three things: the **query layer** (Drizzle, read), **Server Actions** (write), and a small **REST surface** for machine consumers.

---

## 1. Surface map

| Kind | Path | Auth | Purpose |
|---|---|---|---|
| Server Action | `(site)/…/partner/actions.ts` → `submitPartnership` | public + Turnstile | Partnership inquiry |
| Server Action | `(site)/…/contact/actions.ts` → `submitContact` | public + Turnstile | General enquiry |
| Server Action | `(site)/…/volunteer/actions.ts` → `submitVolunteer` | public + Turnstile | Volunteer application |
| Server Action | `(site)/…/careers/[slug]/actions.ts` → `submitJobApplication` | public + Turnstile | Job application + CV |
| Server Action | `(site)/…/contact/actions.ts` → `submitComplaint` | public + Turnstile | CFM (anonymous allowed) |
| Server Action | `(site)/…/verify/actions.ts` → `submitFraudReport` | public + Turnstile | Impersonation report |
| Server Action | `(admin)/admin/**/actions.ts` | session + role | All CMS mutations (`05-ADMIN §4`) |
| Route Handler | `GET /api/health` | none | Uptime probe |
| Route Handler | `GET /feed.xml` | none | News RSS |
| Route Handler | `GET /api/cron/archive-expired` | `CRON_SECRET` | Archive + revalidate |
| Route Handler | `GET /api/cron/purge-submissions` | `CRON_SECRET` | Retention purge |
| Route Handler | `POST /api/admin/media` | session + role | Upload (multipart, EXIF strip) |
| Route Handler | `GET /api/admin/submissions/[id]/attachment` | session + role | Signed URL for a CV |

No public REST. Six form endpoints that no third party will ever call do not justify a REST surface, and Server Actions give progressive enhancement for free.

---

## 2. Directory layout

```
src/lib/
├── auth/
│   ├── supabase-server.ts      # createServerClient with cookie adapter
│   ├── session.ts              # getSession(), getCurrentProfile()
│   └── guard.ts                # requireAuth(), requireRole(), requireSensitiveAccess()
├── validation/
│   ├── common.ts               # phone, email, locale, slug primitives
│   ├── partnership.ts
│   ├── contact.ts
│   ├── volunteer.ts
│   ├── job.ts
│   ├── complaint.ts
│   ├── fraud.ts
│   └── admin/                  # one file per entity
├── security/
│   ├── rate-limit.ts
│   ├── turnstile.ts
│   ├── ip.ts                   # hashIp()
│   └── upload.ts               # magic bytes, EXIF strip, dimensions
├── mail/
│   ├── client.ts               # Resend
│   ├── templates/              # React Email
│   └── send.ts                 # sendNotification(), sendAcknowledgement()
├── cache/
│   └── tags.ts                 # tag constants + revalidateEntity()
├── whatsapp.ts                 # buildWhatsAppUrl()
├── analytics.ts                # server-side event dispatch
├── errors.ts                   # AppError, toActionResult()
└── utils.ts
```

---

## 3. Result contract

Every Server Action returns the same discriminated union. The UI never branches on `try/catch`.

`src/lib/errors.ts`
```ts
export type ActionResult<T = void> =
  | { ok: true;  data: T }
  | { ok: false; code: ErrorCode; message: string; fieldErrors?: Record<string, string[]> };

export type ErrorCode =
  | 'validation' | 'captcha' | 'rate_limited' | 'unauthorized'
  | 'forbidden'  | 'not_found' | 'conflict'   | 'upload_rejected'
  | 'internal';

export const fail = (code: ErrorCode, message: string, fieldErrors?: Record<string,string[]>): ActionResult<never> =>
  ({ ok: false, code, message, fieldErrors });

export const ok = <T>(data: T): ActionResult<T> => ({ ok: true, data });
```

Messages returned to the client are **localized keys**, resolved by the form component — the server never returns English strings to an Arabic page.

---

## 4. Query layer

`src/db/queries/*` — one module per entity. Rules:

1. Every public query filters `status = 'published'`.
2. Every public query is wrapped in `unstable_cache` with the entity's tags.
3. Queries take `locale` and return **locale-resolved** objects, so components never write `locale === 'ar' ? x.titleAr : x.titleEn`.
4. Admin queries live in `src/db/queries/admin/*` and are never cached.

### 4.1 Locale resolution helper

`src/db/queries/_localize.ts`
```ts
import type { Locale } from '@/i18n/config';

/** Pick the locale field, falling back to Arabic when English is missing. */
export function pick<T extends Record<string, unknown>>(
  row: T, base: string, locale: Locale
): string | null {
  const primary = row[`${base}${locale === 'ar' ? 'Ar' : 'En'}`] as string | null;
  const fallback = row[`${base}Ar`] as string | null;
  return primary ?? fallback ?? null;
}

/** True when the requested locale genuinely has content (drives the
 *  "translation coming soon" notice — spec §21.5). */
export const hasLocale = (row: { translationStatus: string }, locale: Locale) =>
  locale === 'ar' || row.translationStatus !== 'ar_only';
```

### 4.2 Projects — the faceted query

`src/db/queries/projects.ts`
```ts
import { and, arrayOverlaps, desc, eq, gte, lte, sql } from 'drizzle-orm';
import { unstable_cache } from 'next/cache';
import { db } from '@/db';
import { projects, programs, projectPartners, partners, mediaAssets } from '@/db/schema';
import { TAGS } from '@/lib/cache/tags';
import type { Locale } from '@/i18n/config';

export type ProjectFilters = {
  program?: string;
  governorates?: Governorate[];
  themes?: ThemeTag[];
  year?: number;
  partnerId?: string;
  state?: ProjectStatus;
  page?: number;
};

export const listProjects = (locale: Locale, filters: ProjectFilters) =>
  unstable_cache(
    async () => {
      const PER_PAGE = 12;
      const page = Math.max(1, filters.page ?? 1);

      const where = and(
        eq(projects.status, 'published'),
        filters.program      ? eq(programs.key, filters.program) : undefined,
        filters.state        ? eq(projects.projectState, filters.state) : undefined,
        // GIN-backed array overlap — this is why the gin indexes exist
        filters.governorates?.length ? arrayOverlaps(projects.governorates, filters.governorates) : undefined,
        filters.themes?.length       ? arrayOverlaps(projects.themes, filters.themes) : undefined,
        filters.year ? and(
          gte(projects.startDate, `${filters.year}-01-01`),
          lte(projects.startDate, `${filters.year}-12-31`),
        ) : undefined,
      );

      const [rows, [{ count }]] = await Promise.all([
        db.select({
            id: projects.id,
            slug: locale === 'ar' ? projects.slugAr : projects.slugEn,
            title: sql<string>`coalesce(${locale === 'ar' ? projects.titleAr : projects.titleEn}, ${projects.titleAr})`,
            summary: sql<string>`coalesce(${locale === 'ar' ? projects.summaryAr : projects.summaryEn}, ${projects.summaryAr})`,
            state: projects.projectState,
            startDate: projects.startDate,
            endDate: projects.endDate,
            governorates: projects.governorates,
            programKey: programs.key,
            programTitle: sql<string>`coalesce(${locale === 'ar' ? programs.titleAr : programs.titleEn}, ${programs.titleAr})`,
            heroPath: mediaAssets.path,
            heroAlt: sql<string>`coalesce(${locale === 'ar' ? mediaAssets.altAr : mediaAssets.altEn}, ${mediaAssets.altAr})`,
            heroBlur: mediaAssets.blurDataUrl,
          })
          .from(projects)
          .innerJoin(programs, eq(programs.id, projects.programId))
          .leftJoin(mediaAssets, eq(mediaAssets.id, projects.heroMediaId))
          .where(where)
          .orderBy(desc(projects.publishedAt))
          .limit(PER_PAGE)
          .offset((page - 1) * PER_PAGE),

        db.select({ count: sql<number>`count(*)::int` })
          .from(projects)
          .innerJoin(programs, eq(programs.id, projects.programId))
          .where(where),
      ]);

      return { items: rows, total: count, page, perPage: PER_PAGE };
    },
    ['projects:list', locale, JSON.stringify(filters)],
    { tags: [TAGS.projectList], revalidate: 3600 },
  )();
```

`getProjectBySlug(slug, locale)` additionally joins `project_partners → partners` (splitting `implementing` / `donor`), `project_media → media_assets`, and related stories/posts — in a single round trip using Drizzle relational queries where the shape allows.

### 4.3 Facet counts

The filter panel shows counts per option. One query, not N:

```ts
export const getProjectFacets = (locale: Locale) =>
  unstable_cache(async () => {
    const [byProgram, byGovernorate, byYear] = await Promise.all([
      db.select({ key: programs.key, count: sql<number>`count(*)::int` })
        .from(projects).innerJoin(programs, eq(programs.id, projects.programId))
        .where(eq(projects.status,'published')).groupBy(programs.key),

      // unnest the enum array, then aggregate
      db.execute(sql`
        select unnest(governorates) as key, count(*)::int as count
        from projects where status='published' group by 1 order by 2 desc`),

      db.execute(sql`
        select extract(year from start_date)::int as key, count(*)::int as count
        from projects where status='published' and start_date is not null
        group by 1 order by 1 desc`),
    ]);
    return { byProgram, byGovernorate: byGovernorate.rows, byYear: byYear.rows };
  }, ['projects:facets', locale], { tags: [TAGS.projectList], revalidate: 3600 })();
```

### 4.4 Metrics

```ts
export const listPublicMetrics = (locale: Locale, opts?: { programKey?: string; featuredOnly?: boolean }) =>
  unstable_cache(async () =>
    db.select({ /* … */ })
      .from(impactMetrics)
      .leftJoin(programs, eq(programs.id, impactMetrics.programId))
      .where(and(
        eq(impactMetrics.status, 'verified'),   // /impact + homepage
        eq(impactMetrics.isPublic, true),
        opts?.featuredOnly ? eq(impactMetrics.isFeatured, true) : undefined,
        opts?.programKey ? eq(programs.key, opts.programKey) : undefined,
      ))
      .orderBy(impactMetrics.displayOrder),
  ['metrics:public', locale, JSON.stringify(opts)], { tags: [TAGS.metricList], revalidate: 3600 })();

// /about/strategy uses the same table with status='target'
export const listTargetMetrics = (locale: Locale) => /* …eq(status,'target') */;
```

### 4.5 Partners — the logo gate

```ts
export const listPartners = (locale: Locale) =>
  unstable_cache(async () => {
    const rows = await db.select({ /* … */ logoPath: mediaAssets.path, logoPermission: partners.logoPermission })
      .from(partners)
      .leftJoin(mediaAssets, eq(mediaAssets.id, partners.logoMediaId))
      .where(eq(partners.status,'published'))
      .orderBy(partners.displayOrder);

    // Permission enforced here, not in the component.
    return rows.map(r => ({ ...r, logoPath: r.logoPermission === 'granted' ? r.logoPath : null }));
  }, ['partners:list', locale], { tags: [TAGS.partnerList], revalidate: 3600 })();
```

### 4.6 Cache tags

`src/lib/cache/tags.ts`
```ts
export const TAGS = {
  orgSettings: 'org:settings',
  programList: 'program:list',
  program:  (slug: string) => `program:${slug}`,
  projectList: 'project:list',
  project:  (slug: string) => `project:${slug}`,
  postList: 'post:list',
  post:     (slug: string) => `post:${slug}`,
  storyList: 'story:list',
  story:    (slug: string) => `story:${slug}`,
  vacancyList: 'vacancy:list',
  vacancy:  (slug: string) => `vacancy:${slug}`,
  partnerList: 'partner:list',
  metricList: 'metric:list',
  personList: 'person:list',
  publicationList: 'publication:list',
  page:     (key: string)  => `page:${key}`,
} as const;

import { revalidateTag } from 'next/cache';
export function revalidateEntity(entity: keyof typeof TAGS, slugs?: { ar?: string; en?: string }) {
  revalidateTag(TAGS[`${entity}List` as keyof typeof TAGS] as string);
  if (slugs?.ar) revalidateTag((TAGS[entity] as (s: string) => string)(slugs.ar));
  if (slugs?.en) revalidateTag((TAGS[entity] as (s: string) => string)(slugs.en));
}
```

Both slugs are busted because the two locales are separate cache entries.

---

## 5. Public Server Actions

### 5.1 Shared pipeline

Every public form action runs the same five steps, in this order:

```
rate limit → parse+validate (Zod) → verify Turnstile → persist → notify (after())
```

`src/lib/security/rate-limit.ts`
```ts
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

const redis = Redis.fromEnv();

export const limiters = {
  form:   new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(5, '1 h'),  prefix: 'rl:form' }),
  upload: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(3, '1 h'),  prefix: 'rl:upload' }),
  global: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(30, '1 h'), prefix: 'rl:global' }),
};

export async function checkRateLimit(key: 'form'|'upload'|'global', id: string) {
  const { success, reset } = await limiters[key].limit(id);
  return { success, retryAfterSeconds: Math.ceil((reset - Date.now()) / 1000) };
}
```

`src/lib/security/turnstile.ts`
```ts
export async function verifyTurnstile(token: string, ip?: string): Promise<boolean> {
  if (!token) return false;
  const body = new FormData();
  body.append('secret', process.env.TURNSTILE_SECRET_KEY!);
  body.append('response', token);
  if (ip) body.append('remoteip', ip);
  const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify',
    { method: 'POST', body });
  const data = (await res.json()) as { success: boolean };
  return data.success === true;
}
```

`src/lib/security/ip.ts`
```ts
import { createHash } from 'node:crypto';
import { headers } from 'next/headers';

export async function getClientIp(): Promise<string> {
  const h = await headers();
  return h.get('x-forwarded-for')?.split(',')[0]?.trim()
      ?? h.get('x-real-ip')
      ?? 'unknown';
}

/** Raw IPs are never persisted (RULE 9). */
export const hashIp = (ip: string) =>
  createHash('sha256').update(ip + process.env.IP_HASH_SALT!).digest('hex');
```

### 5.2 Reference implementation — partnership

`src/lib/validation/partnership.ts`
```ts
import { z } from 'zod';

export const partnershipSchema = z.object({
  organizationName: z.string().trim().min(2).max(120),
  organizationType: z.enum(['un','ingo','foundation','government','local_ngo','private','other']),
  country:          z.string().length(2),
  contactName:      z.string().trim().min(2).max(80),
  role:             z.string().trim().min(2).max(80),
  email:            z.string().trim().email().max(160),
  phone:            z.string().trim().regex(/^\+?[1-9]\d{7,14}$/).optional().or(z.literal('')),
  interest:         z.array(z.enum(['funding','consortium','implementation','technical','other'])).min(1),
  programs:         z.array(z.enum(['protection','humanitarian_response','early_recovery'])).default([]),
  message:          z.string().trim().min(20).max(2000),
  locale:           z.enum(['ar','en']).default('ar'),
  turnstileToken:   z.string().min(1),
  // honeypot: bots fill it, humans never see it
  website:          z.string().max(0).optional(),
});

export type PartnershipInput = z.infer<typeof partnershipSchema>;
```

`src/app/(site)/[locale]/get-involved/partner/actions.ts`
```ts
'use server';

import { after } from 'next/server';
import { db } from '@/db';
import { formSubmissions } from '@/db/schema';
import { partnershipSchema } from '@/lib/validation/partnership';
import { checkRateLimit } from '@/lib/security/rate-limit';
import { verifyTurnstile } from '@/lib/security/turnstile';
import { getClientIp, hashIp } from '@/lib/security/ip';
import { sendPartnershipNotification, sendPartnershipAcknowledgement } from '@/lib/mail/send';
import { ok, fail, type ActionResult } from '@/lib/errors';
import { addMonths } from '@/lib/utils';

export async function submitPartnership(
  _prev: ActionResult<{ reference: string }> | null,
  formData: FormData,
): Promise<ActionResult<{ reference: string }>> {
  const ip = await getClientIp();

  const rl = await checkRateLimit('form', ip);
  if (!rl.success) return fail('rate_limited', 'errors.rateLimited');

  const parsed = partnershipSchema.safeParse({
    ...Object.fromEntries(formData),
    interest: formData.getAll('interest'),
    programs: formData.getAll('programs'),
    turnstileToken: formData.get('cf-turnstile-response'),
  });
  if (!parsed.success) {
    return fail('validation', 'errors.validation', parsed.error.flatten().fieldErrors);
  }
  if (parsed.data.website) return ok({ reference: 'PCS-000000' }); // honeypot: silent success
  if (!(await verifyTurnstile(parsed.data.turnstileToken, ip))) {
    return fail('captcha', 'errors.captcha');
  }

  const { turnstileToken, website, ...payload } = parsed.data;

  // Persist first. Email is the least reliable link; a lost partnership
  // inquiry is the most expensive failure this site can have.
  const [row] = await db.insert(formSubmissions).values({
    type: 'partnership',
    isSensitive: false,
    locale: payload.locale,
    payload,
    ipHash: hashIp(ip),
    userAgent: (await headers()).get('user-agent')?.slice(0, 255) ?? null,
    purgeAfter: addMonths(new Date(), 24),
  }).returning({ reference: formSubmissions.reference });

  after(async () => {
    await Promise.allSettled([
      sendPartnershipNotification(row.reference, payload),
      sendPartnershipAcknowledgement(payload.email, payload.locale, row.reference),
    ]);
  });

  return ok({ reference: row.reference });
}
```

### 5.3 Per-form differences

| Action | Deviations from the reference |
|---|---|
| `submitContact` | Adds `enquiryType: 'general'\|'partnership'\|'media'\|'complaint'`; routes to a different `MAIL_TO_*`; retention 12 mo |
| `submitVolunteer` | Collects **age band, not date of birth**; **governorate, not address**; no national ID (spec §20.5 minimization). Retention 12 mo |
| `submitJobApplication` | Accepts a `File`; runs `validateUpload()`; stores in the private `applications` bucket; `attachmentPath` on the row; `upload` rate limiter; retention 12 mo after the vacancy closes |
| `submitComplaint` | **`isSensitive: true`**. `ipHash = null`, `userAgent = null`. Identity fields optional (anonymous permitted). Notifies `MAIL_TO_SENSITIVE` only. **No analytics event fires.** |
| `submitFraudReport` | Reporter contact optional. Retention 24 mo |

`submitComplaint`, extract:
```ts
const [row] = await db.insert(formSubmissions).values({
  type: 'complaint',
  isSensitive: true,
  locale: payload.locale,
  payload,
  ipHash: null,        // DNH-8: a complainant must not be re-identifiable
  userAgent: null,
  purgeAfter: addMonths(new Date(), 24),
}).returning({ reference: formSubmissions.reference });
// no trackServerEvent() call here — deliberate
```

### 5.4 Upload validation

`src/lib/security/upload.ts`
```ts
import { fileTypeFromBuffer } from 'file-type';
import sharp from 'sharp';

const CV_MIME = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

export async function validateCvUpload(file: File) {
  if (file.size > 5 * 1024 * 1024) return { ok: false as const, reason: 'too_large' };
  const buf = Buffer.from(await file.arrayBuffer());
  const sniffed = await fileTypeFromBuffer(buf);           // magic bytes, not the extension
  if (!sniffed || !CV_MIME.has(sniffed.mime)) return { ok: false as const, reason: 'bad_type' };
  return { ok: true as const, buffer: buf, mime: sniffed.mime, ext: sniffed.ext };
}

/** Images: strip ALL metadata (DNH-1) and normalize. */
export async function processImageUpload(file: File) {
  const buf = Buffer.from(await file.arrayBuffer());
  const sniffed = await fileTypeFromBuffer(buf);
  if (!sniffed || !['jpg','png','webp','avif'].includes(sniffed.ext)) {
    return { ok: false as const, reason: 'bad_type' };
  }
  const img = sharp(buf, { failOn: 'error' });
  const meta = await img.metadata();

  // .rotate() applies EXIF orientation then discards it; sharp drops all
  // other metadata unless withMetadata() is called — which we never call.
  const output = await img.rotate().webp({ quality: 82 }).toBuffer();

  const blur = (await sharp(output).resize(16).webp({ quality: 40 }).toBuffer()).toString('base64');

  return {
    ok: true as const,
    buffer: output,
    mime: 'image/webp',
    width: meta.width ?? null,
    height: meta.height ?? null,
    blurDataUrl: `data:image/webp;base64,${blur}`,
    exifStripped: true,
  };
}
```

Filenames are randomized on store: `${crypto.randomUUID()}.${ext}`. The original filename is never used in a path.

---

## 6. Route handlers

### 6.1 `GET /api/health`
```ts
export const dynamic = 'force-dynamic';
export async function GET() {
  try {
    await db.execute(sql`select 1`);
    return Response.json({ status: 'ok', ts: new Date().toISOString() });
  } catch {
    return Response.json({ status: 'degraded' }, { status: 503 });
  }
}
```

### 6.2 `GET /feed.xml`
Latest 20 published posts, Arabic. `Content-Type: application/rss+xml`, `revalidate: 3600`.

### 6.3 `GET /api/cron/archive-expired`
```ts
export async function GET(req: Request) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }
  const posts = await db.update(postsTable)
    .set({ status: 'archived' })
    .where(and(eq(postsTable.category,'announcement'),
               eq(postsTable.status,'published'),
               lt(postsTable.expiresAt, new Date())))
    .returning({ slugAr: postsTable.slugAr, slugEn: postsTable.slugEn });

  const vacancies = await db.update(vacanciesTable)
    .set({ status: 'archived' })
    .where(and(eq(vacanciesTable.status,'published'),
               lt(vacanciesTable.deadline, new Date().toISOString().slice(0,10))))
    .returning({ slugAr: vacanciesTable.slugAr, slugEn: vacanciesTable.slugEn });

  // The whole point: a closed vacancy must stop rendering as open.
  if (posts.length)     revalidateEntity('post',    undefined);
  if (vacancies.length) revalidateEntity('vacancy', undefined);
  posts.forEach(p => revalidateEntity('post', p));
  vacancies.forEach(v => revalidateEntity('vacancy', v));

  return Response.json({ archivedPosts: posts.length, archivedVacancies: vacancies.length });
}
```

`vercel.json`
```json
{ "crons": [
  { "path": "/api/cron/archive-expired",   "schedule": "0 * * * *" },
  { "path": "/api/cron/purge-submissions", "schedule": "30 0 * * *" }
]}
```

### 6.4 `POST /api/admin/media`
Multipart upload. `requireRole(['admin','content_manager','editor'])` → `processImageUpload()` → Storage upload via service-role client → insert `media_assets` with required `altAr` from the form → return the row. `alt` missing ⇒ 400 before anything is written.

### 6.5 `GET /api/admin/submissions/[id]/attachment`
`requireRole` → load the submission → if `isSensitive`, additionally `requireSensitiveAccess()` → `storage.from('applications').createSignedUrl(path, 60)` → 302 redirect. The private bucket is never made public, and links expire in 60 seconds.

---

## 7. Auth & guards

`src/lib/auth/guard.ts`
```ts
import { redirect } from 'next/navigation';
import { getCurrentProfile } from './session';
import type { UserRole } from '@/db/schema/enums';

export async function requireAuth() {
  const profile = await getCurrentProfile();
  if (!profile || !profile.isActive) redirect('/admin/login');
  return profile;
}

export async function requireRole(roles: UserRole[]) {
  const profile = await requireAuth();
  if (!roles.includes(profile.role)) redirect('/admin?error=forbidden');
  return profile;
}

/** Confidential complaints. Deliberately NOT derived from role. */
export async function requireSensitiveAccess() {
  const profile = await requireAuth();
  if (!profile.canViewSensitive) redirect('/admin?error=forbidden');
  return profile;
}
```

Permission matrix:

| Capability | admin | content_manager | editor |
|---|---|---|---|
| Read all content | ✅ | ✅ | ✅ |
| Create / edit content | ✅ | ✅ | ✅ |
| Publish / unpublish | ✅ | ✅ | ❌ |
| Delete content | ✅ | ❌ | ❌ |
| Org settings | ✅ | ⚠ contact only | ❌ |
| Media upload | ✅ | ✅ | ✅ |
| Media delete | ✅ | ✅ | ❌ |
| Submissions (non-sensitive) | ✅ | ✅ | ❌ |
| Submissions (sensitive) | `can_view_sensitive` | `can_view_sensitive` | ❌ |
| Users | ✅ | ❌ | ❌ |
| Audit log | ✅ | ❌ | ❌ |

Every admin Server Action calls a guard as its **first statement**. No exceptions — a guard in the page but not the action is an open endpoint.

---

## 8. Mail

`src/lib/mail/send.ts` exposes typed senders; all templates are React Email, bilingual, and rendered by locale.

| Function | To | Template |
|---|---|---|
| `sendPartnershipNotification` | `MAIL_TO_PARTNERSHIP` | `PartnershipNotification` |
| `sendPartnershipAcknowledgement` | submitter | `PartnershipAck` — includes the dossier link + reference |
| `sendContactNotification` | routed by `enquiryType` | `ContactNotification` |
| `sendVolunteerNotification` / `Ack` | `MAIL_TO_GENERAL` / submitter | — |
| `sendJobNotification` / `Ack` | `MAIL_TO_HR` / submitter | — |
| `sendComplaintNotification` | `MAIL_TO_SENSITIVE` | **No payload in the body** — reference only, with a link into the admin. Complaint content must not sit in an inbox |
| `sendFraudNotification` | `MAIL_TO_GENERAL` | — |

All sends wrapped in `Promise.allSettled` inside `after()`. A failed send never fails a submission.

---

## 9. Security headers & middleware

`middleware.ts`
```ts
import { NextResponse, type NextRequest } from 'next/server';
import { locales, defaultLocale } from '@/i18n/config';

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // 1 — locale prefix
  const hasLocale = locales.some(l => pathname === `/${l}` || pathname.startsWith(`/${l}/`));
  if (!hasLocale && !pathname.startsWith('/api') && !pathname.startsWith('/admin')) {
    const url = req.nextUrl.clone();
    url.pathname = `/${defaultLocale}${pathname === '/' ? '' : pathname}`;
    return NextResponse.redirect(url, 307);
  }

  // 2 — CSP nonce
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  const csp = [
    `default-src 'self'`,
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' https://challenges.cloudflare.com`,
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' data: blob: https://*.supabase.co`,
    `font-src 'self'`,
    `connect-src 'self' https://*.supabase.co https://challenges.cloudflare.com ${process.env.NEXT_PUBLIC_ANALYTICS_URL ?? ''}`,
    `frame-src https://challenges.cloudflare.com`,
    `frame-ancestors 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    `object-src 'none'`,
    `upgrade-insecure-requests`,
  ].join('; ');

  const headers = new Headers(req.headers);
  headers.set('x-nonce', nonce);
  const res = NextResponse.next({ request: { headers } });
  res.headers.set('Content-Security-Policy', csp);
  res.headers.set('X-Content-Type-Options', 'nosniff');
  res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.headers.set('X-Frame-Options', 'DENY');
  res.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
  res.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  return res;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|fonts|icons|.*\\.(?:svg|png|jpg|webp|avif|woff2)$).*)'],
};
```

> `style-src 'unsafe-inline'` is required by Next's inlined critical CSS. Everything else is nonce-locked. `frame-src` allows only the Turnstile challenge frame.

Admin session checking is **not** in middleware — it happens in `(admin)/admin/layout.tsx` via `requireAuth()`, because middleware runs on the edge and a DB round-trip there costs every request. The layout guard is enough; the actions guard again anyway (defense in depth).

---

## 10. Error handling & observability

- `error.tsx` per route group; `global-error.tsx` at the root.
- Sentry: `sendDefaultPii: false`, `beforeSend` scrubs `email`, `phone`, `message`, and anything under `payload`.
- Server Actions never throw to the client — they return `ActionResult`. Unexpected throws are caught by a wrapper, logged to Sentry with the reference, and returned as `fail('internal', 'errors.unexpected')`.
- No `console.log` of form payloads. Ever. ESLint `no-console` with a `warn`/`error` allow-list.
