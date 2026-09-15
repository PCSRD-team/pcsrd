import { sql } from 'drizzle-orm';
import {
  check,
  date,
  index,
  jsonb,
  pgTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import {
  blockA,
  blockAForeignKeys,
  blockB,
  blockC,
  blockCForeignKey,
  type RichText,
  slugShapeCheck,
} from './_shared';
import { vacancyType } from './enums';

/**
 * Jobs and volunteer positions.
 *
 * `deadline` is `notNull`. A vacancy without one stays open forever and wastes
 * an applicant's time — the daily archive cron depends on this column being
 * present on every row.
 */
export const vacancies = pgTable(
  'vacancies',
  {
    ...blockA(),
    ...blockB(),

    type: vacancyType().notNull().default('job'),
    titleAr: text().notNull(),
    titleEn: text(),
    locationAr: text(),
    locationEn: text(),
    /** schema.org `employmentType`: FULL_TIME | PART_TIME | VOLUNTEER. */
    employmentType: text(),

    descriptionAr: jsonb().$type<RichText>(),
    descriptionEn: jsonb().$type<RichText>(),
    requirementsAr: jsonb().$type<RichText>(),
    requirementsEn: jsonb().$type<RichText>(),

    deadline: date().notNull(),
    /** `'form'` | `'email'` — the `vacancies_method` CHECK. */
    applicationMethod: text().notNull().default('form'),
    applicationEmail: text(),
    postedAt: date().notNull().default(sql`CURRENT_DATE`),

    ...blockC(),
  },
  (t) => [
    ...blockAForeignKeys('vacancies', t),
    blockCForeignKey('vacancies', t),
    slugShapeCheck('vacancies', t),
    check('vacancies_method', sql`${t.applicationMethod} in ('form', 'email')`),
    check(
      'vacancies_email_required',
      sql`${t.applicationMethod} <> 'email' or ${t.applicationEmail} is not null`,
    ),
    uniqueIndex('vacancies_slug_ar_idx').on(t.slugAr),
    uniqueIndex('vacancies_slug_en_idx').on(t.slugEn),
    index('vacancies_open_idx')
      .on(t.type, t.deadline.desc())
      .where(sql`${t.status} = 'published'`),
    // The `ix_*` / `ux_*` family is the hand-written DDL the live database was
    // built from; the two `ux_*` duplicate the slug indexes above.
    index('ix_vacancies_open')
      .on(t.deadline)
      .where(sql`${t.status} = 'published'`),
    uniqueIndex('ux_vacancies_slug_ar').on(t.slugAr),
    uniqueIndex('ux_vacancies_slug_en').on(t.slugEn),
  ],
);

export type Vacancy = typeof vacancies.$inferSelect;
export type NewVacancy = typeof vacancies.$inferInsert;
