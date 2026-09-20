import { eq } from 'drizzle-orm';
import type { Db } from '@/db';
import { withActor } from '@/db/session';
import { impactMetrics, organizationSettings, partners, people } from '@/db/schema';
import type {
  ContentStatus,
  LogoPermission,
  MembershipLevel,
  MetricStatus,
  PartnerType,
  PersonCategory,
} from '@/db/schema/enums';
import type {
  BilingualLine,
  OfficialChannel,
  SocialLink,
  TitledBlock,
} from '@/db/schema/organization';
import { notFound } from '@/lib/errors';
import type { Actor } from '../_shared/actor';
import { writeAudit } from '../_shared/audit';
import { one } from '../_shared/one';
import { computeDiff, valuesEqual } from '../_shared/diff';
import { assertCan } from '../_shared/permissions';
import {
  assertCanTransition,
  assertMediaConsent,
  assertMetricPublishable,
  assertPersonPublishable,
} from '../_shared/publish';

/**
 * The four entities with no slug and no publishing lifecycle: partners,
 * people, impact figures and the organisation singleton.
 *
 * They do not fit `createContentService` — there is nothing to publish and no
 * URL to invalidate — but they share the rest of the discipline: guard,
 * transaction, gate, audit.
 */

// ── Partners ─────────────────────────────────────────────────────────────

export type PartnerInput = {
  id?: string;
  nameAr: string;
  nameEn?: string | null;
  type: PartnerType;
  membershipLevel?: MembershipLevel | null;
  sectorAr?: string | null;
  sectorEn?: string | null;
  descriptionAr?: string | null;
  descriptionEn?: string | null;
  website?: string | null;
  logoMediaId?: string | null;
  logoPermission?: LogoPermission;
  isFeatured?: boolean;
  displayOrder?: number;
  status?: ContentStatus;
};

export async function upsertPartner(
  db: Db,
  actor: Actor,
  input: PartnerInput,
): Promise<{ id: string }> {
  assertCan(actor, 'content.write');
  if ((input.status ?? 'draft') === 'published') assertCan(actor, 'content.publish');

  return withActor(db, actor, async (tx) => {
    const [existing] = input.id
      ? await tx.select().from(partners).where(eq(partners.id, input.id)).limit(1)
      : [];
    if (input.id && !existing) throw notFound('partner');

    const values = {
      nameAr: input.nameAr,
      nameEn: input.nameEn ?? null,
      type: input.type,
      // A membership level on a donor is meaningless and would render as a
      // stray badge, so it is cleared rather than trusted from the form.
      membershipLevel:
        input.type === 'network' || input.type === 'membership'
          ? (input.membershipLevel ?? null)
          : null,
      sectorAr: input.sectorAr ?? null,
      sectorEn: input.sectorEn ?? null,
      descriptionAr: input.descriptionAr ?? null,
      descriptionEn: input.descriptionEn ?? null,
      website: input.website ?? null,
      logoMediaId: input.logoMediaId ?? null,
      logoPermission: input.logoPermission ?? 'pending',
      isFeatured: input.isFeatured ?? false,
      displayOrder: input.displayOrder ?? 0,
      status: input.status ?? ('draft' as ContentStatus),
    };

    if (values.status === 'published' && values.logoPermission === 'granted') {
      await assertMediaConsent(tx, [values.logoMediaId]);
    }

    const row = one(
      existing
        ? await tx
            .update(partners)
            .set({ ...values, updatedAt: new Date() })
            .where(eq(partners.id, existing.id))
            .returning()
        : await tx.insert(partners).values(values).returning(),
      'partner',
    );

    await writeAudit(tx, actor, {
      action: existing ? 'update' : 'create',
      entityType: 'partner',
      entityId: row.id,
      diff: computeDiff(existing ?? null, row),
    });

    return { id: row.id };
  });
}

/**
 * Status-only transition from a list row. A partner logo is subject to the
 * same consent gate as any other asset the moment it goes public with
 * permission granted — the same rule `upsertPartner` applies on a full save.
 */
export async function setPartnerStatus(
  db: Db,
  actor: Actor,
  id: string,
  status: ContentStatus,
): Promise<{ id: string }> {
  return withActor(db, actor, async (tx) => {
    const [existing] = await tx.select().from(partners).where(eq(partners.id, id)).limit(1);
    if (!existing) throw notFound('partner');

    assertCanTransition(actor, existing.status, status);
    if (status === 'published' && existing.logoPermission === 'granted') {
      await assertMediaConsent(tx, [existing.logoMediaId]);
    }

    const row = one(
      await tx
        .update(partners)
        .set({ status, updatedAt: new Date() })
        .where(eq(partners.id, id))
        .returning(),
      'partner',
    );

    await writeAudit(tx, actor, {
      action:
        status === 'published' ? 'publish' : status === 'archived' ? 'archive' : 'unpublish',
      entityType: 'partner',
      entityId: id,
      diff: { status: { from: existing.status, to: row.status } },
    });

    return { id: row.id };
  });
}

