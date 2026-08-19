// `drizzle-kit` is a standalone binary. It does not inherit Next's env loading,
// so the .env files have to be read explicitly here — this single missing line
// is the most common cause of "DIRECT_URL is undefined".
import 'dotenv/config';
import { config as loadEnv } from 'dotenv';
import { defineConfig } from 'drizzle-kit';

loadEnv({ path: '.env.local', override: true, quiet: true });

export default defineConfig({
  schema: './src/db/schema/index.ts',
  out: './drizzle',
  dialect: 'postgresql',
  // :5432 session mode. The transaction pooler cannot run session-level DDL.
  dbCredentials: { url: process.env.DIRECT_URL! },
  casing: 'snake_case',
  verbose: true,
  strict: true,
});
