-- Public, read-only sharing for Notes, matching the Custom Pages share-link flow.
alter table public.notes
  add column if not exists share_token text unique;

create or replace function public.get_shared_note(token text)
returns table (
  title text,
  content text,
  created_at timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
  select n.title, n.content, n.created_at
  from public.notes n
  where n.share_token = token
  limit 1;
$$;

revoke all on function public.get_shared_note(text) from public;
grant execute on function public.get_shared_note(text) to anon, authenticated;
