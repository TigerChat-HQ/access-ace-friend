create or replace function public.finalize_draughts_league()
returns trigger language plpgsql security definer set search_path=public as $$
declare champ uuid; bonus int;
begin
 if new.status<>'completed' or old.status='completed' then return new; end if;
 if (select format from public.draughts_tournaments where id=new.tournament_id) not in('league','team') then return new; end if;
 if exists(select 1 from public.draughts_tournament_matches where tournament_id=new.tournament_id and status in('scheduled','live')) then return new; end if;
 select candidate.user_id into champ from (
  select player_id as user_id,sum(points) as pts,sum(wins) as wins,sum(losses) as losses
  from (
   select player_one as player_id,points_one as points,(points_one=3)::int as wins,(points_one=0)::int as losses from public.draughts_tournament_matches where tournament_id=new.tournament_id and status='completed'
   union all
   select player_two,points_two,(points_two=3)::int,(points_two=0)::int from public.draughts_tournament_matches where tournament_id=new.tournament_id and status='completed'
  ) s where player_id is not null group by player_id
 ) candidate order by pts desc,wins desc,losses asc,user_id limit 1;
 if champ is not null then
  select ranking_bonus into bonus from public.draughts_tournaments where id=new.tournament_id;
  update public.draughts_tournaments set winner_id=champ,status='completed',updated_at=now() where id=new.tournament_id;
  update public.draughts_tournament_entries set status=case when user_id=champ then 'champion' else 'eliminated' end where tournament_id=new.tournament_id and status='registered';
  if bonus>0 then
   insert into public.draughts_tournament_awards(tournament_id,user_id,bonus_points) values(new.tournament_id,champ,bonus) on conflict(tournament_id,user_id) do nothing;
   if found then
    insert into public.draughts_player_stats(season_id,user_id,rating_points) select id,champ,300+bonus from public.draughts_seasons where is_active
    on conflict(season_id,user_id) do update set rating_points=draughts_player_stats.rating_points+excluded.rating_points-300,updated_at=now();
   end if;
  end if;
 end if;
 return new;
end $$;
drop trigger if exists draughts_league_finalize on public.draughts_tournament_matches;
create trigger draughts_league_finalize after update of status on public.draughts_tournament_matches for each row execute function public.finalize_draughts_league();
