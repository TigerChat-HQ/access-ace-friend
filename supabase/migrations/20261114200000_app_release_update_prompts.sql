-- Publish concise Android release notes for in-app update prompts.
-- Only trusted server/admin tooling should insert or update release rows.
create table if not exists public.app_releases (
  id uuid primary key default gen_random_uuid(),
  platform text not null default 'android' check (platform in ('android', 'ios', 'web', 'all')),
  version text not null check (char_length(version) between 1 and 32),
  title text not null check (char_length(title) between 1 and 120),
  summary text not null check (char_length(summary) between 1 and 500),
  features text[] not null default '{}',
  update_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (platform, version)
);
alter table public.app_releases enable row level security;
grant select, insert, update, delete on public.app_releases to authenticated;
drop policy if exists "Authenticated users can read active app releases" on public.app_releases;
create policy "Authenticated users can read active app releases"
on public.app_releases for select to authenticated
using (is_active = true);
create index if not exists app_releases_active_platform_created_idx
on public.app_releases (platform, is_active, created_at desc);

drop policy if exists "Admins publish app releases" on public.app_releases;
create policy "Admins publish app releases"
on public.app_releases for all to authenticated
using (
  exists (select 1 from public.user_roles ur where ur.user_id = (select auth.uid()) and ur.role in ('admin', 'superior_admin'))
)
with check (
  exists (select 1 from public.user_roles ur where ur.user_id = (select auth.uid()) and ur.role in ('admin', 'superior_admin'))
);
