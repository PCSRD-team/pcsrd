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
  NEXT_PUBLIC_SITE_URL: z.string().min(1),
  NEXT_PUBLIC_DEFAULT_LOCALE: z.enum(['ar', 'en']).default('ar'),
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: z.string().min(1),
  /** Digits only, no leading `+` — this is the `wa.me` path format. */
  NEXT_PUBLIC_WHATSAPP_NUMBER: z.string().regex(/^\d{8,15}$/),
});

export type PublicEnv = z.infer<typeof publicSchema>;

/**
 * Every key is written out literally. Next inlines `NEXT_PUBLIC_*` by matching
 * the source text `process.env.NEXT_PUBLIC_FOO`, so a computed lookup like
 * `process.env[name]` compiles to `undefined` in the browser.
 */
const source = {
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  NEXT_PUBLIC_DEFAULT_LOCALE: process.env.NEXT_PUBLIC_DEFAULT_LOCALE,
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY,
  NEXT_PUBLIC_WHATSAPP_NUMBER: process.env.NEXT_PUBLIC_WHATSAPP_NUMBER,
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
