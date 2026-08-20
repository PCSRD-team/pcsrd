import { db } from '@/db';
import { createSupabaseAdminClient } from '@/lib/auth/supabase-server';
import { requireActor } from '@/lib/auth/guard';
import { isAppError, toActionResult } from '@/lib/errors';
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
 */
export async function POST(request: Request) {
  try {
    const actor = await requireActor();
    const form = await request.formData();

    const file = form.get('file');
    if (!(file instanceof File)) {
      return Response.json({ ok: false, code: 'validation' }, { status: 422 });
    }

    const altAr = String(form.get('altAr') ?? '').trim();
    if (!altAr) {
      return Response.json(
        { ok: false, code: 'validation', fieldErrors: { altAr: ['errors.field.required'] } },
        { status: 422 },
      );
    }

    const isDocument = form.get('kind') === 'document';
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
      altAr,
      altEn: (form.get('altEn') as string) || null,
      captionAr: (form.get('captionAr') as string) || null,
      credit: (form.get('credit') as string) || null,
      consent: (form.get('consent') as 'not_required' | 'obtained' | 'pending') || 'not_required',
      consentReference: (form.get('consentReference') as string) || null,
      hasIdentifiableMinors: form.get('hasIdentifiableMinors') === 'true',
      exifStripped: 'exifStripped' in processed ? processed.exifStripped : false,
    });

    return Response.json({ ok: true, data: record }, { status: 201 });
  } catch (error) {
    const result = toActionResult(error);
    return Response.json(result, { status: isAppError(error) ? error.status : 500 });
  }
}
