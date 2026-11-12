
alter table public.draughts_tournaments add column if not exists winner_id uuid references auth.users(id);
alter table public.draughts_tournaments add column if not exists ranking_bonus integer not null default 50 check(ranking_bonus between 0 and 500);
alter table public.draughts_tournament_matches add column if not exists points_one integer not null default 0;
alter table public.draughts_tournament_matches add column if not exists points_two integer not null default 0;
create table if not exists public.draughts_tournament_awards(
 id uuid primary key default gen_random_uuid(), tournament_id uuid not null references public.draughts_tournaments(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade, bonus_points integer not null,
 created_at timestamptz not null default now(), unique(tournament_id,user_id)
);
alter table public.draughts_tournament_awards enable row level security;
drop policy if exists "Tournament awards visible to signed in users" on public.draughts_tournament_awards;
create policy "Tournament awards visible to signed in users" on public.draughts_tournament_awards for select to authenticated using(true);
grant select on public.draughts_tournament_awards to authenticated;

create or replace function public.start_draughts_tournament(p_tournament_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare t public.draughts_tournaments%rowtype; ids uuid[]; n int; i int; r int:=1; m int:=1; total int; round_count int; a uuid; b uuid;
begin
 if not exists(select 1 from public.user_roles where user_id=(select auth.uid()) and role::text in('admin','superior_admin')) then raise exception 'Admin access required'; end if;
 select * into t from public.draughts_tournaments where id=p_tournament_id for update;
 if not found or t.status not in('registration','live') then raise exception 'Tournament cannot be started'; end if;
 if exists(select 1 from public.draughts_tournament_matches where tournament_id=t.id) then raise exception 'Fixtures already generated'; end if;
 select array_agg(user_id order by coalesce(seed,2147483647),joined_at) into ids from public.draughts_tournament_entries where tournament_id=t.id and status='registered';
 n:=coalesce(array_length(ids,1),0);
 if n<2 then raise exception 'At least two registered players are required'; end if;
 if t.format in('quick_cup','grand','weekly','daily','open','private') then
  total:=1; while total<n loop total:=total*2; end loop;
  round_count:=ceil(ln(total::numeric)/ln(2::numeric))::int;
  for i in 1..(total/2) loop
   a:=case when (i*2-1)<=n then ids[i*2-1] else null end;
   b:=case when (i*2)<=n then ids[i*2] else null end;
   insert into public.draughts_tournament_matches(tournament_id,round_number,match_number,player_one,player_two,status,winner_id)
   values(t.id,1,i,a,b,case when a is null or b is null then 'bye' else 'scheduled' end,case when a is null then b when b is null then a else null end);
   if a is null or b is null then
    update public.draughts_tournament_entries set status='registered' where tournament_id=t.id and user_id=coalesce(a,b);
   end if;
  end loop;
  for r in 2..round_count loop
   for i in 1..(total/(2^r)) loop
    insert into public.draughts_tournament_matches(tournament_id,round_number,match_number,status)
    values(t.id,r,i,'scheduled');
   end loop;
  end loop;
 else
  for i in 1..n loop
   for m in (i+1)..n loop
    insert into public.draughts_tournament_matches(tournament_id,round_number,match_number,player_one,player_two,status)
    values(t.id,1,((i-1)*(2*n-i))/2+(m-i),ids[i],ids[m],'scheduled');
   end loop;
  end loop;
 end if;
 update public.draughts_tournaments set status='live',updated_at=now() where id=t.id;
 return jsonb_build_object('players',n,'fixtures',(select count(*) from public.draughts_tournament_matches where tournament_id=t.id),'format',t.format);
end $$;

create or replace function public.create_draughts_tournament_game(p_tournament_match_id uuid)
returns public.draft_matches language plpgsql security definer set search_path=public as $$
declare tm public.draughts_tournament_matches%rowtype; b jsonb; dm public.draft_matches%rowtype;
begin
 select * into tm from public.draughts_tournament_matches where id=p_tournament_match_id for update;
 if not found or tm.status<>'scheduled' or tm.player_one is null or tm.player_two is null then raise exception 'Fixture is not ready'; end if;
 if (select auth.uid()) not in(tm.player_one,tm.player_two) then raise exception 'Only assigned players can start this fixture'; end if;
 if tm.draft_match_id is not null then select * into dm from public.draft_matches where id=tm.draft_match_id; return dm; end if;
 select jsonb_agg(case when ((x/8+x%8)%2=1) and x/8<3 then jsonb_build_object('c','b','k',false)
 when ((x/8+x%8)%2=1) and x/8>4 then jsonb_build_object('c','w','k',false) else 'null'::jsonb end order by x)
 into b from generate_series(0,63) g(x);
 insert into public.draft_matches(player_white,player_black,vs_ai,board,current_turn,status)
 values(tm.player_one,tm.player_two,false,b,'w','active') returning * into dm;
 update public.draughts_tournament_matches set draft_match_id=dm.id,status='live' where id=tm.id;
 return dm;
end $$;

create or replace function public.sync_draughts_tournament_result()
returns trigger language plpgsql security definer set search_path=public as $$
declare tm public.draughts_tournament_matches%rowtype; next_round int; next_match int; slot int; champ uuid; bonus int;
begin
 if old.status='finished' or new.status<>'finished' or new.winner not in('white','black','draw') then return new; end if;
 select * into tm from public.draughts_tournament_matches where draft_match_id=new.id for update;
 if not found then return new; end if;
 update public.draughts_tournament_matches set status='completed',
 winner_id=case new.winner when 'white' then tm.player_one when 'black' then tm.player_two else null end,
 points_one=case new.winner when 'white' then 3 when 'draw' then 1 else 0 end,
 points_two=case new.winner when 'black' then 3 when 'draw' then 1 else 0 end
 where id=tm.id returning * into tm;
 if tm.winner_id is not null and tm.round_number>0 then
  next_round:=tm.round_number+1; next_match:=ceil(tm.match_number::numeric/2)::int;
  if exists(select 1 from public.draughts_tournament_matches where tournament_id=tm.tournament_id and round_number=next_round and match_number=next_match) then
   slot:=case when tm.match_number%2=1 then 1 else 2 end;
   if slot=1 then update public.draughts_tournament_matches set player_one=tm.winner_id where tournament_id=tm.tournament_id and round_number=next_round and match_number=next_match;
   else update public.draughts_tournament_matches set player_two=tm.winner_id where tournament_id=tm.tournament_id and round_number=next_round and match_number=next_match; end if;
  end if;
 end if;
 if not exists(select 1 from public.draughts_tournament_matches where tournament_id=tm.tournament_id and status in('scheduled','live')) then
  if (select format from public.draughts_tournaments where id=tm.tournament_id) in('quick_cup','grand','weekly','daily','open','private') then
   select winner_id into champ from public.draughts_tournament_matches where tournament_id=tm.tournament_id order by round_number desc,match_number limit 1;
   if champ is not null then
    select ranking_bonus into bonus from public.draughts_tournaments where id=tm.tournament_id;
    update public.draughts_tournaments set status='completed',winner_id=champ,updated_at=now() where id=tm.tournament_id;
    update public.draughts_tournament_entries set status=case when user_id=champ then 'champion' else 'eliminated' end where tournament_id=tm.tournament_id and status='registered';
    if bonus>0 then
     insert into public.draughts_tournament_awards(tournament_id,user_id,bonus_points) values(tm.tournament_id,champ,bonus) on conflict(tournament_id,user_id) do nothing;
     if found then
      insert into public.draughts_player_stats(season_id,user_id,rating_points) select id,champ,300+bonus from public.draughts_seasons where is_active
      on conflict(season_id,user_id) do update set rating_points=draughts_player_stats.rating_points+excluded.rating_points-300,updated_at=now();
     end if;
    end if;
   end if;
  else
   update public.draughts_tournaments set status='completed',updated_at=now() where id=tm.tournament_id;
  end if;
 end if;
 return new;
end $$;
drop trigger if exists draft_match_sync_tournament on public.draft_matches;
create trigger draft_match_sync_tournament after update of status,winner on public.draft_matches for each row execute function public.sync_draughts_tournament_result();

revoke all on function public.start_draughts_tournament(uuid) from public,anon;
revoke all on function public.create_draughts_tournament_game(uuid) from public,anon;
grant execute on function public.start_draughts_tournament(uuid),public.create_draughts_tournament_game(uuid) to authenticated;

