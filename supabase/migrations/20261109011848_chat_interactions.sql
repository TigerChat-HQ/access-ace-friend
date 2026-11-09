-- Chat interactions: reactions, pins, editing metadata, and polls.
-- RLS policies restrict all interaction data to authenticated conversation members.

alter table public.messages
  add column if not exists is_edited boolean not null default false,
  add column if not exists edited_at timestamptz;

create or replace function public.guard_message_content_edits()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.id is distinct from old.id
     or new.conversation_id is distinct from old.conversation_id
     or new.sender_id is distinct from old.sender_id
     or new.created_at is distinct from old.created_at then
    raise exception 'Message identity fields cannot be changed';
  end if;

  if new.content is distinct from old.content
     or new.message_type is distinct from old.message_type
     or new.media_url is distinct from old.media_url then
    if old.sender_id <> (select auth.uid()) then
      raise exception 'Only the message author can edit message content';
    end if;
    new.is_edited := true;
    new.edited_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists guard_message_content_edits on public.messages;
create trigger guard_message_content_edits
before update on public.messages
for each row execute function public.guard_message_content_edits();

create table if not exists public.message_reactions (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  emoji text not null check (char_length(emoji) between 1 and 16),
  created_at timestamptz not null default now(),
  unique (message_id, user_id, emoji)
);
create index if not exists message_reactions_message_id_idx on public.message_reactions(message_id);
create index if not exists message_reactions_user_id_idx on public.message_reactions(user_id);

create table if not exists public.pinned_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  message_id uuid not null references public.messages(id) on delete cascade,
  pinned_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (conversation_id, message_id)
);
create index if not exists pinned_messages_conversation_id_idx on public.pinned_messages(conversation_id, created_at desc);
create index if not exists pinned_messages_message_id_idx on public.pinned_messages(message_id);
create index if not exists pinned_messages_pinned_by_idx on public.pinned_messages(pinned_by);

