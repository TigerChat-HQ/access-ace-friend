create extension if not exists pg_cron;
create extension if not exists pg_net;

create table if not exists public.tiger_ai_social_cards (
  id uuid primary key default gen_random_uuid(),
  date_key date not null default ((now() at time zone 'Africa/Dar_es_Salaam')::date),
  card_type text not null check (card_type in ('status','post')),
  title text not null check (char_length(title) between 3 and 120),
  body text not null check (char_length(body) between 20 and 2200),
  theme text not null default 'sunset' check (theme in ('sunset','ocean','forest','royal')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '24 hours'),
  constraint tiger_ai_social_cards_expiry_check check (expires_at > created_at)
);
create index if not exists tiger_ai_social_cards_active_idx
  on public.tiger_ai_social_cards (expires_at desc, created_at desc);
create index if not exists tiger_ai_social_cards_day_idx
  on public.tiger_ai_social_cards (date_key, created_at desc);

alter table public.tiger_ai_social_cards enable row level security;
revoke all on public.tiger_ai_social_cards from anon, authenticated;
grant select on public.tiger_ai_social_cards to authenticated;
drop policy if exists "Signed in users can read active Tiger AI cards" on public.tiger_ai_social_cards;
create policy "Signed in users can read active Tiger AI cards"
  on public.tiger_ai_social_cards for select to authenticated
  using (expires_at > now());

create table if not exists public.tiger_ai_social_card_config (
  id boolean primary key default true check (id),
  cron_token text not null,
  enabled boolean not null default true,
  updated_at timestamptz not null default now()
);
alter table public.tiger_ai_social_card_config enable row level security;
revoke all on public.tiger_ai_social_card_config from anon, authenticated;
insert into public.tiger_ai_social_card_config (id, cron_token, enabled)
values (true, encode(gen_random_bytes(32), 'hex'), true)
on conflict (id) do nothing;

create or replace function public.enforce_tiger_ai_social_card_daily_limit()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  day_start timestamptz := (new.date_key::timestamp at time zone 'Africa/Dar_es_Salaam');
  day_end timestamptz := ((new.date_key + 1)::timestamp at time zone 'Africa/Dar_es_Salaam');
  current_count integer;
begin
  perform pg_advisory_xact_lock(hashtext('tiger-ai-social-cards'), new.date_key - date '2000-01-01');
  select count(*) into current_count
  from public.tiger_ai_social_cards
  where created_at >= day_start and created_at < day_end;
  if current_count >= 4 then
    raise exception 'Tiger AI daily publishing limit reached (4 posts per Tanzania day).';
  end if;
  new.expires_at := new.created_at + interval '24 hours';
  return new;
end;
$$;
drop trigger if exists tiger_ai_social_cards_daily_limit on public.tiger_ai_social_cards;
create trigger tiger_ai_social_cards_daily_limit
before insert on public.tiger_ai_social_cards
for each row execute function public.enforce_tiger_ai_social_card_daily_limit();

select cron.unschedule(jobid) from cron.job where jobname = 'tiger-ai-social-cards-cleanup';
select cron.schedule(
  'tiger-ai-social-cards-cleanup',
  '15 * * * *',
  $$delete from public.tiger_ai_social_cards where expires_at <= now()$$
);
select cron.unschedule(jobid) from cron.job where jobname = 'tiger-ai-social-cards-daily';
select cron.schedule(
  'tiger-ai-social-cards-daily',
  '0 3 * * *',
  $job$
    select net.http_post(
      url := 'https://dngilyoyhmgazhuuaxfh.supabase.co/functions/v1/tiger-ai-daily-social-posts',
      headers := jsonb_build_object('Content-Type', 'application/json'),
      body := jsonb_build_object(
        'token', (select cron_token from public.tiger_ai_social_card_config where id = true)
      ),
      timeout_milliseconds := 120000
    );
  $job$
);

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'tiger_ai_social_cards'
  ) then
    alter publication supabase_realtime add table public.tiger_ai_social_cards;
  end if;
end $$;
