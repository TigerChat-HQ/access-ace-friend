create table if not exists public.user_chat_defaults (
  user_id uuid primary key references auth.users(id) on delete cascade,
  wallpaper text not null default 'default',
  bubble_color text not null default 'primary',
  font_size text not null default 'medium' check (font_size in ('small', 'medium', 'large')),
  updated_at timestamptz not null default now()
);

alter table public.user_chat_defaults enable row level security;

grant select, insert, update, delete on public.user_chat_defaults to authenticated;

create policy "Users read own chat defaults"
  on public.user_chat_defaults for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users insert own chat defaults"
  on public.user_chat_defaults for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users update own chat defaults"
  on public.user_chat_defaults for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users delete own chat defaults"
  on public.user_chat_defaults for delete to authenticated
  using ((select auth.uid()) = user_id);
