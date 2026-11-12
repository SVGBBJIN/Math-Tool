-- AMC Coach — M1 core schema: households, profiles, problem bank, trainer, attempts,
-- spaced review queue, error log reviews, daily activity.
-- Every table is household-scoped and protected by RLS.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type public.user_role as enum ('parent', 'student');
create type public.problem_source as enum ('aops_wiki', 'generated', 'pasted');
create type public.problem_status as enum ('train', 'vault', 'burned');
create type public.error_type as enum ('concept_gap', 'careless', 'misread', 'no_approach', 'out_of_time');
create type public.attempt_context as enum ('trainer', 'review', 'endurance', 'error_review');
create type public.plan_item as enum ('trainer', 'error_review', 'timed_block', 'saturday_review', 'khan');
create type public.review_status as enum ('pending', 'retired');

-- ---------------------------------------------------------------------------
-- Households & profiles
-- ---------------------------------------------------------------------------
create table public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  timezone text not null default 'America/Los_Angeles',
  amc_date date,                      -- configurable AMC 10 date
  finals_start date,                  -- Honors Math finals window (taper)
  finals_end date,
  created_by uuid not null references auth.users (id),
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  household_id uuid not null references public.households (id) on delete cascade,
  role public.user_role not null,
  display_name text not null,
  created_at timestamptz not null default now()
);
create index on public.profiles (household_id);

-- Helpers used by RLS. SECURITY DEFINER so they can read profiles without recursion.
create or replace function public.my_household() returns uuid
language sql stable security definer set search_path = public as $$
  select household_id from public.profiles where id = auth.uid()
$$;

create or replace function public.my_role() returns public.user_role
language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid()
$$;

revoke all on function public.my_household() from public;
revoke all on function public.my_role() from public;
grant execute on function public.my_household() to authenticated;
grant execute on function public.my_role() to authenticated;

-- Parent onboarding: the signed-in user (who has no profile yet) creates a household
-- and becomes its parent. Student accounts are created server-side by the parent.
create or replace function public.create_household(p_name text, p_display_name text, p_timezone text)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  hid uuid;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  if exists (select 1 from public.profiles where id = auth.uid()) then
    raise exception 'profile already exists';
  end if;
  if not exists (select 1 from pg_timezone_names where name = p_timezone) then
    raise exception 'unknown timezone %', p_timezone;
  end if;
  insert into public.households (name, timezone, created_by)
    values (p_name, p_timezone, auth.uid()) returning id into hid;
  insert into public.profiles (id, household_id, role, display_name)
    values (auth.uid(), hid, 'parent', p_display_name);
  return hid;
