import {
  bigserial,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { profiles } from './profiles';

/** A single field's before/after, as written by `services/_shared/diff.ts`. */
export type AuditDiff = Record<string, { from: unknown; to: unknown }>;

/**
 * Append-only record of every admin mutation.
 *
 * `actorId` is `set null` on profile deletion rather than `cascade`: the record
 * that something happened must survive the departure of the person who did it.
 */
export const auditLogs = pgTable(
  'audit_logs',
  {
    id: bigserial({ mode: 'number' }).primaryKey(),
    actorId: uuid().references(() => profiles.id, { onDelete: 'set null' }),
    /** 'create' | 'update' | 'publish' | 'unpublish' | 'delete' | 'view_sensitive' */
    action: text().notNull(),
    entityType: text().notNull(),
    entityId: uuid(),
    diff: jsonb().$type<AuditDiff>(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('audit_entity_idx').on(t.entityType, t.entityId, t.createdAt.desc()),
    index('audit_actor_idx').on(t.actorId, t.createdAt.desc()),
  ],
);

export type AuditLog = typeof auditLogs.$inferSelect;
export type NewAuditLog = typeof auditLogs.$inferInsert;
