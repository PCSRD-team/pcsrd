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
import { Checkbox, Input, Select, Textarea } from '@/components/ui/inputs';
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
 * beside them are. So every control here takes an `id` and no `name`: the
 * kit's controls, with the one prop that keeps them out of the request.
 */
const PLATFORM_SELECT_OPTIONS = PLATFORM_OPTIONS.map(([value, label]) => ({ value, label }));

function PlatformSelect({
  value,
  onChange,
  id,
}: {
  value: string;
  onChange: (value: string) => void;
  id: string;
}) {
  return (
    <Select
      id={id}
      value={value}
      onChange={(event) => onChange(event.currentTarget.value)}
      placeholder={null}
      options={PLATFORM_SELECT_OPTIONS}
    />
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
    <Checkbox
      label={label}
      checked={checked}
      onChange={(event) => onChange(event.currentTarget.checked)}
    />
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
                    id={`social-platform-${index}`}
                    value={row.platform}
                    onChange={(platform) => updateSocial(index, { platform })}
                  />
                </Field>
                <Field name={`social-url-${index}`} label={t.url}>
                  <Input
                    id={`social-url-${index}`}
                    value={row.url}
                    onChange={(event) => updateSocial(index, { url: event.currentTarget.value })}
                    dir="ltr"
                    inputMode="url"
                    className="text-start"
                  />
                </Field>
                <Field name={`social-order-${index}`} label={t.order}>
                  <Input
                    id={`social-order-${index}`}
                    value={row.display_order}
                    onChange={(event) => updateSocial(index, { display_order: Number(event.currentTarget.value) })}
                    type="number"
                    min="0"
                    dir="ltr"
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
                    id={`official-platform-${index}`}
                    value={row.platform}
                    onChange={(platform) => updateOfficial(index, { platform })}
                  />
                </Field>
                <Field name={`official-handle-${index}`} label={t.handle}>
                  <Input
                    id={`official-handle-${index}`}
                    value={row.handle}
                    onChange={(event) => updateOfficial(index, { handle: event.currentTarget.value })}
                    dir="ltr"
                    className="text-start"
                  />
                </Field>
                <Field name={`official-url-${index}`} label={t.url}>
                  <Input
                    id={`official-url-${index}`}
                    value={row.url}
                    onChange={(event) => updateOfficial(index, { url: event.currentTarget.value })}
                    dir="ltr"
                    inputMode="url"
                    className="text-start"
                  />
                </Field>
                <Field name={`official-order-${index}`} label={t.order}>
                  <Input
                    id={`official-order-${index}`}
                    value={row.display_order}
                    onChange={(event) => updateOfficial(index, { display_order: Number(event.currentTarget.value) })}
                    type="number"
                    min="0"
                    dir="ltr"
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
  const fields = adminUi.organization.fields;

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
            {text('legalNameAr', fields.legalNameAr, { required: true })}
            {text('legalNameEn', fields.legalNameEn, { required: true, dir: 'ltr' })}
            {text('shortNameAr', fields.shortNameAr, { required: true })}
            {text('shortNameEn', fields.shortNameEn, { required: true, dir: 'ltr' })}
            {text('acronym', fields.acronym, { required: true, dir: 'ltr' })}
            {area('shortDescriptionAr', fields.shortDescriptionAr, fields.shortDescriptionHint)}
            {area('shortDescriptionEn', fields.shortDescriptionEn, fields.shortDescriptionHint)}
            {text('foundedYear', fields.foundedYear, { type: 'number' })}
            {text('licenseNumber', fields.licenseNumber, { required: true, dir: 'ltr' })}
            {text('licenseAuthorityAr', fields.licenseAuthorityAr)}
            {text('licenseAuthorityEn', fields.licenseAuthorityEn, { dir: 'ltr' })}
            {text('legalFormAr', fields.legalFormAr)}
            {text('legalFormEn', fields.legalFormEn, { dir: 'ltr' })}
            {media('logoPrimaryId', fields.logoPrimary, fields.logoPrimaryHint)}
            {media('footerLogoId', fields.footerLogo, fields.footerLogoHint)}
            {media('logoMonoId', fields.logoMono, fields.logoMonoHint)}
            {media('defaultOgId', fields.defaultOg, fields.defaultOgHint)}
          </FieldRow>
        </FormSection>

        <FormSection title={t.sections.vision}>
          <FieldRow>
            {area('visionAr', fields.visionAr)}
            {area('visionEn', fields.visionEn)}
            {area('missionAr', fields.missionAr)}
            {area('missionEn', fields.missionEn)}
          </FieldRow>
        </FormSection>

        <FormSection title={t.sections.contact}>
          <FieldRow>
            {text('primaryPhone', fields.primaryPhone, { dir: 'ltr', hint: fields.primaryPhoneHint })}
            {text('whatsappNumber', fields.whatsappNumber, {
              dir: 'ltr',
              hint: fields.whatsappNumberHint,
            })}
            {text('email', fields.email, { dir: 'ltr', type: 'email' })}
            {text('secondaryEmail', fields.secondaryEmail, { dir: 'ltr', type: 'email' })}
            {text('officeHoursAr', fields.officeHoursAr)}
            {text('officeHoursEn', fields.officeHoursEn, { dir: 'ltr' })}
            {text('addressAr', fields.addressAr)}
            {text('addressEn', fields.addressEn, { dir: 'ltr' })}
          </FieldRow>
          <Checkbox
            name="addressIsPublic"
            label={fields.addressPublic}
            hint={fields.addressPublicHint}
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
            {text('footerCtaTitleAr', fields.footerCtaTitleAr)}
            {text('footerCtaTitleEn', fields.footerCtaTitleEn, { dir: 'ltr' })}
            {area('footerCtaDescriptionAr', fields.footerCtaDescriptionAr)}
            {area('footerCtaDescriptionEn', fields.footerCtaDescriptionEn)}
            {text('footerCtaButtonLabelAr', fields.footerCtaButtonLabelAr)}
            {text('footerCtaButtonLabelEn', fields.footerCtaButtonLabelEn, { dir: 'ltr' })}
            {text('footerCtaUrl', fields.footerCtaUrl, { dir: 'ltr', hint: fields.footerCtaUrlHint })}
          </FieldRow>
          <Checkbox
            name="footerCtaEnabled"
            label={fields.footerCtaEnabled}
            hint={fields.footerCtaEnabledHint}
            defaultChecked={Boolean(formValues.footerCtaEnabled)}
          />
        </FormSection>

        <FormSection title={t.sections.lists} lede={t.sections.listsLede}>
          <Stack gap={6}>
            <StringListEditor name="alternateNames" label={fields.alternateNames} initialItems={arrayValue<string>(formValues, 'alternateNames')} placeholder={fields.alternateNamesPlaceholder} error={firstError('alternateNames')} />
            <StringListEditor name="additionalPhones" label={fields.additionalPhones} initialItems={arrayValue<string>(formValues, 'additionalPhones')} placeholder="+970…" dir="ltr" error={firstError('additionalPhones')} />
            <TitledBlocksEditor name="coreValues" label={fields.coreValues} initialItems={arrayValue<TitledBlock>(formValues, 'coreValues')} error={firstError('coreValues')} />
            <TitledBlocksEditor name="principles" label={fields.principles} initialItems={arrayValue<TitledBlock>(formValues, 'principles')} error={firstError('principles')} />
            <BilingualLinesEditor name="strategicObjectives" label={fields.strategicObjectives} initialItems={arrayValue<BilingualLine>(formValues, 'strategicObjectives')} error={firstError('strategicObjectives')} />
          </Stack>
        </FormSection>

        <SaveBar pending={pending} note={adminUi.form.auditNote} />
      </Stack>
    </form>
  );
}
