import { db } from '@/db';
import { requireActor } from '@/lib/auth/guard';
import { createSupabaseAdminClient } from '@/lib/auth/supabase-server';
import { isAppError, toActionResult } from '@/lib/errors';
import { resolveAttachment } from '@/services/applications/application.service';

export const dynamic = 'force-dynamic';

/**
 * Signed download for one of an applicant's files.
 *
 * The path arrives in the query string, and that is the dangerous part: without
 * a check it would let anyone who can read one application fetch **any** object
 * in the private bucket — every CV and every ID copy the portal has ever
 * received. `resolveAttachment` refuses a path that is not recorded on the
 * application named in the URL, so the query parameter can only ever name a
 * file this application actually carries.
 *
 * It also writes the audit entry, inside the same transaction as the read.
 * "Who downloaded this person's ID copy" is a question the organisation has to
 * be able to answer, and an entry that could commit without its read would not
 * answer it.
 *
 * Sixty seconds, and the bucket is never public. That is long enough for a
 * browser to follow the redirect and not long enough for the URL to be useful
 * once it has been pasted into a chat window.
 */
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireActor();
    const { id } = await context.params;

    const path = new URL(request.url).searchParams.get('path');
    if (!path) return new Response('Not found', { status: 404 });

    const file = await resolveAttachment(db, actor, id, path);

    const { data, error } = await createSupabaseAdminClient()
      .storage.from('applications')
      .createSignedUrl(file.path, 60, {
        // The stored object is a UUID; this is what the reviewer's browser
        // saves it as. The applicant's own filename, which is what makes a
        // folder of forty downloads navigable.
        download: file.originalName,
      });

    if (error || !data) return new Response('Not found', { status: 404 });

    return Response.redirect(data.signedUrl, 302);
  } catch (error) {
    const result = toActionResult(error);
    return Response.json(result, { status: isAppError(error) ? error.status : 500 });
  }
}
