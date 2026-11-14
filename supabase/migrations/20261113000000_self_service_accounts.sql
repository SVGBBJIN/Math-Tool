-- AMC Coach — self-service accounts.
-- Replaces the parent -> household -> student onboarding with a single account per person.
-- Every auth user gets a profile and a private "household" row (the data-scoping key every
-- table already uses) the moment the user is created, so RLS keeps working unchanged.
-- The `role` column is kept for compatibility but no longer drives any access rule.

-- ---------------------------------------------------------------------------
-- Account provisioning
-- ---------------------------------------------------------------------------
-- Internal: create the household + profile for a user. Idempotent.
create or replace function public.provision_account(p_user uuid, p_email text, p_meta jsonb)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_name text;
  v_tz text;
  v_household uuid;
begin
  if exists (select 1 from public.profiles where id = p_user) then
    return;
  end if;

  v_name := left(nullif(btrim(coalesce(p_meta ->> 'display_name', '')), ''), 60);
  if v_name is null then
    v_name := left(coalesce(nullif(split_part(coalesce(p_email, ''), '@', 1), ''), 'Student'), 60);
  end if;

  v_tz := coalesce(p_meta ->> 'timezone', '');
  if not exists (select 1 from pg_timezone_names where name = v_tz) then
    v_tz := 'America/Los_Angeles';
  end if;

  insert into public.households (name, timezone, created_by)
    values (v_name, v_tz, p_user) returning id into v_household;
  insert into public.profiles (id, household_id, role, display_name)
    values (p_user, v_household, 'student', v_name);
end $$;
revoke all on function public.provision_account(uuid, text, jsonb) from public, anon, authenticated;

-- Trigger: runs for every new auth user (self sign-up, admin createUser, OAuth later).
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.provision_account(new.id, new.email, coalesce(new.raw_user_meta_data, '{}'::jsonb));
  return new;
end $$;
revoke all on function public.handle_new_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Self-heal for users created before this migration (or if the trigger was ever missing).
create or replace function public.ensure_account() returns void
language plpgsql security definer set search_path = public as $$
declare
  u auth.users;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  select * into u from auth.users where id = auth.uid();
  perform public.provision_account(u.id, u.email, coalesce(u.raw_user_meta_data, '{}'::jsonb));
end $$;
revoke all on function public.ensure_account() from public, anon;
grant execute on function public.ensure_account() to authenticated;

-- The parent onboarding RPC is gone.
drop function if exists public.create_household(text, text, text);

-- ---------------------------------------------------------------------------
-- RLS: role no longer matters. Members of a household (just the owner) can do everything
-- inside it; other households see nothing.
-- ---------------------------------------------------------------------------
drop policy if exists households_parent_update on public.households;
create policy households_owner_update on public.households for update to authenticated
  using (id = (select public.my_household()))
  with check (id = (select public.my_household()));

drop policy if exists problems_delete on public.problems;
create policy problems_delete on public.problems for delete to authenticated
  using (household_id = (select public.my_household()));

-- Let a user rename themselves; nothing else on the profile is editable.
create policy profiles_update_own on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()) and household_id = (select public.my_household()));
revoke update on public.profiles from authenticated;
grant update (display_name) on public.profiles to authenticated;

do $$
declare t text;
begin
  foreach t in array array['trainer_sessions', 'attempts', 'review_items', 'error_reviews', 'day_activity'] loop
    execute format('drop policy if exists %1$s_student_insert on public.%1$s', t);
    execute format('drop policy if exists %1$s_student_update on public.%1$s', t);
    execute format($f$
      create policy %1$s_owner_insert on public.%1$s for insert to authenticated
        with check (household_id = (select public.my_household()) and student_id = (select auth.uid()));
      create policy %1$s_owner_update on public.%1$s for update to authenticated
        using (student_id = (select auth.uid()))
        with check (household_id = (select public.my_household()) and student_id = (select auth.uid()));
    $f$, t);
  end loop;
end $$;

-- Khan proof entries stay append-only (no update policy), just without the role check.
drop policy if exists khan_sessions_student_insert on public.khan_sessions;
create policy khan_sessions_owner_insert on public.khan_sessions for insert to authenticated
  with check (household_id = (select public.my_household()) and student_id = (select auth.uid()));
