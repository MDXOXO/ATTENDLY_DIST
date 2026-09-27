-- Attendly production security hardening.
-- Run after the base Attendly schema and amizone_sync.sql.
-- Safe to re-run: all application policies are replaced with owner-scoped policies.

alter table public.profiles enable row level security;
alter table public.semesters enable row level security;
alter table public.subjects enable row level security;
alter table public.timetable enable row level security;
alter table public.holidays enable row level security;
alter table public.working_days enable row level security;
alter table public.special_working_days enable row level security;
alter table public.attendance_records enable row level security;
alter table public.class_sessions enable row level security;
alter table public.amizone_attendance_snapshots enable row level security;

do $$
declare
  item record;
begin
  for item in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in (
        'profiles', 'semesters', 'subjects', 'timetable', 'holidays',
        'working_days', 'special_working_days', 'attendance_records',
        'class_sessions', 'amizone_attendance_snapshots'
      )
  loop
    execute format('drop policy if exists %I on %I.%I', item.policyname, item.schemaname, item.tablename);
  end loop;
end $$;

revoke all on table public.profiles, public.semesters, public.subjects, public.timetable,
  public.holidays, public.working_days, public.special_working_days,
  public.attendance_records, public.class_sessions, public.amizone_attendance_snapshots
from anon;

grant select, insert, update, delete on table public.profiles, public.semesters, public.subjects,
  public.timetable, public.holidays, public.working_days, public.special_working_days,
  public.attendance_records, public.class_sessions, public.amizone_attendance_snapshots
to authenticated;

create policy profiles_select_own on public.profiles
  for select to authenticated using (id = auth.uid());
create policy profiles_insert_own on public.profiles
  for insert to authenticated with check (id = auth.uid());
create policy profiles_update_own on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create policy semesters_all_own on public.semesters
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy subjects_all_own on public.subjects
  for all to authenticated
  using (exists (select 1 from public.semesters s where s.id = subjects.semester_id and s.user_id = auth.uid()))
  with check (exists (select 1 from public.semesters s where s.id = subjects.semester_id and s.user_id = auth.uid()));

create policy timetable_all_own on public.timetable
  for all to authenticated
  using (exists (
    select 1
    from public.subjects sub
    join public.semesters sem on sem.id = sub.semester_id
    where sub.id = timetable.subject_id and sem.user_id = auth.uid()
  ))
  with check (exists (
    select 1
    from public.subjects sub
    join public.semesters sem on sem.id = sub.semester_id
    where sub.id = timetable.subject_id and sem.user_id = auth.uid()
  ));

create policy holidays_all_own on public.holidays
  for all to authenticated
  using (exists (select 1 from public.semesters s where s.id = holidays.semester_id and s.user_id = auth.uid()))
  with check (exists (select 1 from public.semesters s where s.id = holidays.semester_id and s.user_id = auth.uid()));

create policy working_days_all_own on public.working_days
  for all to authenticated
  using (exists (select 1 from public.semesters s where s.id = working_days.semester_id and s.user_id = auth.uid()))
  with check (exists (select 1 from public.semesters s where s.id = working_days.semester_id and s.user_id = auth.uid()));

create policy special_working_days_all_own on public.special_working_days
  for all to authenticated
  using (exists (select 1 from public.semesters s where s.id = special_working_days.semester_id and s.user_id = auth.uid()))
  with check (exists (select 1 from public.semesters s where s.id = special_working_days.semester_id and s.user_id = auth.uid()));

create policy attendance_records_all_own on public.attendance_records
  for all to authenticated
  using (exists (
    select 1
    from public.subjects sub
    join public.semesters sem on sem.id = sub.semester_id
    where sub.id = attendance_records.subject_id and sem.user_id = auth.uid()
  ))
  with check (exists (
    select 1
    from public.subjects sub
    join public.semesters sem on sem.id = sub.semester_id
    where sub.id = attendance_records.subject_id and sem.user_id = auth.uid()
  ));

create policy class_sessions_all_own on public.class_sessions
  for all to authenticated
  using (exists (select 1 from public.semesters s where s.id = class_sessions.semester_id and s.user_id = auth.uid()))
  with check (exists (select 1 from public.semesters s where s.id = class_sessions.semester_id and s.user_id = auth.uid()));

create policy amizone_snapshots_all_own on public.amizone_attendance_snapshots
  for all to authenticated
  using (exists (select 1 from public.semesters s where s.id = amizone_attendance_snapshots.semester_id and s.user_id = auth.uid()))
  with check (exists (select 1 from public.semesters s where s.id = amizone_attendance_snapshots.semester_id and s.user_id = auth.uid()));

-- Never expose administrative Supabase keys in the browser.
-- The Vite client must use only the publishable/anon key.
