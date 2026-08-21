import { config } from 'dotenv';

/**
 * Loads `.env.local` before anything else can read `process.env`.
 *
 * This exists as its own module because ES module imports are **hoisted**: a
 * `config()` call in the body of a script runs after every import in that
 * script has already been evaluated, so `src/lib/env.ts` would have thrown on
 * missing variables before the file was even read. Importing this first makes
 * the load part of the module graph rather than part of the script body.
 */
config({ path: '.env', quiet: true });
config({ path: '.env.local', override: true, quiet: true });
