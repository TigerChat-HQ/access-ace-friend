do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'tiger_ai_daily_posts'
  ) then
    alter publication supabase_realtime add table public.tiger_ai_daily_posts;
  end if;
end $$;
