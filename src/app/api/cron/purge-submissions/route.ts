import { db } from '@/db';
import { serverEnv } from '@/lib/env';
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
  if (request.headers.get('authorization') !== `Bearer ${serverEnv.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  const purged = await purgeExpiredSubmissions(db);
  return Response.json({ purged });
}
