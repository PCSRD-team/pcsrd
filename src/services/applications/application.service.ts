import { and, asc, count, desc, eq, ilike, or, sql } from 'drizzle-orm';
import type { Db, Tx } from '@/db';
import {
  applicationEvents,
  applicationFormFields,
  applicationForms,
  applications,
  type Application,
  type ApplicationAttachment,
  type ApplicationForm,
  type ApplicationFormField,
} from '@/db/schema';
import type { ApplicationStatus, LocaleCode } from '@/db/schema/enums';
import { readAsActor, rowsOf, withActor } from '@/db/session';
import { AppError, notFound } from '@/lib/errors';
import { hashIp } from '@/lib/security/ip';
import type { Actor } from '../_shared/actor';
import { writeAudit } from '../_shared/audit';
import { one } from '../_shared/one';
import { assertCan } from '../_shared/permissions';
import type { ApplicationReviewInput } from '@/lib/validation/applications';

/**
 * Everything that happens to an application after it is submitted.
 *
 * The submission half is one function, and it is thin on purpose: every rule
 * that decides whether an application may exist at all — published, inside its
 * window, under its cap, not a duplicate — lives in
 * `app.submit_application()`, because the cap cannot be enforced correctly
 * outside a row lock. What this file adds is the part the database cannot do:
 * translating the function's refusals into `AppError`s an action can render,
 * and owning the pipeline, the audit trail and the export shape.
 */

// ── Submission ───────────────────────────────────────────────────────────

export type SubmitApplicationInput = {
  formId: string;
  locale: LocaleCode;
  answers: Record<string, unknown>;
  attachments: ApplicationAttachment[];
  applicantName: string | null;
  applicantEmail: string | null;
  applicantPhone: string | null;
  /** Raw address. Hashed here — never stored as given. */
  ip?: string | null;
  userAgent?: string | null;
};

export type SubmittedApplication = {
  id: string;
  reference: string;
  waitlisted: boolean;
  purgeAfter: string;
};

/**
 * `app.submit_application()` raises with a `PCSRD_` prefix; this is the one
 * place those strings are read.
 *
 * Matched on the prefix rather than on SQLSTATE because every refusal shares
 * errcode 22023 — the code says "the data is not valid for this operation",
 * which is true of all five and distinguishes none of them. The applicant is
 * owed a specific sentence: "this closed yesterday" and "you have already
 * applied" call for different actions on their part.
 */
const REFUSALS: { marker: string; code: 'conflict' | 'validation'; key: string }[] = [
  { marker: 'PCSRD_FORM_FULL', code: 'conflict', key: 'errors.apply.full' },
  { marker: 'PCSRD_FORM_CLOSED', code: 'conflict', key: 'errors.apply.closed' },
  { marker: 'PCSRD_FORM_NOT_OPEN', code: 'conflict', key: 'errors.apply.notYetOpen' },
  { marker: 'PCSRD_DUPLICATE_APPLICATION', code: 'conflict', key: 'errors.apply.duplicate' },
  { marker: 'PCSRD_FORM_NOT_FOUND', code: 'validation', key: 'errors.notFound' },
];

/**
 * Collects the message of an error **and of every error it wraps**.
 *
 * Drizzle does not rethrow the driver's error: it throws its own
 * `Failed query: select * from app.submit_application(...)` and hangs the real
 * one off `cause`. Matching on the top-level message alone therefore never
 * matched anything, and every refusal the database raised — "this closed
 * yesterday", "you have already applied" — reached the applicant as
 * `errors.unexpected`. The integration suite caught it; a browser would have
 * shown a generic failure on the one path where the specific sentence is the
 * whole point.
 *
 * Depth-limited because an error chain can be circular.
 */
function messageChain(error: unknown, depth = 0): string {
  if (depth > 5 || error === null || error === undefined) return '';
  const own = error instanceof Error ? error.message : String(error);
  const cause = error instanceof Error ? error.cause : undefined;
  return cause === undefined ? own : `${own}
${messageChain(cause, depth + 1)}`;
}

