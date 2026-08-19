import { sql } from 'drizzle-orm';
import {
  date,
  index,
  jsonb,
  pgTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { blockA, blockB, blockC, type RichText } from './_shared';
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
    /** `'form'` | `'email'`. */
    applicationMethod: text().notNull().default('form'),
    applicationEmail: text(),
    postedAt: date().notNull().default(sql`CURRENT_DATE`),

    ...blockC(),
  },
  (t) => [
    uniqueIndex('vacancies_slug_ar_idx').on(t.slugAr),
    uniqueIndex('vacancies_slug_en_idx').on(t.slugEn),
    index('vacancies_open_idx')
      .on(t.type, t.deadline.desc())
      .where(sql`${t.status} = 'published'`),
  ],
);

export type Vacancy = typeof vacancies.$inferSelect;
export type NewVacancy = typeof vacancies.$inferInsert;
