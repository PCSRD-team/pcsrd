import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { serverEnv } from '@/lib/env';

/**
 * Sliding-window limits per client (02-API §5.1).
 *
 *   form    5 / hour   every public form except the one with a file
 *   upload  3 / hour   the job application (it writes to storage)
 *   global 30 / hour   everything a single client may do
 *   login   8 / hour   an admin sign-in attempt
 *
 * Created lazily. Building the Redis client at module load would make every
 * import of this file — including from a unit test that never rate-limits —
 * require `UPSTASH_*` to be present.
 *
 * The id a caller passes should already be opaque — `hashIp(ip)`, not the
 * address itself — so the window key written to Upstash carries nothing a
 * third party could correlate with a person. The limiter does not hash on the
 * caller's behalf because the same function also keys on actor ids.
 *
 * ## Why there are two backends
 *
 * On 2026-09-19 the free-tier Upstash database was reclaimed and its host began
 * returning NXDOMAIN. `cached[key].limit(id)` had no `try/catch`, so the fetch
 * error propagated out of `submit()`, was caught by `runAction` as an
 * unexpected throw, and every one of the six public forms started answering
 * "Something went wrong" — the confidential safeguarding complaints channel
 * included. Nothing paged anyone: `runAction` swallows the throw, and
 * `instrumentation.ts` only reports errors that escape a request.
 *
 * A limiter whose own outage takes down the forms it protects is worse than no
 * limiter. So an unreachable Upstash now falls through to `app.check_rate_limit`
 * in Postgres, which the site cannot be up without anyway, and the failure is
 * reported rather than absorbed.
 */

export type LimiterKey = 'form' | 'upload' | 'global' | 'login';

export type RateLimitResult = { success: boolean; retryAfterSeconds: number };

type Limiters = Record<LimiterKey, Ratelimit>;

/** Allowance per window, shared by both backends so they cannot drift. */
const LIMITS: Record<LimiterKey, { limit: number; windowSeconds: number }> = {
  form: { limit: 5, windowSeconds: 3600 },
  upload: { limit: 3, windowSeconds: 3600 },
  global: { limit: 30, windowSeconds: 3600 },
  login: { limit: 8, windowSeconds: 3600 },
};

/**
 * `null` means "no limiter" — permitted in development only, so a developer
 * without an Upstash database can still exercise the forms. In production and
 * under test the absence is an error: a rate limiter that silently vanishes
 * when its config is missing is the kind of failure nobody notices until the
 * inbox is full.
 */
let cached: Limiters | null | undefined;

function build(): Limiters | null {
  const url = serverEnv.UPSTASH_REDIS_REST_URL;
  const token = serverEnv.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    if (serverEnv.NODE_ENV !== 'development') {
      throw new Error(
        'UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are required outside development.',
      );
    }
    console.warn(
      '[rate-limit] UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN are unset; ' +
        'rate limiting is DISABLED for this development process.',
    );
    return null;
  }

  const redis = new Redis({ url, token });
  const make = (key: LimiterKey) =>
    new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(LIMITS[key].limit, `${LIMITS[key].windowSeconds} s`),
      prefix: `rl:${key}`,
      analytics: false,
      // Without this, a host that hangs rather than refusing holds every form
      // request open until the platform kills the function. The fallback below
      // is only reachable if the attempt actually ends.
      timeout: 2_000,
    });

  return { form: make('form'), upload: make('upload'), global: make('global'), login: make('login') };
}

/**
 * The second wall: a sliding window in the database the site already depends on.
 *
 * `app.check_rate_limit` is `SECURITY DEFINER` because the public form path
 * deliberately sets no actor — `anon` is the right identity for a visitor, and
 * every table here is `FORCE ROW LEVEL SECURITY`. Same shape, same reason, as
 * `app.submit_form`.
 *
 * Returns `null` when the database cannot answer either. That is not "allow":
 * the caller decides, and it decides differently for a safeguarding channel
 * than for a partnership enquiry.
 */
async function checkInDatabase(key: LimiterKey, id: string): Promise<boolean | null> {
  try {
    // Imported at the point of use, not at module load. The Redis client is
    // lazy for the same reason: importing this file from a unit test that
    // never rate-limits must not open a database connection.
    const [{ sql }, { db }, { rowsOf }] = await Promise.all([
      import('drizzle-orm'),
      import('@/db'),
      import('@/db/session'),
    ]);
    const result = await db.execute(
      sql`select app.check_rate_limit(${`rl:${key}:${id}`}, ${LIMITS[key].limit}, make_interval(secs => ${LIMITS[key].windowSeconds})) as ok`,
    );
    const [row] = rowsOf<{ ok: boolean | null }>(result);
    return row?.ok ?? null;
  } catch (error) {
    console.error('[rate-limit] the database fallback failed too', error);
    return null;
  }
}

/**
 * Reported once per process, not once per request — an outage is one event.
 *
 * Never awaited by the request path. A slow or hanging Sentry transport must
 * not be the thing that makes a form submission time out; the whole point of
 * this branch is that the visitor gets an answer when the backend does not.
 */
let outageReported = false;

function reportOutage(error: unknown): void {
  console.error('[rate-limit] Upstash is unreachable; falling back to the database', error);
  if (outageReported) return;
  outageReported = true;
  void (async () => {
    try {
      const Sentry = await import('@sentry/nextjs');
      Sentry.captureException(error, {
        level: 'error',
        tags: { area: 'rate-limit', backend: 'upstash' },
        extra: {
          why: 'Anti-abuse backend unreachable. The database fallback is now carrying every public form and the admin sign-in.',
        },
      });
    } catch {
      // Sentry is inert without a DSN and must never be the reason a form fails.
    }
  })();
}

/**
 * `degraded` says the primary backend did not answer. The caller uses it to
 * decide policy — a safeguarding disclosure and a partnership enquiry do not
 * deserve the same treatment when anti-abuse is down.
 */
export type RateLimitOutcome = RateLimitResult & { degraded: boolean };

export async function checkRateLimit(key: LimiterKey, id: string): Promise<RateLimitOutcome> {
  if (cached === undefined) cached = build();
  if (cached === null) return { success: true, retryAfterSeconds: 0, degraded: false };

  try {
    const { success, reset } = await cached[key].limit(id);
    return {
      success,
      retryAfterSeconds: Math.max(0, Math.ceil((reset - Date.now()) / 1000)),
      degraded: false,
    };
  } catch (error) {
    reportOutage(error);
    const ok = await checkInDatabase(key, id);
    // Neither backend answered. Refuse, and say the limiter is degraded so the
    // caller can override for a channel that must survive an outage.
    if (ok === null) return { success: false, retryAfterSeconds: 60, degraded: true };
    return { success: ok, retryAfterSeconds: ok ? 0 : LIMITS[key].windowSeconds, degraded: true };
  }
}
