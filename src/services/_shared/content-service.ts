import { eq } from 'drizzle-orm';
import type { PgColumn, PgTable } from 'drizzle-orm/pg-core';
import type { Db, Tx } from '@/db';
import type { ContentStatus } from '@/db/schema/enums';
import { AppError, notFound } from '@/lib/errors';
import type { Actor } from './actor';
import { writeAudit } from './audit';
import { computeDiff } from './diff';
import { assertCan } from './permissions';
import { assertCanTransition, assertMediaConsent } from './publish';
import { assertSlugsUnique, deriveSlugs } from './slug';

/**
 * The five steps every content entity shares, written once.
 *
 *   permission → slug uniqueness → publish gates → one transaction → audit
 *
 * `project.service.ts` implements the same sequence by hand because projects
 * carry two junction tables and a `restrict` foreign key that need their own
 * handling. Everything else — posts, stories, vacancies, publications, pages,
 * programmes — differs only in its column list, so restating three hundred
 * lines per entity would be six opportunities to get the consent gate subtly
 * wrong rather than one place to get it right.
 */

/** The columns this factory needs to exist. Enforced structurally. */
export type ContentTable = PgTable & {
  id: PgColumn;
  slugAr: PgColumn;
  slugEn: PgColumn;
  status: PgColumn;
  createdBy: PgColumn;
  updatedBy: PgColumn;
  updatedAt: PgColumn;
};

type ContentRow = {
  id: string;
  slugAr: string;
  slugEn: string;
  status: ContentStatus;
} & Record<string, unknown>;

export type ContentMutationResult = {
  id: string;
  slugAr: string;
  slugEn: string;
  status: ContentStatus;
  /** Slugs before the edit, so a renamed page's old URL is invalidated too. */
  previousSlugs?: { ar: string; en: string };
};

export type ContentInputBase = {
  id?: string;
  titleAr: string;
  titleEn?: string | null;
  slugAr?: string | null;
  slugEn?: string | null;
  status?: ContentStatus;
};

export type ContentServiceConfig<TInput extends ContentInputBase> = {
  table: ContentTable;
  /** Appears in `audit_logs.entity_type`. Singular, snake_case. */
  entityType: string;
  /** Maps validated input to column values. Slugs are supplied already resolved. */
  toColumns: (input: TInput, slugs: { slugAr: string; slugEn: string }) => Record<string, unknown>;
  /** Media that must clear the consent gate before this row may be published. */
  mediaIds?: (input: TInput) => (string | null | undefined)[];
  /** Extra work inside the same transaction — junction rows, derived columns. */
  afterWrite?: (tx: Tx, id: string, input: TInput) => Promise<void>;
  /** Media referenced by an already-stored row, for a status-only transition. */
  storedMediaIds?: (tx: Tx, row: ContentRow) => Promise<(string | null | undefined)[]>;
};

export type ContentService<TInput extends ContentInputBase> = {
  upsert: (db: Db, actor: Actor, input: TInput) => Promise<ContentMutationResult>;
  setStatus: (
    db: Db,
    actor: Actor,
    id: string,
    status: ContentStatus,
  ) => Promise<ContentMutationResult>;
  remove: (db: Db, actor: Actor, id: string) => Promise<ContentMutationResult>;
};

export function createContentService<TInput extends ContentInputBase>(
  config: ContentServiceConfig<TInput>,
): ContentService<TInput> {
  const { table, entityType } = config;

  async function loadRow(tx: Tx, id: string): Promise<ContentRow | null> {
    const [row] = await tx.select().from(table).where(eq(table.id, id)).limit(1);
    return (row as ContentRow | undefined) ?? null;
  }

  return {
    async upsert(db, actor, input) {
      assertCan(actor, 'content.write');

      return db.transaction(async (tx) => {
        const existing = input.id ? await loadRow(tx, input.id) : null;
        if (input.id && !existing) throw notFound(entityType);

        const slugs = deriveSlugs(input);
        await assertSlugsUnique(tx, table, slugs, existing?.id);

        const values = config.toColumns(input, slugs);
        const status = (values.status as ContentStatus | undefined) ?? 'draft';

        assertCanTransition(actor, existing?.status ?? 'draft', status);
        if (status === 'published' && config.mediaIds) {
          await assertMediaConsent(tx, config.mediaIds(input));
        }

        const written = existing
          ? await tx
              .update(table)
              .set({ ...values, updatedBy: actor.id, updatedAt: new Date() })
              .where(eq(table.id, existing.id))
              .returning()
          : await tx
              .insert(table)
              // A single-element array selects Drizzle's array overload, whose
              // element type stays open for a table known only to satisfy
              // `ContentTable`. Passing the bare object would need a cast.
              .values([{ ...values, createdBy: actor.id, updatedBy: actor.id }])
              .returning();

        const row = written[0] as ContentRow;
        await config.afterWrite?.(tx, row.id, input);

        await writeAudit(tx, actor, {
          action: existing ? 'update' : 'create',
          entityType,
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
    },

    async setStatus(db, actor, id, status) {
      return db.transaction(async (tx) => {
        const existing = await loadRow(tx, id);
        if (!existing) throw notFound(entityType);

        assertCanTransition(actor, existing.status, status);

        if (status === 'published') {
          const ids = config.storedMediaIds
            ? await config.storedMediaIds(tx, existing)
            : [existing.heroMediaId as string | null, existing.ogMediaId as string | null];
          await assertMediaConsent(tx, ids);
        }

        const [row] = (await tx
          .update(table)
          .set({ status, updatedBy: actor.id, updatedAt: new Date() })
          .where(eq(table.id, id))
          .returning()) as ContentRow[];

        await writeAudit(tx, actor, {
          action:
            status === 'published' ? 'publish' : status === 'archived' ? 'archive' : 'unpublish',
          entityType,
          entityId: id,
          diff: { status: { from: existing.status, to: status } },
        });

        return { id: row.id, slugAr: row.slugAr, slugEn: row.slugEn, status: row.status };
      });
    },

    async remove(db, actor, id) {
      assertCan(actor, 'content.delete');

      return db.transaction(async (tx) => {
        const existing = await loadRow(tx, id);
        if (!existing) throw notFound(entityType);

        // Taking a page off the internet and destroying its record are two
        // decisions. Conflating them means one mis-click loses content other
        // pages still link to.
        if (existing.status === 'published') {
          throw new AppError('conflict', 'errors.content.unpublishFirst');
        }

        await writeAudit(tx, actor, {
          action: 'delete',
          entityType,
          entityId: id,
          diff: computeDiff(existing, {}),
        });

        await tx.delete(table).where(eq(table.id, id));

        return {
          id,
          slugAr: existing.slugAr,
          slugEn: existing.slugEn,
          status: existing.status,
        };
      });
    },
  };
}
