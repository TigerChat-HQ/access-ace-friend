-- Harden WebRTC signaling: immutable events, authenticated sender, and shared-chat membership.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated;

create or replace function private.can_insert_call_signal(
  p_caller_id uuid,
  p_callee_id uuid,
  p_conversation_id uuid,
  p_call_type text,
  p_signal_type text,
  p_signal_data jsonb,
  p_status text
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  signal_from text;
  signal_call_id text;
  renegotiate text;
begin
  if actor_id is null
     or p_conversation_id is null
     or p_caller_id is null
     or p_callee_id is null
     or p_caller_id = p_callee_id
     or p_call_type is null or p_call_type not in ('voice', 'video')
     or p_status is null or p_status not in ('pending', 'active', 'ended')
     or p_signal_data is null
     or pg_catalog.jsonb_typeof(p_signal_data) is distinct from 'object'
  then
    return false;
  end if;

  signal_from := p_signal_data ->> 'from';
  signal_call_id := p_signal_data ->> 'callId';
  renegotiate := p_signal_data ->> 'renegotiate';

  if signal_from is distinct from actor_id::text
     or signal_call_id is null
     or signal_call_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  then
    return false;
  end if;

  -- Both parties must belong to this exact conversation. This function is
  -- private and checks auth.uid() itself; callers cannot nominate another actor.
  if not exists (
    select 1 from public.conversation_members cm
    where cm.conversation_id = p_conversation_id and cm.user_id = p_caller_id
  ) or not exists (
    select 1 from public.conversation_members cm
    where cm.conversation_id = p_conversation_id and cm.user_id = p_callee_id
  ) then
    return false;
  end if;

  -- Every response/ICE/hangup and renegotiation must belong to a real prior offer.
  if p_signal_type <> 'offer' or renegotiate = 'true' then
    if not exists (
      select 1 from public.call_signals cs
      where cs.signal_type = 'offer'
        and cs.caller_id = p_caller_id
        and cs.callee_id = p_callee_id
        and cs.conversation_id = p_conversation_id
        and cs.signal_data ->> 'callId' = signal_call_id
    ) then
      return false;
    end if;
  end if;

  if p_signal_type = 'offer' then
    return actor_id = p_caller_id
      and p_signal_data ? 'sdp'
      and p_signal_data ->> 'type' = 'offer'
      and ((p_status = 'pending' and coalesce(renegotiate, 'false') <> 'true')
        or (p_status = 'active' and renegotiate = 'true'));
  elsif p_signal_type = 'answer' then
    return actor_id = p_callee_id and p_status = 'active'
      and p_signal_data ? 'sdp' and p_signal_data ->> 'type' = 'answer';
  elsif p_signal_type = 'reject' then
    return actor_id = p_callee_id and p_status = 'ended';
  elsif p_signal_type = 'ice-candidate' then
    return actor_id in (p_caller_id, p_callee_id)
      and p_status in ('pending', 'active') and p_signal_data ? 'candidate';
  elsif p_signal_type = 'hangup' then
    return actor_id in (p_caller_id, p_callee_id) and p_status = 'ended';
  end if;

  return false;
end;
$$;

revoke all on function private.can_insert_call_signal(uuid, uuid, uuid, text, text, jsonb, text)
  from public, anon, authenticated;
grant execute on function private.can_insert_call_signal(uuid, uuid, uuid, text, text, jsonb, text)
  to authenticated;

alter table public.call_signals enable row level security;

drop policy if exists "Users can create call signals" on public.call_signals;
drop policy if exists "Users can view their own call signals" on public.call_signals;
drop policy if exists "Users can update their own call signals" on public.call_signals;
drop policy if exists "Users can delete their own call signals" on public.call_signals;

create policy "Call participants can view their signals"
  on public.call_signals for select to authenticated
  using ((select auth.uid()) = caller_id or (select auth.uid()) = callee_id);

create policy "Verified participants can insert call signals"
  on public.call_signals for insert to authenticated
  with check (
    private.can_insert_call_signal(
      caller_id, callee_id, conversation_id, call_type,
      signal_type, signal_data, status
    )
  );

revoke update, delete on public.call_signals from anon, authenticated;
grant select, insert on public.call_signals to authenticated;
