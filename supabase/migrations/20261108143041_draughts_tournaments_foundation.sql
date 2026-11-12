
create table if not exists public.draughts_tournaments (
 id uuid primary key default gen_random_uuid(),
 title text not null,
 description text not null default '',
 format text not null check (format in ('quick_cup','league','daily','weekly','grand','team','open','private')),
 status text not null default 'registration' check (status in ('draft','registration','live','completed','cancelled')),
 visibility text not null default 'public' check (visibility in ('public','private')),
 invite_code text unique,
 max_players integer not null default 32 check (max_players between 2 and 512),
 starts_at timestamptz not null,
 ends_at timestamptz,
 rules text not null default '',
 prize text not null default '',
 created_by uuid not null references auth.users(id),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 check (ends_at is null or ends_at > starts_at)
);
create table if not exists public.draughts_tournament_entries (
 id uuid primary key default gen_random_uuid(),
 tournament_id uuid not null references public.draughts_tournaments(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 team_name text,
 seed integer,
 status text not null default 'registered' check (status in ('registered','waitlisted','withdrawn','eliminated','champion')),
 joined_at timestamptz not null default now(),
 unique(tournament_id,user_id)
);
create table if not exists public.draughts_tournament_matches (
 id uuid primary key default gen_random_uuid(),
 tournament_id uuid not null references public.draughts_tournaments(id) on delete cascade,
 round_number integer not null default 1,
 match_number integer not null default 1,
 player_one uuid references auth.users(id),
 player_two uuid references auth.users(id),
 winner_id uuid references auth.users(id),
 draft_match_id uuid references public.draft_matches(id) on delete set null,
 scheduled_at timestamptz,
 status text not null default 'scheduled' check(status in ('scheduled','live','completed','bye')),
 created_at timestamptz not null default now(),
 unique(tournament_id,round_number,match_number)
);
alter table public.draughts_tournaments enable row level security;
alter table public.draughts_tournament_entries enable row level security;
alter table public.draughts_tournament_matches enable row level security;
drop policy if exists "Tournament public discovery" on public.draughts_tournaments;
create policy "Tournament public discovery" on public.draughts_tournaments for select to authenticated using (visibility='public' and status<>'draft' or created_by=(select auth.uid()) or exists(select 1 from public.user_roles r where r.user_id=(select auth.uid()) and r.role::text in ('admin','superior_admin')));
drop policy if exists "Tournament entries visible to signed in users" on public.draughts_tournament_entries;
create policy "Tournament entries visible to signed in users" on public.draughts_tournament_entries for select to authenticated using (true);
drop policy if exists "Tournament matches visible to signed in users" on public.draughts_tournament_matches;
create policy "Tournament matches visible to signed in users" on public.draughts_tournament_matches for select to authenticated using (true);
grant select on public.draughts_tournaments, public.draughts_tournament_entries, public.draughts_tournament_matches to authenticated;
create or replace function public.join_draughts_tournament(p_tournament_id uuid,p_invite_code text default null)
returns public.draughts_tournament_entries language plpgsql security definer set search_path=public as $$
declare t public.draughts_tournaments%rowtype; e public.draughts_tournament_entries%rowtype; n integer;
begin
 if (select auth.uid()) is null then raise exception 'Sign in required'; end if;
 select * into t from public.draughts_tournaments where id=p_tournament_id for update;
 if not found or t.status<>'registration' then raise exception 'Registration is closed'; end if;
 if t.visibility='private' and (p_invite_code is null or upper(trim(p_invite_code))<>upper(t.invite_code)) then raise exception 'Invalid invite code'; end if;
 if t.starts_at<=now() then raise exception 'Registration has ended'; end if;
 select count(*) into n from public.draughts_tournament_entries where tournament_id=t.id and status='registered';
 insert into public.draughts_tournament_entries(tournament_id,user_id,status)
 values(t.id,(select auth.uid()),case when n<t.max_players then 'registered' else 'waitlisted' end)
 on conflict(tournament_id,user_id) do update set status=case when excluded.status='registered' then 'registered' else draughts_tournament_entries.status end
 returning * into e;
 return e;
end $$;
create or replace function public.create_draughts_tournament(
 p_title text,p_description text,p_format text,p_starts_at timestamptz,p_max_players integer,
 p_rules text default '',p_prize text default '',p_visibility text default 'public',p_invite_code text default null
) returns public.draughts_tournaments language plpgsql security definer set search_path=public as $$
declare t public.draughts_tournaments%rowtype;
begin
 if not exists(select 1 from public.user_roles where user_id=(select auth.uid()) and role::text in ('admin','superior_admin')) then raise exception 'Admin access required'; end if;
 if length(trim(coalesce(p_title,'')))<3 then raise exception 'Tournament title is too short'; end if;
 insert into public.draughts_tournaments(title,description,format,starts_at,max_players,rules,prize,visibility,invite_code,status,created_by)
 values(trim(p_title),coalesce(p_description,''),p_format,p_starts_at,p_max_players,coalesce(p_rules,''),coalesce(p_prize,''),p_visibility,
 case when p_visibility='private' then upper(coalesce(nullif(trim(p_invite_code),''),substr(replace(gen_random_uuid()::text,'-',''),1,8))) else null end,
 'registration',(select auth.uid())) returning * into t;
 return t;
end $$;
revoke all on function public.join_draughts_tournament(uuid,text) from public;
revoke all on function public.create_draughts_tournament(text,text,text,timestamptz,integer,text,text,text,text) from public;
grant execute on function public.join_draughts_tournament(uuid,text),public.create_draughts_tournament(text,text,text,timestamptz,integer,text,text,text,text) to authenticated;