function translateRefusal(error: unknown): never {
  const message = messageChain(error);
  const match = REFUSALS.find((refusal) => message.includes(refusal.marker));
  if (match) throw new AppError(match.code, match.key, { cause: error });
  throw error;
}

/**
 * Creates one application.
 *
 * No actor is bound. The submitter is a member of the public and `anon` is the
 * correct identity for them — exactly as the six public forms do it. The insert
 * still succeeds because `app.submit_application()` is SECURITY DEFINER and
 * owns the table; `applications` has no INSERT grant for the runtime role, so
 * this function is not a shortcut past the policies but the only door through
 * them.
 */
export async function submitApplication(
  db: Db,
  input: SubmitApplicationInput,
): Promise<SubmittedApplication> {
  const ipHash = hashIp(input.ip);
  const userAgent = input.userAgent?.slice(0, 255) ?? null;

  try {
    const row = one(
      rowsOf<{
        id: string;
        reference: string;
        waitlisted: boolean;
        purge_after: string;
      }>(
        await db.execute(sql`
          select * from app.submit_application(
            ${input.formId}::uuid,
            ${input.locale}::locale_code,
            ${JSON.stringify(input.answers)}::jsonb,
            ${JSON.stringify(input.attachments)}::jsonb,
            ${input.applicantName}::text,
            ${input.applicantEmail}::text,
            ${input.applicantPhone}::text,
            ${ipHash}::text,
            ${userAgent}::text
          )
        `),
      ),
      'application',
    );

    return {
      id: row.id,
      reference: row.reference,
      waitlisted: row.waitlisted,
      // `date` comes back as a string from postgres-js and as a Date from
      // PGlite. Normalised here so the receipt renders the same under both.
      purgeAfter: String(row.purge_after).slice(0, 10),
    };
  } catch (error) {
    return translateRefusal(error);
  }
}

// ── Reading the pipeline ─────────────────────────────────────────────────

export type ApplicantRow = {
  id: string;
  reference: string;
  status: ApplicationStatus;
  waitlisted: boolean;
  applicantName: string | null;
  applicantEmail: string | null;
  applicantPhone: string | null;
  rating: number | null;
  attachmentCount: number;
  createdAt: Date;
};

export type ApplicantPage = {
  rows: ApplicantRow[];
  total: number;
  page: number;
  pageSize: number;
  /** Per-status totals for the filter chips, unaffected by the status filter. */
  statusCounts: Record<string, number>;
};

const PAGE_SIZE = 50;

export type ApplicantFilters = {
  search?: string;
  status?: ApplicationStatus;
  waitlistedOnly?: boolean;
  page?: number;
};

/**
 * The applicants table.
 *
 * `readAsActor` is not optional here. `applications` is FORCE ROW LEVEL
 * SECURITY and `rt_select` is `app.can_publish()`, so a statement issued on the
 * bare `db` handle runs as `anon`, matches nothing, and reports an empty
 * inbox — a failure that looks exactly like "no one has applied yet".
 *
 * The search covers the three denormalised identity columns plus the reference,
 * and nothing inside `answers`. Searching the jsonb would mean a sequential
 * scan over every stored answer on every keystroke, and it would also make the
 * search box a way to probe for a national ID.
 */
