import { beforeEach, describe, expect, it } from 'vitest';
import { useTestDb } from '../setup/pglite';

/**
 * `app.check_rate_limit` is the second wall behind Upstash.
 *
 * It exists because the limiter had no `try/catch`: when the Upstash host
 * started returning NXDOMAIN, the fetch error propagated out of `submit()` and
 * all six public forms — the confidential complaints channel included — began
 * answering "Something went wrong". A limiter whose outage takes down the
 * forms it protects is not a limiter.
 *
 * These run against real Postgres 17 (PGlite) with this repository's own
 * migrations applied, so the SQL itself is under test and not a description of
 * it. Note PGlite connects as `postgres`, so this exercises the function's
 * logic; that it is reachable *as `app_runtime`* is what the grant in the
 * migration is for and what `scripts/assert-rls.ts` checks against the real
 * database.
 */

const getDb = useTestDb();

async function check(bucket: string, limit: number, window = '1 hour'): Promise<boolean> {
  const result = await getDb().execute(
    `select app.check_rate_limit('${bucket}', ${limit}, interval '${window}') as ok`,
  );
  return (result.rows as { ok: boolean }[])[0]!.ok;
}

async function hitCount(bucket: string): Promise<number> {
  const result = await getDb().execute(
    `select count(*)::int as n from public.rate_limit_hits where bucket = '${bucket}'`,
  );
  return (result.rows as { n: number }[])[0]!.n;
}

beforeEach(async () => {
  await getDb().execute('truncate table public.rate_limit_hits');
});

describe('app.check_rate_limit', () => {
  it('permits exactly the allowance, then refuses', async () => {
    const bucket = 'rl:form:aaa';
    for (let i = 1; i <= 5; i += 1) {
      expect(await check(bucket, 5), `call ${i} of 5 should be inside the allowance`).toBe(true);
    }
    expect(await check(bucket, 5)).toBe(false);
  });

  it('does not record a hit for a call it refused', async () => {
    const bucket = 'rl:form:bbb';
    for (let i = 0; i < 3; i += 1) await check(bucket, 3);
    expect(await hitCount(bucket)).toBe(3);

    await check(bucket, 3);
    await check(bucket, 3);

    // A refused call that still wrote would extend its own lockout every time
    // the client retried — the window would never drain.
    expect(await hitCount(bucket)).toBe(3);
  });

  it('keeps buckets independent, so one client cannot exhaust another', async () => {
    for (let i = 0; i < 5; i += 1) await check('rl:form:ccc', 5);
    expect(await check('rl:form:ccc', 5)).toBe(false);
    expect(await check('rl:form:ddd', 5)).toBe(true);
  });

  it('slides: a hit outside the window no longer counts', async () => {
    const bucket = 'rl:form:eee';
    for (let i = 0; i < 5; i += 1) await check(bucket, 5);
    expect(await check(bucket, 5)).toBe(false);

    // Age the existing hits past the window rather than waiting an hour.
    await getDb().execute(
      `update public.rate_limit_hits set hit_at = now() - interval '2 hours' where bucket = '${bucket}'`,
    );
    expect(await check(bucket, 5)).toBe(true);
  });

  it('refuses a blank bucket rather than letting every such caller share one', async () => {
    expect(await check('', 5)).toBe(false);
  });

  it('refuses a non-positive limit instead of treating it as unlimited', async () => {
    expect(await check('rl:form:fff', 0)).toBe(false);
    expect(await check('rl:form:fff', -1)).toBe(false);
  });
});

describe('app.purge_rate_limit_hits', () => {
  it('drops only what can no longer affect a decision', async () => {
    await check('rl:form:ggg', 5);
    await getDb().execute(
      `insert into public.rate_limit_hits (bucket, hit_at) values ('rl:form:old', now() - interval '3 hours')`,
    );

    const purged = await getDb().execute(`select app.purge_rate_limit_hits() as n`);
    expect((purged.rows as { n: number }[])[0]!.n).toBe(1);

    expect(await hitCount('rl:form:old')).toBe(0);
    expect(await hitCount('rl:form:ggg')).toBe(1);
  });
});
