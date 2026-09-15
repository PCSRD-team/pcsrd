import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  date,
  index,
  numeric,
  pgTable,
  smallint,
  text,
  uuid,
} from 'drizzle-orm/pg-core';
import { fk, timestamps } from './_shared';
import { metricStatus } from './enums';
import { programs } from './programs';
import { projects } from './projects';

/**
 * Impact figures.
 *
 * `periodStart` / `periodEnd` are `notNull` so a metric can always render its
 * period label, and `status` distinguishes a target from a reported figure from
 * a verified one. Together they are RULE: no impact figure is published without
 * its period and verification status — the schema makes the omission impossible
 * rather than the review process catching it.
 */
export const impactMetrics = pgTable(
  'impact_metrics',
  {
    id: uuid().primaryKey().defaultRandom(),
    labelAr: text().notNull(),
    labelEn: text(),
    /** `numeric(14,2)`; read as a string to avoid float rounding. */
    value: numeric({ precision: 14, scale: 2 }).notNull(),
    /** people | families | children | sessions | ILS … */
    unit: text().notNull(),
    /** `'+'` | `'~'` | null — rendered verbatim before the number. */
    displayPrefix: text(),

    programId: uuid(),
    projectId: uuid(),

    periodStart: date().notNull(),
    periodEnd: date().notNull(),
    status: metricStatus().notNull(),
    verificationSource: text(),

    /** Opt-in. A metric is internal until someone decides otherwise. */
    isPublic: boolean().notNull().default(false),
    isFeatured: boolean().notNull().default(false),
    displayOrder: smallint().notNull().default(0),
    ...timestamps(),
  },
  (t) => [
    fk('impact_metrics_program_id_fkey', t.programId, programs.id, 'set null'),
    fk('impact_metrics_project_id_fkey', t.projectId, projects.id, 'cascade'),
    check(
      'impact_metrics_display_prefix_check',
      sql`${t.displayPrefix} is null or ${t.displayPrefix} in ('+', '~')`,
    ),
    check('metrics_period_order', sql`${t.periodEnd} >= ${t.periodStart}`),
    /** "Verified" is a claim about provenance; without a source it is a label. */
    check(
      'metrics_verified_needs_source',
      sql`${t.status} <> 'verified' or (${t.verificationSource} is not null and length(btrim(${t.verificationSource})) > 0)`,
    ),
    index('metrics_public_idx').on(t.status, t.isPublic, t.displayOrder),
    index('metrics_program_idx').on(t.programId).where(sql`${t.isPublic}`),
    index('metrics_project_idx').on(t.projectId),
    // The `ix_*` family is the hand-written DDL the live database was built
    // from; `ix_metrics_project` duplicates `metrics_project_idx` exactly.
    index('ix_metrics_program').on(t.programId),
    index('ix_metrics_project').on(t.projectId),
    index('ix_metrics_public')
      .on(t.displayOrder, t.periodEnd.desc())
      .where(sql`${t.isPublic}`),
  ],
);

export type ImpactMetric = typeof impactMetrics.$inferSelect;
export type NewImpactMetric = typeof impactMetrics.$inferInsert;