export async function listApplicants(
  db: Db,
  actor: Actor,
  formId: string,
  filters: ApplicantFilters = {},
): Promise<ApplicantPage> {
  assertCan(actor, 'submissions.read');

  const page = Math.max(1, filters.page ?? 1);

  return readAsActor(db, actor, async (tx) => {
    const conditions = [eq(applications.formId, formId)];

    if (filters.status) conditions.push(eq(applications.status, filters.status));
    if (filters.waitlistedOnly) conditions.push(eq(applications.waitlisted, true));

    if (filters.search) {
      const term = `%${filters.search}%`;
      const matches = or(
        ilike(applications.applicantName, term),
        ilike(applications.applicantEmail, term),
        ilike(applications.applicantPhone, term),
        ilike(applications.reference, term),
      );
      if (matches) conditions.push(matches);
    }

    const where = and(...conditions);

    const [rows, [totalRow], statusRows] = await Promise.all([
      tx
        .select({
          id: applications.id,
          reference: applications.reference,
          status: applications.status,
          waitlisted: applications.waitlisted,
          applicantName: applications.applicantName,
          applicantEmail: applications.applicantEmail,
          applicantPhone: applications.applicantPhone,
          rating: applications.rating,
          attachments: applications.attachments,
          createdAt: applications.createdAt,
        })
        .from(applications)
        .where(where)
        .orderBy(desc(applications.createdAt))
        .limit(PAGE_SIZE)
        .offset((page - 1) * PAGE_SIZE),

      tx.select({ n: count() }).from(applications).where(where),

      // Counted without the status filter so the chips keep showing how many
      // are in every other state while one of them is selected.
      tx
        .select({ status: applications.status, n: count() })
        .from(applications)
        .where(eq(applications.formId, formId))
        .groupBy(applications.status),
    ]);

    return {
      rows: rows.map(({ attachments, ...row }) => ({
        ...row,
        attachmentCount: attachments.length,
      })),
      total: totalRow?.n ?? 0,
      page,
      pageSize: PAGE_SIZE,
      statusCounts: Object.fromEntries(statusRows.map((row) => [row.status, row.n])),
    };
  });
}

export type ApplicationDetail = Application & {
  form: Pick<ApplicationForm, 'id' | 'slug' | 'titleAr' | 'titleEn' | 'kind' | 'requireConsent'>;
  fields: ApplicationFormField[];
  events: {
    id: string;
    fromStatus: ApplicationStatus | null;
    toStatus: ApplicationStatus;
    note: string | null;
    createdAt: Date;
  }[];
};

/**
 * One application, with the form's fields alongside it.
 *
 * The fields come too because `answers` is a bag of keys and a reviewer needs
 * labels, order and types to read it. An answer whose field has since been
 * deleted has no label left, so the screen falls back to the key — visibly odd
 * rather than invisibly missing.
 */
export async function getApplication(
  db: Db,
  actor: Actor,
  id: string,
): Promise<ApplicationDetail> {
  assertCan(actor, 'submissions.read');

  return readAsActor(db, actor, async (tx) => {
    const [found] = await tx
      .select({
        application: applications,
        form: {
          id: applicationForms.id,
          slug: applicationForms.slug,
          titleAr: applicationForms.titleAr,
          titleEn: applicationForms.titleEn,
          kind: applicationForms.kind,
          requireConsent: applicationForms.requireConsent,
        },
      })
      .from(applications)
      .innerJoin(applicationForms, eq(applicationForms.id, applications.formId))
      .where(eq(applications.id, id))
      .limit(1);

    if (!found) throw notFound('application');

    const [fields, events] = await Promise.all([
      tx
        .select()
        .from(applicationFormFields)
        .where(eq(applicationFormFields.formId, found.form.id))
        .orderBy(asc(applicationFormFields.sortOrder)),
      tx
        .select({
          id: applicationEvents.id,
          fromStatus: applicationEvents.fromStatus,
          toStatus: applicationEvents.toStatus,
          note: applicationEvents.note,
          createdAt: applicationEvents.createdAt,
        })
        .from(applicationEvents)
        .where(eq(applicationEvents.applicationId, id))
        .orderBy(asc(applicationEvents.createdAt)),
    ]);

    return { ...found.application, form: found.form, fields, events };
  });
}

// ── Moving an applicant through the pipeline ─────────────────────────────

/**
 * Records a decision.
 *
 * Three writes in one transaction: the row, the applicant's own history, and
 * the audit log. They commit together or not at all — a status that changed
 * without a history entry is a pipeline nobody can reconstruct, and a history
 * entry for a change that rolled back is worse than none.
 *
 * `reviewedAt` is set whenever the status leaves `new`, because the
 * `applications_reviewed_shape` CHECK requires it. Setting it here rather than
 * letting the constraint fail is what turns "a reviewer forgot" into something
 * that cannot happen.
 */
