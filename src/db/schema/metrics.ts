import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  date,
  index,
  integer,
  numeric,
  pgTable,
  text,
  uuid,
} from 'drizzle-orm/pg-core';
import { timestamps } from './_shared';
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

    programId: uuid().references(() => programs.id, { onDelete: 'set null' }),
    projectId: uuid().references(() => projects.id, { onDelete: 'cascade' }),

    periodStart: date().notNull(),
    periodEnd: date().notNull(),
    status: metricStatus().notNull(),
    verificationSource: text(),

    /** Opt-in. A metric is internal until someone decides otherwise. */
    isPublic: boolean().notNull().default(false),
    isFeatured: boolean().notNull().default(false),
    displayOrder: integer().notNull().default(0),
    ...timestamps(),
  },
  (t) => [
    index('metrics_public_idx').on(t.status, t.isPublic, t.displayOrder),
    index('metrics_program_idx').on(t.programId).where(sql`${t.isPublic}`),
    check('metrics_period_order', sql`${t.periodEnd} >= ${t.periodStart}`),
  ],
);

export type ImpactMetric = typeof impactMetrics.$inferSelect;
export type NewImpactMetric = typeof impactMetrics.$inferInsert;
