import { z } from 'zod';

/**
 * Public environment — safe in a browser bundle.
 *
 * Kept in its own module so `env.ts` can refuse to load in the browser without
 * also blocking the Turnstile widget and the WhatsApp link, which are Client
 * Components and legitimately need these values.
 */

const publicSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().min(1),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  /**
   * The public origin every canonical, hreflang, sitemap and JSON-LD URL is
   * built from. Validated as a URL — a value like `example.org` (no scheme)
   * used to pass `min(1)` and then throw inside `new URL()` in the metadata
   * builder on every page — and normalised without its trailing slash, so
   * `${SITE}/ar` never becomes `//ar`.
   */
  NEXT_PUBLIC_SITE_URL: z
    .string()
    .url()
    .transform((value) => value.replace(/\/+$/, '')),
  NEXT_PUBLIC_DEFAULT_LOCALE: z.enum(['ar', 'en']).default('ar'),
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: z.string().min(1),
  /** Digits only, no leading `+` — this is the `wa.me` path format. */
  NEXT_PUBLIC_WHATSAPP_NUMBER: z.string().regex(/^\d{8,15}$/),
  /**
   * The browser SDK's DSN. Optional: unset means the client SDK never
   * initialises and the CSP names no ingest origin. A DSN is not a secret —
   * it is a public write-only key — but its shape is checked so a typo cannot
   * become a `connect-src` entry. An empty string is normalised to unset in
   * `source` below, so a copied `.env.example` with the line blank is fine.
   */
  NEXT_PUBLIC_SENTRY_DSN: z
    .string()
    .regex(/^https:\/\/\S+$/)
    .optional(),
});

export type PublicEnv = z.infer<typeof publicSchema>;

/**
 * Vercel sets `VERCEL_PROJECT_PRODUCTION_URL` (a bare host, no scheme) on
 * every deployment, and exposes it to the browser bundle as
 * `NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL` for Next.js projects. It is the
 * fallback when `NEXT_PUBLIC_SITE_URL` is unset, so a forgotten variable
 * still produces absolute URLs on the project's real domain instead of
 * failing validation. Both names are written literally for the same inlining
 * reason as `source` below.
 */
function vercelProductionUrl(): string | undefined {
  const host =
    process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL;
  return host ? `https://${host}` : undefined;
}

/**
 * Every key is written out literally. Next inlines `NEXT_PUBLIC_*` by matching
 * the source text `process.env.NEXT_PUBLIC_FOO`, so a computed lookup like
 * `process.env[name]` compiles to `undefined` in the browser.
 */
const source = {
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL || vercelProductionUrl(),
  NEXT_PUBLIC_DEFAULT_LOCALE: process.env.NEXT_PUBLIC_DEFAULT_LOCALE,
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY,
  NEXT_PUBLIC_WHATSAPP_NUMBER: process.env.NEXT_PUBLIC_WHATSAPP_NUMBER,
  NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN || undefined,
};

function parsePublic(): PublicEnv {
  if (process.env.SKIP_ENV_VALIDATION === '1') return source as unknown as PublicEnv;
  const result = publicSchema.safeParse(source);
  if (!result.success) {
    const lines = result.error.issues
      .map((issue) => `  ${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('\n');
    throw new Error(
      `Invalid public environment variables:\n${lines}\n\n` +
        `Copy .env.example to .env.local and fill it in.`,
    );
  }
  return result.data;
}

export const publicEnv: PublicEnv = parsePublic();
