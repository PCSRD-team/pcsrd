'use client';

import { useActionState } from 'react';
import { type EntityResult, saveProjectForm } from '@/actions/admin/entity-forms';
import { BilingualField } from '@/components/admin/bilingual-field';
import {
  CheckboxField,
  EnumSelect,
  Field,
  PublishBar,
  inputClass,
} from '@/components/admin/controls';
import { GalleryPicker } from '@/components/admin/gallery-picker';
import { RichTextEditor } from '@/components/admin/rich-text-editor';
import { MediaPicker } from '@/components/admin/media-picker';
import { ADMIN_OPTIONS } from '@/lib/admin-options';
import type { RichText } from '@/db/schema/_shared';
import type { ContentStatus } from '@/db/schema/enums';
import { type AdminFormDict, resolveAdminKey } from './admin-dict';

/**
 * The project editor — the template the other content forms follow.
 *
 * A Client Component for `useActionState`, and it submits natively before
 * hydration like every other form here. What the client adds is field-level
 * error placement and the rich-text editors.
 *
 * The **status** is posted by whichever button in `PublishBar` was pressed, so
 * "save as draft" and "publish" are the same submission with a different value
 * rather than two code paths that can drift apart.
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

  return (
    <form action={formAction} className="space-y-8">
      {values.id ? <input type="hidden" name="id" value={values.id} /> : null}

      {state && !state.ok ? (
        <div className="rule-edge border-gold-600 bg-gold-050 p-4" role="alert">
          <p className="text-small text-ink">
            {hasFieldErrors
              ? resolveAdminKey(dict, 'admin.form.checkFields')
              : resolveAdminKey(dict, state.messageKey)}
          </p>
        </div>
      ) : null}

      <BilingualField
        name="title"
        label="العنوان"
        required
        maxLength={{ ar: 200, en: 200 }}
        defaultAr={values.titleAr ?? ''}
        defaultEn={values.titleEn ?? ''}
        errorAr={firstError('titleAr')}
        errorEn={firstError('titleEn')}
      />

      <BilingualField
        name="slug"
        label="المسار"
        required
        hint="حروف وأرقام وشرطات فقط. يُشتق من العنوان إن تُرك فارغاً."
        defaultAr={values.slugAr ?? ''}
        defaultEn={values.slugEn ?? ''}
        errorAr={firstError('slugAr')}
        errorEn={firstError('slugEn')}
      />

      <div className="grid gap-6 md:grid-cols-2">
        <EnumSelect
          name="programId"
          label="البرنامج"
          required
          options={options.programs}
          defaultValue={values.programId}
        />
        <EnumSelect
          name="projectState"
          label="حالة المشروع"
          options={options.states}
          defaultValue={values.projectState ?? 'active'}
        />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Field name="startDate" label="تاريخ البدء">
          <input
            id="startDate"
            name="startDate"
            type="date"
            defaultValue={values.startDate ?? ''}
            className={inputClass}
          />
        </Field>
        <Field name="endDate" label="تاريخ الانتهاء" hint="لا يسبق تاريخ البدء.">
          <input
            id="endDate"
            name="endDate"
            type="date"
            defaultValue={values.endDate ?? ''}
            className={inputClass}
          />
          {firstError('endDate') ? (
            <p className="text-caption text-gold-700" role="alert">
              {firstError('endDate')}
            </p>
          ) : null}
        </Field>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <EnumSelect
          name="governorates"
          label="المحافظات"
          multiple
          options={options.governorates}
          defaultValue={values.governorates}
        />
        <EnumSelect
          name="themes"
          label="المحاور"
          multiple
          options={options.themes}
          defaultValue={values.themes}
        />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <EnumSelect
          name="implementingPartners"
          label="شركاء التنفيذ"
          multiple
          options={options.partners}
          defaultValue={values.implementingPartners}
        />
        <EnumSelect
          name="donors"
          label="الجهات المموّلة"
          multiple
          options={options.partners}
          defaultValue={values.donors}
        />
      </div>

      <BilingualField
        name="summary"
        label="ملخّص"
        multiline
        maxLength={{ ar: 600, en: 600 }}
        defaultAr={values.summaryAr ?? ''}
        defaultEn={values.summaryEn ?? ''}
      />

      <div className="grid gap-6 md:grid-cols-2">
        <RichTextEditor name="objectiveAr" label="الهدف (عربي)" defaultValue={values.objectiveAr} />
        <RichTextEditor
          name="objectiveEn"
          label="Objective (English)"
          dir="ltr"
          defaultValue={values.objectiveEn}
        />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <RichTextEditor name="activitiesAr" label="الأنشطة (عربي)" defaultValue={values.activitiesAr} />
        <RichTextEditor
          name="activitiesEn"
          label="Activities (English)"
          dir="ltr"
          defaultValue={values.activitiesEn}
        />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <RichTextEditor name="outcomesAr" label="المخرجات (عربي)" defaultValue={values.outcomesAr} />
        <RichTextEditor
          name="outcomesEn"
          label="Outcomes (English)"
          dir="ltr"
          defaultValue={values.outcomesEn}
        />
      </div>

      <Field
        name="localities"
        label="المناطق والأحياء"
        hint="اسم في كل سطر. تظهر مع المحافظات في بطاقة المشروع."
        error={firstError('localities')}
      >
        <textarea
          id="localities"
          name="localities"
          rows={3}
          defaultValue={(values.localities ?? []).join('\n')}
          className={inputClass}
        />
      </Field>

      <Field name="heroMediaId" label="الصورة الرئيسية" hint="اختر صورة من مكتبة الوسائط.">
        <MediaPicker name="heroMediaId" initialValue={values.heroMediaId ?? ''} kind="image" />
      </Field>

      <GalleryPicker
        name="gallery"
        label="معرض الصور"
        hint="بالترتيب الذي تظهر به. كل صورة تخضع لقاعدة الموافقة عند النشر."
        initial={values.gallery ?? []}
      />

      <CheckboxField name="isFeatured" label="مميّز" defaultChecked={values.isFeatured} />

      <Field
        name="sourceNote"
        label="ملاحظة داخلية"
        hint="لا تُعرض على الموقع. لتوثيق مصدر البيانات."
      >
        <textarea
          id="sourceNote"
          name="sourceNote"
          rows={2}
          defaultValue={values.sourceNote ?? ''}
          className={inputClass}
        />
      </Field>

      <details className="rule-edge rounded-lg bg-paper p-5 shadow-[0_10px_28px_rgb(20_33_63/0.04)]">
        <summary className="cursor-pointer text-small font-medium text-ink">
          تحسين محركات البحث
        </summary>
        <div className="mbs-5 space-y-6">
          <BilingualField
            name="seoTitle"
            label="عنوان SEO"
            maxLength={{ ar: 60, en: 60 }}
            hint="العربية أطول بنحو 10% لكل حرف."
            defaultAr={values.seoTitleAr ?? ''}
            defaultEn={values.seoTitleEn ?? ''}
          />
          <BilingualField
            name="seoDescription"
            label="وصف SEO"
            multiline
            maxLength={{ ar: 160, en: 160 }}
            defaultAr={values.seoDescriptionAr ?? ''}
            defaultEn={values.seoDescriptionEn ?? ''}
          />
          <Field
            name="ogMediaId"
            label="صورة المشاركة (Open Graph)"
            hint="تظهر عند مشاركة الرابط. إن تُركت فارغة تُستخدم صورة المؤسسة الافتراضية."
            error={firstError('ogMediaId')}
          >
            <MediaPicker name="ogMediaId" initialValue={values.ogMediaId ?? ''} kind="image" />
          </Field>
          <CheckboxField
            name="noIndex"
            label="منع الفهرسة"
            defaultChecked={values.noIndex}
            hint="يمنع محركات البحث من فهرسة هذه الصفحة."
          />
        </div>
      </details>

      <EnumSelect
        name="translationStatus"
        label="حالة الترجمة"
        options={[...ADMIN_OPTIONS.translationStatus]}
        defaultValue={values.translationStatus ?? 'ar_only'}
        hint="تُحدَّد يدوياً. الموقع يعرض المحتوى العربي للقارئ الإنجليزي ما لم تكن الترجمة مراجَعة."
        error={firstError('translationStatus')}
      />

      <fieldset disabled={pending}>
        <PublishBar status={values.status ?? 'draft'} canPublish={canPublish} />
      </fieldset>
    </form>
  );
}
