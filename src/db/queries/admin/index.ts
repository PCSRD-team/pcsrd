import { cache } from 'react';
import { and, desc, eq, ilike, inArray, isNull, or, sql } from 'drizzle-orm';
import type { PgColumn, PgTable } from 'drizzle-orm/pg-core';
import { db } from '@/db';
import { readAsActor, rowsOf } from '@/db/session';
import {
  type AuditAction,
  auditLogs,
  formSubmissions,
  impactMetrics,
  mediaAssets,
  pages,
  partners,
  people,
  postMedia,
  posts,
  profiles,
  programMedia,
  programs,
  projectMedia,
  projects,
  publications,
  redirects,
  stories,
  storyMedia,
  vacancies,
} from '@/db/schema';
import type { ContentStatus, SubmissionState, SubmissionType } from '@/db/schema/enums';
import type { Entity } from '@/lib/cache/tags';
import type { Actor } from '@/services/_shared/actor';

/**
 * Admin reads.
 *
 * **Never cached.** An editor who saves a draft and sees the previous version
 * has no way to tell a stale cache from a failed save, and will save again.
 *
 * Every read runs through `readAsActor`, which binds `app.actor_id` and
 * `app.actor_role` to the transaction. Without that the statement executes as
 * `anon` and the RLS policies hide exactly the drafts the editor opened the
 * page to work on.
 */

export const ADMIN_PAGE_SIZE = 25;

/** The columns every content list shows. Kept identical so one table renders all. */
export type AdminRow = {
  id: string;
  title: string;
  slugAr: string;
  status: ContentStatus;
  updatedAt: Date;
};

type ListableTable = PgTable & {
  id: PgColumn;
  titleAr: PgColumn;
  slugAr: PgColumn;
  status: PgColumn;
  updatedAt: PgColumn;
};

const TABLES = {
  project: projects,
  post: posts,
  story: stories,
  vacancy: vacancies,
  publication: publications,
  page: pages,
  program: programs,
} as const;

export type AdminEntity = keyof typeof TABLES;

export const getAdminNavCounts = cache(async function getAdminNavCounts(actor: Actor) {
  return readAsActor(db, actor, async (tx) => {
    const [counts] = rowsOf<{ submissions: number; sensitive: number }>(
      await tx.execute(sql`
        select
          count(*) filter (
            where ${formSubmissions.state} = 'new'
              and ${formSubmissions.isSensitive} = false
          )::int as submissions,
          ${
            actor.canViewSensitive
              ? sql`count(*) filter (
                  where ${formSubmissions.state} = 'new'
                    and ${formSubmissions.isSensitive} = true
                )::int`
              : sql`0::int`
          } as sensitive
        from ${formSubmissions}
      `),
    );

    return { submissions: counts?.submissions ?? 0, sensitive: counts?.sensitive ?? 0 };
  });
});

export async function listAdminRows(
  actor: Actor,
  entity: AdminEntity,
  options: { search?: string; status?: ContentStatus; page?: number } = {},
): Promise<{ items: AdminRow[]; total: number; page: number; totalPages: number }> {
  const table = TABLES[entity] as unknown as ListableTable;
  const page = Math.max(1, options.page ?? 1);

  return readAsActor(db, actor, async (tx) => {
    const where = and(
      options.status ? eq(table.status, options.status) : undefined,
      options.search
        ? or(
            ilike(table.titleAr, `%${options.search}%`),
            ilike(table.slugAr, `%${options.search}%`),
          )
        : undefined,
    );

    const rows = rowsOf<AdminRow & { __total: number }>(
      await tx
        .select({
          id: table.id,
          title: table.titleAr,
          slugAr: table.slugAr,
          status: table.status,
          updatedAt: table.updatedAt,
          __total: sql<number>`count(*) over()::int`,
        })
        .from(table)
        .where(where)
        .orderBy(desc(table.updatedAt))
        .limit(ADMIN_PAGE_SIZE)
        .offset((page - 1) * ADMIN_PAGE_SIZE),
    );

    let total = rows[0]?.__total ?? 0;
    if (total === 0 && page > 1) {
      const [counted] = await tx.select({ count: sql<number>`count(*)::int` }).from(table).where(where);
      total = counted?.count ?? 0;
    }

    return {
      items: rows.map((row) => ({
        id: row.id,
        title: row.title,
        slugAr: row.slugAr,
        status: row.status,
        updatedAt: row.updatedAt,
      })),
      total,
      page,
      totalPages: Math.max(1, Math.ceil(total / ADMIN_PAGE_SIZE)),
    };
  });
}

