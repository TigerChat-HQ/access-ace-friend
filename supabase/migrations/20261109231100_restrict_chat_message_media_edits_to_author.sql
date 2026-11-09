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

  new.is_edited := old.is_edited;
  new.edited_at := old.edited_at;

  if new.content is distinct from old.content
     or new.message_type is distinct from old.message_type
     or new.media_url is distinct from old.media_url then
    if old.sender_id <> (select auth.uid()) then
      raise exception 'Only the message author can edit message content or media';
    end if;
    new.is_edited := true;
    new.edited_at := now();
  end if;
  return new;
end;
$$;