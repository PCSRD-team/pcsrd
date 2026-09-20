'use client';
// Client Component: `useActionState` places a rejected save's errors on the
// fields that caused them. The form still submits natively before hydration.

import { useActionState } from 'react';
import { type EntityResult, saveProjectForm } from '@/actions/admin/entity-forms';
import { BilingualField } from '@/components/admin/bilingual-field';
import { PublishBar } from '@/components/admin/controls';
import { GalleryPicker } from '@/components/admin/gallery-picker';
import { MediaPicker } from '@/components/admin/media-picker';
import { RichTextEditor } from '@/components/admin/rich-text-editor';
import { describedBy, Field, FieldRow } from '@/components/ui/field';
import { Checkbox, Input, Select, Textarea } from '@/components/ui/inputs';
import { Stack } from '@/components/ui/layout';
import { Notice } from '@/components/ui/notice';
import { ADMIN_OPTIONS } from '@/lib/admin-options';
import type { RichText } from '@/db/schema/_shared';
import type { ContentStatus } from '@/db/schema/enums';
import { type AdminFormDict, resolveAdminKey } from './admin-dict';
import { adminUi } from './admin-ui-dict';

/**
 * The project editor — the template the other content forms follow.
 *
 * What the client adds over a native form is field-level error placement and
 * the rich-text editors. The **status** is posted by whichever button in
 * `PublishBar` was pressed, so "save as draft" and "publish" are the same
 * submission with a different value rather than two code paths that can
 * drift apart.
 *
 * Field labels and hints are the project's own configuration and live here,
 * like the entity configs in `field-configs.ts`; the chrome around them comes
 * from `adminUi`.
 */

export type ProjectFormValues = {
  id?: string;
  status: ContentStatus;
  titleAr: string;
  titleEn: string | null;
  slugAr: string;
  slugEn: string;
  summaryAr: string | null;
  summaryEn: string | null;
  objectiveAr: RichText | null;
  objectiveEn: RichText | null;
  activitiesAr: RichText | null;
  activitiesEn: RichText | null;
  outcomesAr: RichText | null;
  outcomesEn: RichText | null;
  programId: string;
  projectState: 'planned' | 'active' | 'completed';
  startDate: string | null;
  endDate: string | null;
  governorates: string[];
  localities: string[];
  themes: string[];
  heroMediaId: string | null;
  isFeatured: boolean;
  sourceNote: string | null;
  seoTitleAr: string | null;
  seoTitleEn: string | null;
  seoDescriptionAr: string | null;
  seoDescriptionEn: string | null;
  ogMediaId: string | null;
  noIndex: boolean;
  translationStatus: string;
  /** Ordered media ids from `project_media`. */
  gallery: string[];
  implementingPartners: string[];
  donors: string[];
};

export type Option = { value: string; label: string };

/**
 * The screen's words, read from the dictionary (RULE 5) rather than restated
 * here. The labels this form shares with the generic entity editors come from
 * `fields.common`, so the project editor and the post editor cannot drift
 * apart on what "الصورة الرئيسية" is called.
 */
const LABEL = {
  title: adminUi.fields.common.title,
  slug: adminUi.fields.common.slug,
  slugHint: adminUi.fields.project.slugHint,
  program: adminUi.fields.common.program,
  state: adminUi.fields.project.state,
  startDate: adminUi.fields.project.startDate,
  endDate: adminUi.fields.project.endDate,
  endDateHint: adminUi.fields.project.endDateHint,
  governorates: adminUi.fields.project.governorates,
  themes: adminUi.fields.project.themes,
  implementingPartners: adminUi.fields.project.implementingPartners,
  donors: adminUi.fields.project.donors,
  summary: adminUi.fields.common.summary,
  objectiveAr: adminUi.fields.project.objectiveAr,
  objectiveEn: adminUi.fields.project.objectiveEn,
  activitiesAr: adminUi.fields.project.activitiesAr,
  activitiesEn: adminUi.fields.project.activitiesEn,
  outcomesAr: adminUi.fields.project.outcomesAr,
  outcomesEn: adminUi.fields.project.outcomesEn,
  localities: adminUi.fields.project.localities,
  localitiesHint: adminUi.fields.project.localitiesHint,
  hero: adminUi.fields.common.heroMedia,
  heroHint: adminUi.fields.project.heroHint,
  gallery: adminUi.fields.common.gallery,
  galleryHint: adminUi.fields.common.galleryHint,
  featured: adminUi.fields.common.featured,
  sourceNote: adminUi.fields.project.sourceNote,
  sourceNoteHint: adminUi.fields.project.sourceNoteHint,
} as const;

