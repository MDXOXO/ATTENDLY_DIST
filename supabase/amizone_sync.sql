-- Attendly Amizone + production compatibility migration.
-- Safe to re-run during development.

alter table public.subjects
  add column if not exists course_code text,
  add column if not exists source text default 'manual';

-- Amizone pages do not always expose credit values. Unknown credits are NULL.
alter table public.subjects alter column credits drop not null;
alter table public.subjects drop constraint if exists credits_valid;
alter table public.subjects add constraint credits_valid check (credits is null or credits > 0);

-- Clean subject names imported by earlier parser versions that accidentally stored attendance percentages.
update public.subjects
set name = trim(regexp_replace(name, '\s+[0-9]{1,3}(\.[0-9]+)?%\s*(\([[:space:]]*[0-9]+[[:space:]]*/[[:space:]]*[0-9]+[[:space:]]*\))?[[:space:]]*$', '', 'i'))
where name ~* '\s+[0-9]{1,3}(\.[0-9]+)?%';

create unique index if not exists subjects_semester_course_code_uidx
  on public.subjects(semester_id, course_code)
  where course_code is not null;

create table if not exists public.class_sessions (
  id uuid primary key default gen_random_uuid(),
  semester_id uuid not null references public.semesters(id) on delete cascade,
  subject_id uuid not null references public.subjects(id) on delete cascade,
  session_date date not null,
  start_time time,
  end_time time,
  room text,
  faculty text,
  source text not null default 'amizone' check (source in ('amizone','manual')),
  source_key text not null,
  status text not null default 'scheduled' check (status in ('scheduled','cancelled','conducted')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (semester_id, source_key)
);

create index if not exists class_sessions_semester_date_idx
  on public.class_sessions(semester_id, session_date);

create table if not exists public.amizone_attendance_snapshots (
  id uuid primary key default gen_random_uuid(),
  semester_id uuid not null references public.semesters(id) on delete cascade,
  captured_at timestamptz not null default now(),
  source_url text,
  payload jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists amizone_snapshots_semester_captured_idx
  on public.amizone_attendance_snapshots(semester_id, captured_at desc);

alter table public.class_sessions enable row level security;
alter table public.amizone_attendance_snapshots enable row level security;

drop policy if exists "class_sessions_select_own" on public.class_sessions;
drop policy if exists "class_sessions_insert_own" on public.class_sessions;
drop policy if exists "class_sessions_update_own" on public.class_sessions;
drop policy if exists "class_sessions_delete_own" on public.class_sessions;
drop policy if exists "amizone_snapshots_select_own" on public.amizone_attendance_snapshots;
drop policy if exists "amizone_snapshots_insert_own" on public.amizone_attendance_snapshots;

create policy "class_sessions_select_own"
on public.class_sessions for select
using (exists (select 1 from public.semesters s where s.id = class_sessions.semester_id and s.user_id = auth.uid()));

create policy "class_sessions_insert_own"
on public.class_sessions for insert
to authenticated
with check (exists (select 1 from public.semesters s where s.id = class_sessions.semester_id and s.user_id = auth.uid()));

create policy "class_sessions_update_own"
on public.class_sessions for update
to authenticated
using (exists (select 1 from public.semesters s where s.id = class_sessions.semester_id and s.user_id = auth.uid()))
with check (exists (select 1 from public.semesters s where s.id = class_sessions.semester_id and s.user_id = auth.uid()));

create policy "class_sessions_delete_own"
on public.class_sessions for delete
to authenticated
using (exists (select 1 from public.semesters s where s.id = class_sessions.semester_id and s.user_id = auth.uid()));

create policy "amizone_snapshots_select_own"
on public.amizone_attendance_snapshots for select
to authenticated
using (exists (select 1 from public.semesters s where s.id = amizone_attendance_snapshots.semester_id and s.user_id = auth.uid()));

create policy "amizone_snapshots_insert_own"
on public.amizone_attendance_snapshots for insert
to authenticated
with check (exists (select 1 from public.semesters s where s.id = amizone_attendance_snapshots.semester_id and s.user_id = auth.uid()));
