-- Add optional event details to Calendar time blocks.
-- Existing events are preserved; all new fields are nullable/defaulted.
alter table public.time_blocks
  add column if not exists description text,
  add column if not exists location text,
  add column if not exists meeting_url text,
  add column if not exists category text not null default 'Personal';

alter table public.time_blocks
  drop constraint if exists time_blocks_category_check;

alter table public.time_blocks
  add constraint time_blocks_category_check
  check (category in ('Work', 'Study', 'Personal', 'Meeting', 'Health', 'Other'));
