import { sql } from 'drizzle-orm';
import { db } from '@/db';

/** Uptime probe. Must never be cached or it stops probing anything. */
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await db.execute(sql`select 1`);
    return Response.json({ status: 'ok', ts: new Date().toISOString() });
  } catch {
    // The error is deliberately not returned: a health endpoint is public, and
    // a connection error message names the host and the user.
    return Response.json({ status: 'degraded' }, { status: 503 });
  }
}
