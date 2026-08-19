import { auditLogs, type AuditDiff } from '@/db/schema';
import type { Db, Tx } from '@/db';
import { type Actor, isSystem } from './actor';

export type AuditAction =
  | 'create'
  | 'update'
  | 'publish'
  | 'unpublish'
  | 'archive'
  | 'delete'
  | 'view_sensitive'
  | 'download_attachment';

/**
 * Writes one audit entry.
 *
 * Takes the transaction handle, not `db`, so the entry commits or rolls back
 * **with** the mutation it describes. An audit log that records changes which
 * were later rolled back is worse than no audit log: it is a record that is
 * confidently wrong.
 *
 * `actorId` is null for system work — a cron job did not have a person behind
 * it, and inventing one would be a lie in the one table that exists to be
 * trusted.
 */
export async function writeAudit(
  tx: Db | Tx,
  actor: Actor,
  entry: {
    action: AuditAction;
    entityType: string;
    entityId?: string | null;
    diff?: AuditDiff | null;
  },
): Promise<void> {
  await tx.insert(auditLogs).values({
    actorId: isSystem(actor) ? null : actor.id,
    action: entry.action,
    entityType: entry.entityType,
    entityId: entry.entityId ?? null,
    diff: entry.diff && Object.keys(entry.diff).length > 0 ? entry.diff : null,
  });
}
