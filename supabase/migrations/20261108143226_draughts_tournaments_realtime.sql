do $$ begin
 if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='draughts_tournaments') then alter publication supabase_realtime add table public.draughts_tournaments; end if;
 if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='draughts_tournament_entries') then alter publication supabase_realtime add table public.draughts_tournament_entries; end if;
 if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='draughts_tournament_matches') then alter publication supabase_realtime add table public.draughts_tournament_matches; end if;
end $$;
