-- Move-based practice engine.
--  * engine_progress: one JSON document per student (skill tree state, resurfacing queue,
--    mistakes, per-card logs, today's set). The rules that update it live in
--    src/lib/engine/progress.ts and are shared with guest mode.
--  * plan_item 'moves': engine minutes count toward the daily minimum; never a required item.
--  * error_type 'setup_error': the sixth error type ("careless" is now shown as "Arithmetic slip").

alter type public.plan_item add value if not exists 'moves';
alter type public.error_type add value if not exists 'setup_error';

create table public.engine_progress (
  student_id uuid primary key references auth.users (id) on delete cascade,
  household_id uuid not null references public.households (id) on delete cascade,
  state jsonb not null,
  updated_at timestamptz not null default now()
);
create index on public.engine_progress (household_id);

alter table public.engine_progress enable row level security;

-- Same rules as the other student-owned tables: the household reads, only the student writes.
create policy engine_progress_read on public.engine_progress for select to authenticated
  using (household_id = (select public.my_household()));
create policy engine_progress_student_insert on public.engine_progress for insert to authenticated
  with check (household_id = (select public.my_household())
              and student_id = (select auth.uid())
              and (select public.my_role()) = 'student');
create policy engine_progress_student_update on public.engine_progress for update to authenticated
  using (student_id = (select auth.uid()))
  with check (household_id = (select public.my_household()) and student_id = (select auth.uid()));