export async function deletePartner(db: Db, actor: Actor, id: string): Promise<void> {
  assertCan(actor, 'content.delete');
  await withActor(db, actor, async (tx) => {
    const [existing] = await tx.select().from(partners).where(eq(partners.id, id)).limit(1);
    if (!existing) throw notFound('partner');

    await writeAudit(tx, actor, {
      action: 'delete',
      entityType: 'partner',
      entityId: id,
      diff: computeDiff(existing, {}),
    });
    await tx.delete(partners).where(eq(partners.id, id));
  });
}

// ── People ───────────────────────────────────────────────────────────────

export type PersonInput = {
  id?: string;
  nameAr: string;
  nameEn?: string | null;
  roleAr: string;
  roleEn?: string | null;
  category?: PersonCategory;
  bioAr?: string | null;
  bioEn?: string | null;
  photoMediaId?: string | null;
  /** DNH-5. Naming staff in Gaza is a safety decision made per person. */
  isPublic?: boolean;
  displayOrder?: number;
};

export async function upsertPerson(
  db: Db,
  actor: Actor,
  input: PersonInput,
): Promise<{ id: string }> {
  assertCan(actor, 'content.write');
  if (input.isPublic) assertCan(actor, 'content.publish');

  return withActor(db, actor, async (tx) => {
    const [existing] = input.id
      ? await tx.select().from(people).where(eq(people.id, input.id)).limit(1)
      : [];
    if (input.id && !existing) throw notFound('person');

    const values = {
      nameAr: input.nameAr,
      nameEn: input.nameEn ?? null,
      roleAr: input.roleAr,
      roleEn: input.roleEn ?? null,
      category: input.category ?? ('board' as PersonCategory),
      bioAr: input.bioAr ?? null,
      bioEn: input.bioEn ?? null,
      photoMediaId: input.photoMediaId ?? null,
      isPublic: input.isPublic ?? false,
      displayOrder: input.displayOrder ?? 0,
    };

    await assertPersonPublishable(tx, values);

    const row = one(
      existing
        ? await tx
            .update(people)
            .set({ ...values, updatedAt: new Date() })
            .where(eq(people.id, existing.id))
            .returning()
        : await tx.insert(people).values(values).returning(),
      'person',
    );

    await writeAudit(tx, actor, {
      action: existing ? 'update' : 'create',
      entityType: 'person',
      entityId: row.id,
      diff: computeDiff(existing ?? null, row),
    });

    return { id: row.id };
  });
}

export async function deletePerson(db: Db, actor: Actor, id: string): Promise<void> {
  assertCan(actor, 'content.delete');
  await withActor(db, actor, async (tx) => {
    const [existing] = await tx.select().from(people).where(eq(people.id, id)).limit(1);
    if (!existing) throw notFound('person');
    await writeAudit(tx, actor, {
      action: 'delete',
      entityType: 'person',
      entityId: id,
      diff: computeDiff(existing, {}),
    });
    await tx.delete(people).where(eq(people.id, id));
  });
}

// ── Impact metrics ───────────────────────────────────────────────────────

export type MetricInput = {
  id?: string;
  labelAr: string;
  labelEn?: string | null;
  /** Kept as a string end to end — a float would round a beneficiary count. */
  value: string;
  unit: string;
  displayPrefix?: string | null;
  programId?: string | null;
  projectId?: string | null;
  periodStart: string;
  periodEnd: string;
  status: MetricStatus;
  verificationSource?: string | null;
  isPublic?: boolean;
  isFeatured?: boolean;
  displayOrder?: number;
};

export async function upsertMetric(
  db: Db,
  actor: Actor,
  input: MetricInput,
): Promise<{ id: string }> {
  assertCan(actor, 'content.write');
  if (input.isPublic) assertCan(actor, 'content.publish');

  const values = {
    labelAr: input.labelAr,
    labelEn: input.labelEn ?? null,
    value: input.value,
    unit: input.unit,
    displayPrefix: input.displayPrefix ?? null,
    programId: input.programId ?? null,
    projectId: input.projectId ?? null,
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
    status: input.status,
    verificationSource: input.verificationSource ?? null,
    isPublic: input.isPublic ?? false,
    isFeatured: input.isFeatured ?? false,
    displayOrder: input.displayOrder ?? 0,
  };

  // No published figure without its period and verification status.
  assertMetricPublishable(values);

  return withActor(db, actor, async (tx) => {
    const [existing] = input.id
      ? await tx.select().from(impactMetrics).where(eq(impactMetrics.id, input.id)).limit(1)
      : [];
    if (input.id && !existing) throw notFound('metric');

    const row = one(
      existing
        ? await tx
            .update(impactMetrics)
            .set({ ...values, updatedAt: new Date() })
            .where(eq(impactMetrics.id, existing.id))
            .returning()
        : await tx.insert(impactMetrics).values(values).returning(),
      'impact_metric',
    );

    await writeAudit(tx, actor, {
      action: existing ? 'update' : 'create',
      entityType: 'impact_metric',
      entityId: row.id,
      diff: computeDiff(existing ?? null, row),
    });

    return { id: row.id };
  });
}

