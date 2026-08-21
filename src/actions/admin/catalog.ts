'use server';

import { db } from '@/db';
import type { SubmissionState } from '@/db/schema/enums';
import { requireActor } from '@/lib/auth/guard';
import { revalidateEntity } from '@/lib/cache/revalidate';
import { type ActionResult, err, ok, runAction } from '@/lib/errors';
import { fieldErrorsFrom } from '@/lib/validation/common';
import {
  mediaMetadataSchema,
  metricSchema,
  organizationSchema,
  partnerSchema,
  personSchema,
} from '@/lib/validation/admin';
import {
  deleteMetric,
  deletePartner,
  deletePerson,
  updateOrganization,
  upsertMetric,
  upsertPartner,
  upsertPerson,
} from '@/services/content/catalog.service';
import { deleteMedia, updateMedia } from '@/services/media/media.service';
import { setSubmissionState } from '@/services/submission/submission.service';

/**
 * Mutations for the entities with no slug: partners, people, impact figures,
 * media metadata, submissions and the organisation singleton.
 *
 * Same discipline as `content.ts` — guard, validate, call, revalidate — with
 * nothing else in between.
 */

type Mutation = ActionResult<{ id: string }>;

export async function savePartner(input: unknown): Promise<Mutation> {
  return runAction(async () => {
    const actor = await requireActor();
    const parsed = partnerSchema.safeParse(input);
    if (!parsed.success) {
      return err('validation', 'errors.validation', fieldErrorsFrom(parsed.error));
    }
    const result = await upsertPartner(db, actor, parsed.data);
    revalidateEntity('partner');
    // A partner logo appears on project pages, so those go stale too.
    revalidateEntity('project');
    return ok({ id: result.id }, 'admin.saved');
  });
}

export async function removePartner(id: string): Promise<Mutation> {
  return runAction(async () => {
    const actor = await requireActor();
    await deletePartner(db, actor, id);
    revalidateEntity('partner');
    revalidateEntity('project');
    return ok({ id }, 'admin.deleted');
  });
}

export async function savePerson(input: unknown): Promise<Mutation> {
  return runAction(async () => {
    const actor = await requireActor();
    const parsed = personSchema.safeParse(input);
    if (!parsed.success) {
      return err('validation', 'errors.validation', fieldErrorsFrom(parsed.error));
    }
    const result = await upsertPerson(db, actor, parsed.data);
    revalidateEntity('person');
    return ok({ id: result.id }, 'admin.saved');
  });
}

export async function removePerson(id: string): Promise<Mutation> {
  return runAction(async () => {
    const actor = await requireActor();
    await deletePerson(db, actor, id);
    revalidateEntity('person');
    return ok({ id }, 'admin.deleted');
  });
}

export async function saveMetric(input: unknown): Promise<Mutation> {
  return runAction(async () => {
    const actor = await requireActor();
    const parsed = metricSchema.safeParse(input);
    if (!parsed.success) {
      return err('validation', 'errors.validation', fieldErrorsFrom(parsed.error));
    }
    const result = await upsertMetric(db, actor, parsed.data);
    revalidateEntity('metric');
    return ok({ id: result.id }, 'admin.saved');
  });
}

export async function removeMetric(id: string): Promise<Mutation> {
  return runAction(async () => {
    const actor = await requireActor();
    await deleteMetric(db, actor, id);
    revalidateEntity('metric');
    return ok({ id }, 'admin.deleted');
  });
}

export async function saveMediaMetadata(id: string, input: unknown): Promise<Mutation> {
  return runAction(async () => {
    const actor = await requireActor();
    const parsed = mediaMetadataSchema.partial().safeParse(input);
    if (!parsed.success) {
      return err('validation', 'errors.validation', fieldErrorsFrom(parsed.error));
    }
    await updateMedia(db, actor, id, parsed.data);
    // Alt text and consent state affect every page that renders the asset.
    revalidateEntity('media');
    return ok({ id }, 'admin.saved');
  });
}

export async function removeMedia(id: string): Promise<Mutation> {
  return runAction(async () => {
    const actor = await requireActor();
    const stored = await deleteMedia(db, actor, id);

    // The record is gone before the object. The reverse order would leave a row
    // pointing at a file that no longer exists, which renders as a broken
    // image; this way the worst case is an orphaned file nobody references.
    const { createSupabaseAdminClient } = await import('@/lib/auth/supabase-server');
    const { error } = await createSupabaseAdminClient()
      .storage.from(stored.bucket)
      .remove([stored.path]);
    if (error) console.error('[storage] orphaned object', stored, error);

    revalidateEntity('media');
    return ok({ id }, 'admin.deleted');
  });
}

export async function saveOrganization(input: unknown): Promise<ActionResult<null>> {
  return runAction(async () => {
    const actor = await requireActor();
    // `organizationSchema` is `.partial().strict()`: the settings form posts a
    // partial record, and an unknown key is rejected rather than ignored.
    //
    // This previously read `input as Record<string, never>` with a comment
    // saying no schema was needed because the service types every field. A cast
    // is not a check, and `Record<string, never>` is assignable to
    // `Partial<OrganizationInput>`, so it also suppressed the type error that
    // would have pointed here. The service spreads its input straight into
    // `.set()`, which made this a mass-assignment sink on the one table holding
    // the licence number, the legal name and the official channels — the facts
    // /verify exists so a reader can check the organisation is real.
    //
    // Which fields a role may touch stays in the service. That is a permission
    // rule, not an HTTP concern.
    const parsed = organizationSchema.safeParse(input);
    if (!parsed.success) {
      return err('validation', 'errors.validation', fieldErrorsFrom(parsed.error));
    }
    await updateOrganization(db, actor, parsed.data);
    revalidateEntity('orgSettings');
    return ok(null, 'admin.saved');
  });
}

export async function updateSubmissionState(
  id: string,
  state: SubmissionState,
  internalNote?: string,
): Promise<Mutation> {
  return runAction(async () => {
    const actor = await requireActor();
    await setSubmissionState(db, actor, id, { state, internalNote: internalNote ?? null });
    // Submissions are never cached — nothing to revalidate.
    return ok({ id }, 'admin.saved');
  });
}
