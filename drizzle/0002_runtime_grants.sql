-- Grants the runtime role the three privileges its policies already constrain.
--
-- Postgres checks the GRANT **before** it consults a policy, so a policy
-- without a matching grant is inert. The live database had three of these:
--
--   audit_logs        INSERT   policy rt_insert exists, grant did not
--   form_submissions  UPDATE   policy rt_update exists, grant did not
--   profiles          UPDATE   policy rt_update exists, grant did not
--
-- Every admin mutation writes an audit entry, so the first of those alone
-- would have failed every save in production with `permission denied for table
-- audit_logs`. The integration tests could not catch it: PGlite connects as
-- `postgres`, which matches the `pcsrd_owner_all` policy and needs no grant.
--
-- Nothing here widens what the policies permit — each grant is the missing
-- prerequisite for a rule the database already enforces:
--
--   audit_logs.rt_insert       app.is_staff() and actor_id = app.actor_id()
--                              → an entry cannot be forged for another actor
--   form_submissions.rt_update sensitive rows need can_view_sensitive()
--   profiles.rt_update         app.is_admin() or id = app.actor_id()
--
-- Deliberately NOT granted:
--
--   form_submissions INSERT       app.submit_form() is SECURITY DEFINER and
--                                 owns the retention and DNH-8 decisions
--   organization_settings INSERT  the singleton is a fixture, created by the
--                                 owner in scripts/seed.ts
--   audit_logs UPDATE / DELETE    append-only; block_audit_mutation refuses
--                                 them regardless, and a grant would only make
--                                 the refusal happen later

grant insert on public.audit_logs to app_runtime;
--> statement-breakpoint
grant update on public.form_submissions to app_runtime;
--> statement-breakpoint
grant update on public.profiles to app_runtime;