/**
 * The gallery of a row, as ordered media ids, for its `GalleryPicker`.
 * Entities without a junction table return an empty list.
 */
export async function getAdminGallery(actor: Actor, entity: AdminEntity, id: string): Promise<string[]> {
  return readAsActor(db, actor, async (tx) => {
    const rows =
      entity === 'post'
        ? await tx.select({ mediaId: postMedia.mediaId }).from(postMedia).where(eq(postMedia.postId, id)).orderBy(postMedia.displayOrder)
        : entity === 'story'
          ? await tx.select({ mediaId: storyMedia.mediaId }).from(storyMedia).where(eq(storyMedia.storyId, id)).orderBy(storyMedia.displayOrder)
          : entity === 'program'
            ? await tx.select({ mediaId: programMedia.mediaId }).from(programMedia).where(eq(programMedia.programId, id)).orderBy(programMedia.displayOrder)
            : entity === 'project'
              ? await tx.select({ mediaId: projectMedia.mediaId }).from(projectMedia).where(eq(projectMedia.projectId, id)).orderBy(projectMedia.displayOrder)
              : [];
    return rows.map((row) => row.mediaId);
  });
}

/** One row, whole, for an edit form. */
export async function getAdminRow(actor: Actor, entity: AdminEntity, id: string) {
  const table = TABLES[entity] as unknown as ListableTable;
  return readAsActor(db, actor, async (tx) => {
    const [row] = await tx.select().from(table).where(eq(table.id, id)).limit(1);
    return row ?? null;
  });
}

// ── Dashboard ────────────────────────────────────────────────────────────

export async function getDashboard(actor: Actor) {
  return readAsActor(db, actor, async (tx) => {
    const [content, newSubmissions, sensitiveNew, recentAudit, consentGaps] = await Promise.all([
      tx.execute(sql`
        select 'project' as entity, status::text, count(*)::int as n from ${projects} group by 2
        union all select 'post', status::text, count(*)::int from ${posts} group by 2
        union all select 'story', status::text, count(*)::int from ${stories} group by 2
        union all select 'vacancy', status::text, count(*)::int from ${vacancies} group by 2`),

      tx
        .select({ n: sql<number>`count(*)::int` })
        .from(formSubmissions)
        .where(and(eq(formSubmissions.state, 'new'), eq(formSubmissions.isSensitive, false))),

      // Returns 0 rather than throwing for an actor without access: the badge
      // must not be the thing that reveals a complaint exists.
      actor.canViewSensitive
        ? tx
            .select({ n: sql<number>`count(*)::int` })
            .from(formSubmissions)
            .where(and(eq(formSubmissions.state, 'new'), eq(formSubmissions.isSensitive, true)))
        : Promise.resolve([{ n: 0 }]),

      tx
        .select({
          id: auditLogs.id,
          action: auditLogs.action,
          entityType: auditLogs.entityType,
          entityId: auditLogs.entityId,
          createdAt: auditLogs.createdAt,
          actorName: profiles.fullName,
        })
        .from(auditLogs)
        .leftJoin(profiles, eq(profiles.id, auditLogs.actorId))
        .orderBy(desc(auditLogs.createdAt))
        .limit(10),

      // The one number worth surfacing on a dashboard: assets that would block
      // a publish. Finding this at publish time is finding it too late.
      tx
        .select({ n: sql<number>`count(*)::int` })
        .from(mediaAssets)
        .where(
          and(eq(mediaAssets.hasIdentifiableMinors, true), sql`${mediaAssets.consent} <> 'obtained'`),
        ),
    ]);

    return {
      content: [...(Array.isArray(content) ? content : (content as { rows: unknown[] }).rows)] as {
        entity: string;
        status: string;
        n: number;
      }[],
      newSubmissions: newSubmissions[0]?.n ?? 0,
      sensitiveNew: sensitiveNew[0]?.n ?? 0,
      recentAudit,
      consentGaps: consentGaps[0]?.n ?? 0,
    };
  });
}

