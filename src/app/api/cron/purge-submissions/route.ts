import { db } from '@/db';
import { isAuthorisedCron } from '@/lib/security/cron-auth';
import { purgeExpiredSubmissions } from '@/services/submission/submission.service';

export const dynamic = 'force-dynamic';

/**
 * Daily retention purge.
 *
 * Returns a count and nothing else. Logging which submissions were deleted
 * would recreate, in a log the purge does not reach, exactly the record the
 * purge exists to destroy.
 */
export async function GET(request: Request) {
  if (!(await isAuthorisedCron(request))) {
    return new Response('Unauthorized', { status: 401 });
  }

  const purged = await purgeExpiredSubmissions(db);

  // The row is gone; the applicant's CV must go with it. A retention policy
  // that deletes the record and keeps the file has deleted the index, not the
  // data.
  if (purged.attachments.length) {
    const { createSupabaseAdminClient } = await import('@/lib/auth/supabase-server');
    const { error } = await createSupabaseAdminClient()
      .storage.from('applications')
      .remove(purged.attachments);
    if (error) console.error('[purge] attachments left in storage', error);
  }

  // The rate limiter's fallback windows ride along on this job rather than
  // taking a cron slot of their own: Vercel Hobby allows exactly two, and
  // vercel.json already declares both. A day of spent windows in a two-column
  // table costs nothing, and the bucket/time index keeps live lookups off them.
  // A failure here must not fail the retention purge, which is the job that
  // actually matters.
  let rateLimitWindows = 0;
  try {
    const { sql } = await import('drizzle-orm');
    const { rowsOf } = await import('@/db/session');
    const result = await db.execute(sql`select app.purge_rate_limit_hits() as n`);
    rateLimitWindows = rowsOf<{ n: number }>(result)[0]?.n ?? 0;
  } catch (error) {
    console.error('[purge] rate-limit windows were not purged', error);
  }

  return Response.json({
    purged: purged.deleted,
    attachments: purged.attachments.length,
    rateLimitWindows,
  });
}
