-- Kaizen Projects custom-page app.
-- Add "projects" to the allowed custom page types (the existing constraint is used by the Customisation page creator).
alter table public.custom_pages drop constraint if exists custom_pages_kind_check;
alter table public.custom_pages add constraint custom_pages_kind_check
  check (kind in ('page', 'table', 'board', 'journal', 'tracker', 'goals', 'countdown', 'flashcards', 'notes', 'checklist', 'projects'));
-- Run this script once in the Supabase SQL Editor.
-- Each Projects custom page owns its own project list. Project tasks remain separate from daily_todos and calendar time blocks.

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  custom_page_id uuid not null references public.custom_pages(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 90),
  description text not null default '',
  status text not null default 'active' check (status in ('planning', 'active', 'on_hold', 'completed')),
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high')),
  color text not null default '#64748b',
  start_date date,
  due_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.projects add column if not exists custom_page_id uuid references public.custom_pages(id) on delete cascade;

create index if not exists projects_user_updated_idx
  on public.projects(user_id, updated_at desc);
create index if not exists projects_custom_page_idx
  on public.projects(custom_page_id, updated_at desc);

create table if not exists public.project_tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(trim(title)) between 1 and 180),
  description text not null default '',
  status text not null default 'todo' check (status in ('todo', 'in_progress', 'done')),
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high')),
  due_date date,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists project_tasks_project_order_idx
  on public.project_tasks(project_id, sort_order, created_at);
create index if not exists project_tasks_user_idx
  on public.project_tasks(user_id);

alter table public.projects enable row level security;
alter table public.project_tasks enable row level security;

drop policy if exists "Users manage their own projects" on public.projects;
create policy "Users manage their own projects"
  on public.projects for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users manage tasks in their own projects" on public.project_tasks;
create policy "Users manage tasks in their own projects"
  on public.project_tasks for all
  using (
    auth.uid() = user_id
    and exists (
      select 1 from public.projects p
      where p.id = project_tasks.project_id and p.user_id = auth.uid()
    )
  )
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.projects p
      where p.id = project_tasks.project_id and p.user_id = auth.uid()
    )
  );
