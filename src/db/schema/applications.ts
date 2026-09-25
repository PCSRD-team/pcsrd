import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { fk, type RichText, timestamps } from './_shared';
import {
  applicationCapacityRule,
  applicationFieldType,
  applicationFormKind,
  applicationStatus,
  contentStatus,
  localeCode,
} from './enums';
import { profiles } from './profiles';
import { vacancies } from './vacancies';

/**
 * The careers portal — four tables that own themselves.
 *
 * `form_submissions` is deliberately **not** reused. That table is six known
 * forms with six fixed Zod schemas behind one `payload` column; this is an
 * admin-authored form whose shape is a row in a table, whose applicants need a
 * pipeline, a reviewer, a rating and a spreadsheet. Bending the submissions
 * table to carry both would give the complaints inbox a schema it does not
 * want and the careers portal a retention policy it cannot set.
 *
 * The separation also keeps the safeguarding channel narrow: nothing here can
 * ever be `is_sensitive`, so no route in this file is a path to a complaint.
 */

/** One choice of a `select`, `radio` or `multi_select` field. */
export type ApplicationFieldOption = {
  value: string;
  labelAr: string;
  labelEn?: string | null;
};

/**
 * Per-type constraints, kept as JSON rather than fifteen mostly-null columns.
 *
 * Every key is optional and every key is advisory to the *database* — the
 * authority is `buildAnswerSchema` in `src/lib/applications/answer-schema.ts`,
 * which compiles this into Zod on each submission. Storing it as a column per
 * rule would mean a migration every time a field type gains an option.
 */
export type ApplicationFieldConfig = {
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  /** `date` fields: ISO dates, or the literal `'today'` for a moving bound. */
  minDate?: string;
  maxDate?: string;
  /** `short_text` only, and only from the catalogue — never author-supplied. */
  pattern?: string;
  /** `file` fields: which catalogue of MIME types the upload is checked against. */
  accept?: 'document' | 'image' | 'any';
  /** `multi_select`: bounds on how many boxes may be ticked. */
  minChoices?: number;
  maxChoices?: number;
  /** Rendering hint only. */
  columns?: 1 | 2;
};

/**
 * Show this field only when another field holds one of these values.
 *
 * Evaluated **on the server, at validation time**, not only in the browser: a
 * hidden field that is `required` must not block a submission that could never
 * have filled it, and a visitor with JavaScript off sees every field and may
 * fill one that the condition excludes.
 */
export type ApplicationVisibleWhen = {
  /** Another field's `key`, always one declared earlier in the order. */
  field: string;
  equals: string[];
};

/** A file an applicant attached, one entry per `file` field they filled. */
export type ApplicationAttachment = {
  fieldKey: string;
  /** Object path in the private `applications` bucket. Never a filename. */
  path: string;
  /** The submitted name, kept for the reviewer. Rendered, never used as a path. */
  originalName: string;
  size: number;
  mime: string;
};

// ── The form ─────────────────────────────────────────────────────────────

/**
 * A form definition.
 *
 * `vacancyId` is nullable and that is the point: a form may hang off a vacancy
 * or stand alone for a volunteer intake, an internship cohort or a consultancy
 * roster that has no vacancy row.
 *
 * `submissionCount` is a stored counter, not a `count(*)`. It is maintained
 * inside `app.submit_application()` under the row lock that enforces
 * `capacity`, so "have we reached the cap" is answered by the same statement
 * that takes the slot. A count over the applications table would race: two
 * simultaneous applicants both read `n - 1` and both insert.
 *
 * The slug is one string, not the bilingual pair `blockB` gives content. A
 * form is reached at `/{locale}/apply/{slug}` in both locales, because an
 * applicant sent a link by a colleague must land on the form whichever
 * language the link was copied from.
 */
