'use client';

import {
  submitComplaint,
  submitContact,
  submitFraudReport,
  submitJobApplication,
  submitPartnership,
  submitVolunteer,
} from '@/actions/public/forms';
import { FieldRow } from '@/components/ui/field';
import { Notice } from '@/components/ui/notice';
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
  type OptionLabels,
  SelectField,
  TextArea,
  TextField,
} from './fields';
import { FormShell } from './form-shell';

/**
 * The six public forms — each one declares its fields and nothing else.
 *
 * The shell owns everything they share: the locale, the honeypot, the result
 * region, the captcha and the submit. The field wrappers own the dictionary
 * resolution and the value restore. What is left here is the *shape* of each
 * form, which is the only thing that differs.
 *
 * Client Component because it renders inside `FormShell`'s render prop, and a
 * function cannot cross the server → client boundary. It holds no state and
 * no effects of its own.
 *
 * Option **values** come from the Zod schemas, so a value the server would
 * reject cannot be offered in the UI. Option **labels** come from a `labels`
 * map the server page builds from the dictionary — rule 5 keeps copy out of
 * components, and these run on the client where the dictionary is not
 * available.
 */

type PublicFormProps = {
  dict: FormDict;
  locale: Locale;
  labels: OptionLabels;
};

const opts = (values: readonly string[], labels: OptionLabels) =>
  values.map((value) => ({ value, label: labels[value] ?? value }));

const CV_ACCEPT =
  '.pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document';

// ── Contact ──────────────────────────────────────────────────────────────

export function ContactForm({ dict, locale, labels }: PublicFormProps) {
  return (
    <FormShell action={submitContact} dict={dict} locale={locale}>
      {(state) => (
        <>
          <FieldRow>
            <TextField name="name" label={dict.forms.name} dict={dict} required state={state} autoComplete="name" />
            <TextField name="email" label={dict.forms.email} dict={dict} type="email" required state={state} autoComplete="email" />
          </FieldRow>
          <FieldRow>
            <TextField name="phone" label={dict.forms.phone} dict={dict} type="tel" state={state} autoComplete="tel" />
            <SelectField
              name="enquiryType"
              label={dict.forms.enquiryType}
              dict={dict}
              options={opts(ENQUIRY_TYPES, labels)}
              defaultValue="general"
              state={state}
            />
          </FieldRow>
          <TextField name="subject" label={dict.forms.subject} dict={dict} required state={state} />
          <TextArea name="message" label={dict.forms.message} dict={dict} required rows={5} state={state} />
        </>
      )}
    </FormShell>
  );
}

// ── Complaint (CFM) ──────────────────────────────────────────────────────

/**
 * Every identity field is optional and the confidentiality notice is shown
 * before them, not after. A complainant deciding whether it is safe to file
 * reads the top of the form, not the small print under the submit button.
 */
export function ComplaintForm({ dict, locale, labels }: PublicFormProps) {
  return (
    <FormShell action={submitComplaint} dict={dict} locale={locale}>
      {(state) => (
        <>
          <Notice tone="warning" title={dict.formsUi.confidentialTitle} live="off">
            {dict.forms.anonymousNotice}
          </Notice>

          <FieldRow>
            <SelectField
              name="category"
              label={dict.forms.category}
              dict={dict}
              options={opts(COMPLAINT_CATEGORIES, labels)}
              required
              state={state}
            />
            <TextField name="incidentDate" label={dict.forms.incidentDate} dict={dict} type="date" state={state} />
          </FieldRow>
          <FieldRow>
            <TextField name="location" label={dict.forms.location} dict={dict} state={state} />
            <TextField name="relatedProject" label={dict.forms.relatedProject} dict={dict} state={state} />
          </FieldRow>
          <TextArea name="description" label={dict.forms.description} dict={dict} required rows={6} state={state} />

          <FieldRow>
            <TextField name="name" label={dict.forms.name} dict={dict} state={state} autoComplete="off" />
            <TextField name="email" label={dict.forms.email} dict={dict} type="email" state={state} autoComplete="off" />
          </FieldRow>
          <FieldRow>
            <TextField name="phone" label={dict.forms.phone} dict={dict} type="tel" state={state} autoComplete="off" />
            <SelectField
              name="contactPreference"
              label={dict.forms.contactPreference}
              dict={dict}
              options={opts(['none', 'email', 'phone'], labels)}
              defaultValue="none"
              state={state}
            />
          </FieldRow>
        </>
      )}
    </FormShell>
  );
}

// ── Partnership ──────────────────────────────────────────────────────────

