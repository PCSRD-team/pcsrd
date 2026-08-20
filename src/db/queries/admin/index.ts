import { and, desc, eq, ilike, isNull, or, sql } from 'drizzle-orm';
import type { PgColumn, PgTable } from 'drizzle-orm/pg-core';
import { db } from '@/db';
import { readAsActor } from '@/db/session';
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

    const [rows, counted] = await Promise.all([
      tx
        .select({
          id: table.id,
          title: table.titleAr,
          slugAr: table.slugAr,
          status: table.status,
          updatedAt: table.updatedAt,
        })
        .from(table)
        .where(where)
        .orderBy(desc(table.updatedAt))
        .limit(ADMIN_PAGE_SIZE)
        .offset((page - 1) * ADMIN_PAGE_SIZE),
      tx.select({ count: sql<number>`count(*)::int` }).from(table).where(where),
    ]);

    const total = counted[0]?.count ?? 0;
    return {
      items: rows as AdminRow[],
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
  const { organizationSettings } = await import('@/db/schema');
  return readAsActor(db, actor, async (tx) => {
    const [row] = await tx
      .select()
      .from(organizationSettings)
      .where(eq(organizationSettings.id, true))
      .limit(1);
    return row ?? null;
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
