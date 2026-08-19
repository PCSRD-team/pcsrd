import { eq } from 'drizzle-orm';
import type { Db, Tx } from '@/db';
import { projectMedia, projectPartners, projects } from '@/db/schema';
import type {
  ContentStatus,
  Governorate,
  PartnerRole,
  ProjectStatus,
  ThemeTag,
  TranslationStatus,
} from '@/db/schema/enums';
import type { RichText } from '@/db/schema/_shared';
import { AppError, notFound } from '@/lib/errors';
import type { Actor } from '../_shared/actor';
import { writeAudit } from '../_shared/audit';
import { computeDiff } from '../_shared/diff';
import { assertCan } from '../_shared/permissions';
import { assertCanTransition, assertMediaConsent } from '../_shared/publish';
import { assertSlugsUnique, deriveSlugs } from '../_shared/slug';

/**
 * Projects — the template the other ten content services follow.
 *
 * The shape is always the same five steps, in this order:
 *
 *   permission → slug uniqueness → publish gates → one transaction → audit
 *
 * The transaction covers the row, its junction rows and the audit entry
 * together. Splitting them would allow a project to be saved with the wrong
 * partners attached, or an audit entry to survive a rolled-back write.
 */

export type ProjectPartnerLink = { partnerId: string; role: PartnerRole };
export type ProjectMediaLink = { mediaId: string; displayOrder?: number };

export type ProjectInput = {
  id?: string;

  programId: string;
  titleAr: string;
  titleEn?: string | null;
  slugAr?: string | null;
  slugEn?: string | null;
  summaryAr?: string | null;
  summaryEn?: string | null;
  objectiveAr?: RichText | null;
  objectiveEn?: RichText | null;
  activitiesAr?: RichText | null;
  activitiesEn?: RichText | null;
  outcomesAr?: RichText | null;
  outcomesEn?: RichText | null;

  projectState?: ProjectStatus;
  startDate?: string | null;
  endDate?: string | null;
  governorates?: Governorate[];
  localities?: string[];
  themes?: ThemeTag[];

  heroMediaId?: string | null;
  isFeatured?: boolean;
  sourceNote?: string | null;

  seoTitleAr?: string | null;
  seoTitleEn?: string | null;
  seoDescriptionAr?: string | null;
  seoDescriptionEn?: string | null;
  ogMediaId?: string | null;
  noIndex?: boolean;

  status?: ContentStatus;
  translationStatus?: TranslationStatus;

  /** Replaced wholesale, not merged — see `replaceLinks`. */
  partners?: ProjectPartnerLink[];
  media?: ProjectMediaLink[];
};

/** What an action needs in order to invalidate the right cache tags. */
export type ContentMutationResult = {
  id: string;
  slugAr: string;
  slugEn: string;
  status: ContentStatus;
  /** The slugs *before* the edit, so a renamed page's old URL is busted too. */
  previousSlugs?: { ar: string; en: string };
};

/**
 * Junction rows are replaced, never merged.
 *
 * A form posts the complete set of partners it wants; treating that as a delta
 * would make removing the last partner impossible, because an empty list would
 * read as "no change". Deleting and re-inserting inside the transaction is both
 * simpler and correct.
 */
async function replaceProjectLinks(
  tx: Tx,
  projectId: string,
  input: ProjectInput,
): Promise<void> {
  if (input.partners) {
    await tx.delete(projectPartners).where(eq(projectPartners.projectId, projectId));
    if (input.partners.length) {
      await tx.insert(projectPartners).values(
        input.partners.map((p) => ({
          projectId,
          partnerId: p.partnerId,
          role: p.role,
        })),
      );
    }
  }

  if (input.media) {
    await tx.delete(projectMedia).where(eq(projectMedia.projectId, projectId));
    if (input.media.length) {
      await tx.insert(projectMedia).values(
        input.media.map((m, index) => ({
          projectId,
          mediaId: m.mediaId,
          displayOrder: m.displayOrder ?? index,
        })),
      );
    }
  }
}

function columnsFrom(input: ProjectInput, slugs: { slugAr: string; slugEn: string }) {
  return {
    programId: input.programId,
    titleAr: input.titleAr,
    titleEn: input.titleEn ?? null,
    slugAr: slugs.slugAr,
    slugEn: slugs.slugEn,
    summaryAr: input.summaryAr ?? null,
    summaryEn: input.summaryEn ?? null,
    objectiveAr: input.objectiveAr ?? null,
    objectiveEn: input.objectiveEn ?? null,
    activitiesAr: input.activitiesAr ?? null,
    activitiesEn: input.activitiesEn ?? null,
    outcomesAr: input.outcomesAr ?? null,
    outcomesEn: input.outcomesEn ?? null,
    projectState: input.projectState ?? 'active',
    startDate: input.startDate ?? null,
    endDate: input.endDate ?? null,
    governorates: input.governorates ?? [],
    localities: input.localities ?? [],
    themes: input.themes ?? [],
    heroMediaId: input.heroMediaId ?? null,
    isFeatured: input.isFeatured ?? false,
    sourceNote: input.sourceNote ?? null,
    seoTitleAr: input.seoTitleAr ?? null,
    seoTitleEn: input.seoTitleEn ?? null,
    seoDescriptionAr: input.seoDescriptionAr ?? null,
    seoDescriptionEn: input.seoDescriptionEn ?? null,
    ogMediaId: input.ogMediaId ?? null,
    noIndex: input.noIndex ?? false,
    status: input.status ?? 'draft',
    translationStatus: input.translationStatus ?? 'ar_only',
  };
}

