# 05 — Admin Panel (self-built CMS)

Route group `(admin)`, same Next.js app, `force-dynamic`, never cached, `noindex`.

This is ~30–40% of total build effort. Budget it honestly.

---

## 1. Route inventory

```
src/app/(admin)/admin/
├── layout.tsx                        # requireAuth() + AdminShell
├── page.tsx                          # dashboard
├── login/
│   ├── page.tsx                      # public — outside the auth guard
│   └── actions.ts                    # signIn, signOut
│
├── organization/
│   ├── page.tsx                      # singleton editor, tabbed
│   └── actions.ts
│
├── programs/
│   ├── page.tsx                      # list (3 rows)
│   ├── [id]/page.tsx  + actions.ts
│   └── _components/ProgramForm.tsx
│
├── projects/
│   ├── page.tsx                      # DataTable + filters
│   ├── new/page.tsx
│   ├── [id]/page.tsx
│   ├── actions.ts
│   └── _components/ProjectForm.tsx
│
├── posts/          … same shape (list · new · [id] · actions · Form)
├── stories/        … same shape
├── vacancies/      … same shape
├── metrics/        … same shape
├── partners/       … same shape
├── people/         … same shape
├── publications/   … same shape
├── pages/          … list + [key] editor
│
├── media/
│   ├── page.tsx                      # library grid + filters
│   ├── actions.ts                    # update alt/caption/consent, delete
│   └── _components/{MediaGrid,MediaUploader,MediaDetail}.tsx
│
├── submissions/
│   ├── page.tsx                      # non-sensitive only
│   ├── sensitive/page.tsx            # requireSensitiveAccess()
│   ├── [id]/page.tsx
│   └── actions.ts                    # setState, addNote
│
├── users/
│   ├── page.tsx                      # admin only
│   └── actions.ts                    # invite, setRole, toggleSensitive, deactivate
│
├── redirects/  page.tsx + actions.ts
├── audit/      page.tsx              # admin only, read-only
└── _components/                      # shared admin UI
```

Eleven entities share one CRUD shape. **Build the generic layer once** (§3), then each entity is a schema + a form config, not a new screen.

---

## 2. Shell & navigation

`(admin)/admin/layout.tsx`
```tsx
export const dynamic = 'force-dynamic';
export const metadata = { robots: { index: false, follow: false } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireAuth();          // redirects to /admin/login
  return (
    <html lang="ar" dir="rtl" className={arabicFont.variable}>
      <body className="bg-surface-alt">
        <AdminShell profile={profile}>{children}</AdminShell>
        <Toaster />
      </body>
    </html>
  );
}
```

Admin UI is **Arabic-only, RTL**. The staff who use it work in Arabic; a bilingual admin doubles the surface for zero benefit. Content inside it is still bilingual — that is a different axis.

Sidebar groups:

| Group | Items | Visible to |
|---|---|---|
| Overview | Dashboard | all |
| Content | Programmes · Projects · News · Stories · Vacancies · Pages | all |
| Data | Impact metrics · Partners · People · Publications | all |
| Media | Media library | all |
| Inbox | Submissions `(n new)` · Confidential `(n)` | content_manager+, sensitive gated |
| Settings | Organization · Redirects · Users · Audit log | admin (org: content_manager, contact fields only) |

The sidebar badge on **Inbox** counts `state = 'new'` — the one number that makes staff open the panel daily.

---

## 3. Generic CRUD layer

`src/components/admin/`

| Component | Purpose |
|---|---|
| `AdminShell` | Sidebar + topbar + breadcrumbs |
| `DataTable` | Sort, filter, paginate, bulk select, row actions. Column defs per entity |
| `EntityForm` | Renders a field config; handles dirty state, submit, error mapping |
| `BilingualField` | **The core component — §4** |
| `RichTextEditor` | TipTap, RTL-aware, allow-listed extensions |
| `MediaPicker` | Dialog → library or upload → returns `media_id` |
| `MediaUploader` | Drag-drop, alt-text required before submit |
| `StatusBadge` | draft / in_review / published / archived |
| `PublishBar` | Sticky footer: Save draft · Submit for review · Publish · Unpublish · Delete |
| `TranslationBadge` | Shows `translation_status`, computed from filled `_en` fields |
| `ConfirmDialog` | Destructive-action gate |
| `SlugField` | Auto-generates from title per locale, editable, uniqueness-checked |
| `ArrayField` | Repeatable groups (objectives, interventions, values) |
| `RelationField` | Single or multi FK picker with search |
| `EnumSelect` | Typed enum → labelled select |
| `DateRangeField` | Start/end with the `end >= start` constraint |

