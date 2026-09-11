'use client';

import {
  submitComplaint,
  submitContact,
  submitFraudReport,
  submitJobApplication,
  submitPartnership,
  submitVolunteer,
} from '@/actions/public/forms';
import {
  AGE_BANDS,
  AVAILABILITY,
  COMPLAINT_CATEGORIES,
  ENQUIRY_TYPES,
  FRAUD_CHANNELS,
  GOVERNORATES,
  ORGANIZATION_TYPES,
  PARTNERSHIP_INTERESTS,
  PROGRAM_KEYS,
  VOLUNTEER_AREAS,
} from '@/lib/validation/forms';
import type { Locale } from '@/lib/i18n/config';
import {
  CheckboxGroup,
  FileField,
  type FormDict,
  Honeypot,
  type OptionLabels,
  SelectField,
  TextArea,
  TextField,
} from './fields';
import { FormShell } from './form-shell';

/**
 * The six public forms.
 *
 * Option **values** come from the Zod schemas, so a value the server would
 * reject cannot be offered in the UI. Option **labels** come from a `labels`
 * map the server page builds from the dictionary — rule 5 keeps copy out of
 * components, and these run on the client where the dictionary is not
 * available.
 */

const opts = (values: readonly string[], labels: OptionLabels) =>
  values.map((value) => ({ value, label: labels[value] ?? value }));

// ── Contact ──────────────────────────────────────────────────────────────

export function ContactForm({
  dict,
  locale,
  labels,
}: {
  dict: FormDict;
  locale: Locale;
  labels: OptionLabels;
}) {
  return (
    <FormShell action={submitContact} dict={dict} locale={locale}>
      {(errors) => (
        <div className="grid gap-5 sm:grid-cols-2">
          <Honeypot />
          <TextField name="name" label={dict.forms.name} dict={dict} required errors={errors} autoComplete="name" />
          <TextField name="email" label={dict.forms.email} dict={dict} type="email" required errors={errors} autoComplete="email" />
          <TextField name="phone" label={dict.forms.phone} dict={dict} type="tel" errors={errors} autoComplete="tel" />
          <SelectField
            name="enquiryType"
            label={dict.forms.enquiryType}
            dict={dict}
            options={opts(ENQUIRY_TYPES, labels)}
            defaultValue="general"
            errors={errors}
          />
          <div className="sm:col-span-2">
            <TextField name="subject" label={dict.forms.subject} dict={dict} required errors={errors} />
          </div>
          <div className="sm:col-span-2">
            <TextArea name="message" label={dict.forms.message} dict={dict} required rows={5} errors={errors} />
          </div>
        </div>
      )}
    </FormShell>
  );
}

// ── Complaint (CFM) ──────────────────────────────────────────────────────

/**
 * Every identity field is optional and the anonymity notice is shown before
 * them, not after. A complainant deciding whether it is safe to file reads the
 * top of the form, not the small print under the submit button.
 */
export function ComplaintForm({
  dict,
  locale,
  labels,
}: {
  dict: FormDict;
  locale: Locale;
  labels: OptionLabels;
}) {
  return (
    <FormShell action={submitComplaint} dict={dict} locale={locale}>
      {(errors) => (
        <div className="grid gap-5 sm:grid-cols-2">
          <Honeypot />
          <div className="rounded-xl border border-gold-600/45 bg-gold-050 p-4 sm:col-span-2">
            <p className="text-small text-ink">{dict.forms.anonymousNotice}</p>
          </div>

          <SelectField
            name="category"
            label={dict.forms.category}
            dict={dict}
            options={opts(COMPLAINT_CATEGORIES, labels)}
            required
            errors={errors}
          />
          <TextField name="incidentDate" label={dict.forms.incidentDate} dict={dict} type="date" errors={errors} />
          <TextField name="location" label={dict.forms.location} dict={dict} errors={errors} />
          <div className="sm:col-span-2">
            <TextArea name="description" label={dict.forms.description} dict={dict} required rows={6} errors={errors} />
          </div>
          <div className="sm:col-span-2">
            <TextField name="relatedProject" label={dict.forms.relatedProject} dict={dict} errors={errors} />
          </div>

          <TextField name="name" label={dict.forms.name} dict={dict} errors={errors} autoComplete="off" />
          <TextField name="email" label={dict.forms.email} dict={dict} type="email" errors={errors} autoComplete="off" />
          <TextField name="phone" label={dict.forms.phone} dict={dict} type="tel" errors={errors} autoComplete="off" />
          <SelectField
            name="contactPreference"
            label={dict.forms.contactPreference}
            dict={dict}
            options={opts(['none', 'email', 'phone'], labels)}
            defaultValue="none"
            errors={errors}
          />
        </div>
      )}
    </FormShell>
  );
}

// ── Partnership ──────────────────────────────────────────────────────────

