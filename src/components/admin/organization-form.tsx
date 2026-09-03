'use client';

import { useActionState, useMemo, useState } from 'react';
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
type SocialRow = {
  platform: string;
  url: string;
  is_official: boolean;
  visible: boolean;
  display_order: number;
};

type OfficialChannelRow = SocialRow & {
  handle: string;
  note_ar: string;
  note_en: string;
};

const PLATFORM_OPTIONS = [
  ['facebook', 'Facebook'],
  ['instagram', 'Instagram'],
  ['linkedin', 'LinkedIn'],
  ['youtube', 'YouTube'],
  ['x', 'X / Twitter'],
  ['whatsapp', 'WhatsApp'],
  ['website', 'Website'],
] as const;

const str = (values: Values, name: string) => (values[name] as string | null) ?? '';
const json = (values: Values, name: string) => {
  const value = values[name];
  if (value === null || value === undefined) return '';
  return JSON.stringify(value, null, 2);
};

function arrayValue<T>(values: Values, name: string): T[] {
  const value = values[name];
  return Array.isArray(value) ? (value as T[]) : [];
}

function normalizeSocialRows(values: Values): SocialRow[] {
  return arrayValue<Partial<SocialRow>>(values, 'socials').map((item, index) => ({
    platform: String(item.platform ?? 'facebook'),
    url: String(item.url ?? ''),
    is_official: item.is_official !== false,
    visible: item.visible !== false,
    display_order: Number.isFinite(Number(item.display_order)) ? Number(item.display_order) : index + 1,
  }));
}

function normalizeOfficialRows(values: Values): OfficialChannelRow[] {
  return arrayValue<Partial<OfficialChannelRow>>(values, 'officialChannels').map((item, index) => ({
    platform: String(item.platform ?? 'facebook'),
    handle: String(item.handle ?? ''),
    url: String(item.url ?? ''),
    is_official: item.is_official !== false,
    visible: item.visible !== false,
    display_order: Number.isFinite(Number(item.display_order)) ? Number(item.display_order) : index + 1,
    note_ar: String(item.note_ar ?? ''),
    note_en: String(item.note_en ?? ''),
  }));
}

function compactSocialRows(rows: SocialRow[]) {
  return rows
    .map((row, index) => ({
      platform: row.platform.trim(),
      url: row.url.trim(),
      is_official: row.is_official,
      visible: row.visible,
      display_order: Number.isFinite(row.display_order) ? row.display_order : index + 1,
    }))
    .filter((row) => row.platform && row.url);
}

function compactOfficialRows(rows: OfficialChannelRow[]) {
  return rows
    .map((row, index) => ({
      platform: row.platform.trim(),
      handle: row.handle.trim(),
      url: row.url.trim(),
      is_official: row.is_official,
      visible: row.visible,
      display_order: Number.isFinite(row.display_order) ? row.display_order : index + 1,
      note_ar: row.note_ar.trim() || null,
      note_en: row.note_en.trim() || null,
    }))
    .filter((row) => row.platform && row.handle && row.url);
}

function PlatformSelect({
  value,
  onChange,
  name,
}: {
  value: string;
  onChange: (value: string) => void;
  name: string;
}) {
  return (
    <select
      id={name}
      value={value}
      onChange={(event) => onChange(event.currentTarget.value)}
      className={inputClass}
    >
      {PLATFORM_OPTIONS.map(([value, label]) => (
        <option key={value} value={value}>
          {label}
        </option>
      ))}
    </select>
  );
}

function RowToggle({
  checked,
  label,
  onChange,
}: {
  checked: boolean;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex min-h-10 items-center gap-2 text-caption text-ink">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.currentTarget.checked)}
        className="size-4 rounded accent-navy-700"
      />
      {label}
    </label>
  );
}