// ── Catalogue entities ───────────────────────────────────────────────────

export async function listAdminPartners(actor: Actor) {
  return readAsActor(db, actor, (tx) =>
    tx.select().from(partners).orderBy(partners.displayOrder, partners.nameAr),
  );
}

export async function listAdminPeople(actor: Actor) {
  return readAsActor(db, actor, (tx) =>
    tx.select().from(people).orderBy(people.category, people.displayOrder),
  );
}

export async function listAdminMetrics(actor: Actor) {
  return readAsActor(db, actor, (tx) =>
    tx.select().from(impactMetrics).orderBy(impactMetrics.displayOrder, desc(impactMetrics.periodEnd)),
  );
}

export async function listAdminRedirects(actor: Actor) {
  return readAsActor(db, actor, (tx) =>
    tx.select().from(redirects).orderBy(redirects.sourcePath),
  );
}

/** One catalogue row, whole, for its edit form. */
export async function getAdminPartner(actor: Actor, id: string) {
  return readAsActor(db, actor, async (tx) => {
    const [row] = await tx.select().from(partners).where(eq(partners.id, id)).limit(1);
    return row ?? null;
  });
}

export async function getAdminPerson(actor: Actor, id: string) {
  return readAsActor(db, actor, async (tx) => {
    const [row] = await tx.select().from(people).where(eq(people.id, id)).limit(1);
    return row ?? null;
  });
}

export async function getAdminMetric(actor: Actor, id: string) {
  return readAsActor(db, actor, async (tx) => {
    const [row] = await tx.select().from(impactMetrics).where(eq(impactMetrics.id, id)).limit(1);
    return row ?? null;
  });
}

export async function getAdminOrganization(actor: Actor) {
  return readAsActor(db, actor, async (tx) => {
    const [row] = rowsOf<Record<string, unknown>>(
      await tx.execute(sql`select * from public.organization_settings where id = true limit 1`),
    );
    if (!row) return null;
    return {
      id: row.id,
      legalNameAr: row.legal_name_ar,
      legalNameEn: row.legal_name_en,
      shortNameAr: row.short_name_ar,
      shortNameEn: row.short_name_en,
      acronym: row.acronym,
      shortDescriptionAr: row.short_description_ar ?? null,
      shortDescriptionEn: row.short_description_en ?? null,
      alternateNames: row.alternate_names,
      foundedYear: row.founded_year,
      licenseNumber: row.license_number,
      licenseAuthorityAr: row.license_authority_ar,
      licenseAuthorityEn: row.license_authority_en,
      legalFormAr: row.legal_form_ar,
      legalFormEn: row.legal_form_en,
      visionAr: row.vision_ar,
      visionEn: row.vision_en,
      missionAr: row.mission_ar,
      missionEn: row.mission_en,
      coreValues: row.core_values,
      principles: row.principles,
      strategicObjectives: row.strategic_objectives,
      primaryPhone: row.primary_phone,
      additionalPhones: row.additional_phones,
      whatsappNumber: row.whatsapp_number,
      email: row.email,
      secondaryEmail: row.secondary_email ?? null,
      addressAr: row.address_ar,
      addressEn: row.address_en,
      addressIsPublic: row.address_is_public,
      officeHoursAr: row.office_hours_ar,
      officeHoursEn: row.office_hours_en,
      socials: row.socials,
      officialChannels: row.official_channels,
      footerCtaTitleAr: row.footer_cta_title_ar ?? null,
      footerCtaTitleEn: row.footer_cta_title_en ?? null,
      footerCtaDescriptionAr: row.footer_cta_description_ar ?? null,
      footerCtaDescriptionEn: row.footer_cta_description_en ?? null,
      footerCtaButtonLabelAr: row.footer_cta_button_label_ar ?? null,
      footerCtaButtonLabelEn: row.footer_cta_button_label_en ?? null,
      footerCtaUrl: row.footer_cta_url ?? null,
      footerCtaEnabled: row.footer_cta_enabled ?? false,
      logoPrimaryId: row.logo_primary_id,
      footerLogoId: row.footer_logo_id ?? null,
      logoMonoId: row.logo_mono_id,
      defaultOgId: row.default_og_id,
      updatedAt: row.updated_at,
      updatedBy: row.updated_by,
    };
  });
}