export async function reviewApplication(
  db: Db,
  actor: Actor,
  id: string,
  input: ApplicationReviewInput,
): Promise<Application> {
  assertCan(actor, 'submissions.handle');

  return withActor(db, actor, async (tx) => {
    const before = one(
      await tx.select().from(applications).where(eq(applications.id, id)).limit(1),
      'application',
    );

    const leavingNew = input.status !== 'new';

    const after = one(
      await tx
        .update(applications)
        .set({
          status: input.status,
          rating: input.rating,
          internalNote: input.internalNote || null,
          reviewedBy: actor.id,
          // Keep the first review's timestamp if there is one: "when was this
          // first looked at" is the useful question, and overwriting it on
          // every note makes it "when was it last touched", which the audit
          // log already answers.
          reviewedAt: leavingNew ? (before.reviewedAt ?? new Date()) : null,
        })
        .where(eq(applications.id, id))
        .returning(),
      'application',
    );

    if (before.status !== after.status) {
      await tx.insert(applicationEvents).values({
        applicationId: id,
        actorId: actor.id,
        fromStatus: before.status,
        toStatus: after.status,
        note: input.internalNote?.slice(0, 500) || null,
      });
    }

    await writeAudit(tx, actor, {
      action: 'set_state',
      entityType: 'application',
      entityId: id,
      diff: {
        status: { from: before.status, to: after.status },
        ...(before.rating !== after.rating
          ? { rating: { from: before.rating, to: after.rating } }
          : {}),
      },
    });

    return after;
  });
}

/**
 * Erasure on request.
 *
 * Admin only. Returns the attachment paths so the caller can delete the objects
 * too — a row deleted without its CV leaves the most identifying part of the
 * application sitting in the bucket, which makes the erasure a gesture rather
 * than an erasure.
 *
 * The audit entry is written **before** the delete and records the reference
 * rather than the person: the log must show that an application was erased
 * without becoming the copy of it that survived.
 */
export async function deleteApplication(
  db: Db,
  actor: Actor,
  id: string,
): Promise<{ attachmentPaths: string[] }> {
  assertCan(actor, 'content.delete');

  return withActor(db, actor, async (tx) => {
    const row = one(
      await tx.select().from(applications).where(eq(applications.id, id)).limit(1),
      'application',
    );

    await writeAudit(tx, actor, {
      action: 'delete',
      entityType: 'application',
      entityId: id,
      diff: { reference: { from: row.reference, to: null } },
    });

    await tx.delete(applications).where(eq(applications.id, id));

    return { attachmentPaths: row.attachments.map((file) => file.path) };
  });
}

/**
 * The retention purge.
 *
 * Calls `app.purge_expired_applications()` rather than issuing a delete: the
 * runtime role binds no actor on a cron run, `applications.rt_delete` requires
 * `app.is_admin()`, and a plain delete would therefore match zero rows and
 * report success. The same trap `app.purge_expired_submissions()` exists to
 * avoid.
 */
export async function purgeExpiredApplications(
  db: Db,
): Promise<{ deleted: number; attachments: string[] }> {
  const row = one(
    rowsOf<{ purge_expired_applications: { deleted: number; attachments: string[] } }>(
      await db.execute(sql`select app.purge_expired_applications()`),
    ),
    'purge_result',
  );

  const result = row.purge_expired_applications;
  return { deleted: result?.deleted ?? 0, attachments: result?.attachments ?? [] };
}

// ── Export ───────────────────────────────────────────────────────────────

export type ExportTable = {
  /** Field keys in form order, then any orphaned keys found in the answers. */
  columns: { key: string; label: string }[];
  rows: Record<string, unknown>[];
};

/**
 * Everything on one form, shaped for a spreadsheet.
 *
 * Two decisions worth stating:
 *
 * - **The column list unions the form's current fields with the keys actually
 *   present in the stored answers.** A field deleted in week three still has
 *   answers from week one, and an export that silently dropped them would be a
 *   spreadsheet that disagrees with the screen.
 *
 * - **Sensitive columns are opt-in.** `includeSensitive` defaults to false, so
 *   a routine export of a shortlist does not put ninety national ID numbers in
 *   a file that will be emailed around. Asking for them is audited.
 *
 * No pagination: an export is the whole filtered set by definition. The cap is
 * a hard limit rather than a page, because a truncated export that looks
 * complete is worse than a refusal.
 */
