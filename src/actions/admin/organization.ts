'use server';

import { db } from '@/db';
import { requireActor } from '@/lib/auth/guard';
import { revalidateEntity } from '@/lib/cache/revalidate';
import { type ActionResult, err, ok, runAction } from '@/lib/errors';
import { organizationSchema } from '@/lib/validation/admin';
import { fieldErrorsFrom } from '@/lib/validation/common';
import { parseAdminForm, type FormShape } from '@/lib/validation/form-data';
import { updateOrganization } from '@/services/content/catalog.service';

export type OrganizationResult = ActionResult<null>;

/**
 * The organisation settings form.
 *
 * Takes `FormData` rather than an object, so the page works with JavaScript
 * disabled — non-negotiable #7. `saveOrganization` in `catalog.ts` takes a
 * parsed object and is kept for programmatic callers; this is the web entry
 * point.
 *
 * The jsonb columns — values, principles, objectives, socials, channels — are
 * edited as JSON text. That is a deliberate floor, not a finished editor: a
 * repeater UI for five differently-shaped arrays is a screen of its own, and
 * the alternative on offer today is a `psql` session. `organizationSchema`
 * validates the parsed result field by field, so a malformed channel is
 * rejected with a field error rather than written.
 */
const SHAPE: FormShape = {
  json: [
    'alternateNames',
    'additionalPhones',
    'coreValues',
    'principles',
    'strategicObjectives',
    'socials',
    'officialChannels',
  ],
  booleans: ['addressIsPublic'],
  nullable: [
    'licenseAuthorityAr',
    'licenseAuthorityEn',
    'legalFormAr',
    'legalFormEn',
    'visionAr',
    'visionEn',
    'missionAr',
    'missionEn',
    'primaryPhone',
    'whatsappNumber',
    'email',
    'addressAr',
    'addressEn',
    'officeHoursAr',
    'officeHoursEn',
    'logoPrimaryId',
    'logoMonoId',
    'defaultOgId',
  ],
};

export async function saveOrganizationForm(
  _previous: OrganizationResult | null,
  formData: FormData,
): Promise<OrganizationResult> {
  return runAction(async () => {
    // Guard first, always — before the body is even parsed.
    const actor = await requireActor();

    const raw = parseAdminForm(formData, SHAPE);

    // A blank JSON field means "leave it alone", not "empty the array".
    // `parseAdminForm` turns an empty json field into `null`, and the schema
    // does not accept null for these, so they are dropped instead — which is
    // what `.partial()` is for.
    for (const field of SHAPE.json ?? []) {
      if (raw[field] === null) delete raw[field];
    }

    const parsed = organizationSchema.safeParse(raw);
    if (!parsed.success) {
      return err('validation', 'errors.validation', fieldErrorsFrom(parsed.error));
    }

    await updateOrganization(db, actor, parsed.data);

    // Every page renders the organisation's name, channels and licence number
    // through the chrome, so this tag is on more or less everything.
    revalidateEntity('orgSettings');
    return ok(null, 'admin.saved');
  });
}