function SocialChannelsEditor({
  initialSocials,
  initialOfficialChannels,
  socialError,
  officialError,
}: {
  initialSocials: SocialRow[];
  initialOfficialChannels: OfficialChannelRow[];
  socialError?: string;
  officialError?: string;
}) {
  const [socials, setSocials] = useState(initialSocials);
  const [officialChannels, setOfficialChannels] = useState(initialOfficialChannels);
  const socialPayload = useMemo(() => JSON.stringify(compactSocialRows(socials)), [socials]);
  const officialPayload = useMemo(() => JSON.stringify(compactOfficialRows(officialChannels)), [officialChannels]);

  const updateSocial = (index: number, patch: Partial<SocialRow>) => {
    setSocials((rows) => rows.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row)));
  };
  const updateOfficial = (index: number, patch: Partial<OfficialChannelRow>) => {
    setOfficialChannels((rows) => rows.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row)));
  };

  return (
    <section className="space-y-6">
      <h2 className="border-be-2 border-ink pbe-2 text-h3 font-semibold text-ink">
        القنوات الاجتماعية والرسمية
      </h2>
      <p className="text-small text-ink-55">
        هذه الحقول تغذّي الشريط العلوي وصفحة التحقق. رتّب العناصر بالأرقام، وأخفِ أي قناة دون حذف بياناتها.
      </p>

      <input type="hidden" name="socials" value={socialPayload} />
      <input type="hidden" name="officialChannels" value={officialPayload} />

      <div className="space-y-4 rounded-lg border border-rule bg-white/60 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-small font-semibold text-ink">Official Social Channels</h3>
          <button
            type="button"
            onClick={() =>
              setSocials((rows) => [
                ...rows,
                { platform: 'facebook', url: '', is_official: true, visible: true, display_order: rows.length + 1 },
              ])
            }
            className="rounded-md bg-navy-700 px-4 py-2 text-caption font-medium text-paper hover:bg-navy-900"
          >
            + Add social channel
          </button>
        </div>
        {socialError ? <p className="text-caption text-gold-700">{socialError}</p> : null}
        {socials.length === 0 ? <p className="text-caption text-ink-55">لا توجد قنوات اجتماعية بعد.</p> : null}
        {socials.map((row, index) => (
          <div key={index} className="grid gap-3 rounded-md border border-rule bg-paper p-3 md:grid-cols-[1fr_1.6fr_0.55fr_auto]">
            <Field name={`social-platform-${index}`} label="Platform">
              <PlatformSelect
                name={`social-platform-${index}`}
                value={row.platform}
                onChange={(platform) => updateSocial(index, { platform })}
              />
            </Field>
            <Field name={`social-url-${index}`} label="URL">
              <input
                id={`social-url-${index}`}
                value={row.url}
                onChange={(event) => updateSocial(index, { url: event.currentTarget.value })}
                dir="ltr"
                inputMode="url"
                className={`${inputClass} text-start`}
              />
            </Field>
            <Field name={`social-order-${index}`} label="Order">
              <input
                id={`social-order-${index}`}
                value={row.display_order}
                onChange={(event) => updateSocial(index, { display_order: Number(event.currentTarget.value) })}
                type="number"
                min="0"
                className={inputClass}
              />
            </Field>
            <div className="flex flex-col justify-end gap-2">
              <RowToggle checked={row.is_official} label="Official" onChange={(is_official) => updateSocial(index, { is_official })} />
              <RowToggle checked={row.visible} label="Visible" onChange={(visible) => updateSocial(index, { visible })} />
              <button
                type="button"
                onClick={() => setSocials((rows) => rows.filter((_, rowIndex) => rowIndex !== index))}
                className="min-h-10 rounded-md border border-rule px-3 text-caption text-ink hover:bg-paper-alt"
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-4 rounded-lg border border-rule bg-white/60 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-small font-semibold text-ink">قنوات التحقق الرسمية</h3>
          <button
            type="button"
            onClick={() =>
              setOfficialChannels((rows) => [
                ...rows,
                {
                  platform: 'facebook',
                  handle: '',
                  url: '',
                  is_official: true,
                  visible: true,
                  display_order: rows.length + 1,
                  note_ar: '',
                  note_en: '',
                },
              ])
            }
            className="rounded-md bg-navy-700 px-4 py-2 text-caption font-medium text-paper hover:bg-navy-900"
          >
            + Add official channel
          </button>
        </div>
        {officialError ? <p className="text-caption text-gold-700">{officialError}</p> : null}
        {officialChannels.length === 0 ? <p className="text-caption text-ink-55">لا توجد قنوات تحقق بعد.</p> : null}
        {officialChannels.map((row, index) => (
          <div key={index} className="grid gap-3 rounded-md border border-rule bg-paper p-3 md:grid-cols-[1fr_1fr_1.4fr_0.55fr_auto]">
            <Field name={`official-platform-${index}`} label="Platform">
              <PlatformSelect
                name={`official-platform-${index}`}
                value={row.platform}
                onChange={(platform) => updateOfficial(index, { platform })}
              />
            </Field>
            <Field name={`official-handle-${index}`} label="Handle">
              <input
                id={`official-handle-${index}`}
                value={row.handle}
                onChange={(event) => updateOfficial(index, { handle: event.currentTarget.value })}
                dir="ltr"
                className={`${inputClass} text-start`}
              />
            </Field>
            <Field name={`official-url-${index}`} label="URL">
              <input
                id={`official-url-${index}`}
                value={row.url}
                onChange={(event) => updateOfficial(index, { url: event.currentTarget.value })}
                dir="ltr"
                inputMode="url"
                className={`${inputClass} text-start`}
              />
            </Field>
            <Field name={`official-order-${index}`} label="Order">
              <input
                id={`official-order-${index}`}
                value={row.display_order}
                onChange={(event) => updateOfficial(index, { display_order: Number(event.currentTarget.value) })}
                type="number"
                min="0"
                className={inputClass}
              />
            </Field>
            <div className="flex flex-col justify-end gap-2">
              <RowToggle checked={row.is_official} label="Official" onChange={(is_official) => updateOfficial(index, { is_official })} />
              <RowToggle checked={row.visible} label="Visible" onChange={(visible) => updateOfficial(index, { visible })} />
              <button
                type="button"
                onClick={() => setOfficialChannels((rows) => rows.filter((_, rowIndex) => rowIndex !== index))}
                className="min-h-10 rounded-md border border-rule px-3 text-caption text-ink hover:bg-paper-alt"
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export function OrganizationForm({ values }: { values: Values }) {
  const [state, action, pending] = useActionState<OrganizationResult | null, FormData>(
    saveOrganizationForm,
    null,
  );

  const errors = state && !state.ok ? state.fieldErrors : undefined;
  const firstError = (name: string) => errors?.[name]?.[0];
  const formValues = state && !state.ok ? (state.values ?? values) : values;
  const socialRows = normalizeSocialRows(formValues);
  const officialRows = normalizeOfficialRows(formValues);

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
        defaultValue={str(formValues, name)}
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
        defaultValue={str(formValues, name)}
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
        defaultValue={json(formValues, name)}
        dir="ltr"
        aria-invalid={firstError(name) ? true : undefined}
        aria-describedby={fieldDescribedBy(name, hint, firstError(name))}
        className={`${inputClass} text-start font-mono text-caption`}
      />
    </Field>
  );

  return (
    <form action={action} className="space-y-10" key={state && !state.ok ? state.formKey : 'persisted'}>
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
          {area('shortDescriptionAr', 'وصف مختصر للمؤسسة (عربي)', 'يستخدم لاحقاً في التذييل وشريط التعريف.')}
          {area('shortDescriptionEn', 'Short organization description (English)', 'Used later in the footer and top header bar.')}
          {text('foundedYear', 'سنة التأسيس', { type: 'number' })}
          {text('licenseNumber', 'رقم الترخيص', { required: true, dir: 'ltr' })}
          {text('licenseAuthorityAr', 'جهة الترخيص (عربي)')}
          {text('licenseAuthorityEn', 'جهة الترخيص (إنجليزي)', { dir: 'ltr' })}
          {text('legalFormAr', 'الشكل القانوني (عربي)')}
          {text('legalFormEn', 'الشكل القانوني (إنجليزي)', { dir: 'ltr' })}
          {text('logoPrimaryId', 'معرّف الشعار الأساسي', { dir: 'ltr', hint: 'معرّف ملف من مكتبة الوسائط.' })}
          {text('footerLogoId', 'معرّف شعار التذييل', { dir: 'ltr', hint: 'يستخدم في تذييل الموقع، وإن ترك فارغاً يستخدم الشعار الأساسي.' })}
          {text('logoMonoId', 'معرّف الشعار أحادي اللون', { dir: 'ltr', hint: 'اختياري للتصاميم الداكنة أو المختصرة.' })}
          {text('defaultOgId', 'معرّف صورة المشاركة الافتراضية', { dir: 'ltr', hint: 'تستخدمها الصفحات التي لا تملك صورة خاصة.' })}
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
          {text('secondaryEmail', 'بريد إلكتروني إضافي', { dir: 'ltr', type: 'email' })}
          {text('officeHoursAr', 'ساعات العمل (عربي)')}
          {text('officeHoursEn', 'ساعات العمل (إنجليزي)', { dir: 'ltr' })}
          {text('addressAr', 'العنوان (عربي)')}
          {text('addressEn', 'العنوان (إنجليزي)', { dir: 'ltr' })}
        </div>
        <CheckboxField
          name="addressIsPublic"
          label="إظهار العنوان على الموقع"
          hint="اترك الخيار مغلقاً إن كان إظهار موقع المكتب يعرّض أحداً للخطر."
          defaultChecked={Boolean(formValues.addressIsPublic)}
        />
      </section>

      <SocialChannelsEditor
        initialSocials={socialRows}
        initialOfficialChannels={officialRows}
        socialError={firstError('socials')}
        officialError={firstError('officialChannels')}
      />

      <section className="space-y-6">
        <h2 className="border-be-2 border-ink pbe-2 text-h3 font-semibold text-ink">
          Footer CTA
        </h2>
        <p className="text-small text-ink-55">
          Content for the future footer call-to-action. Core footer navigation links remain route-driven in code.
        </p>
        <div className="grid gap-6 md:grid-cols-2">
          {text('footerCtaTitleAr', 'عنوان الدعوة إلى الإجراء (عربي)')}
          {text('footerCtaTitleEn', 'CTA title (English)', { dir: 'ltr' })}
          {area('footerCtaDescriptionAr', 'وصف الدعوة إلى الإجراء (عربي)')}
          {area('footerCtaDescriptionEn', 'CTA description (English)')}
          {text('footerCtaButtonLabelAr', 'نص الزر (عربي)')}
          {text('footerCtaButtonLabelEn', 'Button label (English)', { dir: 'ltr' })}
          {text('footerCtaUrl', 'رابط الزر', { dir: 'ltr', hint: 'رابط داخلي مثل /contact أو رابط كامل.' })}
        </div>
        <CheckboxField
          name="footerCtaEnabled"
          label="تفعيل دعوة التذييل"
          hint="عند إيقافها لن تعرض الواجهة المستقبلية هذه الدعوة."
          defaultChecked={Boolean(formValues.footerCtaEnabled)}
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
