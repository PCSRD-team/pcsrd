-- A new auth user's profile starts inactive. Hand-written, like 0006–0011.
--
-- `app.handle_new_user()` fires AFTER INSERT on `auth.users` and created every
-- profile as an **active** editor. Invitations are not the only way a row gets
-- there: with Supabase's public sign-up enabled, anyone holding the anon key
-- (which ships in every page) can POST to `/auth/v1/signup`, confirm their own
-- address and sign in to `/admin` as an editor.
--
-- The profile is now created inactive. `inviteUser()` activates the one it
-- invited, in the same audited transaction that sets its role — so an
-- invitation works exactly as before and a self-sign-up stays locked out
-- (`requireActor()` refuses an inactive profile). `is_active` is not keyed on
-- `invited_at` because GoTrue writes that column after the insert.
--
-- Existing profiles are untouched: this changes only what the next insert does.
-- Body otherwise identical to drizzle/0001.
CREATE OR REPLACE FUNCTION app.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  insert into public.profiles (id, email, full_name, role, can_view_sensitive, is_active)
  values (
    new.id,
    new.email,
    coalesce(nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''), split_part(new.email, '@', 1)),
    'editor',      -- least privilege, always
    false,         -- sensitive access is granted per person, never inherited
    false          -- inactive until an invitation activates it (inviteUser)
  )
  on conflict (id) do nothing;
  return new;
end $function$
;
