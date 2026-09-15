'use server';

import { redirect } from 'next/navigation';
import { db } from '@/db';
import { requireActor } from '@/lib/auth/guard';
import { revalidateEntity } from '@/lib/cache/revalidate';
import { type ActionResult, err, ok, runAction } from '@/lib/errors';
import { fieldErrorsFrom } from '@/lib/validation/common';
import {
  rowIdSchema,
  setUserFlagSchema,
  setUserRoleSchema,
  submissionStateFormSchema,
} from '@/lib/validation/admin';
import { deleteRedirect } from '@/services/content/redirect.service';
import { deleteMedia } from '@/services/media/media.service';
import { setSubmissionState } from '@/services/submission/submission.service';
import { setSensitiveAccess, setUserActive, setUserRole } from '@/services/users/user.service';
import { safeReturnPath, withFlash } from './flash';

/**
 * Row actions for the entities outside the content lifecycle: media, redirects,
 * submissions and users.
 *
 * Every one is a `<form action>` target taking `FormData` and redirecting with
 * the outcome in the query string — see `content.ts` for why. Same discipline:
 * guard, validate, call the service, revalidate. Nothing else in between.
 */

type Outcome = ActionResult<{ id: string }>;

function pick(formData: FormData, keys: string[]) {
  return Object.fromEntries(keys.map((key) => [key, formData.get(key) ?? undefined]));
}

export async function removeMedia(formData: FormData): Promise<void> {
  const raw = pick(formData, ['id', 'returnTo']);
  const result: Outcome = await runAction(async () => {
    const actor = await requireActor();
    const parsed = rowIdSchema.safeParse(raw);
    if (!parsed.success) {
      return err('validation', 'errors.validation', fieldErrorsFrom(parsed.error));
    }

    const stored = await deleteMedia(db, actor, parsed.data.id);

    // The record is gone before the object. The reverse order would leave a row
    // pointing at a file that no longer exists, which renders as a broken
    // image; this way the worst case is an orphaned file nobody references.
    const { createSupabaseAdminClient } = await import('@/lib/auth/supabase-server');
    const { error } = await createSupabaseAdminClient()
      .storage.from(stored.bucket)
      .remove([stored.path]);
    if (error) console.error('[storage] orphaned object', stored, error);

    revalidateEntity('media');
    return ok({ id: parsed.data.id }, 'admin.deleted');
  });

  // A refused delete goes back to the detail page, which lists the usages that
  // refused it; a successful one has no detail page left to return to.
  redirect(withFlash(result.ok ? '/admin/media' : safeReturnPath(raw.returnTo), result));
}

export async function removeRedirect(formData: FormData): Promise<void> {
  const raw = pick(formData, ['id', 'returnTo']);
  const result: Outcome = await runAction(async () => {
    const actor = await requireActor();
    const parsed = rowIdSchema.safeParse(raw);
    if (!parsed.success) {
      return err('validation', 'errors.validation', fieldErrorsFrom(parsed.error));
    }
    await deleteRedirect(db, actor, parsed.data.id);
    // The proxy reads one cached array; this is the entry it drops.
    revalidateEntity('redirect');
    return ok({ id: parsed.data.id }, 'admin.deleted');
  });

  redirect(withFlash('/admin/redirects', result));
}

export async function updateSubmissionState(formData: FormData): Promise<void> {
  const raw = pick(formData, ['id', 'state', 'internalNote']);
  const result: Outcome = await runAction(async () => {
    const actor = await requireActor();
    const parsed = submissionStateFormSchema.safeParse(raw);
    if (!parsed.success) {
      return err('validation', 'errors.validation', fieldErrorsFrom(parsed.error));
    }
    await setSubmissionState(db, actor, parsed.data.id, {
      state: parsed.data.state,
      internalNote: parsed.data.internalNote || null,
    });
    // Submissions are never cached — nothing to revalidate.
    return ok({ id: parsed.data.id }, 'admin.saved');
  });

  const id = typeof raw.id === 'string' ? raw.id : '';
  redirect(withFlash(`/admin/submissions/${id}`, result));
}

// ── Users ────────────────────────────────────────────────────────────────
// Nothing here is cached: a role change is visible on the next request.

export async function changeUserRole(formData: FormData): Promise<void> {
  const raw = pick(formData, ['userId', 'role']);
  const result: Outcome = await runAction(async () => {
    const actor = await requireActor();
    const parsed = setUserRoleSchema.safeParse(raw);
    if (!parsed.success) {
      return err('validation', 'errors.validation', fieldErrorsFrom(parsed.error));
    }
    const user = await setUserRole(db, actor, parsed.data.userId, parsed.data.role);
    return ok({ id: user.id }, 'admin.updated');
  });

  redirect(withFlash('/admin/users', result));
}

export async function changeUserSensitiveAccess(formData: FormData): Promise<void> {
  const raw = pick(formData, ['userId', 'value']);
  const result: Outcome = await runAction(async () => {
    const actor = await requireActor();
    const parsed = setUserFlagSchema.safeParse(raw);
    if (!parsed.success) {
      return err('validation', 'errors.validation', fieldErrorsFrom(parsed.error));
    }
    const user = await setSensitiveAccess(db, actor, parsed.data.userId, parsed.data.value);
    return ok({ id: user.id }, 'admin.updated');
  });

  redirect(withFlash('/admin/users', result));
}

export async function changeUserActive(formData: FormData): Promise<void> {
  const raw = pick(formData, ['userId', 'value']);
  const result: Outcome = await runAction(async () => {
    const actor = await requireActor();
    const parsed = setUserFlagSchema.safeParse(raw);
    if (!parsed.success) {
      return err('validation', 'errors.validation', fieldErrorsFrom(parsed.error));
    }
    const user = await setUserActive(db, actor, parsed.data.userId, parsed.data.value);
    return ok({ id: user.id }, 'admin.updated');
  });

  redirect(withFlash('/admin/users', result));
}
