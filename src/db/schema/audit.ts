import { sql } from 'drizzle-orm';
import {
  bigint,
  check,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { fk } from './_shared';
import { profiles } from './profiles';

/** A single field's before/after, as written by `services/_shared/diff.ts`. */
export type AuditDiff = Record<string, { from: unknown; to: unknown }>;

/**
 * The closed list of audit actions, as the `audit_action_known` CHECK on the
 * live table enforces it. A value outside this list is not "an unusual
 * action" — it is a rejected insert, and because every service writes its
 * audit entry inside the transaction it describes, the rejected insert rolls
 * the whole mutation back. Services must pick from this list, never from a
 * wider local union.
 */
export const AUDIT_ACTIONS = [
  'create',
  'update',
  'publish',
  'unpublish',
  'delete',
  'login',
  'invite',
  'set_role',
  'deactivate',
  'view_sensitive',
  'set_state',
  'upload',
  'purge',
  'archive',
] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

/**
 * Append-only record of every admin mutation.
 *
 * `id` is `bigint generated always as identity`, matching the live column, not
 * `bigserial`. The two behave the same for every insert the application makes
 * (none supplies an id) and share the sequence name `audit_logs_id_seq` that
 * `0003_audit_log_sequence_grant.sql` grants USAGE on. The difference is that
 * an identity column refuses an explicit id without `OVERRIDING SYSTEM VALUE`,
 * which is the right answer for a table whose rows must never be renumbered.
 *
 * `actorId` is `set null` on profile deletion rather than `cascade`: the record
 * that something happened must survive the departure of the person who did it.
 */
export const auditLogs = pgTable(
  'audit_logs',
  {
    id: bigint({ mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    actorId: uuid(),
    action: text().$type<AuditAction>().notNull(),
    entityType: text().notNull(),
    entityId: uuid(),
    diff: jsonb().$type<AuditDiff>(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    fk('audit_logs_actor_id_fkey', t.actorId, profiles.id, 'set null'),
    check(
      'audit_action_known',
      sql`${t.action} in ('create', 'update', 'publish', 'unpublish', 'delete', 'login', 'invite', 'set_role', 'deactivate', 'view_sensitive', 'set_state', 'upload', 'purge', 'archive')`,
    ),
    index('audit_entity_idx').on(t.entityType, t.entityId, t.createdAt.desc()),
    index('audit_actor_idx').on(t.actorId, t.createdAt.desc()),
    index('audit_action_idx').on(t.action, t.createdAt.desc()),
    // Live duplicates of the three above, created by the hand-written DDL the
    // database was built from. Kept so `drizzle/` describes production; drop
    // them there first, then here.
    index('ix_audit_entity').on(t.entityType, t.entityId, t.createdAt.desc()),
    index('ix_audit_actor').on(t.actorId, t.createdAt.desc()),
    index('ix_audit_action').on(t.action, t.createdAt.desc()),
  ],
);

export type AuditLog = typeof auditLogs.$inferSelect;
export type NewAuditLog = typeof auditLogs.$inferInsert;
