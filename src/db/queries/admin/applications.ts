import { count, desc, eq, sql } from 'drizzle-orm';
import { db } from '@/db';
import { applicationForms, applications, vacancies } from '@/db/schema';
import type {
  ApplicationCapacityRule,
  ApplicationFormKind,
  ContentStatus,
} from '@/db/schema/enums';
import { readAsActor } from '@/db/session';
import type { Actor } from '@/services/_shared/actor';
import { assertCan } from '@/services/_shared/permissions';

/**
 * Admin reads for the careers portal.
 *
 * **Never `unstable_cache`-wrapped**, like everything under `queries/admin/*`.
 * A forms list that could be served from cache would show a recruiter a count
 * of applicants that is up to an hour old, on the one screen where the count is
 * the reason they opened it.
 *
 * Every read binds the actor. The four tables are FORCE ROW LEVEL SECURITY and
 * the runtime role has no BYPASSRLS, so a statement on the bare `db` handle runs
 * as `anon`: it would return published forms only, and no applications at all —
 * an empty pipeline that looks like nobody has applied.
 */

export type AdminFormRow = {
  id: string;
  slug: string;
  titleAr: string;
  kind: ApplicationFormKind;
  status: ContentStatus;
  opensAt: Date | null;
  closesAt: Date | null;
  capacity: number | null;
  capacityRule: ApplicationCapacityRule;
  submissionCount: number;
  /** Everyone who applied, including the waitlisted rows the counter excludes. */
  applicationCount: number;
  /** How many are still untouched — the number a recruiter is actually looking for. */
  newCount: number;
  vacancyTitle: string | null;
  updatedAt: Date;
};

/**
 * Every application form, newest first.
 *
 * The two counts are correlated subqueries rather than a `group by` over a
 * left join. A join would multiply the form row by its applications and make
 * `submission_count` — a column on the form — arrive multiplied too, which is
 * the kind of wrong that looks plausible on a screen. At the scale this table
 * runs (tens of forms) two subqueries per row cost nothing.
 */
export async function listAdminForms(actor: Actor): Promise<AdminFormRow[]> {
  assertCan(actor, 'content.read');

  return readAsActor(db, actor, async (tx) =>
    tx
      .select({
        id: applicationForms.id,
        slug: applicationForms.slug,
        titleAr: applicationForms.titleAr,
        kind: applicationForms.kind,
        status: applicationForms.status,
        opensAt: applicationForms.opensAt,
        closesAt: applicationForms.closesAt,
        capacity: applicationForms.capacity,
        capacityRule: applicationForms.capacityRule,
        submissionCount: applicationForms.submissionCount,
        applicationCount: sql<number>`(
          select count(*)::int from ${applications}
           where ${applications.formId} = ${applicationForms.id}
        )`,
        newCount: sql<number>`(
          select count(*)::int from ${applications}
           where ${applications.formId} = ${applicationForms.id}
             and ${applications.status} = 'new'
        )`,
        vacancyTitle: vacancies.titleAr,
        updatedAt: applicationForms.updatedAt,
      })
      .from(applicationForms)
      .leftJoin(vacancies, eq(vacancies.id, applicationForms.vacancyId))
      .orderBy(desc(applicationForms.updatedAt)),
  );
}

/**
 * Vacancies a form could be attached to.
 *
 * Only those that do not already have one — the `application_forms_vacancy_idx`
 * unique index permits one form per vacancy, and offering a taken vacancy in the
 * picker means the save fails on a constraint the editor never saw.
 * `currentVacancyId` keeps the form's own vacancy in the list while editing it,
 * or the select would silently drop the value it is meant to be showing.
 */
export async function listVacancyOptions(
  actor: Actor,
  currentVacancyId?: string | null,
): Promise<{ id: string; title: string }[]> {
  assertCan(actor, 'content.read');

  return readAsActor(db, actor, async (tx) =>
    tx
      .select({ id: vacancies.id, title: vacancies.titleAr })
      .from(vacancies)
      .where(
        sql`not exists (
          select 1 from ${applicationForms}
           where ${applicationForms.vacancyId} = ${vacancies.id}
             ${currentVacancyId ? sql`and ${applicationForms.vacancyId} <> ${currentVacancyId}` : sql``}
        )`,
      )
      .orderBy(desc(vacancies.postedAt))
      .limit(200),
  );
}

/** Totals for the portal's header, in one round trip. */
export async function getCareersSummary(
  actor: Actor,
): Promise<{ forms: number; open: number; newApplications: number }> {
  assertCan(actor, 'content.read');

  return readAsActor(db, actor, async (tx) => {
    const [row] = await tx
      .select({
        forms: count(),
        open: sql<number>`count(*) filter (
          where ${applicationForms.status} = 'published'
            and (${applicationForms.opensAt} is null or ${applicationForms.opensAt} <= now())
            and (${applicationForms.closesAt} is null or ${applicationForms.closesAt} > now())
        )::int`,
      })
      .from(applicationForms);

    const [pending] = await tx
      .select({ n: count() })
      .from(applications)
      .where(eq(applications.status, 'new'));

    return {
      forms: row?.forms ?? 0,
      open: row?.open ?? 0,
      newApplications: pending?.n ?? 0,
    };
  });
}
