import 'server-only';
import { z } from 'zod';

/**
 * Validated environment. Importing this module throws with a readable list of
 * what is missing, instead of letting `process.env.X!` fail later as an opaque
 * `undefined` inside a Postgres driver or a fetch call.
 *
 * `SKIP_ENV_VALIDATION=1` bypasses the check so `next build` succeeds in CI,
 * which has no secrets. It must never be set in a running environment.
 */

const serverSchema = z.object({
  // Database — 00-ARCHITECTURE §0.7
  DATABASE_URL: z.string().min(1),
  DIRECT_URL: z.string().min(1),

  // Supabase — auth + storage only
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),

  // Email
  RESEND_API_KEY: z.string().min(1),
  MAIL_FROM: z.string().min(1),
  MAIL_TO_GENERAL: z.string().min(1),
  MAIL_TO_PARTNERSHIP: z.string().min(1),
  MAIL_TO_HR: z.string().min(1),
  MAIL_TO_SENSITIVE: z.string().min(1),

  // Anti-abuse
  TURNSTILE_SECRET_KEY: z.string().min(1),
  UPSTASH_REDIS_REST_URL: z.string().min(1),
  UPSTASH_REDIS_REST_TOKEN: z.string().min(1),

  // Privacy — RULE 9. A short salt is a broken salt, so the length is checked.
  IP_HASH_SALT: z.string().min(32),

  // Ops
  CRON_SECRET: z.string().min(16),
  SENTRY_DSN: z.string().optional(),

  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
});

const publicSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().min(1),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  NEXT_PUBLIC_SITE_URL: z.string().min(1),
  NEXT_PUBLIC_DEFAULT_LOCALE: z.enum(['ar', 'en']).default('ar'),
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: z.string().min(1),
  NEXT_PUBLIC_WHATSAPP_NUMBER: z.string().regex(/^\d{8,15}$/),
});

type ServerEnv = z.infer<typeof serverSchema>;
type PublicEnv = z.infer<typeof publicSchema>;

const skip = process.env.SKIP_ENV_VALIDATION === '1';

function parse<T extends z.ZodType>(schema: T, source: unknown, label: string): z.infer<T> {
  if (skip) return source as z.infer<T>;
  const result = schema.safeParse(source);
  if (!result.success) {
    const lines = result.error.issues
      .map((issue) => `  ${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('\n');
    throw new Error(
      `Invalid ${label} environment variables:\n${lines}\n\n` +
        `Copy .env.example to .env.local and fill it in.`,
    );
  }
  return result.data;
}

/**
 * NEXT_PUBLIC_* must be referenced statically — Next inlines them at build
 * time by literal text match, so `process.env[name]` would produce undefined
 * in the browser bundle.
 */
export const publicEnv: PublicEnv = parse(
  publicSchema,
  {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
    NEXT_PUBLIC_DEFAULT_LOCALE: process.env.NEXT_PUBLIC_DEFAULT_LOCALE,
    NEXT_PUBLIC_TURNSTILE_SITE_KEY: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY,
    NEXT_PUBLIC_WHATSAPP_NUMBER: process.env.NEXT_PUBLIC_WHATSAPP_NUMBER,
  },
  'public',
);

export const serverEnv: ServerEnv = parse(serverSchema, process.env, 'server');
