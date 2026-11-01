-- Learning checklist subtasks
create table if not exists public.learning_checklist_subtasks (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.learning_checklist_items(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(trim(title)) between 1 and 240),
  is_completed boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists learning_checklist_subtasks_item_sort_idx on public.learning_checklist_subtasks(item_id, sort_order, created_at);
alter table public.learning_checklist_subtasks enable row level security;
drop policy if exists "Users can view their own learning subtasks" on public.learning_checklist_subtasks;
create policy "Users can view their own learning subtasks" on public.learning_checklist_subtasks for select using (auth.uid() = user_id);
drop policy if exists "Users can create their own learning subtasks" on public.learning_checklist_subtasks;
create policy "Users can create their own learning subtasks" on public.learning_checklist_subtasks for insert with check (auth.uid() = user_id and exists (select 1 from public.learning_checklist_items item where item.id = item_id and item.user_id = auth.uid()));
drop policy if exists "Users can update their own learning subtasks" on public.learning_checklist_subtasks;
create policy "Users can update their own learning subtasks" on public.learning_checklist_subtasks for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Users can delete their own learning subtasks" on public.learning_checklist_subtasks;
create policy "Users can delete their own learning subtasks" on public.learning_checklist_subtasks for delete using (auth.uid() = user_id);
