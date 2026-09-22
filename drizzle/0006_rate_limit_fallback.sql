-- A rate limiter that survives its own backend going away.
--
-- The primary limiter is Upstash. On 2026-09-19 the free-tier database was
-- reclaimed and its host began returning NXDOMAIN; `checkRateLimit` had no
-- `try/catch`, so the fetch error propagated out of `submit()` and every one
-- of the six public forms answered "Something went wrong" — the confidential
-- safeguarding complaints channel included. Nothing paged anyone, because the
-- throw was caught by `runAction` and never reached Sentry.
--
-- This is the second wall. When Upstash is unreachable the limiter falls back
-- here instead of failing the request, so an anti-abuse outage degrades the
-- limiter rather than taking down the forms.
--
-- Why a SECURITY DEFINER function and not a plain insert: the public form path
-- deliberately does not set an actor (`anon` is the correct identity for a
-- visitor), so every table in this database refuses it under FORCE ROW LEVEL
-- SECURITY. `app.submit_form()` solves the same problem the same way, for the
-- same reason.

create table if not exists public.rate_limit_hits (
  -- The limiter name and the already-hashed client id, joined. The caller
  -- hashes; this table never sees an address. See src/lib/security/ip.ts.
  bucket text not null,
  hit_at timestamptz not null default now()
);
--> statement-breakpoint

-- The only access pattern is "count this bucket's rows inside a window, then
-- insert one", so the index carries both columns in that order.
create index if not exists rate_limit_hits_bucket_time_idx
  on public.rate_limit_hits (bucket, hit_at desc);
--> statement-breakpoint

alter table public.rate_limit_hits enable row level security;
--> statement-breakpoint
alter table public.rate_limit_hits force row level security;
--> statement-breakpoint

-- No policy for the runtime role, on purpose. Nothing reads or writes this
-- table except the function below, which is SECURITY DEFINER and runs as the
-- owner. A grant here would let a compromised runtime role forge or clear
-- another client's window.
drop policy if exists rate_limit_hits_owner_all on public.rate_limit_hits;
--> statement-breakpoint
create policy rate_limit_hits_owner_all on public.rate_limit_hits
  for all to postgres using (true) with check (true);
--> statement-breakpoint

/*
 * Returns true when the caller is INSIDE its allowance, false when it has
 * exhausted it — the same polarity as `Ratelimit.limit().success`, so the two
 * backends are interchangeable at the call site.
 *
 * The count and the insert run in one statement so two concurrent requests
 * cannot both read "4 of 5" and both write. A sliding window, matching
 * Upstash's `slidingWindow`, not a fixed one: a fixed window lets a client
 * spend its whole allowance twice across a boundary.
 */
create or replace function app.check_rate_limit(
  p_bucket text,
  p_limit integer,
  p_window interval
)
returns boolean
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_used integer;
begin
  if p_bucket is null or p_bucket = '' or p_limit <= 0 then
    return false;
  end if;

  with counted as (
    select count(*) as n
    from public.rate_limit_hits
    where bucket = p_bucket
      and hit_at > now() - p_window
  ),
  inserted as (
    insert into public.rate_limit_hits (bucket)
    select p_bucket from counted where counted.n < p_limit
    returning 1
  )
  select counted.n into v_used from counted;

  return v_used < p_limit;
end;
$function$;
--> statement-breakpoint

revoke all on function app.check_rate_limit(text, integer, interval) from public;
--> statement-breakpoint
grant execute on function app.check_rate_limit(text, integer, interval) to app_runtime;
--> statement-breakpoint

/*
 * Drops windows that can no longer affect any decision.
 *
 * Called from the daily purge cron rather than getting an hourly job of its
 * own: Vercel Hobby allows exactly two cron jobs and `vercel.json` already
 * declares both. A day of dead rows in a table this narrow costs nothing, and
 * the partial index keeps the live lookups off them either way.
 */
create or replace function app.purge_rate_limit_hits(p_older_than interval default '2 hours')
returns integer
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_deleted integer;
begin
  delete from public.rate_limit_hits where hit_at < now() - p_older_than;
  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$function$;
--> statement-breakpoint

revoke all on function app.purge_rate_limit_hits(interval) from public;
--> statement-breakpoint
grant execute on function app.purge_rate_limit_hits(interval) to app_runtime;
