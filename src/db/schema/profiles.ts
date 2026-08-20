import { sql } from 'drizzle-orm';
import {
  boolean,
  index,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { userRole } from './enums';

/**
 * Admin users. `id` mirrors `auth.users.id` — the FK is declared in the
 * Supabase-owned migration, not here, because `auth` is not a Drizzle schema
 * (00-ARCHITECTURE §0.6). Drizzle sees a plain uuid primary key.
 */
export const profiles = pgTable(
  'profiles',
  {
    id: uuid().primaryKey(),
    email: text().notNull().unique(),
    fullName: text().notNull(),
    role: userRole().notNull().default('editor'),

    /**
     * Deliberately NOT derived from `role`. Access to confidential complaints
     * is granted per person by the organisation's policy, and an admin is not
     * automatically on that list (01-DATABASE §4.1).
     */
    canViewSensitive: boolean().notNull().default(false),

    isActive: boolean().notNull().default(true),
    lastLoginAt: timestamp({ withTimezone: true }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('profiles_role_idx').on(t.role).where(sql`${t.isActive}`)],
);

export type Profile = typeof profiles.$inferSelect;
export type NewProfile = typeof profiles.$inferInsert;
