import { db } from '@/db';
import { isAuthorisedCron } from '@/lib/security/cron-auth';
import { purgeExpiredApplications } from '@/services/applications/application.service';
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

  // Each purge is caught on its own. They are two independent deletes, and a
  // failure in the second used to throw past the storage removal below —
  // after the first had already committed its delete and handed back its
  // paths. Those rows were gone and nothing would ever find their files
  // again. Whatever either purge returned is removed, whatever the other did.
  const failures: string[] = [];

  let purged: Awaited<ReturnType<typeof purgeExpiredSubmissions>> = { deleted: 0, attachments: [] };
  try {
    purged = await purgeExpiredSubmissions(db);
  } catch (error) {
    failures.push('submissions');
    console.error('[purge] submission purge failed', error);
  }

  // The careers portal has its own retention, set per form rather than per
  // type, so it has its own purge function — and it rides this job rather than
  // taking a cron slot of its own, because Vercel Hobby allows exactly two and
  // `vercel.json` already declares both.
  //
  // Sequential, not `Promise.all`: both call SECURITY DEFINER functions that
  // take row locks, and the pool is `max: 1`. Running them concurrently on one
  // connection buys nothing and risks the second waiting on a transaction the
  // same connection is holding.
  let purgedApplications: Awaited<ReturnType<typeof purgeExpiredApplications>> = {
    deleted: 0,
    attachments: [],
  };
  try {
    purgedApplications = await purgeExpiredApplications(db);
  } catch (error) {
    failures.push('applications');
    console.error('[purge] application purge failed', error);
  }

  // The rows are gone; the files must go with them. A retention policy that
  // deletes the record and keeps the CV has deleted the index, not the data.
  //
  // A failure is logged **with the paths**: their rows no longer exist, so
  // the log line is the only record left of what must be removed by hand.
  // A path is `<prefix>/<field key>/<uuid>.<ext>` — no name, no filename,
  // nothing about the person — which is why it may be logged at all.
  const attachments = [...purged.attachments, ...purgedApplications.attachments];
  if (attachments.length) {
    try {
      const { createSupabaseAdminClient } = await import('@/lib/auth/supabase-server');
      const { error } = await createSupabaseAdminClient()
        .storage.from('applications')
        .remove(attachments);
      if (error) throw error;
    } catch (error) {
      failures.push('storage');
      console.error('[purge] attachments left in storage', { paths: attachments, error });
    }
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

  return Response.json(
    {
      purged: purged.deleted,
      purgedApplications: purgedApplications.deleted,
      attachments: attachments.length,
      rateLimitWindows,
      failures,
    },
    // A partial failure is not a success: the cron dashboard should show it.
    { status: failures.length ? 500 : 200 },
  );
}

