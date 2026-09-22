import { index, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

/**
 * The rate limiter's fallback windows.
 *
 * Declared here because `drizzle/` owns every application table, and a table
 * present in the database but absent from this schema is drift the next
 * `drizzle-kit generate` would propose dropping.
 *
 * **Nothing in the application reads or writes it through Drizzle.** The only
 * access is `app.check_rate_limit`, which is `SECURITY DEFINER` — the public
 * form path sets no actor, and every table here is `FORCE ROW LEVEL SECURITY`,
 * so a direct insert as the runtime role is refused by policy. The runtime has
 * no grant on this table on purpose: one would let a compromised role forge or
 * clear another client's window.
 *
 * `bucket` is a limiter name joined to an **already-hashed** client id. No
 * address and no email reaches this table; see `src/lib/security/ip.ts`.
 */
export const rateLimitHits = pgTable(
  'rate_limit_hits',
  {
    bucket: text().notNull(),
    hitAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // The one access pattern is "count this bucket inside a window, then
    // insert", so the index carries both columns in that order.
    index('rate_limit_hits_bucket_time_idx').on(t.bucket, t.hitAt.desc()),
  ],
);
