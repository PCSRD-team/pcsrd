import { sql } from 'drizzle-orm';
import {
  check,
  pgTable,
  smallint,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

/**
 * Legacy-path redirects, read at **build time** by `next.config.ts`
 * `redirects()`. Deliberately not consulted at request time: a database call in
 * the proxy would put a network round trip in front of every navigation.
 */
export const redirects = pgTable(
  'redirects',
  {
    id: uuid().primaryKey().defaultRandom(),
    sourcePath: text().notNull().unique('redirects_source_path_key'),
    destinationPath: text().notNull(),
    /** 301 | 302 | 307 | 308 — the `redirects_status_code` CHECK. */
    statusCode: smallint().notNull().default(308),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // Both paths are site-absolute: a bare `foo` would be a relative redirect
    // whose meaning depends on where it was hit.
    check(
      'redirects_absolute',
      sql`${t.sourcePath} like '/%' and ${t.destinationPath} like '/%'`,
    ),
    check('redirects_no_loop', sql`${t.sourcePath} <> ${t.destinationPath}`),
    check('redirects_status_code', sql`${t.statusCode} in (301, 302, 307, 308)`),
  ],
);

export type Redirect = typeof redirects.$inferSelect;
export type NewRedirect = typeof redirects.$inferInsert;
