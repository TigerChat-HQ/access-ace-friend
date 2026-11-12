create or replace function public.sync_draughts_tournament_result()
returns trigger language plpgsql security definer set search_path=public as $$
declare tm public.draughts_tournament_matches%rowtype; next_round int; next_match int; slot int; champ uuid; bonus int; tournament_format text;
begin
 if old.status='finished' or new.status<>'finished' or new.winner not in('white','black','draw') then return new; end if;
 select * into tm from public.draughts_tournament_matches where draft_match_id=new.id for update;
 if not found then return new; end if;
 update public.draughts_tournament_matches set status='completed',
  winner_id=case new.winner when 'white' then tm.player_one when 'black' then tm.player_two else null end,
  points_one=case new.winner when 'white' then 3 when 'draw' then 1 else 0 end,
  points_two=case new.winner when 'black' then 3 when 'draw' then 1 else 0 end
 where id=tm.id returning * into tm;
 select format into tournament_format from public.draughts_tournaments where id=tm.tournament_id;
 if tm.winner_id is not null and tournament_format in('quick_cup','grand','weekly','daily','open','private') then
  next_round:=tm.round_number+1; next_match:=ceil(tm.match_number::numeric/2)::int;
  if exists(select 1 from public.draughts_tournament_matches where tournament_id=tm.tournament_id and round_number=next_round and match_number=next_match) then
   slot:=case when tm.match_number%2=1 then 1 else 2 end;
   if slot=1 then update public.draughts_tournament_matches set player_one=tm.winner_id where tournament_id=tm.tournament_id and round_number=next_round and match_number=next_match;
   else update public.draughts_tournament_matches set player_two=tm.winner_id where tournament_id=tm.tournament_id and round_number=next_round and match_number=next_match; end if;
  end if;
 end if;
 if not exists(select 1 from public.draughts_tournament_matches where tournament_id=tm.tournament_id and status in('scheduled','live')) then
  if tournament_format in('quick_cup','grand','weekly','daily','open','private') then
   select winner_id into champ from public.draughts_tournament_matches where tournament_id=tm.tournament_id and winner_id is not null order by round_number desc,match_number limit 1;
  else
   select user_id into champ from (
    select player_id as user_id,sum(points) pts,sum(wins) wins,sum(losses) losses from (
     select player_one player_id,points_one points,(points_one=3)::int wins,(points_one=0)::int losses from public.draughts_tournament_matches where tournament_id=tm.tournament_id and status='completed'
     union all
     select player_two,points_two,(points_two=3)::int,(points_two=0)::int from public.draughts_tournament_matches where tournament_id=tm.tournament_id and status='completed'
    ) s where player_id is not null group by player_id
   ) standings order by pts desc,wins desc,losses asc,user_id limit 1;
  end if;
  if champ is not null then
   select ranking_bonus into bonus from public.draughts_tournaments where id=tm.tournament_id;
   update public.draughts_tournaments set status='completed',winner_id=champ,updated_at=now() where id=tm.tournament_id;
   update public.draughts_tournament_entries set status=case when user_id=champ then 'champion' else 'eliminated' end where tournament_id=tm.tournament_id and status='registered';
   if bonus>0 then
    insert into public.draughts_tournament_awards(tournament_id,user_id,bonus_points) values(tm.tournament_id,champ,bonus) on conflict(tournament_id,user_id) do nothing;
    if found then
     insert into public.draughts_player_stats(season_id,user_id,rating_points) select id,champ,bonus from public.draughts_seasons where is_active
     on conflict(season_id,user_id) do update set rating_points=draughts_player_stats.rating_points+excluded.rating_points,updated_at=now();
    end if;
   end if;
  elsif tournament_format not in('quick_cup','grand','weekly','daily','open','private') then
   update public.draughts_tournaments set status='completed',updated_at=now() where id=tm.tournament_id;
  end if;
 end if;
 return new;
end $$;
revoke all on function public.sync_draughts_tournament_result() from public,anon,authenticated;

