// `drizzle-kit` is a standalone binary. It does not inherit Next's env loading,
// so the .env files have to be read explicitly here — this single missing line
// is the most common cause of "DIRECT_URL is undefined".
import 'dotenv/config';
import { config as loadEnv } from 'dotenv';
import { defineConfig } from 'drizzle-kit';

loadEnv({ path: '.env.local', override: true, quiet: true });

// A `!` here turns a missing variable into `undefined` travelling into
// drizzle-kit, which fails much later with a connection error that names
// neither the variable nor this file. Say it once, here, in words.
const directUrl = process.env.DIRECT_URL;
if (!directUrl) {
  throw new Error(
    'DIRECT_URL is not set. drizzle-kit needs the owner connection on :5432 — ' +
      'check .env.local, and note that DATABASE_URL (the :6543 pooler) is not a substitute.',
  );
}

export default defineConfig({
  schema: './src/db/schema/index.ts',
  out: './drizzle',
  dialect: 'postgresql',
  // :5432 session mode. The transaction pooler cannot run session-level DDL.
  dbCredentials: { url: directUrl },
  casing: 'snake_case',
  verbose: true,
  strict: true,
});
