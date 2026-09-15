import { eq } from 'drizzle-orm';
import type { Db } from '@/db';
import { withActor } from '@/db/session';
import { redirects } from '@/db/schema';
import { conflict, notFound } from '@/lib/errors';
import type { Actor } from '../_shared/actor';
import { writeAudit } from '../_shared/audit';
import { computeDiff } from '../_shared/diff';
import { one } from '../_shared/one';
import { assertCan } from '../_shared/permissions';

/**
 * Legacy-path redirects.
 *
 * Admin only — `redirects.manage` — and the database policy `redirects.rt_write`
 * says the same thing as `app.is_admin()`. There is no draft state and no
 * per-row cache tag: the proxy reads the whole table as one cached array, so
 * any write here busts that one entry (the action does the busting).
 */

export type RedirectInput = {
  sourcePath: string;
  destinationPath: string;
  /** Stored as a smallint; the form posts the string value of a `<select>`. */
  statusCode: '301' | '302' | '307' | '308';
};

/**
 * `/About/` and `/about` are the same request to a visitor, so they must be
 * the same key in the lookup. Trailing slashes are dropped except on the
 * root; case is kept, because Next routes are case-sensitive and the
 * destination may legitimately need it.
 */
export function normalizeSourcePath(path: string): string {
  const trimmed = path.trim();
  if (trimmed.length > 1 && trimmed.endsWith('/')) return trimmed.replace(/\/+$/, '');
  return trimmed;
}

export async function createRedirect(
  db: Db,
  actor: Actor,
  input: RedirectInput,
): Promise<{ id: string }> {
  assertCan(actor, 'redirects.manage');

  const sourcePath = normalizeSourcePath(input.sourcePath);
  const destinationPath = input.destinationPath.trim();

  return withActor(db, actor, async (tx) => {
    const [taken] = await tx
      .select({ id: redirects.id })
      .from(redirects)
      .where(eq(redirects.sourcePath, sourcePath))
      .limit(1);
    if (taken) {
      throw conflict('errors.redirects.sourceTaken', {
        sourcePath: ['errors.redirects.sourceTaken'],
      });
    }

    const row = one(
      await tx
        .insert(redirects)
        .values({ sourcePath, destinationPath, statusCode: Number(input.statusCode) })
        .returning(),
      'redirect',
    );

    await writeAudit(tx, actor, {
      action: 'create',
      entityType: 'redirect',
      entityId: row.id,
      diff: computeDiff(null, row),
    });

    return { id: row.id };
  });
}

export async function deleteRedirect(db: Db, actor: Actor, id: string): Promise<void> {
  assertCan(actor, 'redirects.manage');

  await withActor(db, actor, async (tx) => {
    const [existing] = await tx.select().from(redirects).where(eq(redirects.id, id)).limit(1);
    if (!existing) throw notFound('redirect');

    await writeAudit(tx, actor, {
      action: 'delete',
      entityType: 'redirect',
      entityId: id,
      diff: computeDiff(existing, {}),
    });
    await tx.delete(redirects).where(eq(redirects.id, id));
  });
}