create table if not exists public.chat_polls (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  question text not null check (char_length(question) between 1 and 500),
  allows_multiple boolean not null default false,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists chat_polls_conversation_id_idx on public.chat_polls(conversation_id, created_at desc);
create index if not exists chat_polls_created_by_idx on public.chat_polls(created_by);

create table if not exists public.chat_poll_options (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references public.chat_polls(id) on delete cascade,
  option_text text not null check (char_length(option_text) between 1 and 200),
  position integer not null default 0,
  unique (poll_id, position)
);
create index if not exists chat_poll_options_poll_id_position_idx on public.chat_poll_options(poll_id, position);

create table if not exists public.chat_poll_votes (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references public.chat_polls(id) on delete cascade,
  option_id uuid not null references public.chat_poll_options(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (poll_id, option_id, user_id)
);
create index if not exists chat_poll_votes_poll_id_idx on public.chat_poll_votes(poll_id);
create index if not exists chat_poll_votes_option_id_idx on public.chat_poll_votes(option_id);
create index if not exists chat_poll_votes_user_id_idx on public.chat_poll_votes(user_id);

alter table public.message_reactions enable row level security;
alter table public.pinned_messages enable row level security;
alter table public.chat_polls enable row level security;
alter table public.chat_poll_options enable row level security;
alter table public.chat_poll_votes enable row level security;

drop policy if exists "Conversation members read message reactions" on public.message_reactions;
create policy "Conversation members read message reactions" on public.message_reactions
for select to authenticated
using (exists (
  select 1 from public.messages m
  join public.conversation_members cm on cm.conversation_id = m.conversation_id
  where m.id = message_reactions.message_id and cm.user_id = (select auth.uid())
));

drop policy if exists "Members add own message reactions" on public.message_reactions;
create policy "Members add own message reactions" on public.message_reactions
for insert to authenticated
with check (user_id = (select auth.uid()) and exists (
  select 1 from public.messages m
  join public.conversation_members cm on cm.conversation_id = m.conversation_id
  where m.id = message_reactions.message_id and cm.user_id = (select auth.uid())
));

drop policy if exists "Users remove own message reactions" on public.message_reactions;
create policy "Users remove own message reactions" on public.message_reactions
for delete to authenticated
using (user_id = (select auth.uid()));

drop policy if exists "Conversation members read pinned messages" on public.pinned_messages;
create policy "Conversation members read pinned messages" on public.pinned_messages
for select to authenticated
using (exists (
  select 1 from public.conversation_members cm
  where cm.conversation_id = pinned_messages.conversation_id and cm.user_id = (select auth.uid())
));

drop policy if exists "Conversation members pin messages" on public.pinned_messages;
create policy "Conversation members pin messages" on public.pinned_messages
for insert to authenticated
with check (
  pinned_by = (select auth.uid())
  and exists (select 1 from public.conversation_members cm where cm.conversation_id = pinned_messages.conversation_id and cm.user_id = (select auth.uid()))
  and exists (select 1 from public.messages m where m.id = pinned_messages.message_id and m.conversation_id = pinned_messages.conversation_id)
);

drop policy if exists "Conversation members unpin messages" on public.pinned_messages;
create policy "Conversation members unpin messages" on public.pinned_messages
for delete to authenticated
using (exists (
  select 1 from public.conversation_members cm
  where cm.conversation_id = pinned_messages.conversation_id and cm.user_id = (select auth.uid())
));

drop policy if exists "Conversation members read polls" on public.chat_polls;
create policy "Conversation members read polls" on public.chat_polls
for select to authenticated
using (exists (
  select 1 from public.conversation_members cm
  where cm.conversation_id = chat_polls.conversation_id and cm.user_id = (select auth.uid())
));

drop policy if exists "Conversation members create polls" on public.chat_polls;
create policy "Conversation members create polls" on public.chat_polls
for insert to authenticated
with check (
  created_by = (select auth.uid())
  and exists (select 1 from public.conversation_members cm where cm.conversation_id = chat_polls.conversation_id and cm.user_id = (select auth.uid()))
);

drop policy if exists "Conversation members read poll options" on public.chat_poll_options;
create policy "Conversation members read poll options" on public.chat_poll_options
for select to authenticated
using (exists (
  select 1 from public.chat_polls p
  join public.conversation_members cm on cm.conversation_id = p.conversation_id
  where p.id = chat_poll_options.poll_id and cm.user_id = (select auth.uid())
));

drop policy if exists "Poll creators add options" on public.chat_poll_options;
create policy "Poll creators add options" on public.chat_poll_options
for insert to authenticated
with check (exists (
  select 1 from public.chat_polls p
  join public.conversation_members cm on cm.conversation_id = p.conversation_id
  where p.id = chat_poll_options.poll_id and p.created_by = (select auth.uid()) and cm.user_id = (select auth.uid())
));

drop policy if exists "Conversation members read poll votes" on public.chat_poll_votes;
create policy "Conversation members read poll votes" on public.chat_poll_votes
for select to authenticated
using (exists (
  select 1 from public.chat_polls p
  join public.conversation_members cm on cm.conversation_id = p.conversation_id
  where p.id = chat_poll_votes.poll_id and cm.user_id = (select auth.uid())
));

drop policy if exists "Users cast own poll votes" on public.chat_poll_votes;
create policy "Users cast own poll votes" on public.chat_poll_votes
for insert to authenticated
with check (
  user_id = (select auth.uid())
  and exists (
    select 1 from public.chat_polls p
    join public.conversation_members cm on cm.conversation_id = p.conversation_id
    join public.chat_poll_options o on o.poll_id = p.id
    where p.id = chat_poll_votes.poll_id and o.id = chat_poll_votes.option_id
      and cm.user_id = (select auth.uid())
      and (p.expires_at is null or p.expires_at > now())
  )
);

drop policy if exists "Users change own poll votes" on public.chat_poll_votes;
create policy "Users change own poll votes" on public.chat_poll_votes
for delete to authenticated
using (user_id = (select auth.uid()));

create or replace function public.cast_chat_poll_vote(_poll_id uuid, _option_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  poll_allows_multiple boolean;
  already_selected boolean;
begin
  select p.allows_multiple into poll_allows_multiple
  from public.chat_polls p
  join public.conversation_members cm on cm.conversation_id = p.conversation_id
  where p.id = _poll_id and cm.user_id = (select auth.uid())
    and (p.expires_at is null or p.expires_at > now());
  if not found then raise exception 'Poll not found, expired, or access denied'; end if;
  if not exists (select 1 from public.chat_poll_options o where o.id = _option_id and o.poll_id = _poll_id) then
    raise exception 'Invalid poll option';
  end if;
  select exists (
    select 1 from public.chat_poll_votes v
    where v.poll_id = _poll_id and v.option_id = _option_id and v.user_id = (select auth.uid())
  ) into already_selected;
  if already_selected then
    delete from public.chat_poll_votes where poll_id = _poll_id and option_id = _option_id and user_id = (select auth.uid());
    return;
  end if;
  if not poll_allows_multiple then
    delete from public.chat_poll_votes where poll_id = _poll_id and user_id = (select auth.uid());
  end if;
  insert into public.chat_poll_votes (poll_id, option_id, user_id)
  values (_poll_id, _option_id, (select auth.uid()));
end;
$$;

revoke all on function public.cast_chat_poll_vote(uuid, uuid) from public, anon;
grant execute on function public.cast_chat_poll_vote(uuid, uuid) to authenticated;

create or replace function public.create_chat_poll(
  _conversation_id uuid,
  _question text,
  _options text[],
  _allows_multiple boolean default false,
  _expires_at timestamptz default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  new_poll_id uuid;
  option_value text;
  option_position integer := 0;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  if char_length(trim(coalesce(_question, ''))) not between 1 and 500 then raise exception 'Question must be 1 to 500 characters'; end if;
  if coalesce(array_length(_options, 1), 0) not between 2 and 10 then raise exception 'A poll needs 2 to 10 options'; end if;
  if not exists (select 1 from public.conversation_members cm where cm.conversation_id = _conversation_id and cm.user_id = (select auth.uid())) then
    raise exception 'Conversation access denied';
  end if;
  insert into public.chat_polls (conversation_id, created_by, question, allows_multiple, expires_at)
  values (_conversation_id, (select auth.uid()), trim(_question), coalesce(_allows_multiple, false), _expires_at)
  returning id into new_poll_id;
  foreach option_value in array _options loop
    if char_length(trim(coalesce(option_value, ''))) not between 1 and 200 then raise exception 'Poll options must be 1 to 200 characters'; end if;
    insert into public.chat_poll_options (poll_id, option_text, position)
    values (new_poll_id, trim(option_value), option_position);
    option_position := option_position + 1;
  end loop;
  return new_poll_id;
end;
$$;

revoke all on function public.cast_chat_poll_vote(uuid, uuid) from public, anon;
grant execute on function public.cast_chat_poll_vote(uuid, uuid) to authenticated;
revoke all on function public.create_chat_poll(uuid, text, text[], boolean, timestamptz) from public, anon;
grant execute on function public.create_chat_poll(uuid, text, text[], boolean, timestamptz) to authenticated;

grant select, insert, delete on public.message_reactions to authenticated;
grant select, insert, delete on public.pinned_messages to authenticated;
grant select, insert on public.chat_polls to authenticated;
grant select, insert on public.chat_poll_options to authenticated;
grant select, insert, delete on public.chat_poll_votes to authenticated;

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'message_reactions') then alter publication supabase_realtime add table public.message_reactions; end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'pinned_messages') then alter publication supabase_realtime add table public.pinned_messages; end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'chat_polls') then alter publication supabase_realtime add table public.chat_polls; end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'chat_poll_options') then alter publication supabase_realtime add table public.chat_poll_options; end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'chat_poll_votes') then alter publication supabase_realtime add table public.chat_poll_votes; end if;
end $$;
