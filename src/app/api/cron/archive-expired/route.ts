import { and, eq, lt, sql } from 'drizzle-orm';
import { db } from '@/db';
import { posts, vacancies } from '@/db/schema';
import { revalidateEntity } from '@/lib/cache/revalidate';
import { serverEnv } from '@/lib/env';

export const dynamic = 'force-dynamic';

/**
 * Hourly. Archives expired announcements and closed vacancies, then busts their
 * caches.
 *
 * The revalidation is the entire point. Flipping the status in the database
 * without dropping the cached page leaves a closed vacancy rendering as open
 * for up to an ISR window — which is exactly the failure the `deadline` column
 * exists to prevent.
 */
export async function GET(request: Request) {
  if (request.headers.get('authorization') !== `Bearer ${serverEnv.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  const archivedPosts = await db
    .update(posts)
    .set({ status: 'archived' })
    .where(
      and(
        eq(posts.category, 'announcement'),
        eq(posts.status, 'published'),
        lt(posts.expiresAt, new Date()),
      ),
    )
    .returning({ slugAr: posts.slugAr, slugEn: posts.slugEn });

  const archivedVacancies = await db
    .update(vacancies)
    .set({ status: 'archived' })
    .where(and(eq(vacancies.status, 'published'), lt(vacancies.deadline, sql`current_date`)))
    .returning({ slugAr: vacancies.slugAr, slugEn: vacancies.slugEn });

  // 'stale' rather than immediate: this can drop hundreds of tags at once, and
  // a brief stale window costs less than a thundering herd of rebuilds.
  for (const row of archivedPosts) {
    revalidateEntity('post', { ar: row.slugAr, en: row.slugEn }, 'stale');
  }
  for (const row of archivedVacancies) {
    revalidateEntity('vacancy', { ar: row.slugAr, en: row.slugEn }, 'stale');
  }
  if (archivedPosts.length) revalidateEntity('post');
  if (archivedVacancies.length) revalidateEntity('vacancy');

  return Response.json({
    archivedPosts: archivedPosts.length,
    archivedVacancies: archivedVacancies.length,
  });
}
