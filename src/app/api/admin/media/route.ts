import { z } from 'zod';
import { db } from '@/db';
import { getAdminMedia, listAdminMedia } from '@/db/queries/admin';
import type { MediaAsset } from '@/db/schema/media';
import { createSupabaseAdminClient } from '@/lib/auth/supabase-server';
import { requireActor } from '@/lib/auth/guard';
import { publicEnv } from '@/lib/env.public';
import { withFlash } from '@/actions/admin/flash';
import { err, isAppError, ok, toActionResult, type ActionResult } from '@/lib/errors';
import { storageUrl } from '@/lib/format';
import { mediaMetadataSchema } from '@/lib/validation/admin';
import { processImageUpload, storagePath, validateCvUpload } from '@/lib/security/upload';
import { registerMedia } from '@/services/media/media.service';

export const dynamic = 'force-dynamic';
/** sharp can exceed the default 10 s on a large photograph. */
export const maxDuration = 30;

/**
 * The same outcome, in whichever shape the caller can use.
 *
 * `media-uploader.tsx` was the one form in the admin that did not work with
 * scripting off, against non-negotiable #7. It did not need a Server Action to
 * fix — this handler already accepts an ordinary `multipart/form-data` POST,
 * because that is what `fetch` was sending it. What it did not do was answer a
 * browser: it returned JSON, so a no-JS submit landed on a page of raw JSON
 * with no way back.
 *
 * So the form now carries a real `action`/`method`/`encType` and the JSON
 * response is reserved for callers that ask for it. `fetch` sets
 * `Accept: application/json` explicitly; a native form submit sends
 * `text/html`, and gets a redirect carrying the outcome as a dictionary key —
 * the same `withFlash` contract every other admin action uses, rendered by the
 * `<Flash>` already on `/admin/media`.
 */
function wantsJson(request: Request): boolean {
  return (request.headers.get('accept') ?? '').includes('application/json');
}

function respond(
  request: Request,
  returnTo: unknown,
  result: ActionResult<unknown>,
  status: number,
): Response {
  if (wantsJson(request)) return Response.json(result, { status });
  // 303, not 307: the browser must follow it with GET. A 307 would repeat the
  // multipart POST against the redirect target.
  return Response.redirect(new URL(withFlash(returnTo, result), request.url), 303);
}

const pickerQuerySchema = z.object({
  q: z.string().trim().max(200).optional(),
  page: z.coerce.number().int().positive().default(1),
  kind: z.enum(['image', 'document']).optional(),
  id: z.string().uuid().optional(),
});

export async function GET(request: Request) {
  try {
    const actor = await requireActor();
    const url = new URL(request.url);
    const parsed = pickerQuerySchema.safeParse(Object.fromEntries(url.searchParams));
    if (!parsed.success) {
      return Response.json({ ok: false, code: 'validation' }, { status: 422 });
    }

    if (parsed.data.id) {
      const item = await getAdminMedia(actor, parsed.data.id);
      return Response.json({ ok: true, data: item ? pickerItem(item) : null });
    }

    const result = await listAdminMedia(actor, parsed.data);
    return Response.json({
      ok: true,
      data: {
        ...result,
        items: result.items.map(pickerItem),
      },
    });
  } catch (error) {
    const result = toActionResult(error);
    return Response.json(result, { status: isAppError(error) ? error.status : 500 });
  }
}

function pickerItem(item: MediaAsset) {
  return {
    id: item.id,
    kind: item.kind,
    url: storageUrl(publicEnv.NEXT_PUBLIC_SUPABASE_URL, item.bucket, item.path),
    altAr: item.altAr,
    altEn: item.altEn,
    mimeType: item.mimeType,
    fileSize: item.fileSize,
    width: item.width,
    height: item.height,
    consent: item.consent,
    hasIdentifiableMinors: item.hasIdentifiableMinors,
  };
}

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
    const returnTo = form.get('returnTo');

    const file = form.get('file');
    if (!(file instanceof File)) {
      return respond(request, returnTo, err('validation', 'errors.upload.failed'), 422);
    }

    // Only the text parts. `file` is handled above and is not metadata.
    const metadata = mediaMetadataSchema.safeParse({
      // Derived here, not in the client, so the no-JS path gets it too: the
      // schema defaults `kind` to `image`, and a PDF posted without one would
      // go to `processImageUpload` and be refused. The browser-reported type
      // is untrusted input, but both processors sniff magic bytes, so a lie
      // only ever costs the uploader a rejection.
      kind: form.get('kind') ?? (file.type === 'application/pdf' ? 'document' : 'image'),
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
      const flat = z.flattenError(metadata.error).fieldErrors;
      return respond(request, returnTo, err('validation', 'errors.validation', flat), 422);
    }

    const isDocument = metadata.data.kind === 'document';
    const processed = isDocument ? await validateCvUpload(file) : await processImageUpload(file);
    if (!processed.ok) {
      return respond(request, returnTo, err('upload_rejected', `errors.upload.${processed.reason}`), 415);
    }

    const bucket = isDocument ? 'documents' : 'media';
    const ext = isDocument ? ('ext' in processed ? processed.ext : 'bin') : 'webp';
    const path = storagePath(isDocument ? 'documents' : 'images', ext);

    const { error } = await createSupabaseAdminClient()
      .storage.from(bucket)
      .upload(path, processed.buffer, { contentType: processed.mime, upsert: false });

    if (error) {
      return respond(request, returnTo, err('internal', 'errors.upload.failed'), 500);
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

    return respond(request, returnTo, ok(record, 'admin.saved'), 201);
  } catch (error) {
    const result = toActionResult(error);
    const status = isAppError(error) ? error.status : 500;
    // `returnTo` is undefined when the throw beat `request.formData()` — an
    // unauthenticated POST, most often. `safeReturnPath` turns that into
    // `/admin`, which is where the login redirect wants the visitor anyway.
    return respond(request, undefined, result, status);
  }
}
