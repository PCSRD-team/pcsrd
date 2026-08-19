/**
 * Test environment.
 *
 * `src/lib/env.ts` validates on import and throws when anything is missing, so
 * the values have to exist before the first module that reads them loads. These
 * are deliberately fake: a test that reaches Upstash, Resend or Cloudflare is a
 * test that fails in CI and on a plane.
 *
 * The one value that must be *valid* rather than merely present is
 * `SUBMISSION_ENC_KEY` — the crypto tests decrypt what they encrypt.
 */
const defaults: Record<string, string> = {
  DATABASE_URL: 'postgresql://test@localhost:5432/test',
  DIRECT_URL: 'postgresql://test@localhost:5432/test',
  SUPABASE_SERVICE_ROLE_KEY: 'test-service-role',
  RESEND_API_KEY: 'test-resend',
  MAIL_FROM: 'PCSRD <test@example.org>',
  MAIL_TO_GENERAL: 'general@example.org',
  MAIL_TO_PARTNERSHIP: 'partnership@example.org',
  MAIL_TO_HR: 'hr@example.org',
  MAIL_TO_SENSITIVE: 'sensitive@example.org',
  TURNSTILE_SECRET_KEY: '1x0000000000000000000000000000000AA',
  UPSTASH_REDIS_REST_URL: 'https://test.upstash.io',
  UPSTASH_REDIS_REST_TOKEN: 'test-token',
  IP_HASH_SALT: 'test-salt-that-is-long-enough-to-pass-the-32-byte-minimum',
  SUBMISSION_ENC_KEY: '00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff',
  SUBMISSION_ENC_KEY_ID: 'test',
  CRON_SECRET: 'test-cron-secret-value',
  NEXT_PUBLIC_SUPABASE_URL: 'https://test.supabase.co',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test-anon',
  NEXT_PUBLIC_SITE_URL: 'http://localhost:3000',
  NEXT_PUBLIC_DEFAULT_LOCALE: 'ar',
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: '1x00000000000000000000AA',
  NEXT_PUBLIC_WHATSAPP_NUMBER: '970000000000',
};

for (const [key, value] of Object.entries(defaults)) {
  process.env[key] ??= value;
}