export function ProjectForm({
  values,
  options,
  canPublish,
  dict,
}: {
  values: Partial<ProjectFormValues>;
  options: {
    programs: Option[];
    partners: Option[];
    governorates: Option[];
    themes: Option[];
    states: Option[];
  };
  canPublish: boolean;
  dict: AdminFormDict;
}) {
  const [state, formAction, pending] = useActionState<EntityResult | null, FormData>(
    saveProjectForm,
    null,
  );
  const errors = state && !state.ok ? state.fieldErrors : undefined;
  const firstError = (field: string) => {
    const key = errors?.[field]?.[0];
    return key ? resolveAdminKey(dict, key) : undefined;
  };
  // STATE-007 — see `ContentForm`.
  const hasFieldErrors = Boolean(
    errors && Object.keys(errors).some((key) => key !== '_form' && (errors[key]?.length ?? 0) > 0),
  );
  const f = adminUi.form;

  return (
    <form action={formAction}>
      <Stack gap={8}>
        {values.id ? <input type="hidden" name="id" value={values.id} /> : null}

        {state && !state.ok ? (
          <Notice tone="danger">
            {hasFieldErrors
              ? resolveAdminKey(dict, 'admin.form.checkFields')
              : resolveAdminKey(dict, state.messageKey)}
          </Notice>
        ) : null}

        <BilingualField
          name="title"
          label={LABEL.title}
          required
          maxLength={{ ar: 200, en: 200 }}
          defaultAr={values.titleAr ?? ''}
          defaultEn={values.titleEn ?? ''}
          errorAr={firstError('titleAr')}
          errorEn={firstError('titleEn')}
        />

        <BilingualField
          name="slug"
          label={LABEL.slug}
          required
          hint={LABEL.slugHint}
          defaultAr={values.slugAr ?? ''}
          defaultEn={values.slugEn ?? ''}
          errorAr={firstError('slugAr')}
          errorEn={firstError('slugEn')}
        />

        <FieldRow>
          <Field name="programId" label={LABEL.program} required error={firstError('programId')}>
            <Select
              name="programId"
              required
              options={options.programs}
              defaultValue={values.programId}
              error={firstError('programId')}
            />
          </Field>
          <Field name="projectState" label={LABEL.state} error={firstError('projectState')}>
            <Select
              name="projectState"
              options={options.states}
              defaultValue={values.projectState ?? 'active'}
              error={firstError('projectState')}
            />
          </Field>
        </FieldRow>

        <FieldRow>
          <Field name="startDate" label={LABEL.startDate} error={firstError('startDate')}>
            <Input
              name="startDate"
              type="date"
              defaultValue={values.startDate ?? ''}
              error={firstError('startDate')}
            />
          </Field>
          <Field
            name="endDate"
            label={LABEL.endDate}
            hint={LABEL.endDateHint}
            error={firstError('endDate')}
          >
            <Input
              name="endDate"
              type="date"
              defaultValue={values.endDate ?? ''}
              hint={LABEL.endDateHint}
              error={firstError('endDate')}
            />
          </Field>
        </FieldRow>

        <FieldRow>
          <Field name="governorates" label={LABEL.governorates} error={firstError('governorates')}>
            <Select
              name="governorates"
              multiple
              options={options.governorates}
              defaultValue={values.governorates}
              error={firstError('governorates')}
            />
          </Field>
          <Field name="themes" label={LABEL.themes} error={firstError('themes')}>
            <Select
              name="themes"
              multiple
              options={options.themes}
              defaultValue={values.themes}
              error={firstError('themes')}
            />
          </Field>
        </FieldRow>

        <FieldRow>
          <Field
            name="implementingPartners"
            label={LABEL.implementingPartners}
            error={firstError('implementingPartners')}
          >
            <Select
              name="implementingPartners"
              multiple
              options={options.partners}
              defaultValue={values.implementingPartners}
              error={firstError('implementingPartners')}
            />
          </Field>
          <Field name="donors" label={LABEL.donors} error={firstError('donors')}>
            <Select
              name="donors"
              multiple
              options={options.partners}
              defaultValue={values.donors}
              error={firstError('donors')}
            />
          </Field>
        </FieldRow>

        <BilingualField
          name="summary"
          label={LABEL.summary}
          multiline
          maxLength={{ ar: 600, en: 600 }}
          defaultAr={values.summaryAr ?? ''}
          defaultEn={values.summaryEn ?? ''}
        />

        <FieldRow>
          <RichTextEditor name="objectiveAr" label={LABEL.objectiveAr} defaultValue={values.objectiveAr} />
          <RichTextEditor
            name="objectiveEn"
            label={LABEL.objectiveEn}
            dir="ltr"
            defaultValue={values.objectiveEn}
          />
        </FieldRow>

        <FieldRow>
          <RichTextEditor name="activitiesAr" label={LABEL.activitiesAr} defaultValue={values.activitiesAr} />
          <RichTextEditor
            name="activitiesEn"
            label={LABEL.activitiesEn}
            dir="ltr"
            defaultValue={values.activitiesEn}
          />
        </FieldRow>

        <FieldRow>
          <RichTextEditor name="outcomesAr" label={LABEL.outcomesAr} defaultValue={values.outcomesAr} />
          <RichTextEditor
            name="outcomesEn"
            label={LABEL.outcomesEn}
            dir="ltr"
            defaultValue={values.outcomesEn}
          />
        </FieldRow>

        <Field
          name="localities"
          label={LABEL.localities}
          hint={LABEL.localitiesHint}
          error={firstError('localities')}
        >
          <Textarea
            name="localities"
            rows={3}
            defaultValue={(values.localities ?? []).join('\n')}
            hint={LABEL.localitiesHint}
            error={firstError('localities')}
          />
        </Field>

        <Field name="heroMediaId" label={LABEL.hero} hint={LABEL.heroHint} error={firstError('heroMediaId')}>
          <MediaPicker
            name="heroMediaId"
            initialValue={values.heroMediaId ?? ''}
            kind="image"
            invalid={Boolean(firstError('heroMediaId'))}
            describedBy={describedBy('heroMediaId', LABEL.heroHint, firstError('heroMediaId'))}
          />
        </Field>

        <GalleryPicker
          name="gallery"
          label={LABEL.gallery}
          hint={LABEL.galleryHint}
          initial={values.gallery ?? []}
        />

        <Checkbox name="isFeatured" label={LABEL.featured} defaultChecked={values.isFeatured} />

        <Field name="sourceNote" label={LABEL.sourceNote} hint={LABEL.sourceNoteHint}>
          <Textarea
            name="sourceNote"
            rows={2}
            defaultValue={values.sourceNote ?? ''}
            hint={LABEL.sourceNoteHint}
          />
        </Field>

        <details className="rule-edge bg-paper p-6">
          <summary className="cursor-pointer text-small font-medium text-ink">{f.seo}</summary>
          <Stack gap={6} className="mbs-5">
            <BilingualField
              name="seoTitle"
              label={f.seoTitle}
              maxLength={{ ar: 60, en: 60 }}
              hint={f.seoTitleHint}
              defaultAr={values.seoTitleAr ?? ''}
              defaultEn={values.seoTitleEn ?? ''}
            />
            <BilingualField
              name="seoDescription"
              label={f.seoDescription}
              multiline
              maxLength={{ ar: 160, en: 160 }}
              defaultAr={values.seoDescriptionAr ?? ''}
              defaultEn={values.seoDescriptionEn ?? ''}
            />
            <Field
              name="ogMediaId"
              label={f.ogImage}
              hint={f.ogImageHint}
              error={firstError('ogMediaId')}
            >
              <MediaPicker
                name="ogMediaId"
                initialValue={values.ogMediaId ?? ''}
                kind="image"
                invalid={Boolean(firstError('ogMediaId'))}
                describedBy={describedBy('ogMediaId', f.ogImageHint, firstError('ogMediaId'))}
              />
            </Field>
            <Checkbox
              name="noIndex"
              label={f.noIndex}
              defaultChecked={values.noIndex}
              hint={f.noIndexHint}
            />
          </Stack>
        </details>

        <Field
          name="translationStatus"
          label={f.translationStatus}
          hint={f.translationStatusHint}
          error={firstError('translationStatus')}
        >
          <Select
            name="translationStatus"
            options={[...ADMIN_OPTIONS.translationStatus]}
            defaultValue={values.translationStatus ?? 'ar_only'}
            hint={f.translationStatusHint}
            error={firstError('translationStatus')}
          />
        </Field>

        <fieldset disabled={pending}>
          <PublishBar status={values.status ?? 'draft'} canPublish={canPublish} />
        </fieldset>
      </Stack>
    </form>
  );
}