Field config example — the whole point of the generic layer:
```ts
export const projectFields: FieldConfig<ProjectFormValues>[] = [
  { kind: 'bilingual-text', name: 'title',   label: 'العنوان', required: true },
  { kind: 'slug',           name: 'slug',    from: 'title' },
  { kind: 'relation',       name: 'programId', label: 'البرنامج', entity: 'programs', required: true },
  { kind: 'enum',           name: 'projectState', label: 'الحالة', enum: 'project_status' },
  { kind: 'date-range',     name: ['startDate','endDate'], label: 'الفترة' },
  { kind: 'enum-multi',     name: 'governorates', label: 'المحافظات', enum: 'governorate' },
  { kind: 'enum-multi',     name: 'themes',       label: 'المحاور',   enum: 'theme_tag' },
  { kind: 'relation-multi', name: 'implementingPartners', label: 'الشركاء المنفذون', entity: 'partners', filter: { type: 'implementing' } },
  { kind: 'relation-multi', name: 'donors',              label: 'الممولون',        entity: 'partners', filter: { type: 'donor' } },
  { kind: 'bilingual-text',      name: 'summary', label: 'ملخص', multiline: true },
  { kind: 'bilingual-richtext',  name: 'objective',  label: 'الهدف' },
  { kind: 'bilingual-richtext',  name: 'activities', label: 'الأنشطة' },
  { kind: 'bilingual-richtext',  name: 'outcomes',   label: 'النتائج' },
  { kind: 'media',        name: 'heroMediaId', label: 'الصورة الرئيسية' },
  { kind: 'media-multi',  name: 'gallery',     label: 'معرض الصور' },
  { kind: 'seo' },
];
```

Adding a twelfth entity is a config file, not a screen.

---

## 4. `BilingualField` — the defining component

Everything about the authoring experience hinges on this. Requirements:

1. Both locales visible simultaneously, side by side on desktop, tabbed on mobile
2. Correct `dir` **per field** — the Arabic input is RTL, the English input LTR, on the same row
3. Arabic required, English optional, expressed visually
4. A "copy from Arabic" affordance for fields that are identical across locales (proper nouns, numbers)
5. Per-field character count against the SEO limits (Arabic titles run ~10% longer per character)

```tsx
'use client';
type BilingualFieldProps = {
  name: string;                    // 'title' → title_ar / title_en
  label: string;
  required?: boolean;              // applies to _ar only
  multiline?: boolean;
  maxLength?: { ar?: number; en?: number };
  valueAr: string; valueEn: string;
  onChange: (locale: 'ar'|'en', value: string) => void;
  errorAr?: string; errorEn?: string;
};

export function BilingualField(p: BilingualFieldProps) {
  const Control = p.multiline ? Textarea : Input;
  return (
    <fieldset className="grid gap-3 md:grid-cols-2">
      <legend className="mb-2 text-sm font-medium">
        {p.label}{p.required && <span className="text-danger"> *</span>}
      </legend>

      <div>
        <label htmlFor={`${p.name}_ar`} className="text-xs text-fg-muted">العربية</label>
        <Control id={`${p.name}_ar`} name={`${p.name}_ar`} dir="rtl" lang="ar"
                 value={p.valueAr} required={p.required} maxLength={p.maxLength?.ar}
                 onChange={(e) => p.onChange('ar', e.target.value)} />
        <FieldMeta length={p.valueAr.length} max={p.maxLength?.ar} error={p.errorAr} />
      </div>

      <div>
        <div className="flex items-center justify-between">
          <label htmlFor={`${p.name}_en`} className="text-xs text-fg-muted">English</label>
          <button type="button" onClick={() => p.onChange('en', p.valueAr)}
                  className="text-xs underline">نسخ من العربية</button>
        </div>
        <Control id={`${p.name}_en`} name={`${p.name}_en`} dir="ltr" lang="en"
                 value={p.valueEn} maxLength={p.maxLength?.en}
                 onChange={(e) => p.onChange('en', e.target.value)} />
        <FieldMeta length={p.valueEn.length} max={p.maxLength?.en} error={p.errorEn} />
      </div>
    </fieldset>
  );
}
```

