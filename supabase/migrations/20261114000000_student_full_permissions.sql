-- The student account now has the parent's management permissions: any household member can
-- update household settings and delete problems. Writes to student-owned tables (attempts,
-- sessions, reviews, activity) are unchanged: still only the student, for their own rows.

drop policy households_parent_update on public.households;
create policy households_member_update on public.households for update to authenticated
  using (id = (select public.my_household()))
  with check (id = (select public.my_household()));

drop policy problems_delete on public.problems;
create policy problems_member_delete on public.problems for delete to authenticated
  using (household_id = (select public.my_household()));
