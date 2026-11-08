-- Allow signed-in users to read global note categories (user_id IS NULL)
-- while retaining access to their own categories.
-- Existing permissive SELECT policies are OR-combined by PostgreSQL, so this
-- policy safely adds visibility for shared rows without granting write access.

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'note_categories'
      and policyname = 'Users can view shared and own note categories'
  ) then
    create policy "Users can view shared and own note categories"
      on public.note_categories
      for select
      to authenticated
      using (user_id is null or user_id = (select auth.uid()));
  end if;
end
$$;