`TranslationBadge` derives `translation_status` automatically rather than asking the editor to maintain it: all `_en` fields empty → `ar_only`; some filled → `partial` (surfaced as a warning); all filled → `human_translated` unless the editor explicitly marks `reviewed`.

---

## 5. Admin Server Actions

Uniform shape. Guard first, always.

```ts
'use server';

export async function upsertProject(
  _prev: ActionResult<{ id: string }> | null,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  const profile = await requireRole(['admin', 'content_manager', 'editor']);

  const parsed = projectAdminSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) {
    return fail('validation', 'أدخل البيانات المطلوبة', parsed.error.flatten().fieldErrors);
  }
  const input = parsed.data;

  // Editors cannot publish.
  if (input.status === 'published' && profile.role === 'editor') {
    return fail('forbidden', 'لا تملك صلاحية النشر');
  }

  const result = await db.transaction(async (tx) => {
    const [row] = input.id
      ? await tx.update(projects)
          .set({ ...input, updatedBy: profile.id, updatedAt: new Date() })
          .where(eq(projects.id, input.id))
          .returning()
      : await tx.insert(projects)
          .values({ ...input, createdBy: profile.id, updatedBy: profile.id })
          .returning();

    // Junctions: delete-then-insert inside the transaction
    await tx.delete(projectPartners).where(eq(projectPartners.projectId, row.id));
    if (input.implementingPartners.length || input.donors.length) {
      await tx.insert(projectPartners).values([
        ...input.implementingPartners.map(pid => ({ projectId: row.id, partnerId: pid, role: 'implementing' as const })),
        ...input.donors.map(pid => ({ projectId: row.id, partnerId: pid, role: 'donor' as const })),
      ]);
    }

    await tx.delete(projectMedia).where(eq(projectMedia.projectId, row.id));
    if (input.gallery.length) {
      await tx.insert(projectMedia).values(
        input.gallery.map((mediaId, i) => ({ projectId: row.id, mediaId, displayOrder: i })),
      );
    }

    await tx.insert(auditLogs).values({
      actorId: profile.id,
      action: input.id ? 'update' : 'create',
      entityType: 'project',
      entityId: row.id,
      diff: buildDiff(input),
    });

    return row;
  });

  revalidateEntity('project', { ar: result.slugAr, en: result.slugEn });
  revalidateTag(TAGS.projectList);
  return ok({ id: result.id });
}
```

Three things this establishes as the pattern for all eleven entities: **guard first**, **transaction wraps the row + its junctions + the audit entry**, **revalidate both locale slugs plus the list tag**.

Per-entity action sets:

| Entity | Actions |
|---|---|
| programs | `upsertProgram`, `reorderPrograms` |
| projects | `upsertProject`, `deleteProject`, `toggleFeatured`, `bulkUpdateStatus` |
| posts | `upsertPost`, `deletePost`, `toggleFeatured`, `bulkUpdateStatus` |
| stories | `upsertStory`, `deleteStory`, `toggleFeatured` |
| vacancies | `upsertVacancy`, `deleteVacancy`, `closeVacancy` |
| metrics | `upsertMetric`, `deleteMetric`, `reorderMetrics`, `toggleFeatured` |
| partners | `upsertPartner`, `deletePartner`, `setLogoPermission`, `reorderPartners` |
| people | `upsertPerson`, `deletePerson`, `togglePublic`, `reorderPeople` |
| publications | `upsertPublication`, `deletePublication` |
| pages | `upsertPage` |
| organization | `updateOrganization`, `updateOfficialChannels` |
| media | `updateMediaMeta`, `deleteMedia` |
| submissions | `setSubmissionState`, `addSubmissionNote` |
| users | `inviteUser`, `setUserRole`, `toggleSensitiveAccess`, `deactivateUser` |
| redirects | `upsertRedirect`, `deleteRedirect` |

`deleteMedia` must first check references across all FK tables and refuse with a list of usages. A hard delete that leaves eleven dangling `hero_media_id` values is the kind of bug that surfaces on the public site, not in the admin.

---

## 6. Media library

**Upload flow** (server-side, via `POST /api/admin/media` — `02-API §6.4`):

