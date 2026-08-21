import 'dotenv/config';
import postgres from 'postgres';

/**
 * Asserts that the live database still carries its authorisation layer.
 *
 * CI has been invoking this file since the pipeline was written. It did not
 * exist, so `db-verify` failed on every push to `main` — and a permanently red
 * pipeline is a pipeline nobody reads.
 *
 * What it checks is also not what the old step described. `01-DATABASE §6` says
 * "RLS on, **NO POLICIES**. Intentional." `CLAUDE.md` records that as out of
 * date: the live database carries a full authorisation layer — a non-superuser
 * login role, forced RLS on every table, ~85 policies and a set of `app.*` gate
 * functions. Asserting zero policies would fail against a correct database and
 * pass against one whose policies had all been dropped, which is the exact
 * inversion of a security check.
 *
 * The five assertions below are the properties that, if any one of them
 * silently changed, would leave the site working and the second line of defence
 * gone.
 *
 * Read-only. It opens a connection, runs six `select`s and exits.
 *
 * Uses `DIRECT_URL` (:5432) rather than `DATABASE_URL`: reading `pg_roles` and
 * `pg_class` needs the owner, and this is a CI check rather than request-path
 * code.
 */

const url = process.env.DIRECT_URL;
if (!url) {
  console.error('DIRECT_URL is not set. This check needs the owner connection.');
  process.exit(1);
}

const sql = postgres(url, { max: 1, prepare: false, idle_timeout: 5 });

const failures: string[] = [];
const pass = (message: string) => console.log(`  ok    ${message}`);
const fail = (message: string) => {
  console.error(`  FAIL  ${message}`);
  failures.push(message);
};

try {
  // 1. The runtime role must not be able to bypass what follows.
  //
  // This is the assertion that matters most and is the easiest to lose: if
  // `DATABASE_URL` is ever pointed at `postgres`, which has BYPASSRLS, the site
  // keeps working, every page renders, every test passes, and all 85 policies
  // stop applying. A configuration that fails open and looks healthy.
  const [runtime] = await sql<{ rolbypassrls: boolean; rolsuper: boolean }[]>`
    select rolbypassrls, rolsuper from pg_roles where rolname = 'app_runtime'
  `;
  if (!runtime) fail('the app_runtime role does not exist');
  else if (runtime.rolbypassrls) fail('app_runtime has BYPASSRLS — every policy is inert');
  else if (runtime.rolsuper) fail('app_runtime is a superuser — every policy is inert');
  else pass('app_runtime exists with neither BYPASSRLS nor SUPERUSER');

  // 2. Forced, not merely enabled. `ENABLE ROW LEVEL SECURITY` alone exempts
  //    the table owner, and the owner is who migrations and seeds run as.
  const unforced = await sql<{ relname: string }[]>`
    select relname from pg_class
    where relnamespace = 'public'::regnamespace
      and relkind = 'r'
      and not relforcerowsecurity
    order by relname
  `;
  if (unforced.length) fail(`FORCE ROW LEVEL SECURITY missing on: ${unforced.map((r) => r.relname).join(', ')}`);
  else pass('FORCE ROW LEVEL SECURITY on every table in public');

  // 3. Policies exist. A table with forced RLS and no policy denies everything,
  //    which is safe but is also indistinguishable from a broken deployment —
  //    and a table whose policies were dropped would otherwise pass check 2.
  const unpolicied = await sql<{ relname: string }[]>`
    select c.relname from pg_class c
    where c.relnamespace = 'public'::regnamespace
      and c.relkind = 'r'
      and not exists (
        select 1 from pg_policies p
        where p.schemaname = 'public' and p.tablename = c.relname
      )
    order by c.relname
  `;
  if (unpolicied.length) fail(`no policies at all on: ${unpolicied.map((r) => r.relname).join(', ')}`);
  else pass('every table in public carries at least one policy');

  // 4. The gate functions the policies call. A dropped or renamed one turns
  //    every policy that references it into an error at query time.
  const gates = ['actor_id', 'actor_role', 'is_staff', 'is_admin', 'can_publish', 'can_view_sensitive'];
  const present = await sql<{ proname: string }[]>`
    select proname from pg_proc
    where pronamespace = 'app'::regnamespace and proname = any(${sql.array(gates)})
  `;
  const missing = gates.filter((g) => !present.some((p) => p.proname === g));
  if (missing.length) fail(`missing app.* gate functions: ${missing.join(', ')}`);
  else pass(`all ${gates.length} app.* gate functions present`);

  // 5. Grants. Postgres checks the GRANT *before* it consults a policy, so a
  //    policy without its matching grant is inert — and the failure surfaces as
  //    a broken feature rather than as a security warning.
  //
  //    The sequence grant is here because it is the one that was missing:
  //    `audit_logs.id` is bigserial, every insert calls `nextval`, and USAGE on
  //    a sequence is a privilege separate from INSERT on the table. Without it
  //    every audited mutation aborts, and every mutation here is audited.
  const [grants] = await sql<
    { audit_insert: boolean; audit_seq: boolean; submissions_update: boolean; profiles_update: boolean }[]
  >`
    select has_table_privilege('app_runtime', 'public.audit_logs', 'INSERT')            as audit_insert,
           has_sequence_privilege('app_runtime', 'public.audit_logs_id_seq', 'USAGE')   as audit_seq,
           has_table_privilege('app_runtime', 'public.form_submissions', 'UPDATE')      as submissions_update,
           has_table_privilege('app_runtime', 'public.profiles', 'UPDATE')              as profiles_update
  `;
  if (!grants?.audit_insert) fail('app_runtime lacks INSERT on audit_logs');
  else if (!grants.audit_seq) fail('app_runtime lacks USAGE on audit_logs_id_seq — every audited mutation will abort');
  else if (!grants.submissions_update) fail('app_runtime lacks UPDATE on form_submissions');
  else if (!grants.profiles_update) fail('app_runtime lacks UPDATE on profiles');
  else pass('app_runtime holds the four grants its policies constrain');
} finally {
  await sql.end({ timeout: 5 });
}

if (failures.length) {
  console.error(`\n${failures.length} assertion(s) failed. The database authorisation layer is not intact.`);
  process.exit(1);
}
console.log('\nDatabase authorisation layer intact.');
