import { z } from 'zod';
import { db } from '@/db';
import { requireActor } from '@/lib/auth/guard';
import { createSupabaseAdminClient } from '@/lib/auth/supabase-server';
import { isAppError, toActionResult } from '@/lib/errors';
import { resolveDonationAttachment } from '@/services/donations/donation.service';

export const dynamic = 'force-dynamic';

/**
 * Signed download of a donor's transfer slip.
 *
 * The path is read from the donation row, never from the request, so this can
 * only ever hand out the file that notice carries. The service writes the
 * audit entry in the same transaction as the read. Sixty seconds, private
 * bucket — the same rules as an applicant's CV.
 */
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireActor();
    const parsedId = z.uuid().safeParse((await context.params).id);
    if (!parsedId.success) return new Response('Not found', { status: 404 });

    const slip = await resolveDonationAttachment(db, actor, parsedId.data);
    const ext = slip.path.split('.').pop() ?? 'bin';

    const { data, error } = await createSupabaseAdminClient()
      .storage.from('applications')
      .createSignedUrl(slip.path, 60, { download: `${slip.reference}.${ext}` });
    if (error || !data) return new Response('Not found', { status: 404 });

    return Response.redirect(data.signedUrl, 302);
  } catch (error) {
    const result = toActionResult(error);
    return Response.json(result, { status: isAppError(error) ? error.status : 500 });
  }
}
