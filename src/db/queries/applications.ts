import { and, asc, desc, eq, gt, isNull, or, sql } from 'drizzle-orm';
import { db } from '@/db';
import {
  applicationFormFields,
  applicationForms,
  type ApplicationFieldOption,
  type ApplicationFieldConfig,
  type ApplicationVisibleWhen,
} from '@/db/schema';
import type {
  ApplicationCapacityRule,
  ApplicationFieldType,
  ApplicationFormKind,
} from '@/db/schema/enums';
import type { RichText } from '@/db/schema/_shared';
import type { Locale } from '@/lib/i18n/config';
import { TAGS } from '@/lib/cache/tags';
import { cached } from './_cache';
import { pick } from './_localize';

/**
 * The public side of the careers portal: read-only, cached, locale-resolved.
 *
 * **No actor is bound.** `anon` is the correct identity for a visitor and the
 * policies already restrict it — `application_forms.rt_select` is
 * `status = 'published' OR app.is_staff()`, and a field is visible exactly when
 * its form is. The `eq(status, 'published')` below stays anyway. It is the same
 * rule stated twice on purpose: the query layer's copy is what makes the
 * intention readable at the call site, and the policy's copy is what holds when
 * this file is wrong.
 *
 * Everything here returns **resolved** strings — `title`, not `titleAr` and
 * `titleEn` — so no component writes the locale ternary that is where an
 * English fallback silently stops happening.
 */

export type PublicFormField = {
  id: string;
  key: string;
  type: ApplicationFieldType;
  label: string;
  placeholder: string | null;
  help: string | null;
  required: boolean;
  sensitive: boolean;
  options: { value: string; label: string }[];
  config: ApplicationFieldConfig;
  visibleWhen: ApplicationVisibleWhen | null;
};

export type PublicForm = {
  id: string;
  slug: string;
  kind: ApplicationFormKind;
  title: string;
  intro: RichText | null;
  confirmation: string | null;
  opensAt: Date | null;
  closesAt: Date | null;
  capacity: number | null;
  capacityRule: ApplicationCapacityRule;
  submissionCount: number;
  requireConsent: boolean;
  /** Rendered on the form as the retention promise the applicant is given. */
  retentionMonths: number;
  status: 'published';
  vacancyId: string | null;
  fields: PublicFormField[];
};

/**
 * Resolves an option list against the locale.
 *
 * Falls back to the Arabic label rather than the raw value: a select whose
 * English labels were never filled in should read `غزة`, not `gaza`. The value
 * is a machine key and is never shown.
 */
function localizeOptions(
  options: ApplicationFieldOption[],
  locale: Locale,
): { value: string; label: string }[] {
  return options.map((option) => ({
    value: option.value,
    label:
      locale === 'en' && option.labelEn?.trim() ? option.labelEn : option.labelAr,
  }));
}

async function _getApplicationForm(
  slug: string,
  locale: Locale,
): Promise<PublicForm | null> {
  const [form] = await db
    .select()
    .from(applicationForms)
    .where(and(eq(applicationForms.slug, slug), eq(applicationForms.status, 'published')))
    .limit(1);

  if (!form) return null;

  const fields = await db
    .select()
    .from(applicationFormFields)
    .where(eq(applicationFormFields.formId, form.id))
    .orderBy(asc(applicationFormFields.sortOrder), asc(applicationFormFields.key));

  return {
    id: form.id,
    slug: form.slug,
    kind: form.kind,
    title: pick(form, 'title', locale) ?? form.titleAr,
    intro: (locale === 'en' ? (form.introEn ?? form.introAr) : form.introAr) ?? null,
    confirmation: pick(form, 'confirmation', locale),
    opensAt: form.opensAt,
    closesAt: form.closesAt,
    capacity: form.capacity,
    capacityRule: form.capacityRule,
    submissionCount: form.submissionCount,
    requireConsent: form.requireConsent,
    retentionMonths: form.retentionMonths,
    status: 'published',
    vacancyId: form.vacancyId,
    fields: fields
      // A form may hold a field marked sensitive while `requireConsent` is off
      // only if it was never published in that state — `setFormStatus` refuses
      // it. This is the second wall: if such a form exists, the sensitive
      // fields are simply not rendered rather than collected without consent.
      .filter((field) => form.requireConsent || !field.sensitive)
      .map((field) => ({
        id: field.id,
        key: field.key,
        type: field.type,
        label: pick(field, 'label', locale) ?? field.labelAr,
        placeholder: pick(field, 'placeholder', locale),
        help: pick(field, 'help', locale),
        required: field.required,
        sensitive: field.sensitive,
        options: localizeOptions(field.options, locale),
        config: field.config,
        visibleWhen: field.visibleWhen,
      })),
  };
}

