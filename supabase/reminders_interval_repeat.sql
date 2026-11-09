-- Allow interval-based reminder recurrence values such as interval:30 and interval:60.
-- Run this migration in the Supabase SQL Editor before using interval reminders.

alter table public.reminders
  drop constraint if exists reminders_repeat_check;

alter table public.reminders
  add constraint reminders_repeat_check
  check (
    repeat in ('none', 'daily', 'weekdays', 'weekly')
    or (
      repeat ~ '^interval:[0-9]+$'
      and split_part(repeat, ':', 2)::integer between 1 and 10080
    )
  );