export async function upsertProject(
  db: Db,
  actor: Actor,
  input: ProjectInput,
): Promise<ContentMutationResult> {
  assertCan(actor, 'content.write');

  return db.transaction(async (tx) => {
    const existing = input.id
      ? ((
          await tx.select().from(projects).where(eq(projects.id, input.id)).limit(1)
        )[0] ?? null)
      : null;

    if (input.id && !existing) throw notFound('project');

    const slugs = deriveSlugs({
      titleAr: input.titleAr,
      titleEn: input.titleEn,
      slugAr: input.slugAr,
      slugEn: input.slugEn,
    });
    await assertSlugsUnique(tx, projects, slugs, existing?.id);

    const values = columnsFrom(input, slugs);

    // Publishing is a different permission from editing, and the gate runs
    // against the transition rather than the target: unpublishing is equally
    // restricted, because taking a page down is as visible as putting one up.
    assertCanTransition(actor, existing?.status ?? 'draft', values.status);

    if (values.status === 'published') {
      const mediaIds = [
        values.heroMediaId,
        values.ogMediaId,
        ...(input.media?.map((m) => m.mediaId) ?? []),
      ];
      await assertMediaConsent(tx, mediaIds);
    }

    let row;
    if (existing) {
      [row] = await tx
        .update(projects)
        .set({ ...values, updatedBy: actor.id, updatedAt: new Date() })
        .where(eq(projects.id, existing.id))
        .returning();
    } else {
      [row] = await tx
        .insert(projects)
        .values({ ...values, createdBy: actor.id, updatedBy: actor.id })
        .returning();
    }

    await replaceProjectLinks(tx, row.id, input);

    await writeAudit(tx, actor, {
      action: existing ? 'update' : 'create',
      entityType: 'project',
      entityId: row.id,
      diff: computeDiff(existing, row),
    });

    return {
      id: row.id,
      slugAr: row.slugAr,
      slugEn: row.slugEn,
      status: row.status,
      previousSlugs: existing ? { ar: existing.slugAr, en: existing.slugEn } : undefined,
    };
  });
}

/**
 * Status-only transition, kept separate from `upsertProject` so the list view
 * can publish without resubmitting an entire record — and so an editor who may
 * write but not publish gets a clear refusal instead of a silently ignored
 * field.
 */
export async function setProjectStatus(
  db: Db,
  actor: Actor,
  id: string,
  status: ContentStatus,
): Promise<ContentMutationResult> {
  return db.transaction(async (tx) => {
    const [existing] = await tx.select().from(projects).where(eq(projects.id, id)).limit(1);
    if (!existing) throw notFound('project');

    assertCanTransition(actor, existing.status, status);

    if (status === 'published') {
      const links = await tx
        .select({ mediaId: projectMedia.mediaId })
        .from(projectMedia)
        .where(eq(projectMedia.projectId, id));

      await assertMediaConsent(tx, [
        existing.heroMediaId,
        existing.ogMediaId,
        ...links.map((l) => l.mediaId),
      ]);
    }

    const [row] = await tx
      .update(projects)
      .set({ status, updatedBy: actor.id, updatedAt: new Date() })
      .where(eq(projects.id, id))
      .returning();

    await writeAudit(tx, actor, {
      action:
        status === 'published' ? 'publish' : status === 'archived' ? 'archive' : 'unpublish',
      entityType: 'project',
      entityId: id,
      diff: { status: { from: existing.status, to: status } },
    });

    return { id: row.id, slugAr: row.slugAr, slugEn: row.slugEn, status: row.status };
  });
}

/**
 * Hard delete, restricted to `admin`.
 *
 * A published project is refused: taking a page off the internet and destroying
 * its record are two decisions, and conflating them means a mis-click loses
 * content that other pages link to. Archive first, then delete.
 */
export async function deleteProject(
  db: Db,
  actor: Actor,
  id: string,
): Promise<ContentMutationResult> {
  assertCan(actor, 'content.delete');

  return db.transaction(async (tx) => {
    const [existing] = await tx.select().from(projects).where(eq(projects.id, id)).limit(1);
    if (!existing) throw notFound('project');

    if (existing.status === 'published') {
      throw new AppError('conflict', 'errors.content.unpublishFirst');
    }

    await writeAudit(tx, actor, {
      action: 'delete',
      entityType: 'project',
      entityId: id,
      diff: computeDiff(existing, {}),
    });

    await tx.delete(projects).where(eq(projects.id, id));

    return {
      id,
      slugAr: existing.slugAr,
      slugEn: existing.slugEn,
      status: existing.status,
    };
  });
}
