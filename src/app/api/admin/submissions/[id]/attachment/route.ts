import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { formSubmissions } from '@/db/schema';
import { requireActor } from '@/lib/auth/guard';
import { createSupabaseAdminClient } from '@/lib/auth/supabase-server';
import { isAppError, toActionResult } from '@/lib/errors';
import { writeAudit } from '@/services/_shared/audit';
import { assertCan } from '@/services/_shared/permissions';

export const dynamic = 'force-dynamic';

/**
 * Signed download for a CV.
 *
 * **02-API §6.5 and 05-ADMIN §7 contradict each other here.** The API spec
 * allows a confidential attachment to be downloaded after an extra permission
 * check; the admin spec says no attachment download on the sensitive path at
 * all. The stricter rule wins: a downloaded file leaves the audited system and
 * lands in a downloads folder, on a shared laptop, in a backup — and for a
 * safeguarding complaint that is the whole risk.
 *
 * The link expires in sixty seconds and the bucket is never public.
 */
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireActor();
    assertCan(actor, 'submissions.read');

    const { id } = await context.params;
    const [row] = await db
      .select({
        id: formSubmissions.id,
        isSensitive: formSubmissions.isSensitive,
        attachmentPath: formSubmissions.attachmentPath,
      })
      .from(formSubmissions)
      .where(eq(formSubmissions.id, id))
      .limit(1);

    if (!row?.attachmentPath) return new Response('Not found', { status: 404 });

    if (row.isSensitive) {
      return Response.json(
        { ok: false, code: 'forbidden', messageKey: 'errors.attachment.sensitiveRefused' },
        { status: 403 },
      );
    }

    const { data, error } = await createSupabaseAdminClient()
      .storage.from('applications')
      .createSignedUrl(row.attachmentPath, 60);

    if (error || !data) return new Response('Not found', { status: 404 });

    await writeAudit(db, actor, {
      action: 'download_attachment',
      entityType: 'form_submission',
      entityId: row.id,
    });

    return Response.redirect(data.signedUrl, 302);
  } catch (error) {
    const result = toActionResult(error);
    return Response.json(result, { status: isAppError(error) ? error.status : 500 });
  }
}