```
select file(s)
  → client: size + type pre-check, preview
  → REQUIRED: alt_ar per file (submit disabled until filled)
  → POST multipart
  → server: magic-byte sniff → sharp: rotate() + strip metadata + WebP
            → generate 16px blurDataUrl
            → randomized filename → Storage 'media'
            → insert media_assets (exif_stripped: true)
  → return rows → grid updates
```

Library grid: filter by kind, consent status, "has identifiable minors", date, and usage (used / unused). Detail panel edits `alt_ar` (required), `alt_en`, captions, credit, `consent`, `consent_reference`, `has_identifiable_minors`.

**Consent gate** — the one place the admin blocks an action on protection grounds:
```ts
if (media.hasIdentifiableMinors && media.consent !== 'obtained') {
  return fail('forbidden', 'لا يمكن نشر صورة تتضمن أطفالًا يمكن التعرف عليهم دون موافقة موثقة');
}
```
Checked when a media asset is attached to any entity being set to `published`. This is DNH-2, enforced at the mutation boundary rather than in a policy document.

---

## 7. Submissions inbox

**`/admin/submissions`** — non-sensitive only. Query hard-filters `is_sensitive = false`; the sensitive rows are not merely hidden in the UI, they are absent from the result set.

Columns: reference · type · created · state · handled by · preview. Filters: type, state, date range. Row → detail.

Detail view: full payload rendered by type-specific renderer, attachment link (signed URL, 60s), state control (`new → in_progress → handled → archived`), internal note, audit trail.

**`/admin/submissions/sensitive`** — separate route, `requireSensitiveAccess()`:
- Not linked in the sidebar for users without the permission
- Detail view shows the payload; **no export, no bulk actions, no attachment download**
- Every view is written to `audit_logs` with action `'view_sensitive'` — access to confidential complaints must itself be auditable
- No IP or user agent exists on these rows to display (they were never stored)

---

## 8. Dashboard

Six cards, chosen because each maps to an action someone will take today:

| Card | Content |
|---|---|
| New submissions | Count by type, last 7 days, link to inbox |
| Content status | Drafts / in review / published, per entity |
| Expiring soon | Vacancies closing ≤ 7 days · announcements expiring ≤ 7 days |
| Translation gaps | Published items with `translation_status = 'ar_only'` |
| Missing media alt | Assets where `alt_en` is null (Arabic is required so never null) |
| Recent activity | Last 10 `audit_logs` entries |

No charts. A monthly-visitors graph belongs in the analytics dashboard, which is linked, not rebuilt.

---

## 9. Auth flow

- `/admin/login` — email + password via Supabase Auth. No public sign-up: users are invited by an admin.
- Session in httpOnly cookies via `@supabase/ssr`.
- **2FA (TOTP) required for all admin users** — enable MFA enforcement in the Supabase Auth settings and gate `requireAuth()` on `aal2` for the `admin` role.
- `last_login_at` updated on successful sign-in.
- Deactivated users (`is_active = false`) are rejected by `requireAuth()` even with a valid session.
- Password reset via Supabase's flow, redirecting to `/admin/reset-password`.

```ts
// src/lib/auth/session.ts
import { cache } from 'react';

export const getCurrentProfile = cache(async () => {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();   // getUser, never getSession
  if (!user) return null;
  const [profile] = await db.select().from(profiles).where(eq(profiles.id, user.id)).limit(1);
  return profile && profile.isActive ? profile : null;
});
```

> `getUser()` verifies the JWT with the auth server; `getSession()` trusts the cookie. On an admin panel that difference is the whole security boundary — the same correction applied across the OnlineMihna API routes.

---

## 10. Admin non-goals

Deliberately not built, to keep the surface small:

| Not building | Instead |
|---|---|
| Custom analytics dashboard | Link to Umami/Plausible |
| Scheduled publishing | Publish manually; cadence is ~2–4 posts/month |
| Content versioning UI | `audit_logs` diff is enough for recovery; full version history is a Phase 2 item if ever requested |
| Multi-step approval | Single approver — a two-approver flow in a two-person team stops content moving |
| WYSIWYG page builder | Fixed templates. A page builder is a second product |
| In-app image cropping | Upload correctly sized originals; `next/image` handles the rest |
| Bulk CSV import | One-time seed script covers migration |
