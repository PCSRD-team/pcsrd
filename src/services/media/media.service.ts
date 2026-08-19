import { eq } from 'drizzle-orm';
import type { Db } from '@/db';
import { mediaAssets } from '@/db/schema';
import type { ConsentStatus, MediaKind } from '@/db/schema/enums';
import { AppError, notFound } from '@/lib/errors';
import type { Actor } from '../_shared/actor';
import { writeAudit } from '../_shared/audit';
import { computeDiff } from '../_shared/diff';
import { assertCan } from '../_shared/permissions';

/**
 * Media records.
 *
 * The bytes are written to Storage by the route handler — that needs `fetch`
 * and the service-role client, both of which are runtime concerns. What this
 * service owns is the record and the rules attached to it.
 */

export type RegisterMediaInput = {
  kind?: MediaKind;
  bucket?: string;
  path: string;
  mimeType: string;
  fileSize: number;
  width?: number | null;
  height?: number | null;
  blurDataUrl?: string | null;
  altAr: string;
  altEn?: string | null;
  captionAr?: string | null;
  captionEn?: string | null;
  credit?: string | null;
  consent?: ConsentStatus;
  consentReference?: string | null;
  hasIdentifiableMinors?: boolean;
  exifStripped?: boolean;
};

export async function registerMedia(
  db: Db,
  actor: Actor,
  input: RegisterMediaInput,
): Promise<{ id: string; path: string }> {
  assertCan(actor, 'media.upload');

  // RULE 7. Checked before the row is written, not at publish time: an asset
  // without Arabic alt text is unusable, and letting it into the library means
  // someone finds out at the moment they are trying to publish.
  if (!input.altAr?.trim()) {
    throw new AppError('validation', 'errors.media.altRequired', {
      fieldErrors: { altAr: ['errors.field.required'] },
    });
  }

  // A photograph of an identifiable child cannot be stored as "consent not
  // required" — that combination is how the safeguarding rule gets bypassed by
  // accident rather than by decision.
  if (input.hasIdentifiableMinors && (input.consent ?? 'not_required') === 'not_required') {
    throw new AppError('validation', 'errors.media.minorConsentState', {
      fieldErrors: { consent: ['errors.media.minorConsentState'] },
    });
  }

  return db.transaction(async (tx) => {
    const [row] = await tx
      .insert(mediaAssets)
      .values({
        kind: input.kind ?? 'image',
        bucket: input.bucket ?? 'media',
        path: input.path,
        mimeType: input.mimeType,
        fileSize: input.fileSize,
        width: input.width ?? null,
        height: input.height ?? null,
        blurDataUrl: input.blurDataUrl ?? null,
        altAr: input.altAr.trim(),
        altEn: input.altEn ?? null,
        captionAr: input.captionAr ?? null,
        captionEn: input.captionEn ?? null,
        credit: input.credit ?? null,
        consent: input.consent ?? 'not_required',
        consentReference: input.consentReference ?? null,
        hasIdentifiableMinors: input.hasIdentifiableMinors ?? false,
        exifStripped: input.exifStripped ?? false,
        createdBy: actor.id,
      })
      .returning({ id: mediaAssets.id, path: mediaAssets.path });

    await writeAudit(tx, actor, {
      action: 'create',
      entityType: 'media_asset',
      entityId: row.id,
    });

    return row;
  });
}

export type UpdateMediaInput = Partial<
  Pick<
    RegisterMediaInput,
    | 'altAr'
    | 'altEn'
    | 'captionAr'
    | 'captionEn'
    | 'credit'
    | 'consent'
    | 'consentReference'
    | 'hasIdentifiableMinors'
  >
>;

export async function updateMedia(
  db: Db,
  actor: Actor,
  id: string,
  input: UpdateMediaInput,
): Promise<void> {
  assertCan(actor, 'media.upload');

  await db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(mediaAssets)
      .where(eq(mediaAssets.id, id))
      .limit(1);
    if (!existing) throw notFound('media_asset');

    const altAr = input.altAr ?? existing.altAr;
    if (!altAr.trim()) {
      throw new AppError('validation', 'errors.media.altRequired', {
        fieldErrors: { altAr: ['errors.field.required'] },
      });
    }

    const [row] = await tx
      .update(mediaAssets)
      .set({ ...input, altAr: altAr.trim() })
      .where(eq(mediaAssets.id, id))
      .returning();

    await writeAudit(tx, actor, {
      action: 'update',
      entityType: 'media_asset',
      entityId: id,
      diff: computeDiff(existing, row),
    });
  });
}

/**
 * Deletes the record. The caller removes the object from Storage afterwards —
 * in that order, so a failed Storage delete leaves an orphaned file rather than
 * a row pointing at nothing.
 *
 * Returns the storage coordinates so the caller knows what to remove.
 */
export async function deleteMedia(
  db: Db,
  actor: Actor,
  id: string,
): Promise<{ bucket: string; path: string }> {
  assertCan(actor, 'media.delete');

  return db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(mediaAssets)
      .where(eq(mediaAssets.id, id))
      .limit(1);
    if (!existing) throw notFound('media_asset');

    await writeAudit(tx, actor, {
      action: 'delete',
      entityType: 'media_asset',
      entityId: id,
      diff: computeDiff(existing, {}),
    });

    // Every foreign key referencing media_assets is `on delete set null` except
    // the four junction tables, which cascade. Removing an asset therefore
    // blanks a hero image rather than deleting the article that used it.
    await tx.delete(mediaAssets).where(eq(mediaAssets.id, id));

    return { bucket: existing.bucket, path: existing.path };
  });
}