export const applicationForms = pgTable(
  'application_forms',
  {
    id: uuid().primaryKey().defaultRandom(),
    vacancyId: uuid(),
    kind: applicationFormKind().notNull().default('job'),
    slug: text().notNull(),

    titleAr: text().notNull(),
    titleEn: text(),
    introAr: jsonb().$type<RichText>(),
    introEn: jsonb().$type<RichText>(),

    status: contentStatus().notNull().default('draft'),
    publishedAt: timestamp({ withTimezone: true }),

    /** Null means "open from the moment it is published". */
    opensAt: timestamp({ withTimezone: true }),
    /** Null means "no deadline" — rare, and the admin has to choose it. */
    closesAt: timestamp({ withTimezone: true }),

    /** Null means uncapped. */
    capacity: integer(),
    capacityRule: applicationCapacityRule().notNull().default('close'),
    submissionCount: integer().notNull().default(0),

    /** Shown on the receipt, under the reference. Plain text, both locales. */
    confirmationAr: text(),
    confirmationEn: text(),
    /** Who gets told about a new application. Empty means the default inbox. */
    notifyEmails: text().array().notNull().default(sql`'{}'::text[]`),

    /**
     * Months from submission to automatic deletion, per form.
     *
     * Per form rather than per type because the retention a recruitment file
     * deserves is a decision about *this* recruitment: a one-off volunteer
     * intake does not need the two years a consultancy roster does. The purge
     * reads this column, so shortening it shortens the life of rows already
     * stored.
     */
    retentionMonths: integer().notNull().default(12),

    /** Off by default: one person, one application, per form. */
    allowMultiplePerEmail: boolean().notNull().default(false),
    /** Whether the consent paragraph and its tick are rendered and required. */
    requireConsent: boolean().notNull().default(true),

    ...timestamps(),
    createdBy: uuid(),
    updatedBy: uuid(),
  },
  (t) => [
    fk('application_forms_vacancy_id_fkey', t.vacancyId, vacancies.id, 'set null'),
    fk('application_forms_created_by_fkey', t.createdBy, profiles.id, 'set null'),
    fk('application_forms_updated_by_fkey', t.updatedBy, profiles.id, 'set null'),

    check('application_forms_slug_shape', sql`${t.slug} ~ '^[^\\s/]+$'`),
    check(
      'application_forms_window',
      sql`${t.opensAt} is null or ${t.closesAt} is null or ${t.closesAt} > ${t.opensAt}`,
    ),
    check('application_forms_capacity', sql`${t.capacity} is null or ${t.capacity} > 0`),
    check('application_forms_count', sql`${t.submissionCount} >= 0`),
    check(
      'application_forms_retention',
      sql`${t.retentionMonths} between 1 and 60`,
    ),

    uniqueIndex('application_forms_slug_idx').on(t.slug),
    /** At most one form per vacancy; several vacancies may have none. */
    uniqueIndex('application_forms_vacancy_idx')
      .on(t.vacancyId)
      .where(sql`${t.vacancyId} is not null`),
    index('application_forms_open_idx')
      .on(t.closesAt.desc())
      .where(sql`${t.status} = 'published'`),
  ],
);

export type ApplicationForm = typeof applicationForms.$inferSelect;
export type NewApplicationForm = typeof applicationForms.$inferInsert;

// ── Its fields ───────────────────────────────────────────────────────────

/**
 * One field of one form.
 *
 * `key` is the machine name and it is load-bearing in three places: it is the
 * property name inside `applications.answers`, the `name` attribute of the
 * rendered control, and the column header's identity in the export. Renaming
 * a label is free; renaming a key would orphan every answer already stored, so
 * the service refuses it once the form has an application.
 *
 * `catalogKey` records where the field came from. A field drawn from the
 * catalogue validates with the catalogue's vetted rule — a Palestinian ID
 * checksum, an E.164 phone — which an admin could not have written into
 * `config.pattern` and must not be able to weaken. A null `catalogKey` is an
 * author-built field and gets generic validation only.
 */
export const applicationFormFields = pgTable(
  'application_form_fields',
  {
    id: uuid().primaryKey().defaultRandom(),
    formId: uuid().notNull(),
    sortOrder: integer().notNull().default(0),

    key: text().notNull(),
    type: applicationFieldType().notNull(),
    /** Non-null when the field came from `src/lib/applications/field-catalog.ts`. */
    catalogKey: text(),

    labelAr: text().notNull(),
    labelEn: text(),
    placeholderAr: text(),
    placeholderEn: text(),
    helpAr: text(),
    helpEn: text(),

    required: boolean().notNull().default(false),
    options: jsonb().$type<ApplicationFieldOption[]>().notNull().default(sql`'[]'::jsonb`),
    config: jsonb().$type<ApplicationFieldConfig>().notNull().default(sql`'{}'::jsonb`),
    visibleWhen: jsonb().$type<ApplicationVisibleWhen>(),

    /**
     * A field whose answer is personal data the organisation would rather not
     * hold longer than it must — an ID number, a date of birth.
     *
     * Marking it does two things: the public form refuses to render it unless
     * the form carries a consent tick, and the export leaves it out unless the
     * exporter asks for it explicitly. `20-PRIVACY §5` says collect the band,
     * not the birthday; this is the switch that makes collecting the birthday
     * a deliberate, visible act rather than a default.
     */
    sensitive: boolean().notNull().default(false),

    ...timestamps(),
  },
  (t) => [
    fk('application_form_fields_form_id_fkey', t.formId, applicationForms.id, 'cascade'),

    /** A key is an identifier, not a label: ASCII, lower case, no spaces. */
    check('application_form_fields_key_shape', sql`${t.key} ~ '^[a-z][a-z0-9_]{0,47}$'`),
    /** A field that offers a choice must offer at least one. */
    check(
      'application_form_fields_options',
      sql`${t.type} not in ('select', 'radio', 'multi_select') or jsonb_array_length(${t.options}) > 0`,
    ),
    /** A heading has nothing to fill in, so it cannot be mandatory. */
    check(
      'application_form_fields_section',
      sql`${t.type} <> 'section' or (${t.required} = false and ${t.sensitive} = false)`,
    ),

    uniqueIndex('application_form_fields_key_idx').on(t.formId, t.key),
    index('application_form_fields_order_idx').on(t.formId, t.sortOrder),
  ],
);