export function PartnershipForm({ dict, locale, labels }: PublicFormProps) {
  return (
    <FormShell action={submitPartnership} dict={dict} locale={locale}>
      {(state) => (
        <>
          <FieldRow>
            <TextField name="organizationName" label={dict.forms.organizationName} dict={dict} required state={state} autoComplete="organization" />
            <SelectField
              name="organizationType"
              label={dict.forms.organizationType}
              dict={dict}
              options={opts(ORGANIZATION_TYPES, labels)}
              required
              state={state}
            />
          </FieldRow>
          <TextField
            name="country"
            label={dict.forms.country}
            dict={dict}
            required
            state={state}
            autoComplete="country"
            hint={dict.formsUi.countryHint}
          />
          <FieldRow>
            <TextField name="contactName" label={dict.forms.name} dict={dict} required state={state} autoComplete="name" />
            <TextField name="role" label={dict.forms.role} dict={dict} required state={state} autoComplete="organization-title" />
          </FieldRow>
          <FieldRow>
            <TextField name="email" label={dict.forms.email} dict={dict} type="email" required state={state} autoComplete="email" />
            <TextField name="phone" label={dict.forms.phone} dict={dict} type="tel" state={state} autoComplete="tel" />
          </FieldRow>
          <CheckboxGroup
            name="interest"
            legend={dict.forms.interest}
            options={opts(PARTNERSHIP_INTERESTS, labels)}
            dict={dict}
            state={state}
            required
          />
          <CheckboxGroup
            name="programs"
            legend={dict.forms.programsOfInterest}
            options={opts(PROGRAM_KEYS, labels)}
            dict={dict}
            state={state}
          />
          <TextArea name="message" label={dict.forms.message} dict={dict} required state={state} />
        </>
      )}
    </FormShell>
  );
}

// ── Volunteer ────────────────────────────────────────────────────────────

/** Age band, not date of birth. Governorate, not address. No national ID. */
export function VolunteerForm({ dict, locale, labels }: PublicFormProps) {
  return (
    <FormShell action={submitVolunteer} dict={dict} locale={locale}>
      {(state) => (
        <>
          <TextField name="name" label={dict.forms.name} dict={dict} required state={state} autoComplete="name" />
          <FieldRow>
            <TextField name="email" label={dict.forms.email} dict={dict} type="email" required state={state} autoComplete="email" />
            <TextField name="phone" label={dict.forms.phone} dict={dict} type="tel" required state={state} autoComplete="tel" />
          </FieldRow>
          <FieldRow>
            <SelectField name="ageBand" label={dict.forms.ageBand} dict={dict} options={opts(AGE_BANDS, labels)} required state={state} />
            <SelectField name="governorate" label={dict.forms.governorate} dict={dict} options={opts(GOVERNORATES, labels)} required state={state} />
          </FieldRow>
          <CheckboxGroup name="areas" legend={dict.forms.areas} options={opts(VOLUNTEER_AREAS, labels)} dict={dict} state={state} required />
          <SelectField name="availability" label={dict.forms.availability} dict={dict} options={opts(AVAILABILITY, labels)} defaultValue="flexible" state={state} />
          <TextArea name="experience" label={dict.forms.experience} dict={dict} rows={4} state={state} />
          <TextArea name="motivation" label={dict.forms.motivation} dict={dict} required state={state} />
        </>
      )}
    </FormShell>
  );
}

// ── Fraud report ─────────────────────────────────────────────────────────

export function FraudReportForm({ dict, locale, labels }: PublicFormProps) {
  return (
    <FormShell action={submitFraudReport} dict={dict} locale={locale}>
      {(state) => (
        <>
          <FieldRow>
            <SelectField name="channel" label={dict.forms.channel} dict={dict} options={opts(FRAUD_CHANNELS, labels)} required state={state} />
            <TextField name="identifier" label={dict.forms.identifier} dict={dict} required state={state} />
          </FieldRow>
          <FieldRow>
            <TextField name="evidenceUrl" label={dict.forms.evidenceUrl} dict={dict} type="url" state={state} />
            <TextField name="occurredOn" label={dict.forms.occurredOn} dict={dict} type="date" state={state} />
          </FieldRow>
          <TextArea name="description" label={dict.forms.description} dict={dict} required state={state} />

          <TextField name="reporterName" label={dict.forms.name} dict={dict} state={state} autoComplete="name" />
          <FieldRow>
            <TextField name="reporterEmail" label={dict.forms.email} dict={dict} type="email" state={state} autoComplete="email" />
            <TextField name="reporterPhone" label={dict.forms.phone} dict={dict} type="tel" state={state} autoComplete="tel" />
          </FieldRow>
        </>
      )}
    </FormShell>
  );
}

// ── Job application ──────────────────────────────────────────────────────

/**
 * The only form that carries a file. React sets `multipart/form-data` on any
 * form whose action is a function, in the server-rendered markup too, so the
 * file posts correctly before hydration.
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
    <FormShell action={submitJobApplication} dict={dict} locale={locale}>
      {(state) => (
        <>
          <input type="hidden" name="vacancyId" value={vacancyId} />
          <TextField name="name" label={dict.forms.name} dict={dict} required state={state} autoComplete="name" />
          <FieldRow>
            <TextField name="email" label={dict.forms.email} dict={dict} type="email" required state={state} autoComplete="email" />
            <TextField name="phone" label={dict.forms.phone} dict={dict} type="tel" required state={state} autoComplete="tel" />
          </FieldRow>
          <FileField
            name="cv"
            label={dict.forms.cv}
            dict={dict}
            hint={dict.forms.cvHint}
            required
            state={state}
            accept={CV_ACCEPT}
          />
          <TextArea name="coverNote" label={dict.forms.coverNote} dict={dict} rows={5} state={state} />
          <TextField name="portfolioUrl" label={dict.forms.portfolioUrl} dict={dict} type="url" state={state} autoComplete="url" />
        </>
      )}
    </FormShell>
  );
}
