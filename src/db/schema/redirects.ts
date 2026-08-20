import {
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
export const redirects = pgTable('redirects', {
  id: uuid().primaryKey().defaultRandom(),
  sourcePath: text().notNull().unique(),
  destinationPath: text().notNull(),
  statusCode: smallint().notNull().default(308),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

export type Redirect = typeof redirects.$inferSelect;
export type NewRedirect = typeof redirects.$inferInsert;
