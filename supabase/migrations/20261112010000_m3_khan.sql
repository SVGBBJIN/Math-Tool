-- M3: Khan Academy proof entries. One row per logged session; day_activity('khan') is derived from them.
create table public.khan_sessions (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  student_id uuid not null references auth.users (id) on delete cascade,
  local_date date not null,
  unit text not null check (char_length(unit) between 2 and 120),
  skill text not null check (char_length(skill) between 2 and 160),
  minutes integer not null check (minutes between 1 and 180),
  questions_correct integer not null check (questions_correct >= 0),
  questions_total integer not null check (questions_total >= 0),
  proof_note text not null check (char_length(proof_note) between 20 and 1000),
  proof_url text check (proof_url is null or proof_url ~ '^https://([a-z0-9-]+\.)*khanacademy\.org(/|$)'),
  created_at timestamptz not null default now(),
  check (questions_correct <= questions_total)
);

create index on public.khan_sessions (household_id);
create index on public.khan_sessions (student_id, local_date);

alter table public.khan_sessions enable row level security;

-- Same shape as the other student-owned tables: household reads; only the student inserts their own rows.
-- No update policy: proof entries are append-only, so a logged session can't be quietly rewritten.
create policy khan_sessions_read on public.khan_sessions for select to authenticated
  using (household_id = (select public.my_household()));
create policy khan_sessions_student_insert on public.khan_sessions for insert to authenticated
  with check (household_id = (select public.my_household())
              and student_id = (select auth.uid())
              and (select public.my_role()) = 'student');
