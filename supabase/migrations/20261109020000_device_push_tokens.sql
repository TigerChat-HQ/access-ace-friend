create table if not exists public.device_push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  token text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.device_push_tokens enable row level security;

drop policy if exists "Users manage their own push tokens" on public.device_push_tokens;
create policy "Users manage their own push tokens"
  on public.device_push_tokens
  for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create index if not exists device_push_tokens_user_id_idx
  on public.device_push_tokens(user_id);

grant select, insert, update, delete on public.device_push_tokens to authenticated;
