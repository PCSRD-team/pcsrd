-- `programs.specific_objectives` and `programs.key_interventions` are removed.
--
-- Both were `jsonb not null default '[]'` and neither had a reader or a writer
-- anywhere in the application. `05-ADMIN §3` describes the `ArrayField` that
-- would have edited them; it was never built, and no template ever rendered
-- them. The only code that touched them was `keep()` in the content service,
-- which preserved whatever was already stored — so they round-tripped through
-- every save and appeared nowhere.
--
-- Checked against the live database before writing this, not inferred:
--
--   protection            objectives=0  interventions=0
--   humanitarian_response objectives=0  interventions=0
--   early_recovery        objectives=0  interventions=0
--
-- All three programmes, both columns, empty. Nothing is lost.
--
-- The alternative was to build the editor and a block on the programme page.
-- That is a feature decision, and the owner made the other one: a column the
-- site does not show is a column the site should not store, and the schema is
-- easier to read for its absence. If the content is wanted later, the columns
-- come back with their editor in the same change rather than waiting years for
-- one.

alter table public.programs drop column if exists specific_objectives;
--> statement-breakpoint
alter table public.programs drop column if exists key_interventions;