// ── Media library ────────────────────────────────────────────────────────

export async function listAdminMedia(
  actor: Actor,
  options: { search?: string; needsConsent?: boolean; kind?: 'image' | 'document'; page?: number } = {},
) {
  const page = Math.max(1, options.page ?? 1);
  return readAsActor(db, actor, async (tx) => {
    const where = and(
      options.search ? ilike(mediaAssets.altAr, `%${options.search}%`) : undefined,
      options.kind ? eq(mediaAssets.kind, options.kind) : undefined,
      options.needsConsent
        ? and(
            eq(mediaAssets.hasIdentifiableMinors, true),
            sql`${mediaAssets.consent} <> 'obtained'`,
          )
        : undefined,
    );

    const [items, counted] = await Promise.all([
      tx
        .select()
        .from(mediaAssets)
        .where(where)
        .orderBy(desc(mediaAssets.createdAt))
        .limit(ADMIN_PAGE_SIZE)
        .offset((page - 1) * ADMIN_PAGE_SIZE),
      tx.select({ count: sql<number>`count(*)::int` }).from(mediaAssets).where(where),
    ]);

    const total = counted[0]?.count ?? 0;
    return { items, total, page, totalPages: Math.max(1, Math.ceil(total / ADMIN_PAGE_SIZE)) };
  });
}

export async function getAdminMedia(actor: Actor, id: string) {
  return readAsActor(db, actor, async (tx) => {
    const rows = await tx.select().from(mediaAssets).where(eq(mediaAssets.id, id)).limit(1);
    return rows[0] ?? null;
  });
}

/**
 * Where an asset is used, with a title per reference so the detail screen can
 * link to the record rather than print a uuid. `app.media_usage` returns the
 * bare (type, id, field) triples; the titles are looked up per table here.
 *
 * The delete rule in `media.service.ts` reads the same function, so what this
 * lists is exactly what that rule refuses on.
 */
export type MediaUsageRow = {
  entityType: string;
  entityId: string | null;
  field: string;
  title: string | null;
  /** Admin edit URL, when the entity has one. */
  href: string | null;
  /** The cache entity the reference lives under, and the keys its detail tags use. */
  cacheEntity: Entity | null;
  cacheKeys: { ar?: string | null; en?: string | null };
};

type UsageMeta = {
  table: PgTable & { id: PgColumn };
  title: PgColumn;
  path: string;
  entity: Entity;
  /** Columns whose values are the detail tags' keys: slugs, or a `key`. */
  keys?: { ar: PgColumn; en?: PgColumn };
};

const USAGE_TABLES: Record<string, UsageMeta | undefined> = {
  program: { table: programs, title: programs.titleAr, path: 'programs', entity: 'program', keys: { ar: programs.key } },
  program_gallery: { table: programs, title: programs.titleAr, path: 'programs', entity: 'program', keys: { ar: programs.key } },
  project: { table: projects, title: projects.titleAr, path: 'projects', entity: 'project', keys: { ar: projects.slugAr, en: projects.slugEn } },
  project_gallery: { table: projects, title: projects.titleAr, path: 'projects', entity: 'project', keys: { ar: projects.slugAr, en: projects.slugEn } },
  story: { table: stories, title: stories.titleAr, path: 'stories', entity: 'story', keys: { ar: stories.slugAr, en: stories.slugEn } },
  story_gallery: { table: stories, title: stories.titleAr, path: 'stories', entity: 'story', keys: { ar: stories.slugAr, en: stories.slugEn } },
  post: { table: posts, title: posts.titleAr, path: 'posts', entity: 'post', keys: { ar: posts.slugAr, en: posts.slugEn } },
  post_gallery: { table: posts, title: posts.titleAr, path: 'posts', entity: 'post', keys: { ar: posts.slugAr, en: posts.slugEn } },
  vacancy: { table: vacancies, title: vacancies.titleAr, path: 'vacancies', entity: 'vacancy', keys: { ar: vacancies.slugAr, en: vacancies.slugEn } },
  page: { table: pages, title: pages.titleAr, path: 'pages', entity: 'page', keys: { ar: pages.key } },
  publication: { table: publications, title: publications.titleAr, path: 'publications', entity: 'publication', keys: { ar: publications.slugAr, en: publications.slugEn } },
  partner: { table: partners, title: partners.nameAr, path: 'partners', entity: 'partner' },
  person: { table: people, title: people.nameAr, path: 'people', entity: 'person' },
};

