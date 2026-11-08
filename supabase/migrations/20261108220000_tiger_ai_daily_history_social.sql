create table if not exists public.tiger_ai_daily_post_likes (
  post_id uuid not null references public.tiger_ai_daily_posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
alter table public.tiger_ai_daily_post_likes enable row level security;
grant select, insert, delete on public.tiger_ai_daily_post_likes to authenticated;
drop policy if exists "Users can read daily history likes" on public.tiger_ai_daily_post_likes;
create policy "Users can read daily history likes" on public.tiger_ai_daily_post_likes for select to authenticated using (true);
drop policy if exists "Users can like daily history" on public.tiger_ai_daily_post_likes;
create policy "Users can like daily history" on public.tiger_ai_daily_post_likes for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "Users can remove own daily history likes" on public.tiger_ai_daily_post_likes;
create policy "Users can remove own daily history likes" on public.tiger_ai_daily_post_likes for delete to authenticated using (user_id = auth.uid());

create table if not exists public.tiger_ai_daily_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.tiger_ai_daily_posts(id) on delete cascade,
  parent_id uuid references public.tiger_ai_daily_comments(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  body text not null check (char_length(body) between 1 and 2000),
  is_tiger_ai boolean not null default false,
  ai_liked boolean not null default false,
  created_at timestamptz not null default now(),
  constraint tiger_ai_daily_comments_ai_identity check ((is_tiger_ai = false and user_id is not null) or (is_tiger_ai = true and user_id is null and ai_liked = false))
);
create index if not exists tiger_ai_daily_comments_post_created_idx on public.tiger_ai_daily_comments(post_id, created_at);
create index if not exists tiger_ai_daily_comments_parent_idx on public.tiger_ai_daily_comments(parent_id);
create unique index if not exists tiger_ai_daily_comments_one_bot_reply_idx on public.tiger_ai_daily_comments(parent_id) where is_tiger_ai = true and parent_id is not null;
alter table public.tiger_ai_daily_comments enable row level security;
grant select, insert on public.tiger_ai_daily_comments to authenticated;
drop policy if exists "Authenticated users can read daily history comments" on public.tiger_ai_daily_comments;
create policy "Authenticated users can read daily history comments" on public.tiger_ai_daily_comments for select to authenticated using (true);
drop policy if exists "Users can add daily history comments" on public.tiger_ai_daily_comments;
create policy "Users can add daily history comments" on public.tiger_ai_daily_comments for insert to authenticated with check (user_id = auth.uid() and is_tiger_ai = false and ai_liked = false);

create table if not exists public.tiger_ai_daily_comment_likes (
  comment_id uuid not null references public.tiger_ai_daily_comments(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (comment_id, user_id)
);
alter table public.tiger_ai_daily_comment_likes enable row level security;
grant select, insert, delete on public.tiger_ai_daily_comment_likes to authenticated;
drop policy if exists "Users can read daily history comment likes" on public.tiger_ai_daily_comment_likes;
create policy "Users can read daily history comment likes" on public.tiger_ai_daily_comment_likes for select to authenticated using (true);
drop policy if exists "Users can like daily history comments" on public.tiger_ai_daily_comment_likes;
create policy "Users can like daily history comments" on public.tiger_ai_daily_comment_likes for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "Users can remove own daily history comment likes" on public.tiger_ai_daily_comment_likes;
create policy "Users can remove own daily history comment likes" on public.tiger_ai_daily_comment_likes for delete to authenticated using (user_id = auth.uid());

do $$ begin
 if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='tiger_ai_daily_comments') then
  alter publication supabase_realtime add table public.tiger_ai_daily_comments;
 end if;
end $$;