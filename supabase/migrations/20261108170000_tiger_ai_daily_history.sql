create extension if not exists pg_cron;
create extension if not exists pg_net;

create table if not exists public.tiger_ai_daily_posts (
  id uuid primary key default gen_random_uuid(),
  date_key date not null unique,
  title text not null,
  content jsonb not null,
  source_urls text[] not null default '{}',
  created_at timestamptz not null default now()
);
alter table public.tiger_ai_daily_posts enable row level security;
grant select on public.tiger_ai_daily_posts to authenticated;
drop policy if exists "Everyone can read Tiger AI daily history" on public.tiger_ai_daily_posts;
create policy "Everyone can read Tiger AI daily history"
  on public.tiger_ai_daily_posts for select to authenticated using (true);

create table if not exists public.tiger_ai_daily_config (
  id boolean primary key default true check (id),
  cron_token text not null,
  enabled boolean not null default true,
  updated_at timestamptz not null default now()
);
alter table public.tiger_ai_daily_config enable row level security;
revoke all on public.tiger_ai_daily_config from anon, authenticated;
insert into public.tiger_ai_daily_config (id, cron_token, enabled)
values (true, encode(gen_random_uuid()::text::bytea, 'hex') || gen_random_uuid()::text, true)
on conflict (id) do nothing;

select cron.unschedule(jobid) from cron.job where jobname = 'tiger-ai-daily-history';
select cron.schedule(
  'tiger-ai-daily-history',
  '0 5 * * *',
  $job$
    select net.http_post(
      url := 'https://dngilyoyhmgazhuuaxfh.supabase.co/functions/v1/tiger-daily-history',
      headers := jsonb_build_object('Content-Type', 'application/json'),
      body := jsonb_build_object(
        'token', (select cron_token from public.tiger_ai_daily_config where id = true),
        'trigger', 'scheduled'
      ),
      timeout_milliseconds := 120000
    );
  $job$
);