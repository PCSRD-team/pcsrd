'use client';

import { useActionState } from 'react';
import { saveOrganizationForm, type OrganizationResult } from '@/actions/admin/organization';
import { CheckboxField, Field, fieldDescribedBy, inputClass } from '@/components/admin/controls';

/**
 * The organisation settings editor.
 *
 * `/admin/organization` is in the primary nav and its route directory was
 * empty. That made this the only screen the nav promises and does not deliver —
 * and it is the screen `scripts/seed.ts` documents as the way to replace the
 * `TODO(org):` placeholders it writes. Until now the only route to changing the
 * organisation's legal name or licence number was raw SQL against production.
 *
 * A Client Component for `useActionState` alone. The form posts to a Server
 * Action and works with JavaScript disabled; `useActionState` adds the pending
 * state and the field errors on top.
 */

type Values = Record<string, unknown>;

const str = (values: Values, name: string) => (values[name] as string | null) ?? '';
const json = (values: Values, name: string) => {
  const value = values[name];
  if (value === null || value === undefined) return '';
  return JSON.stringify(value, null, 2);
};

export function OrganizationForm({ values }: { values: Values }) {
  const [state, action, pending] = useActionState<OrganizationResult | null, FormData>(
    saveOrganizationForm,
    null,
  );

  const errors = state && !state.ok ? state.fieldErrors : undefined;
  const firstError = (name: string) => errors?.[name]?.[0];

  const text = (
    name: string,
    label: string,
    options: { required?: boolean; hint?: string; dir?: 'ltr' | 'rtl'; type?: string } = {},
  ) => (
    <Field
      name={name}
      label={label}
      hint={options.hint}
      error={firstError(name)}
      required={options.required}
    >
      <input
        id={name}
        name={name}
        type={options.type ?? 'text'}
        required={options.required}
        defaultValue={str(values, name)}
        dir={options.dir}
        aria-invalid={firstError(name) ? true : undefined}
        aria-describedby={fieldDescribedBy(name, options.hint, firstError(name))}
        className={options.dir === 'ltr' ? `${inputClass} text-start` : inputClass}
      />
    </Field>
  );

  const area = (name: string, label: string, hint?: string) => (
    <Field name={name} label={label} hint={hint} error={firstError(name)}>
      <textarea
        id={name}
        name={name}
        rows={4}
        defaultValue={str(values, name)}
        aria-invalid={firstError(name) ? true : undefined}
        aria-describedby={fieldDescribedBy(name, hint, firstError(name))}
        className={inputClass}
      />
    </Field>
  );

  const jsonArea = (name: string, label: string, hint: string) => (
    <Field name={name} label={label} hint={hint} error={firstError(name)}>
      <textarea
        id={name}
        name={name}
        rows={8}
        defaultValue={json(values, name)}
        dir="ltr"
        aria-invalid={firstError(name) ? true : undefined}
        aria-describedby={fieldDescribedBy(name, hint, firstError(name))}
        className={`${inputClass} text-start font-mono text-caption`}
      />
    </Field>
  );

  return (
    <form action={action} className="space-y-10">
      {/* Always in the DOM, contents swapped — a live region that appears at the
          same moment as its content is frequently never announced. */}
      <div aria-live="polite" role="status">
        {state ? (
          <div
            className={
              state.ok
                ? 'rule-edge border-navy-700 bg-navy-100 p-4'
                : 'rule-edge border-gold-600 bg-gold-050 p-4'
            }
          >
            <p className="text-small text-ink">
              {state.ok ? 'تم الحفظ.' : 'تحقّق من الحقول المميّزة.'}
            </p>
          </div>
        ) : null}
      </div>

      <section className="space-y-6">
        <h2 className="border-be-2 border-ink pbe-2 text-h3 font-semibold text-ink">
          الهوية القانونية
        </h2>
        <p className="text-small text-ink-55">
          هذه الحقول تظهر في السجل التعريفي وفي صفحة التحقّق، ويستخدمها المانحون للتأكّد من أنّ
          المؤسسة حقيقية. لا تتركها كما هي إن كانت تبدأ بـ <code dir="ltr">TODO(org):</code>.
        </p>

        <div className="grid gap-6 md:grid-cols-2">
          {text('legalNameAr', 'الاسم القانوني (عربي)', { required: true })}
          {text('legalNameEn', 'الاسم القانوني (إنجليزي)', { required: true, dir: 'ltr' })}
          {text('shortNameAr', 'الاسم المختصر (عربي)', { required: true })}
          {text('shortNameEn', 'الاسم المختصر (إنجليزي)', { required: true, dir: 'ltr' })}
          {text('acronym', 'الاختصار', { required: true, dir: 'ltr' })}
          {text('foundedYear', 'سنة التأسيس', { type: 'number' })}
          {text('licenseNumber', 'رقم الترخيص', { required: true, dir: 'ltr' })}
          {text('licenseAuthorityAr', 'جهة الترخيص (عربي)')}
          {text('licenseAuthorityEn', 'جهة الترخيص (إنجليزي)', { dir: 'ltr' })}
          {text('legalFormAr', 'الشكل القانوني (عربي)')}
          {text('legalFormEn', 'الشكل القانوني (إنجليزي)', { dir: 'ltr' })}
        </div>
      </section>

      <section className="space-y-6">
        <h2 className="border-be-2 border-ink pbe-2 text-h3 font-semibold text-ink">
          الرؤية والرسالة
        </h2>
        <div className="grid gap-6 md:grid-cols-2">
          {area('visionAr', 'الرؤية (عربي)')}
          {area('visionEn', 'الرؤية (إنجليزي)')}
          {area('missionAr', 'الرسالة (عربي)')}
          {area('missionEn', 'الرسالة (إنجليزي)')}
        </div>
      </section>

      <section className="space-y-6">
        <h2 className="border-be-2 border-ink pbe-2 text-h3 font-semibold text-ink">
          وسائل التواصل
        </h2>
        <div className="grid gap-6 md:grid-cols-2">
          {text('primaryPhone', 'الهاتف الأساسي', { dir: 'ltr', hint: 'بصيغة دولية، مثل +970...' })}
          {text('whatsappNumber', 'رقم واتساب', {
            dir: 'ltr',
            hint: 'أرقام فقط دون علامة +، لأنّه مسار wa.me.',
          })}
          {text('email', 'البريد الإلكتروني', { dir: 'ltr', type: 'email' })}
          {text('officeHoursAr', 'ساعات العمل (عربي)')}
          {text('officeHoursEn', 'ساعات العمل (إنجليزي)', { dir: 'ltr' })}
          {text('addressAr', 'العنوان (عربي)')}
          {text('addressEn', 'العنوان (إنجليزي)', { dir: 'ltr' })}
        </div>
        <CheckboxField
          name="addressIsPublic"
          label="إظهار العنوان على الموقع"
          hint="اترك الخيار مغلقاً إن كان إظهار موقع المكتب يعرّض أحداً للخطر."
          defaultChecked={Boolean(values.addressIsPublic)}
        />
      </section>

      <section className="space-y-6">
        <h2 className="border-be-2 border-ink pbe-2 text-h3 font-semibold text-ink">
          الحقول المركّبة
        </h2>
        <p className="text-small text-ink-55">
          تُحرَّر بصيغة JSON. هذا حدّ أدنى مقصود وليس محرّراً نهائياً — البديل المتاح اليوم هو
          تعديل قاعدة البيانات مباشرة. كل حقل يمرّ على التحقّق قبل الحفظ، فالخطأ يُرفض ولا يُكتب.
          اترك الحقل فارغاً لإبقائه دون تغيير.
        </p>

        <div className="space-y-6">
          {jsonArea('alternateNames', 'أسماء بديلة', '["اسم", "اسم آخر"]')}
          {jsonArea('additionalPhones', 'هواتف إضافية', '["+970...", "+970..."]')}
          {jsonArea(
            'coreValues',
            'القيم',
            '[{"title_ar": "...", "title_en": "...", "body_ar": "...", "body_en": "..."}]',
          )}
          {jsonArea('principles', 'المبادئ', 'نفس شكل القيم.')}
          {jsonArea(
            'strategicObjectives',
            'الأهداف الاستراتيجية',
            '[{"text_ar": "...", "text_en": "..."}]',
          )}
          {jsonArea(
            'socials',
            'حسابات التواصل',
            '[{"platform": "facebook", "url": "https://...", "is_official": true}]',
          )}
          {jsonArea(
            'officialChannels',
            'القنوات الرسمية',
            '[{"platform": "...", "handle": "...", "url": "https://...", "is_official": true, "note_ar": null, "note_en": null}] — is_official: false يعني حساب منتحل موثّق، وهذا هو الغرض من صفحة التحقّق.',
          )}
        </div>
      </section>

      <div className="sticky inset-be-0 flex flex-wrap items-center gap-3 border-bs-2 border-ink bg-paper p-4">
        <button
          type="submit"
          disabled={pending}
          className="bg-navy-700 px-5 py-2 text-small font-medium text-paper hover:bg-navy-900 disabled:opacity-60"
        >
          {pending ? 'جارٍ الحفظ…' : 'حفظ'}
        </button>
        <p className="text-caption text-ink-55">
          يُسجَّل كل تعديل هنا في سجلّ التدقيق مع اسم من أجراه.
        </p>
      </div>
    </form>
  );
}
