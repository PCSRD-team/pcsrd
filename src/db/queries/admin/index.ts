import { and, desc, eq, ilike, isNull, or, sql } from 'drizzle-orm';
import type { PgColumn, PgTable } from 'drizzle-orm/pg-core';
import { db } from '@/db';
import { readAsActor, rowsOf } from '@/db/session';
import {
  auditLogs,
  formSubmissions,
  impactMetrics,
  mediaAssets,
  pages,
  partners,
  people,
  posts,
  profiles,
  programs,
  projects,
  publications,
  redirects,
  stories,
  vacancies,
} from '@/db/schema';
import type { ContentStatus } from '@/db/schema/enums';
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

export async function getAdminNavCounts(actor: Actor) {
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
}

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
  options: { search?: string; needsConsent?: boolean; page?: number } = {},
) {
  const page = Math.max(1, options.page ?? 1);
  return readAsActor(db, actor, async (tx) => {
    const where = and(
      options.search ? ilike(mediaAssets.altAr, `%${options.search}%`) : undefined,
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

/** Where an asset is used, so a delete can say what it will blank. */
export async function getMediaUsage(actor: Actor, mediaId: string) {
  return readAsActor(db, actor, async (tx) => {
    const rows = await tx.execute<{ entity_type: string; entity_id: string; field: string }>(
      sql`select * from app.media_usage(${mediaId}::uuid)`,
    );
    return [...(Array.isArray(rows) ? rows : (rows as { rows: unknown[] }).rows)] as {
      entity_type: string;
      entity_id: string;
      field: string;
    }[];
  });
}

// ── Inbox ────────────────────────────────────────────────────────────────

export async function listSubmissions(
  actor: Actor,
  options: { sensitive?: boolean; page?: number } = {},
) {
  const page = Math.max(1, options.page ?? 1);
  return readAsActor(db, actor, async (tx) => {
    const where = eq(formSubmissions.isSensitive, options.sensitive ?? false);

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

export async function listAudit(
  actor: Actor,
  options: { entityType?: string; page?: number } = {},
) {
  const page = Math.max(1, options.page ?? 1);
  return readAsActor(db, actor, async (tx) => {
    const where = options.entityType ? eq(auditLogs.entityType, options.entityType) : undefined;

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
