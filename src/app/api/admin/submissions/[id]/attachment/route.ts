import { z } from 'zod';
import { db } from '@/db';
import { requireActor } from '@/lib/auth/guard';
import { createSupabaseAdminClient } from '@/lib/auth/supabase-server';
import { isAppError, toActionResult } from '@/lib/errors';
import {
  recordSubmissionAttachmentDownload,
  resolveSubmissionAttachment,
} from '@/services/submission/submission.service';

export const dynamic = 'force-dynamic';

/**
 * Signed download for a submission's attachment.
 *
 * The rules — who may download, and that a confidential attachment is refused
 * outright rather than gated — live in `submission.service.ts`
 * (`resolveSubmissionAttachment`), as does the audit entry. This handler is
 * the HTTP half: parse the id, ask the service, sign a URL, redirect.
 *
 * The link expires in sixty seconds and the bucket is never public. The audit
 * entry is written only once a usable link exists, so the log records
 * downloads that could actually happen.
 */
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireActor();

    // A malformed id is a missing page, not a Postgres `invalid input syntax
    // for type uuid` surfacing as a 500.
    const parsedId = z.uuid().safeParse((await context.params).id);
    if (!parsedId.success) return new Response('Not found', { status: 404 });

    const attachment = await resolveSubmissionAttachment(db, actor, parsedId.data);

    const { data, error } = await createSupabaseAdminClient()
      .storage.from('applications')
      .createSignedUrl(attachment.path, 60);

    if (error || !data) return new Response('Not found', { status: 404 });

    await recordSubmissionAttachmentDownload(db, actor, attachment.id);

    return Response.redirect(data.signedUrl, 302);
  } catch (error) {
    const result = toActionResult(error);
    return Response.json(result, { status: isAppError(error) ? error.status : 500 });
  }
}
