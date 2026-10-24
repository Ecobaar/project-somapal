create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  school_name text not null default '',
  phone_number text not null default '',
  grades text[] not null default '{}',
  subjects text[] not null default '{}',
  created_at timestamptz not null default now()
);

create table if not exists public.classes (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  grade text not null,
  subject text not null,
  term text not null check (term in ('Term 1', 'Term 2', 'Term 3')),
  year integer not null,
  created_at timestamptz not null default now()
);

create table if not exists public.learners (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  name text not null,
  admission_number text,
  created_at timestamptz not null default now()
);

create table if not exists public.assessments (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  learner_id uuid not null references public.learners(id) on delete cascade,
  strand text not null,
  sub_strand text not null,
  level text not null check (level in ('EE', 'ME', 'AE', 'BE')),
  assessed_on date not null default current_date,
  term text not null check (term in ('Term 1', 'Term 2', 'Term 3')),
  year integer not null,
  created_at timestamptz not null default now()
);

create table if not exists public.lesson_plans (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  grade text not null,
  subject text not null,
  strand text not null,
  sub_strand text not null,
  learning_outcomes text not null,
  inquiry_question text not null default '',
  resources text not null default '',
  activities text not null default '',
  reflection text not null default '',
  week integer not null check (week between 1 and 20),
  term text not null check (term in ('Term 1', 'Term 2', 'Term 3')),
  year integer not null,
  created_at timestamptz not null default now()
);

create table if not exists public.learner_remarks (
  teacher_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  learner_id uuid not null references public.learners(id) on delete cascade,
  term text not null check (term in ('Term 1', 'Term 2', 'Term 3')),
  year integer not null,
  remark text not null default '',
  updated_at timestamptz not null default now(),
  primary key (learner_id, term, year)
);

create index if not exists classes_teacher_idx on public.classes (teacher_id, created_at);
create index if not exists learners_class_idx on public.learners (teacher_id, class_id, name);
create index if not exists assessments_learner_idx on public.assessments (teacher_id, learner_id, assessed_on desc);
create index if not exists lesson_plans_filter_idx on public.lesson_plans (teacher_id, term, week, year);

alter table public.profiles enable row level security;
alter table public.classes enable row level security;
alter table public.learners enable row level security;
alter table public.assessments enable row level security;
alter table public.lesson_plans enable row level security;
alter table public.learner_remarks enable row level security;

drop policy if exists "Teachers manage own profile" on public.profiles;
create policy "Teachers manage own profile" on public.profiles for all to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

drop policy if exists "Teachers manage own classes" on public.classes;
create policy "Teachers manage own classes" on public.classes for all to authenticated using (teacher_id = (select auth.uid())) with check (teacher_id = (select auth.uid()));

drop policy if exists "Teachers manage learners in own classes" on public.learners;
create policy "Teachers manage learners in own classes" on public.learners for all to authenticated
using (teacher_id = (select auth.uid()) and exists (select 1 from public.classes c where c.id = class_id and c.teacher_id = (select auth.uid())))
with check (teacher_id = (select auth.uid()) and exists (select 1 from public.classes c where c.id = class_id and c.teacher_id = (select auth.uid())));

drop policy if exists "Teachers manage assessments in own classes" on public.assessments;
create policy "Teachers manage assessments in own classes" on public.assessments for all to authenticated
using (teacher_id = (select auth.uid()) and exists (select 1 from public.classes c where c.id = assessments.class_id and c.teacher_id = (select auth.uid())) and exists (select 1 from public.learners l where l.id = assessments.learner_id and l.class_id = assessments.class_id and l.teacher_id = (select auth.uid())))
with check (teacher_id = (select auth.uid()) and exists (select 1 from public.classes c where c.id = assessments.class_id and c.teacher_id = (select auth.uid())) and exists (select 1 from public.learners l where l.id = assessments.learner_id and l.class_id = assessments.class_id and l.teacher_id = (select auth.uid())));

drop policy if exists "Teachers manage plans in own classes" on public.lesson_plans;
create policy "Teachers manage plans in own classes" on public.lesson_plans for all to authenticated
using (teacher_id = (select auth.uid()) and exists (select 1 from public.classes c where c.id = class_id and c.teacher_id = (select auth.uid())))
with check (teacher_id = (select auth.uid()) and exists (select 1 from public.classes c where c.id = class_id and c.teacher_id = (select auth.uid())));

drop policy if exists "Teachers manage remarks for own learners" on public.learner_remarks;
create policy "Teachers manage remarks for own learners" on public.learner_remarks for all to authenticated
using (teacher_id = (select auth.uid()) and exists (select 1 from public.learners l where l.id = learner_id and l.teacher_id = (select auth.uid())))
with check (teacher_id = (select auth.uid()) and exists (select 1 from public.learners l where l.id = learner_id and l.teacher_id = (select auth.uid())));

grant select, insert, update, delete on public.profiles, public.classes, public.learners, public.assessments, public.lesson_plans, public.learner_remarks to authenticated;

create or replace function public.create_profile_for_teacher()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, school_name, phone_number, grades, subjects)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce(new.raw_user_meta_data ->> 'school_name', ''),
    coalesce(new.raw_user_meta_data ->> 'phone_number', ''),
    array(select jsonb_array_elements_text(coalesce(new.raw_user_meta_data -> 'grades', '[]'::jsonb))),
    array(select jsonb_array_elements_text(coalesce(new.raw_user_meta_data -> 'subjects', '[]'::jsonb)))
  ) on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_teacher_signup_create_profile on auth.users;
create trigger on_teacher_signup_create_profile after insert on auth.users for each row execute procedure public.create_profile_for_teacher();