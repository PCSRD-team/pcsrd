import { z } from 'zod';

/**
 * Server environment. Importing this module throws with a readable list of what
 * is missing, instead of letting `process.env.X!` fail later as an opaque
 * `undefined` inside a Postgres driver or a fetch call.
 *
 * **Why not `import 'server-only'`.** That package resolves to a throwing
 * module under every condition except `react-server` — including plain Node.
 * It would therefore break `tsx scripts/seed.ts`, every Vitest run and
 * `drizzle-kit`, all of which legitimately need these values. The browser guard
 * below is the part that actually matters, and it costs nothing off the server.
 *
 * `SKIP_ENV_VALIDATION=1` bypasses the check so `next build` succeeds in CI,
 * which has no secrets. It must never be set in a running environment.
 */

if (typeof window !== 'undefined') {
  throw new Error(
    'src/lib/env.ts was imported in the browser. Server secrets must never ' +
      'reach a client bundle — import src/lib/env.public.ts instead.',
  );
}

const serverSchema = z.object({
  // ── Database (00-ARCHITECTURE §0.7) ──────────────────────────────────
  /** Supavisor transaction mode, :6543. Requires `prepare: false`. */
  DATABASE_URL: z.string().min(1),
  /** Supavisor session mode, :5432. DDL only. */
  DIRECT_URL: z.string().min(1),

  // ── Supabase (auth + storage only — never data access) ───────────────
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),

  // ── Email ────────────────────────────────────────────────────────────
  RESEND_API_KEY: z.string().min(1),
  MAIL_FROM: z.string().min(1),
  MAIL_TO_GENERAL: z.string().min(1),
  MAIL_TO_PARTNERSHIP: z.string().min(1),
  MAIL_TO_HR: z.string().min(1),
  MAIL_TO_SENSITIVE: z.string().min(1),

  // ── Anti-abuse ───────────────────────────────────────────────────────
  TURNSTILE_SECRET_KEY: z.string().min(1),
  UPSTASH_REDIS_REST_URL: z.string().min(1),
  UPSTASH_REDIS_REST_TOKEN: z.string().min(1),

  // ── Privacy ──────────────────────────────────────────────────────────
  /** A short salt is a broken salt, so the length is checked, not just presence. */
  IP_HASH_SALT: z.string().min(32),
  /**
   * 32 bytes, hex-encoded, for AES-256-GCM of sensitive submission payloads.
   * `form_submissions.payload_encrypted` exists precisely so a database dump of
   * a complaint reveals nothing on its own.
   */
  SUBMISSION_ENC_KEY: z.string().regex(/^[0-9a-f]{64}$/i),
  /** Names the key that produced a ciphertext, so keys can be rotated. */
  SUBMISSION_ENC_KEY_ID: z.string().min(1).default('k1'),

  // ── Ops ──────────────────────────────────────────────────────────────
  CRON_SECRET: z.string().min(16),
  SENTRY_DSN: z.string().optional(),

  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
});

export type ServerEnv = z.infer<typeof serverSchema>;

function parseServer(): ServerEnv {
  if (process.env.SKIP_ENV_VALIDATION === '1') {
    return process.env as unknown as ServerEnv;
  }
  const result = serverSchema.safeParse(process.env);
  if (!result.success) {
    const lines = result.error.issues
      .map((issue) => `  ${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('\n');
    throw new Error(
      `Invalid server environment variables:\n${lines}\n\n` +
        `Copy .env.example to .env.local and fill it in.`,
    );
  }
  return result.data;
}

export const serverEnv: ServerEnv = parseServer();

export { publicEnv, type PublicEnv } from './env.public';