export const getApplicationForm = cached(_getApplicationForm, ['application-form'], {
  tags: (slug) => [TAGS.applicationForm(slug), TAGS.applicationFormList],
});

export { _getApplicationForm };

// ── Listing what is open ─────────────────────────────────────────────────

export type OpenFormCard = {
  slug: string;
  kind: ApplicationFormKind;
  title: string;
  closesAt: Date | null;
  /** Null when uncapped; otherwise how many slots are left, floored at zero. */
  slotsLeft: number | null;
};

/**
 * Every form currently accepting applications.
 *
 * The window and the cap are filtered **in SQL** rather than in TypeScript, so
 * a careers page with forty closed forms behind it does not read forty rows to
 * show none. `now()` inside a cached query is safe here because the entry is
 * revalidated hourly and busted on every form mutation; a form that closes
 * between two revalidations shows as open for at most an hour, and
 * `app.submit_application()` still refuses the submission with a message the
 * applicant can act on.
 *
 * A `waitlist` form past its cap stays in the list: it is still accepting
 * names, which is the whole meaning of that rule.
 */
async function _listOpenForms(locale: Locale): Promise<OpenFormCard[]> {
  const rows = await db
    .select({
      slug: applicationForms.slug,
      kind: applicationForms.kind,
      titleAr: applicationForms.titleAr,
      titleEn: applicationForms.titleEn,
      closesAt: applicationForms.closesAt,
      capacity: applicationForms.capacity,
      submissionCount: applicationForms.submissionCount,
    })
    .from(applicationForms)
    .where(
      and(
        eq(applicationForms.status, 'published'),
        or(isNull(applicationForms.opensAt), sql`${applicationForms.opensAt} <= now()`),
        or(isNull(applicationForms.closesAt), sql`${applicationForms.closesAt} > now()`),
        or(
          isNull(applicationForms.capacity),
          eq(applicationForms.capacityRule, 'waitlist'),
          gt(applicationForms.capacity, applicationForms.submissionCount),
        ),
      ),
    )
    .orderBy(asc(applicationForms.closesAt), desc(applicationForms.publishedAt));

  return rows.map((row) => ({
    slug: row.slug,
    kind: row.kind,
    title: pick(row, 'title', locale) ?? row.titleAr,
    closesAt: row.closesAt,
    slotsLeft:
      row.capacity === null ? null : Math.max(0, row.capacity - row.submissionCount),
  }));
}

export const listOpenForms = cached(_listOpenForms, ['application-form-list'], {
  tags: [TAGS.applicationFormList],
});

export { _listOpenForms };

/**
 * The form attached to a vacancy, for the "apply" button on its page.
 *
 * Returns the slug only. The vacancy page needs a link, not a form, and
 * fetching the fields to render a button would pull a dozen rows per card.
 */
async function _getFormSlugForVacancy(vacancyId: string): Promise<string | null> {
  const [row] = await db
    .select({ slug: applicationForms.slug })
    .from(applicationForms)
    .where(
      and(
        eq(applicationForms.vacancyId, vacancyId),
        eq(applicationForms.status, 'published'),
      ),
    )
    .limit(1);

  return row?.slug ?? null;
}

export const getFormSlugForVacancy = cached(
  _getFormSlugForVacancy,
  ['application-form-for-vacancy'],
  { tags: [TAGS.applicationFormList] },
);

export { _getFormSlugForVacancy };