export async function getMediaUsage(actor: Actor, mediaId: string): Promise<MediaUsageRow[]> {
  return readAsActor(db, actor, async (tx) => {
    const usages = rowsOf<{ entity_type: string; entity_id: string | null; field: string }>(
      await tx.execute(sql`select * from app.media_usage(${mediaId}::uuid)`),
    );

    /**
     * One query per *table*, not per usage row.
     *
     * This ran a `select … limit 1` inside the loop, and it is not a cold path:
     * `entity-forms.ts` calls it on every media metadata save and
     * `media.service.ts` on every delete. Production runs `max: 1` connection
     * (`src/db/index.ts` — a serverless rule), so those round trips to Tokyo
     * serialised completely. An asset used twelve times cost twelve of them.
     *
     * The same table backs several usage types — `program` and
     * `program_gallery` are both `programs` — so ids are grouped by the entity
     * name rather than by the usage type, and one `inArray` covers all of them.
     */
    type Resolved = { title: string | null; ar: string | null; en: string | null };
    const byEntity = new Map<string, { meta: UsageMeta; ids: Set<string> }>();
    for (const usage of usages) {
      const meta = USAGE_TABLES[usage.entity_type];
      if (!meta || !usage.entity_id) continue;
      const group = byEntity.get(meta.entity) ?? { meta, ids: new Set<string>() };
      group.ids.add(usage.entity_id);
      byEntity.set(meta.entity, group);
    }

    const resolved = new Map<string, Resolved>();
    await Promise.all(
      [...byEntity.values()].map(async ({ meta, ids }) => {
        const rows = await tx
          .select({
            id: meta.table.id,
            title: meta.title,
            ar: meta.keys?.ar ?? sql<null>`null`,
            en: meta.keys?.en ?? sql<null>`null`,
          })
          .from(meta.table)
          .where(inArray(meta.table.id, [...ids]));
        for (const row of rows) {
          resolved.set(row.id as string, {
            title: (row.title as string | undefined) ?? null,
            ar: (row.ar as string | null) ?? null,
            en: (row.en as string | null) ?? null,
          });
        }
      }),
    );

    return usages.map((usage) => {
      const meta = USAGE_TABLES[usage.entity_type];
      const row = usage.entity_id ? resolved.get(usage.entity_id) : undefined;
      return {
        entityType: usage.entity_type,
        entityId: usage.entity_id,
        field: usage.field,
        title: row?.title ?? null,
        cacheEntity: usage.entity_type === 'organization' ? 'orgSettings' : (meta?.entity ?? null),
        cacheKeys: row ? { ar: row.ar, en: row.en } : {},
        href:
          usage.entity_type === 'organization'
            ? '/admin/organization'
            : meta && usage.entity_id
              ? `/admin/${meta.path}/${usage.entity_id}`
              : null,
      } satisfies MediaUsageRow;
    });
  });
}
// ── Inbox ────────────────────────────────────────────────────────────────

export async function listSubmissions(
  actor: Actor,
  options: {
    sensitive?: boolean;
    type?: SubmissionType;
    state?: SubmissionState;
    page?: number;
  } = {},
) {
  const page = Math.max(1, options.page ?? 1);
  return readAsActor(db, actor, async (tx) => {
    // `is_sensitive` is a hard filter, never a UI one (05-ADMIN §7): the
    // confidential rows are absent from the result set, not hidden in it. The
    // type and state filters narrow what is left.
    const where = and(
      eq(formSubmissions.isSensitive, options.sensitive ?? false),
      options.type ? eq(formSubmissions.type, options.type) : undefined,
      options.state ? eq(formSubmissions.state, options.state) : undefined,
    );

    const [items, counted] = await Promise.all([
      tx
        .select({
          id: formSubmissions.id,
          reference: formSubmissions.reference,
          type: formSubmissions.type,
          state: formSubmissions.state,
          createdAt: formSubmissions.createdAt,
          purgeAfter: formSubmissions.purgeAfter,
          hasAttachment: sql<boolean>`${formSubmissions.attachmentPath} is not null`,
          handledBy: profiles.fullName,
        })
        .from(formSubmissions)
        .leftJoin(profiles, eq(profiles.id, formSubmissions.handledBy))
        .where(where)
        .orderBy(desc(formSubmissions.createdAt))
        .limit(ADMIN_PAGE_SIZE)
        .offset((page - 1) * ADMIN_PAGE_SIZE),
      tx.select({ count: sql<number>`count(*)::int` }).from(formSubmissions).where(where),
    ]);

    const total = counted[0]?.count ?? 0;
    return { items, total, page, totalPages: Math.max(1, Math.ceil(total / ADMIN_PAGE_SIZE)) };
  });
}