end $$;
revoke all on function public.create_household(text, text, text) from public;
grant execute on function public.create_household(text, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Problem bank
-- ---------------------------------------------------------------------------
create table public.problems (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  source public.problem_source not null,
  contest text,                       -- e.g. 'AMC 10A'
  year int check (year between 1950 and 2100),
  number int check (number between 1 and 30),
  url text,                           -- AoPS wiki link (aops_wiki)
  statement text,                     -- ONLY for pasted/generated; never AoPS text
  choices jsonb,                      -- {"A": "...", ...} for pasted/generated
  answer char(1) not null check (answer in ('A', 'B', 'C', 'D', 'E')),
  difficulty int not null check (difficulty between 1 and 25),  -- test position
  topic_tags text[] not null default '{}',
  technique_tags text[] not null default '{}',
  status public.problem_status not null default 'train',
  solution_url text,
  solution_sketch text,               -- generated only
  verification jsonb,                 -- generated only (M5)
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  -- AoPS: link + metadata only, never copied problem text.
  constraint aops_no_text check (source <> 'aops_wiki' or (statement is null and url is not null)),
  constraint non_aops_has_text check (source = 'aops_wiki' or statement is not null),
  -- Generated problems never go to the vault.
  constraint generated_not_vault check (source <> 'generated' or status <> 'vault'),
  constraint has_technique check (cardinality(technique_tags) >= 1)
);
create index on public.problems (household_id, status);
create index on public.problems using gin (technique_tags);
create unique index problems_aops_unique on public.problems (household_id, contest, year, number)
  where source = 'aops_wiki';

-- ---------------------------------------------------------------------------
-- Trainer sessions & attempts
-- ---------------------------------------------------------------------------
create table public.trainer_sessions (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  student_id uuid not null references auth.users (id) on delete cascade,
  local_date date not null,
  problem_ids uuid[] not null,
  slot_reasons text[] not null,       -- 'twin:<tag>' | 'weak:<tag>' | 'stretch' | 'fill'
  review_item_ids uuid[] not null default '{}',  -- parallel to problem_ids; null-uuid when not a twin
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (student_id, local_date)
);

create table public.attempts (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  student_id uuid not null references auth.users (id) on delete cascade,
  problem_id uuid not null references public.problems (id) on delete cascade,
  context public.attempt_context not null,
  session_id uuid references public.trainer_sessions (id) on delete set null,
  review_item_id uuid,                -- set when this attempt was a twin
  local_date date not null,
  seconds int not null check (seconds >= 0),
  answer char(1) check (answer in ('A', 'B', 'C', 'D', 'E')),  -- null = blank
  correct boolean not null,
  confidence smallint check (confidence between 1 and 3),
  familiar boolean not null default false,  -- excluded from score stats
  key_idea text,
  error_type public.error_type,
  finalized boolean not null default false,
  created_at timestamptz not null default now(),
  -- A finalized trainer/review attempt must have a key idea, confidence and (if wrong) an error type.
  constraint finalized_complete check (
    not finalized
    or context not in ('trainer', 'review')
    or (
      key_idea is not null and length(btrim(key_idea)) >= 5
      and confidence is not null
      and (correct or error_type is not null)
    )
  )
);
create index on public.attempts (student_id, local_date);
create index on public.attempts (problem_id);

-- ---------------------------------------------------------------------------
-- Spaced review: one pending item per (student, technique tag).
-- Stage k is due intervals[k] days after the last event: 1, 3, 7, 21.
-- ---------------------------------------------------------------------------
create table public.review_items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  student_id uuid not null references auth.users (id) on delete cascade,
  technique_tag text not null,
  origin_problem_id uuid references public.problems (id) on delete set null,
  stage smallint not null default 0 check (stage between 0 and 3),
  due_date date not null,
  status public.review_status not null default 'pending',
  last_attempt_id uuid references public.attempts (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index review_one_pending_per_tag on public.review_items (student_id, technique_tag)
  where status = 'pending';

alter table public.attempts
  add constraint attempts_review_item_fk foreign key (review_item_id)
  references public.review_items (id) on delete set null;

-- ---------------------------------------------------------------------------
-- Error log reviews (Wednesday)
-- ---------------------------------------------------------------------------
create table public.error_reviews (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  student_id uuid not null references auth.users (id) on delete cascade,
  attempt_id uuid not null references public.attempts (id) on delete cascade,
  local_date date not null,
  takeaway text not null check (length(btrim(takeaway)) >= 5),
  created_at timestamptz not null default now(),
  unique (attempt_id)
);

-- ---------------------------------------------------------------------------
-- Daily activity: one row per (student, date, plan item).
-- ---------------------------------------------------------------------------
create table public.day_activity (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  student_id uuid not null references auth.users (id) on delete cascade,
  local_date date not null,
  item public.plan_item not null,
  minutes numeric(6, 1) not null default 0 check (minutes >= 0),
  completed boolean not null default false,
  updated_at timestamptz not null default now(),
  unique (student_id, local_date, item)
);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.households enable row level security;
alter table public.profiles enable row level security;
alter table public.problems enable row level security;
alter table public.trainer_sessions enable row level security;
alter table public.attempts enable row level security;
alter table public.review_items enable row level security;
alter table public.error_reviews enable row level security;
alter table public.day_activity enable row level security;

-- Households: members read; parent updates.
create policy households_read on public.households for select to authenticated
  using (id = (select public.my_household()));
create policy households_parent_update on public.households for update to authenticated
  using (id = (select public.my_household()) and (select public.my_role()) = 'parent')
  with check (id = (select public.my_household()));

-- Profiles: members read each other; inserts happen via create_household / service role.
create policy profiles_read on public.profiles for select to authenticated
  using (household_id = (select public.my_household()));

-- Problems: members read/insert/update; only parent deletes.
create policy problems_read on public.problems for select to authenticated
  using (household_id = (select public.my_household()));
create policy problems_insert on public.problems for insert to authenticated
  with check (household_id = (select public.my_household()));
create policy problems_update on public.problems for update to authenticated
  using (household_id = (select public.my_household()))
  with check (household_id = (select public.my_household()));
create policy problems_delete on public.problems for delete to authenticated
  using (household_id = (select public.my_household()) and (select public.my_role()) = 'parent');

-- Student-owned tables: household reads; only the student writes their own rows.
do $$
declare t text;
begin
  foreach t in array array['trainer_sessions', 'attempts', 'review_items', 'error_reviews', 'day_activity'] loop
    execute format($f$
      create policy %1$s_read on public.%1$s for select to authenticated
        using (household_id = (select public.my_household()));
      create policy %1$s_student_insert on public.%1$s for insert to authenticated
        with check (household_id = (select public.my_household())
                    and student_id = (select auth.uid())
                    and (select public.my_role()) = 'student');
      create policy %1$s_student_update on public.%1$s for update to authenticated
        using (student_id = (select auth.uid()))
        with check (household_id = (select public.my_household()) and student_id = (select auth.uid()));
    $f$, t);
  end loop;
end $$;

-- Covering indexes for FKs used in RLS / joins.
create index on public.trainer_sessions (household_id);
create index on public.attempts (household_id);
create index on public.review_items (household_id);
create index on public.error_reviews (household_id);
create index on public.day_activity (household_id);
