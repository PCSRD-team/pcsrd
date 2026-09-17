'use client';
// Client Component: `useActionState` for the pending state and field errors;
// the channel editors keep rows in state. The form posts to a Server Action
// and works with JavaScript disabled.

import { useActionState, useId, useMemo, useState } from 'react';
import { saveOrganizationForm, type OrganizationResult } from '@/actions/admin/organization';
import { SaveBar } from '@/components/admin/controls';
import { MediaPicker } from '@/components/admin/media-picker';
import {
  BilingualLinesEditor,
  StringListEditor,
  TitledBlocksEditor,
  type BilingualLine,
  type TitledBlock,
} from '@/components/admin/organization-list-editors';
import { Button } from '@/components/ui/button';
import { Code } from '@/components/ui/bidi';
import { Panel } from '@/components/ui/card';
import { describedBy, Field, FieldError, FieldRow } from '@/components/ui/field';
import { Checkbox, Input, Textarea } from '@/components/ui/inputs';
import { Section, Stack } from '@/components/ui/layout';
import { LiveRegion, Notice } from '@/components/ui/notice';
import { Caption, Heading } from '@/components/ui/typography';
import { adminUi } from './admin-ui-dict';

/**
 * The organisation settings editor.
 *
 * This is the screen `scripts/seed.ts` documents as the way to replace the
 * `TODO(org):` placeholders it writes. Without it the only route to changing
 * the organisation's legal name or licence number is raw SQL against
 * production.
 *
 * Field labels are this form's configuration — the same status as the entity
 * configs in `field-configs.ts`; the chrome around them comes from `adminUi`.
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

/**
 * The channel rows are controlled and *not* posted — the hidden JSON inputs
 * are — so their controls are native elements wearing the kit's `control`
 * utilities rather than the kit's `Input`/`Select`, which would carry a
 * `name` into the request.
 */
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
      className="control"
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
    <label className="flex min-h-target items-center gap-2 text-caption text-ink">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.currentTarget.checked)}
        className="control-choice"
      />
      {label}
    </label>
  );
}