export async function deleteMetric(db: Db, actor: Actor, id: string): Promise<void> {
  assertCan(actor, 'content.delete');
  await withActor(db, actor, async (tx) => {
    const [existing] = await tx
      .select()
      .from(impactMetrics)
      .where(eq(impactMetrics.id, id))
      .limit(1);
    if (!existing) throw notFound('metric');
    await writeAudit(tx, actor, {
      action: 'delete',
      entityType: 'impact_metric',
      entityId: id,
      diff: computeDiff(existing, {}),
    });
    await tx.delete(impactMetrics).where(eq(impactMetrics.id, id));
  });
}

// ── Organisation settings ────────────────────────────────────────────────

export type OrganizationInput = Partial<{
  legalNameAr: string;
  legalNameEn: string;
  shortNameAr: string;
  shortNameEn: string;
  acronym: string;
  shortDescriptionAr: string | null;
  shortDescriptionEn: string | null;
  alternateNames: string[];
  foundedYear: number;
  licenseNumber: string;
  licenseAuthorityAr: string | null;
  licenseAuthorityEn: string | null;
  legalFormAr: string | null;
  legalFormEn: string | null;
  visionAr: string | null;
  visionEn: string | null;
  missionAr: string | null;
  missionEn: string | null;
  coreValues: TitledBlock[];
  principles: TitledBlock[];
  strategicObjectives: BilingualLine[];
  primaryPhone: string | null;
  additionalPhones: string[];
  whatsappNumber: string | null;
  email: string | null;
  secondaryEmail: string | null;
  addressAr: string | null;
  addressEn: string | null;
  addressIsPublic: boolean;
  officeHoursAr: string | null;
  officeHoursEn: string | null;
  socials: SocialLink[];
  officialChannels: OfficialChannel[];
  footerCtaTitleAr: string | null;
  footerCtaTitleEn: string | null;
  footerCtaDescriptionAr: string | null;
  footerCtaDescriptionEn: string | null;
  footerCtaButtonLabelAr: string | null;
  footerCtaButtonLabelEn: string | null;
  footerCtaUrl: string | null;
  footerCtaEnabled: boolean;
  logoPrimaryId: string | null;
  footerLogoId: string | null;
  logoMonoId: string | null;
  defaultOgId: string | null;
}>;

/**
 * The fields a `content_manager` may touch. Everything else — legal name,
 * licence number, founding year — is `admin` only, because those are the facts
 * a reader uses to verify the organisation is real.
 */
const CONTACT_FIELDS = new Set<keyof OrganizationInput>([
  'primaryPhone',
  'additionalPhones',
  'whatsappNumber',
  'email',
  'secondaryEmail',
  'addressAr',
  'addressEn',
  'addressIsPublic',
  'officeHoursAr',
  'officeHoursEn',
  'socials',
  'officialChannels',
  'footerCtaTitleAr',
  'footerCtaTitleEn',
  'footerCtaDescriptionAr',
  'footerCtaDescriptionEn',
  'footerCtaButtonLabelAr',
  'footerCtaButtonLabelEn',
  'footerCtaUrl',
  'footerCtaEnabled',
]);

export async function updateOrganization(
  db: Db,
  actor: Actor,
  input: OrganizationInput,
): Promise<void> {
  // The floor, before anything is read: nobody without at least the contact
  // capability gets as far as loading the row.
  assertCan(actor, 'org.settings.contact');

  await withActor(db, actor, async (tx) => {
    const [existing] = await tx
      .select()
      .from(organizationSettings)
      .where(eq(organizationSettings.id, true))
      .limit(1);
    if (!existing) throw notFound('organization_settings');

    // The full capability is required for a restricted field that actually
    // **changes**, not for one that merely appears in the payload.
    //
    // The settings form is one form: it posts the legal name and the licence
    // number alongside the phone number, because a partial form would have to
    // decide per role which inputs to render and then fail differently
    // depending on what the browser sent. Keying the check on "was this
    // mentioned" therefore refused every save a content manager ever made,
    // including one that touched nothing but the office hours — a screen they
    // are explicitly entitled to and could not use.
    const changesRestricted = (Object.keys(input) as (keyof OrganizationInput)[]).some(
      (key) =>
        !CONTACT_FIELDS.has(key) &&
        !valuesEqual(input[key], (existing as Record<string, unknown>)[key]),
    );
    if (changesRestricted) assertCan(actor, 'org.settings');

    const row = one(
      await tx
        .update(organizationSettings)
        .set({ ...input, updatedBy: actor.id, updatedAt: new Date() })
        .where(eq(organizationSettings.id, true))
        .returning(),
      'organization_settings',
    );

    await writeAudit(tx, actor, {
      action: 'update',
      entityType: 'organization_settings',
      entityId: null,
      diff: computeDiff(existing, row),
    });
  });
}
