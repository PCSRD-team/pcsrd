import { z } from 'zod';
import { db } from '@/db';
import { createSupabaseAdminClient } from '@/lib/auth/supabase-server';
import { requireActor } from '@/lib/auth/guard';
import { isAppError, toActionResult } from '@/lib/errors';
import { mediaMetadataSchema } from '@/lib/validation/admin';
import { processImageUpload, storagePath, validateCvUpload } from '@/lib/security/upload';
import { registerMedia } from '@/services/media/media.service';

export const dynamic = 'force-dynamic';
/** sharp can exceed the default 10 s on a large photograph. */
export const maxDuration = 30;

/**
 * Multipart upload.
 *
 * A route handler rather than a Server Action because it streams a file and
 * returns a JSON record the media picker consumes directly.
 *
 * `altAr` is checked **before** anything is written — not after the upload
 * succeeds. Otherwise a rejected record leaves an orphaned object in the bucket
 * every time somebody forgets the alt text, which is often.
 *
 * The metadata goes through `mediaMetadataSchema`, the same schema the rest of
 * the admin uses. It previously went through a row of `as` casts, and
 * `form.get('consent') as 'not_required' | 'obtained' | 'pending'` accepts any
 * string at all — a cast is an assertion, not a check. That mattered here more
 * than anywhere else in the codebase: posting
 * `consent=obtained&hasIdentifiableMinors=true` satisfied the service's
 * safeguarding gate and stored a photograph of an identifiable child as
 * consented. `form.get('altEn') as string` was wrong in a quieter way — the
 * value is a `File` if the part is a file, and `String(File)` is
 * `"[object File]"`, written straight into a text column.
 */
export async function POST(request: Request) {
  try {
    const actor = await requireActor();
    const form = await request.formData();

    const file = form.get('file');
    if (!(file instanceof File)) {
      return Response.json({ ok: false, code: 'validation' }, { status: 422 });
    }

    // Only the text parts. `file` is handled above and is not metadata.
    const metadata = mediaMetadataSchema.safeParse({
      kind: form.get('kind') ?? undefined,
      altAr: form.get('altAr') ?? '',
      altEn: form.get('altEn') || null,
      captionAr: form.get('captionAr') || null,
      captionEn: form.get('captionEn') || null,
      credit: form.get('credit') || null,
      consent: form.get('consent') ?? undefined,
      consentReference: form.get('consentReference') || null,
      hasIdentifiableMinors: form.get('hasIdentifiableMinors') === 'true',
    });

    if (!metadata.success) {
      return Response.json(
        {
          ok: false,
          code: 'validation',
          fieldErrors: z.flattenError(metadata.error).fieldErrors,
        },
        { status: 422 },
      );
    }

    const isDocument = metadata.data.kind === 'document';
    const processed = isDocument ? await validateCvUpload(file) : await processImageUpload(file);
    if (!processed.ok) {
      return Response.json(
        { ok: false, code: 'upload_rejected', messageKey: `errors.upload.${processed.reason}` },
        { status: 415 },
      );
    }

    const bucket = isDocument ? 'documents' : 'media';
    const ext = isDocument ? ('ext' in processed ? processed.ext : 'bin') : 'webp';
    const path = storagePath(isDocument ? 'documents' : 'images', ext);

    const { error } = await createSupabaseAdminClient()
      .storage.from(bucket)
      .upload(path, processed.buffer, { contentType: processed.mime, upsert: false });

    if (error) {
      return Response.json(
        { ok: false, code: 'internal', messageKey: 'errors.upload.failed' },
        { status: 500 },
      );
    }

    const record = await registerMedia(db, actor, {
      kind: isDocument ? 'document' : 'image',
      bucket,
      path,
      mimeType: processed.mime,
      fileSize: processed.buffer.byteLength,
      width: 'width' in processed ? processed.width : null,
      height: 'height' in processed ? processed.height : null,
      blurDataUrl: 'blurDataUrl' in processed ? processed.blurDataUrl : null,
      altAr: metadata.data.altAr,
      altEn: metadata.data.altEn,
      captionAr: metadata.data.captionAr,
      captionEn: metadata.data.captionEn,
      credit: metadata.data.credit,
      consent: metadata.data.consent,
      consentReference: metadata.data.consentReference,
      hasIdentifiableMinors: metadata.data.hasIdentifiableMinors,
      exifStripped: 'exifStripped' in processed ? processed.exifStripped : false,
    });

    return Response.json({ ok: true, data: record }, { status: 201 });
  } catch (error) {
    const result = toActionResult(error);
    return Response.json(result, { status: isAppError(error) ? error.status : 500 });
  }
}
