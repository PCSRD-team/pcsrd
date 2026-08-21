import { sql } from 'drizzle-orm';
import { db } from '@/db';
import { isAuthorisedCron } from '@/lib/security/cron-auth';
import { rowsOf } from '@/db/session';
import { revalidateEntity } from '@/lib/cache/revalidate';

export const dynamic = 'force-dynamic';

/**
 * Hourly. Archives expired announcements and closed vacancies, then busts their
 * caches.
 *
 * The revalidation is the entire point. Flipping the status in the database
 * without dropping the cached page leaves a closed vacancy rendering as open
 * for up to an ISR window — which is exactly the failure the `deadline` column
 * exists to prevent.
 *
 * The archiving goes through `app.archive_expired_content()`, which is
 * `SECURITY DEFINER` and was written for this and called by nothing. The two
 * plain `UPDATE`s it replaces were the only mutation in the codebase that
 * skipped `withActor`, and a cron job has no actor to bind: under
 * `posts.rt_update` / `vacancies.rt_update` (`using (app.is_staff())`) the
 * statement ran as `anon`, matched no rows and reported success. Nothing was
 * ever archived, and the response said `archivedPosts: 0` — indistinguishable
 * from "nothing had expired".
 *
 * Binding a fabricated staff actor would have worked too, and would have been
 * worse: it puts a person's role on an action no person took, in the one place
 * the database is asked to trust the application.
 */
export async function GET(request: Request) {
  if (!(await isAuthorisedCron(request))) {
    return new Response('Unauthorized', { status: 401 });
  }

  const archived = rowsOf<{ entity: 'post' | 'vacancy'; slug_ar: string; slug_en: string }>(
    await db.execute(sql`select * from app.archive_expired_content()`),
  );

  const archivedPosts = archived.filter((row) => row.entity === 'post');
  const archivedVacancies = archived.filter((row) => row.entity === 'vacancy');

  // 'stale' rather than immediate: this can drop hundreds of tags at once, and
  // a brief stale window costs less than a thundering herd of rebuilds.
  for (const row of archivedPosts) {
    revalidateEntity('post', { ar: row.slug_ar, en: row.slug_en }, 'stale');
  }
  for (const row of archivedVacancies) {
    revalidateEntity('vacancy', { ar: row.slug_ar, en: row.slug_en }, 'stale');
  }
  if (archivedPosts.length) revalidateEntity('post');
  if (archivedVacancies.length) revalidateEntity('vacancy');

  return Response.json({
    archivedPosts: archivedPosts.length,
    archivedVacancies: archivedVacancies.length,
  });
}