export type ApplicationFormField = typeof applicationFormFields.$inferSelect;
export type NewApplicationFormField = typeof applicationFormFields.$inferInsert;

// ── The applications ─────────────────────────────────────────────────────

/**
 * One submitted application.
 *
 * `answers` is keyed by `application_form_fields.key`, so a form whose fields
 * change later does not rewrite history: an answer to a field that has since
 * been deleted stays in the row and the export still has a column for it,
 * because the exporter unions the current field list with the keys actually
 * present.
 *
 * `applicantName` / `applicantEmail` / `applicantPhone` are copies of three
 * answers, denormalised on purpose. The applicants table sorts, searches and
 * de-duplicates on them, and none of that can be done on a jsonb key that may
 * not exist. They are written by `app.submit_application()` from the fields
 * the form marks as its identity fields, never by the client.
 *
 * `purgeAfter` comes from the form's `retentionMonths` at insert, so a file's
 * life is fixed when it is created and does not depend on a later backfill.
 */
export const applications = pgTable(
  'applications',
  {
    id: uuid().primaryKey().defaultRandom(),
    formId: uuid().notNull(),
    /** Snapshot of the form's vacancy, so a detached form keeps the link. */
    vacancyId: uuid(),

    /** `PCS-APP-XXXXXXXX`, generated by a trigger when not supplied. */
    reference: text().notNull().unique('applications_reference_key'),
    locale: localeCode().notNull().default('ar'),

    status: applicationStatus().notNull().default('new'),
    /** Arrived after the cap, on a form whose rule is `waitlist`. */
    waitlisted: boolean().notNull().default(false),

    answers: jsonb().$type<Record<string, unknown>>().notNull(),
    attachments: jsonb()
      .$type<ApplicationAttachment[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),

    applicantName: text(),
    applicantEmail: text(),
    applicantPhone: text(),

    /** 1–5, the reviewer's own mark. Null until someone sets one. */
    rating: smallint(),
    internalNote: text(),
    reviewedBy: uuid(),
    reviewedAt: timestamp({ withTimezone: true }),

    /** `sha256(ip + IP_HASH_SALT)`. Never a raw address. */
    ipHash: text(),
    userAgent: text(),

    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    purgeAfter: date().notNull(),
  },
  (t) => [
    fk('applications_form_id_fkey', t.formId, applicationForms.id, 'cascade'),
    fk('applications_vacancy_id_fkey', t.vacancyId, vacancies.id, 'set null'),
    fk('applications_reviewed_by_fkey', t.reviewedBy, profiles.id, 'set null'),

    /** Leaving `new` records who and when; `reviewed_at` cannot be skipped. */
    check(
      'applications_reviewed_shape',
      sql`${t.status} = 'new' or ${t.reviewedAt} is not null`,
    ),
    check('applications_rating_range', sql`${t.rating} is null or ${t.rating} between 1 and 5`),

    index('applications_form_idx').on(t.formId, t.createdAt.desc()),
    index('applications_status_idx').on(t.formId, t.status),
    index('applications_purge_idx').on(t.purgeAfter),
    index('applications_email_idx').on(t.formId, t.applicantEmail),
  ],
);

export type Application = typeof applications.$inferSelect;
export type NewApplication = typeof applications.$inferInsert;

// ── The pipeline's history ───────────────────────────────────────────────

/**
 * Every status change, append-only.
 *
 * Separate from `audit_logs` rather than folded into it. The audit log answers
 * "who touched what" across the whole admin and is readable by admins only;
 * this answers "what happened to this applicant" and belongs on the applicant's
 * own screen, in front of the person reviewing them. A service writes both.
 *
 * `actorId` is `set null` on profile deletion: the record that a decision was
 * taken must survive the departure of whoever took it.
 */
export const applicationEvents = pgTable(
  'application_events',
  {
    id: uuid().primaryKey().defaultRandom(),
    applicationId: uuid().notNull(),
    actorId: uuid(),
    /** Null on the row that records the application arriving. */
    fromStatus: applicationStatus(),
    toStatus: applicationStatus().notNull(),
    note: text(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    fk('application_events_application_id_fkey', t.applicationId, applications.id, 'cascade'),
    fk('application_events_actor_id_fkey', t.actorId, profiles.id, 'set null'),
    index('application_events_application_idx').on(t.applicationId, t.createdAt.desc()),
  ],
);

export type ApplicationEvent = typeof applicationEvents.$inferSelect;
export type NewApplicationEvent = typeof applicationEvents.$inferInsert;
