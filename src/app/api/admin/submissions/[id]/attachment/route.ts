import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { readAsActor, withActor } from '@/db/session';
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
 *
 * Both statements bind the actor. `form_submissions` is FORCE ROW LEVEL
 * SECURITY and the runtime has no BYPASSRLS, so the unbound read returned
 * nothing and every download 404ed, while the unbound audit insert was refused
 * by `audit_logs.rt_insert`.
 *
 * They are two transactions rather than one because the signed-URL call in
 * between is a network round trip to Supabase Storage, and the pool is
 * `max: 1` — holding a transaction open across it would serialise every other
 * request behind this one. The ordering is what matters: the entry is written
 * only once a usable link exists, so the log records downloads that could
 * actually happen.
 */
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireActor();
    assertCan(actor, 'submissions.read');

    const { id } = await context.params;
    const [row] = await readAsActor(db, actor, (tx) =>
      tx
        .select({
          id: formSubmissions.id,
          isSensitive: formSubmissions.isSensitive,
          attachmentPath: formSubmissions.attachmentPath,
        })
        .from(formSubmissions)
        .where(eq(formSubmissions.id, id))
        .limit(1),
    );

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

    await withActor(db, actor, (tx) =>
      // `download_attachment` is not in the database's `audit_action_known`
      // CHECK, so it is recorded as a `view_sensitive` event whose diff names
      // the attachment — the row-level enum is the live database's, not ours.
      writeAudit(tx, actor, {
        action: 'view_sensitive',
        entityType: 'form_submission',
        entityId: row.id,
        diff: { attachment: { from: null, to: 'download' } },
      }),
    );

    return Response.redirect(data.signedUrl, 302);
  } catch (error) {
    const result = toActionResult(error);
    return Response.json(result, { status: isAppError(error) ? error.status : 500 });
  }
}