const EXPORT_LIMIT = 5000;

export async function buildExportTable(
  db: Db,
  actor: Actor,
  formId: string,
  options: { includeSensitive?: boolean; filters?: ApplicantFilters; locale?: LocaleCode } = {},
): Promise<ExportTable> {
  assertCan(actor, 'submissions.read');
  const locale = options.locale ?? 'ar';

  return withActor(db, actor, async (tx) => {
    const fields = await tx
      .select()
      .from(applicationFormFields)
      .where(eq(applicationFormFields.formId, formId))
      .orderBy(asc(applicationFormFields.sortOrder));

    const conditions = [eq(applications.formId, formId)];
    if (options.filters?.status) {
      conditions.push(eq(applications.status, options.filters.status));
    }
    if (options.filters?.waitlistedOnly) conditions.push(eq(applications.waitlisted, true));

    const rows = await tx
      .select()
      .from(applications)
      .where(and(...conditions))
      .orderBy(desc(applications.createdAt))
      .limit(EXPORT_LIMIT);

    const visible = fields.filter(
      (field) =>
        field.type !== 'section' && (options.includeSensitive || !field.sensitive),
    );

    const labelled = new Map(
      visible.map((field) => [
        field.key,
        (locale === 'en' ? field.labelEn : field.labelAr) || field.labelAr,
      ]),
    );

    // Orphans: answered keys the form no longer declares. Appended after the
    // known columns so the familiar ones stay where the reader expects them.
    const sensitiveKeys = new Set(
      fields.filter((field) => field.sensitive).map((field) => field.key),
    );
    for (const row of rows) {
      for (const key of Object.keys(row.answers)) {
        if (labelled.has(key)) continue;
        if (!options.includeSensitive && sensitiveKeys.has(key)) continue;
        labelled.set(key, key);
      }
    }

    if (options.includeSensitive) {
      await writeAudit(tx, actor, {
        action: 'view_sensitive',
        entityType: 'application_form',
        entityId: formId,
        diff: { export: { from: null, to: `${rows.length} rows, sensitive columns included` } },
      });
    }

    return {
      columns: [...labelled].map(([key, label]) => ({ key, label })),
      rows: rows.map((row) => ({
        __reference: row.reference,
        __status: row.status,
        __waitlisted: row.waitlisted,
        __rating: row.rating,
        __createdAt: row.createdAt,
        __attachments: row.attachments,
        ...row.answers,
      })),
    };
  });
}

/** Whether the export hit its cap, so the caller can say so rather than lie. */
export const EXPORT_ROW_LIMIT = EXPORT_LIMIT;

/**
 * The attachment a reviewer asked to download.
 *
 * Returns the path only after confirming it belongs to the application named in
 * the request. Without that check the route handler would accept any path in
 * the private bucket from anyone who can read one application, which is every
 * CV the portal has ever received.
 *
 * The download is audited. "Who downloaded this person's ID copy" is a question
 * the organisation has to be able to answer.
 */
export async function resolveAttachment(
  db: Db,
  actor: Actor,
  applicationId: string,
  path: string,
): Promise<ApplicationAttachment> {
  assertCan(actor, 'submissions.read');

  return withActor(db, actor, async (tx) => {
    const row = one(
      await tx
        .select({ attachments: applications.attachments, reference: applications.reference })
        .from(applications)
        .where(eq(applications.id, applicationId))
        .limit(1),
      'application',
    );

    const file = row.attachments.find((candidate) => candidate.path === path);
    if (!file) throw notFound('attachment');

    await writeAudit(tx, actor, {
      action: 'view_sensitive',
      entityType: 'application',
      entityId: applicationId,
      diff: { download: { from: null, to: file.fieldKey } },
    });

    return file;
  });
}

/** Re-exported so a caller can count without loading a page of rows. */
export async function countApplications(tx: Tx, formId: string): Promise<number> {
  const [row] = await tx
    .select({ n: count() })
    .from(applications)
    .where(eq(applications.formId, formId));
  return row?.n ?? 0;
}