export function PartnershipForm({
  dict,
  locale,
  labels,
}: {
  dict: FormDict;
  locale: Locale;
  labels: OptionLabels;
}) {
  return (
    <FormShell action={submitPartnership} dict={dict} locale={locale}>
      {(errors) => (
        <>
          <Honeypot />
          <TextField name="organizationName" label={dict.forms.organizationName} dict={dict} required errors={errors} />
          <SelectField
            name="organizationType"
            label={dict.forms.organizationType}
            dict={dict}
            options={opts(ORGANIZATION_TYPES, labels)}
            required
            errors={errors}
          />
          <TextField
            name="country"
            label={dict.forms.country}
            dict={dict}
            required
            errors={errors}
            autoComplete="country"
            hint="ISO 3166-1 alpha-2"
          />
          <TextField name="contactName" label={dict.forms.name} dict={dict} required errors={errors} autoComplete="name" />
          <TextField name="role" label={dict.forms.role} dict={dict} required errors={errors} />
          <TextField name="email" label={dict.forms.email} dict={dict} type="email" required errors={errors} autoComplete="email" />
          <TextField name="phone" label={dict.forms.phone} dict={dict} type="tel" errors={errors} autoComplete="tel" />
          <CheckboxGroup
            name="interest"
            legend={dict.forms.interest}
            options={opts(PARTNERSHIP_INTERESTS, labels)}
            dict={dict}
            errors={errors}
            required
          />
          <CheckboxGroup
            name="programs"
            legend={dict.forms.programsOfInterest}
            options={opts(PROGRAM_KEYS, labels)}
            dict={dict}
            errors={errors}
          />
          <TextArea name="message" label={dict.forms.message} dict={dict} required errors={errors} />
        </>
      )}
    </FormShell>
  );
}

// ── Volunteer ────────────────────────────────────────────────────────────

/** Age band, not date of birth. Governorate, not address. No national ID. */
export function VolunteerForm({
  dict,
  locale,
  labels,
}: {
  dict: FormDict;
  locale: Locale;
  labels: OptionLabels;
}) {
  return (
    <FormShell action={submitVolunteer} dict={dict} locale={locale}>
      {(errors) => (
        <>
          <Honeypot />
          <TextField name="name" label={dict.forms.name} dict={dict} required errors={errors} autoComplete="name" />
          <TextField name="email" label={dict.forms.email} dict={dict} type="email" required errors={errors} autoComplete="email" />
          <TextField name="phone" label={dict.forms.phone} dict={dict} type="tel" required errors={errors} autoComplete="tel" />
          <SelectField name="ageBand" label={dict.forms.ageBand} dict={dict} options={opts(AGE_BANDS, labels)} required errors={errors} />
          <SelectField name="governorate" label={dict.forms.governorate} dict={dict} options={opts(GOVERNORATES, labels)} required errors={errors} />
          <CheckboxGroup name="areas" legend={dict.forms.areas} options={opts(VOLUNTEER_AREAS, labels)} dict={dict} errors={errors} required />
          <SelectField name="availability" label={dict.forms.availability} dict={dict} options={opts(AVAILABILITY, labels)} defaultValue="flexible" errors={errors} />
          <TextArea name="experience" label={dict.forms.experience} dict={dict} rows={4} errors={errors} />
          <TextArea name="motivation" label={dict.forms.motivation} dict={dict} required errors={errors} />
        </>
      )}
    </FormShell>
  );
}

// ── Fraud report ─────────────────────────────────────────────────────────

export function FraudReportForm({
  dict,
  locale,
  labels,
}: {
  dict: FormDict;
  locale: Locale;
  labels: OptionLabels;
}) {
  return (
    <FormShell action={submitFraudReport} dict={dict} locale={locale}>
      {(errors) => (
        <>
          <Honeypot />
          <SelectField name="channel" label={dict.forms.channel} dict={dict} options={opts(FRAUD_CHANNELS, labels)} required errors={errors} />
          <TextField name="identifier" label={dict.forms.identifier} dict={dict} required errors={errors} />
          <TextField name="evidenceUrl" label={dict.forms.evidenceUrl} dict={dict} type="url" errors={errors} />
          <TextField name="occurredOn" label={dict.forms.occurredOn} dict={dict} type="date" errors={errors} />
          <TextArea name="description" label={dict.forms.description} dict={dict} required errors={errors} />

          <TextField name="reporterName" label={dict.forms.name} dict={dict} errors={errors} />
          <TextField name="reporterEmail" label={dict.forms.email} dict={dict} type="email" errors={errors} />
          <TextField name="reporterPhone" label={dict.forms.phone} dict={dict} type="tel" errors={errors} />
        </>
      )}
    </FormShell>
  );
}

// ── Job application ──────────────────────────────────────────────────────

/**
 * The only form that carries a file.
 *
 * `encType` is set explicitly: React sets it for a Server Action form, but this
 * form must also work **before hydration**, and a native submit without
 * `multipart/form-data` posts the filename instead of the file.
 *
 * The accept list is a convenience for the file picker, not a check. The real
 * validation reads magic bytes on the server, because both the extension and
 * the browser-supplied MIME type are attacker-controlled.
 */
export function JobApplicationForm({
  dict,
  locale,
  vacancyId,
}: {
  dict: FormDict;
  locale: Locale;
  vacancyId: string;
}) {
  return (
    <FormShell
      action={submitJobApplication}
      dict={dict}
      locale={locale}
      encType="multipart/form-data"
    >
      {(errors) => (
        <>
          <Honeypot />
          <input type="hidden" name="vacancyId" value={vacancyId} />
          <TextField name="name" label={dict.forms.name} dict={dict} required errors={errors} autoComplete="name" />
          <TextField name="email" label={dict.forms.email} dict={dict} type="email" required errors={errors} autoComplete="email" />
          <TextField name="phone" label={dict.forms.phone} dict={dict} type="tel" required errors={errors} autoComplete="tel" />
          <FileField
            name="cv"
            label={dict.forms.cv}
            dict={dict}
            hint={dict.forms.cvHint}
            required
            errors={errors}
            accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          />
          <TextArea name="coverNote" label={dict.forms.coverNote} dict={dict} rows={5} errors={errors} />
          <TextField name="portfolioUrl" label={dict.forms.portfolioUrl} dict={dict} type="url" errors={errors} />
        </>
      )}
    </FormShell>
  );
}
