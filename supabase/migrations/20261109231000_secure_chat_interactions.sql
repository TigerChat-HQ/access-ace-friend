-- Harden chat message editing and enforce poll vote mode at the database boundary.

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

  -- Edit metadata is server-managed and cannot be forged by clients.
  new.is_edited := old.is_edited;
  new.edited_at := old.edited_at;

  if new.content is distinct from old.content then
    if old.sender_id <> (select auth.uid()) then
      raise exception 'Only the message author can edit message content';
    end if;
    new.is_edited := true;
    new.edited_at := now();
  end if;

  return new;
end;
$$;

create or replace function public.enforce_chat_poll_vote_mode()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  poll_allows_multiple boolean;
begin
  select p.allows_multiple into poll_allows_multiple
  from public.chat_polls p
  where p.id = new.poll_id
    and (p.expires_at is null or p.expires_at > now());

  if not found then
    raise exception 'Poll not found or expired';
  end if;

  if not poll_allows_multiple then
    delete from public.chat_poll_votes
    where poll_id = new.poll_id and user_id = new.user_id;
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_chat_poll_vote_mode on public.chat_poll_votes;
create trigger enforce_chat_poll_vote_mode
before insert on public.chat_poll_votes
for each row execute function public.enforce_chat_poll_vote_mode();

create or replace function public.cast_chat_poll_vote(_poll_id uuid, _option_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  poll_allows_multiple boolean;
  existing_vote_id uuid;
begin
  select p.allows_multiple into poll_allows_multiple
  from public.chat_polls p
  join public.conversation_members cm on cm.conversation_id = p.conversation_id
  where p.id = _poll_id and cm.user_id = (select auth.uid())
    and (p.expires_at is null or p.expires_at > now());

  if not found then
    raise exception 'Poll not found, expired, or access denied';
  end if;

  if not exists (
    select 1 from public.chat_poll_options o
    where o.id = _option_id and o.poll_id = _poll_id
  ) then
    raise exception 'Invalid poll option';
  end if;

  select v.id into existing_vote_id
  from public.chat_poll_votes v
  where v.poll_id = _poll_id
    and v.option_id = _option_id
    and v.user_id = (select auth.uid());

  if existing_vote_id is not null then
    delete from public.chat_poll_votes where id = existing_vote_id;
    return;
  end if;

  if not poll_allows_multiple then
    delete from public.chat_poll_votes
    where poll_id = _poll_id and user_id = (select auth.uid());
  end if;

  insert into public.chat_poll_votes (poll_id, option_id, user_id)
  values (_poll_id, _option_id, (select auth.uid()));
end;
$$;

revoke all on function public.cast_chat_poll_vote(uuid, uuid) from public, anon;
grant execute on function public.cast_chat_poll_vote(uuid, uuid) to authenticated;