/** A section of the form: the 2px rule, the heading, an optional lede. */
function FormSection({
  title,
  lede,
  children,
}: {
  title: string;
  lede?: React.ReactNode;
  children: React.ReactNode;
}) {
  const id = useId();
  return (
    <Section bounded spacing="none" labelledBy={id} className="pbs-6">
      <Stack gap={6}>
        <div>
          <Heading level={2} size="h3" id={id}>
            {title}
          </Heading>
          {lede ? <p className="mbs-2 text-small text-ink-55">{lede}</p> : null}
        </div>
        {children}
      </Stack>
    </Section>
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
  const socialId = useId();
  const officialId = useId();
  const t = adminUi.organization.channels;

  const updateSocial = (index: number, patch: Partial<SocialRow>) => {
    setSocials((rows) => rows.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row)));
  };
  const updateOfficial = (index: number, patch: Partial<OfficialChannelRow>) => {
    setOfficialChannels((rows) => rows.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row)));
  };

  return (
    <FormSection title={adminUi.organization.sections.channels} lede={adminUi.organization.sections.channelsLede}>
      <input type="hidden" name="socials" value={socialPayload} />
      <input type="hidden" name="officialChannels" value={officialPayload} />

      <Panel as="section" padding="sm" labelledBy={socialId}>
        <Stack gap={4}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Heading level={3} size="h4" id={socialId}>
              {t.social}
            </Heading>
            <Button
              type="button"
              tone="secondary"
              size="sm"
              onClick={() =>
                setSocials((rows) => [
                  ...rows,
                  { platform: 'facebook', url: '', is_official: true, visible: true, display_order: rows.length + 1 },
                ])
              }
            >
              {t.addSocial}
            </Button>
          </div>
          {socialError ? <FieldError id="socials-error">{socialError}</FieldError> : null}
          {socials.length === 0 ? <Caption>{t.noSocial}</Caption> : null}
          {socials.map((row, index) => (
            <Panel key={index} tone="alt" padding="sm">
              <div className="grid gap-3 md:grid-cols-[1fr_1.6fr_0.55fr_auto]">
                <Field name={`social-platform-${index}`} label={t.platform}>
                  <PlatformSelect
                    name={`social-platform-${index}`}
                    value={row.platform}
                    onChange={(platform) => updateSocial(index, { platform })}
                  />
                </Field>
                <Field name={`social-url-${index}`} label={t.url}>
                  <input
                    id={`social-url-${index}`}
                    value={row.url}
                    onChange={(event) => updateSocial(index, { url: event.currentTarget.value })}
                    dir="ltr"
                    inputMode="url"
                    className="control text-start"
                  />
                </Field>
                <Field name={`social-order-${index}`} label={t.order}>
                  <input
                    id={`social-order-${index}`}
                    value={row.display_order}
                    onChange={(event) => updateSocial(index, { display_order: Number(event.currentTarget.value) })}
                    type="number"
                    min="0"
                    dir="ltr"
                    className="control text-start"
                  />
                </Field>
                <div className="flex flex-col justify-end gap-2">
                  <RowToggle checked={row.is_official} label={t.isOfficial} onChange={(is_official) => updateSocial(index, { is_official })} />
                  <RowToggle checked={row.visible} label={t.visible} onChange={(visible) => updateSocial(index, { visible })} />
                  <Button
                    type="button"
                    tone="quiet"
                    size="sm"
                    onClick={() => setSocials((rows) => rows.filter((_, rowIndex) => rowIndex !== index))}
                  >
                    {t.remove}
                  </Button>
                </div>
              </div>
            </Panel>
          ))}
        </Stack>
      </Panel>

      <Panel as="section" padding="sm" labelledBy={officialId}>
        <Stack gap={4}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Heading level={3} size="h4" id={officialId}>
              {t.official}
            </Heading>
            <Button
              type="button"
              tone="secondary"
              size="sm"
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
            >
              {t.addOfficial}
            </Button>
          </div>
          {officialError ? <FieldError id="officialChannels-error">{officialError}</FieldError> : null}
          {officialChannels.length === 0 ? <Caption>{t.noOfficial}</Caption> : null}
          {officialChannels.map((row, index) => (
            <Panel key={index} tone="alt" padding="sm">
              <div className="grid gap-3 md:grid-cols-[1fr_1fr_1.4fr_0.55fr_auto]">
                <Field name={`official-platform-${index}`} label={t.platform}>
                  <PlatformSelect
                    name={`official-platform-${index}`}
                    value={row.platform}
                    onChange={(platform) => updateOfficial(index, { platform })}
                  />
                </Field>
                <Field name={`official-handle-${index}`} label={t.handle}>
                  <input
                    id={`official-handle-${index}`}
                    value={row.handle}
                    onChange={(event) => updateOfficial(index, { handle: event.currentTarget.value })}
                    dir="ltr"
                    className="control text-start"
                  />
                </Field>
                <Field name={`official-url-${index}`} label={t.url}>
                  <input
                    id={`official-url-${index}`}
                    value={row.url}
                    onChange={(event) => updateOfficial(index, { url: event.currentTarget.value })}
                    dir="ltr"
                    inputMode="url"
                    className="control text-start"
                  />
                </Field>
                <Field name={`official-order-${index}`} label={t.order}>
                  <input
                    id={`official-order-${index}`}
                    value={row.display_order}
                    onChange={(event) => updateOfficial(index, { display_order: Number(event.currentTarget.value) })}
                    type="number"
                    min="0"
                    dir="ltr"
                    className="control text-start"
                  />
                </Field>
                <div className="flex flex-col justify-end gap-2">
                  <RowToggle checked={row.is_official} label={t.isOfficial} onChange={(is_official) => updateOfficial(index, { is_official })} />
                  <RowToggle checked={row.visible} label={t.visible} onChange={(visible) => updateOfficial(index, { visible })} />
                  <Button
                    type="button"
                    tone="quiet"
                    size="sm"
                    onClick={() => setOfficialChannels((rows) => rows.filter((_, rowIndex) => rowIndex !== index))}
                  >
                    {t.remove}
                  </Button>
                </div>
              </div>
            </Panel>
          ))}
        </Stack>
      </Panel>
    </FormSection>
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
  const t = adminUi.organization;

  const text = (
    name: string,
    label: string,
    options: { required?: boolean; hint?: string; dir?: 'ltr' | 'rtl'; type?: 'text' | 'email' | 'number' } = {},
  ) => (
    <Field
      name={name}
      label={label}
      hint={options.hint}
      error={firstError(name)}
      required={options.required}
    >
      <Input
        name={name}
        type={options.type ?? 'text'}
        required={options.required}
        defaultValue={str(formValues, name)}
        dir={options.dir}
        hint={options.hint}
        error={firstError(name)}
        className={options.dir === 'ltr' ? 'text-start' : undefined}
      />
    </Field>
  );

  const area = (name: string, label: string, hint?: string) => (
    <Field name={name} label={label} hint={hint} error={firstError(name)}>
      <Textarea
        name={name}
        rows={4}
        defaultValue={str(formValues, name)}
        hint={hint}
        error={firstError(name)}
      />
    </Field>
  );

  const media = (name: string, label: string, hint: string) => (
    <Field name={name} label={label} hint={hint} error={firstError(name)}>
      <MediaPicker
        name={name}
        initialValue={str(formValues, name)}
        kind="image"
        invalid={Boolean(firstError(name))}
        describedBy={describedBy(name, hint, firstError(name))}
      />
    </Field>
  );

  return (
    <form action={action} key={state && !state.ok ? state.formKey : 'persisted'}>
      <Stack gap={10}>
        {/* Always in the DOM, contents swapped — a live region that appears at
            the same moment as its content is frequently never announced. */}
        <LiveRegion>
          {state ? (
            <Notice tone={state.ok ? 'success' : 'danger'} live="off">
              {state.ok ? t.saved : t.checkFields}
            </Notice>
          ) : null}
        </LiveRegion>

        <FormSection
          title={t.sections.identity}
          lede={
            <>
              {t.sections.identityLede} <Code>TODO(org):</Code>.
            </>
          }
        >
          <FieldRow>
            {text('legalNameAr', 'الاسم القانوني (عربي)', { required: true })}
            {text('legalNameEn', 'الاسم القانوني (إنجليزي)', { required: true, dir: 'ltr' })}
            {text('shortNameAr', 'الاسم المختصر (عربي)', { required: true })}
            {text('shortNameEn', 'الاسم المختصر (إنجليزي)', { required: true, dir: 'ltr' })}
            {text('acronym', 'الاختصار', { required: true, dir: 'ltr' })}
            {area('shortDescriptionAr', 'وصف مختصر للمؤسسة (عربي)', 'يستخدم في التذييل وشريط التعريف.')}
            {area('shortDescriptionEn', 'وصف مختصر للمؤسسة (إنجليزي)', 'يستخدم في التذييل وشريط التعريف.')}
            {text('foundedYear', 'سنة التأسيس', { type: 'number' })}
            {text('licenseNumber', 'رقم الترخيص', { required: true, dir: 'ltr' })}
            {text('licenseAuthorityAr', 'جهة الترخيص (عربي)')}
            {text('licenseAuthorityEn', 'جهة الترخيص (إنجليزي)', { dir: 'ltr' })}
            {text('legalFormAr', 'الشكل القانوني (عربي)')}
            {text('legalFormEn', 'الشكل القانوني (إنجليزي)', { dir: 'ltr' })}
            {media('logoPrimaryId', 'الشعار الأساسي', 'اختر صورة من مكتبة الوسائط.')}
            {media('footerLogoId', 'شعار التذييل', 'إن تُرك فارغاً يُستخدم الشعار الأساسي.')}
            {media('logoMonoId', 'الشعار أحادي اللون', 'اختياري للتصاميم الداكنة أو المختصرة.')}
            {media('defaultOgId', 'صورة المشاركة الافتراضية', 'تستخدمها الصفحات التي لا تملك صورة خاصة.')}
          </FieldRow>
        </FormSection>

        <FormSection title={t.sections.vision}>
          <FieldRow>
            {area('visionAr', 'الرؤية (عربي)')}
            {area('visionEn', 'الرؤية (إنجليزي)')}
            {area('missionAr', 'الرسالة (عربي)')}
            {area('missionEn', 'الرسالة (إنجليزي)')}
          </FieldRow>
        </FormSection>

        <FormSection title={t.sections.contact}>
          <FieldRow>
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
          </FieldRow>
          <Checkbox
            name="addressIsPublic"
            label="إظهار العنوان على الموقع"
            hint="اترك الخيار مغلقاً إن كان إظهار موقع المكتب يعرّض أحداً للخطر."
            defaultChecked={Boolean(formValues.addressIsPublic)}
          />
        </FormSection>

        <SocialChannelsEditor
          initialSocials={socialRows}
          initialOfficialChannels={officialRows}
          socialError={firstError('socials')}
          officialError={firstError('officialChannels')}
        />

        <FormSection title={t.sections.footerCta} lede={t.sections.footerCtaLede}>
          <FieldRow>
            {text('footerCtaTitleAr', 'عنوان الدعوة إلى الإجراء (عربي)')}
            {text('footerCtaTitleEn', 'عنوان الدعوة إلى الإجراء (إنجليزي)', { dir: 'ltr' })}
            {area('footerCtaDescriptionAr', 'وصف الدعوة إلى الإجراء (عربي)')}
            {area('footerCtaDescriptionEn', 'وصف الدعوة إلى الإجراء (إنجليزي)')}
            {text('footerCtaButtonLabelAr', 'نص الزر (عربي)')}
            {text('footerCtaButtonLabelEn', 'نص الزر (إنجليزي)', { dir: 'ltr' })}
            {text('footerCtaUrl', 'رابط الزر', { dir: 'ltr', hint: 'رابط داخلي مثل /contact أو رابط كامل.' })}
          </FieldRow>
          <Checkbox
            name="footerCtaEnabled"
            label="تفعيل دعوة التذييل"
            hint="عند إيقافها لا تعرض الواجهة هذه الدعوة."
            defaultChecked={Boolean(formValues.footerCtaEnabled)}
          />
        </FormSection>

        <FormSection title={t.sections.lists} lede={t.sections.listsLede}>
          <Stack gap={6}>
            <StringListEditor name="alternateNames" label="الأسماء البديلة" initialItems={arrayValue<string>(formValues, 'alternateNames')} placeholder="اسم بديل للمؤسسة" error={firstError('alternateNames')} />
            <StringListEditor name="additionalPhones" label="الهواتف الإضافية" initialItems={arrayValue<string>(formValues, 'additionalPhones')} placeholder="+970…" dir="ltr" error={firstError('additionalPhones')} />
            <TitledBlocksEditor name="coreValues" label="القيم" initialItems={arrayValue<TitledBlock>(formValues, 'coreValues')} error={firstError('coreValues')} />
            <TitledBlocksEditor name="principles" label="المبادئ" initialItems={arrayValue<TitledBlock>(formValues, 'principles')} error={firstError('principles')} />
            <BilingualLinesEditor name="strategicObjectives" label="الأهداف الاستراتيجية" initialItems={arrayValue<BilingualLine>(formValues, 'strategicObjectives')} error={firstError('strategicObjectives')} />
          </Stack>
        </FormSection>

        <SaveBar pending={pending} note={adminUi.form.auditNote} />
      </Stack>
    </form>
  );
}