// ── Users and audit ──────────────────────────────────────────────────────

export async function listUsers(actor: Actor) {
  return readAsActor(db, actor, (tx) =>
    tx.select().from(profiles).orderBy(profiles.role, profiles.fullName),
  );
}

export async function getUser(actor: Actor, id: string) {
  return readAsActor(db, actor, async (tx) => {
    const [row] = await tx.select().from(profiles).where(eq(profiles.id, id)).limit(1);
    return row ?? null;
  });
}

/**
 * The entity types that actually appear in the log, for the filter's options.
 *
 * Read from the table rather than restated as a constant: `entity_type` is a
 * plain text column each service names for itself, so a hand-written list
 * would offer a filter for a type nothing writes and miss one that a new
 * service added.
 */
export async function listAuditEntityTypes(actor: Actor): Promise<string[]> {
  return readAsActor(db, actor, async (tx) => {
    const rows = await tx
      .selectDistinct({ entityType: auditLogs.entityType })
      .from(auditLogs)
      .orderBy(auditLogs.entityType);
    return rows.map((row) => row.entityType);
  });
}

export async function listAudit(
  actor: Actor,
  options: { entityType?: string; action?: AuditAction; page?: number } = {},
) {
  const page = Math.max(1, options.page ?? 1);
  return readAsActor(db, actor, async (tx) => {
    const where = and(
      options.entityType ? eq(auditLogs.entityType, options.entityType) : undefined,
      options.action ? eq(auditLogs.action, options.action) : undefined,
    );

    const [items, counted] = await Promise.all([
      tx
        .select({
          id: auditLogs.id,
          action: auditLogs.action,
          entityType: auditLogs.entityType,
          entityId: auditLogs.entityId,
          diff: auditLogs.diff,
          createdAt: auditLogs.createdAt,
          actorName: profiles.fullName,
          // A system action has no actor, and the audit log says so rather than
          // attributing it to whoever happened to deploy.
          isSystem: isNull(auditLogs.actorId),
        })
        .from(auditLogs)
        .leftJoin(profiles, eq(profiles.id, auditLogs.actorId))
        .where(where)
        .orderBy(desc(auditLogs.createdAt))
        .limit(ADMIN_PAGE_SIZE)
        .offset((page - 1) * ADMIN_PAGE_SIZE),
      tx.select({ count: sql<number>`count(*)::int` }).from(auditLogs).where(where),
    ]);

    const total = counted[0]?.count ?? 0;
    return { items, total, page, totalPages: Math.max(1, Math.ceil(total / ADMIN_PAGE_SIZE)) };
  });
}

/** Options for a relation picker. */
export async function listRelationOptions(actor: Actor, entity: 'programs' | 'partners' | 'projects') {
  return readAsActor(db, actor, async (tx) => {
    if (entity === 'programs') {
      return tx
        .select({ id: programs.id, label: programs.titleAr, meta: programs.key })
        .from(programs)
        .orderBy(programs.displayOrder);
    }
    if (entity === 'partners') {
      return tx
        .select({ id: partners.id, label: partners.nameAr, meta: partners.type })
        .from(partners)
        .orderBy(partners.nameAr);
    }
    return tx
      .select({ id: projects.id, label: projects.titleAr, meta: projects.status })
      .from(projects)
      .orderBy(desc(projects.updatedAt));
  });
}
