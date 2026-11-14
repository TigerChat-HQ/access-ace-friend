-- Make initial-offer authorization failures diagnosable without weakening
-- participant checks or exposing SDP, call IDs, or account identifiers.
create or replace function public.create_call_signal(
  p_caller_id uuid, p_callee_id uuid, p_conversation_id uuid,
  p_call_type text, p_signal_type text, p_signal_data jsonb,
  p_status text default 'active'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  payload jsonb;
  signal_call_id text;
  inserted_id uuid;
begin
  if actor_id is null then
    raise exception using errcode='42501', message='Call signal rejected: sign-in session is missing.';
  end if;
  if p_caller_id is null or p_callee_id is null or p_caller_id=p_callee_id
     or p_conversation_id is null or p_call_type is null or p_call_type not in ('voice','video')
     or p_signal_type is null or p_signal_type not in ('offer','answer','ice-candidate','reject','hangup')
     or p_status is null or p_status not in ('pending','active','ended')
     or p_signal_data is null or jsonb_typeof(p_signal_data)<>'object' then
    raise exception using errcode='22023', message='Call signal rejected: invalid call fields.';
  end if;
  if not exists(select 1 from public.conversation_members cm where cm.conversation_id=p_conversation_id and cm.user_id=p_caller_id)
     or not exists(select 1 from public.conversation_members cm where cm.conversation_id=p_conversation_id and cm.user_id=p_callee_id) then
    raise exception using errcode='42501', message='Call signal rejected: both accounts must belong to this conversation.';
  end if;
  payload := jsonb_set(p_signal_data,'{from}',to_jsonb(actor_id::text),true);
  signal_call_id := payload->>'callId';
  if signal_call_id is null or signal_call_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    raise exception using errcode='22023', message='Call signal rejected: callId is missing or invalid.';
  end if;
  if p_signal_type='offer' then
    -- Keep each authorization predicate separate so the client and logs identify
    -- the exact invalid field rather than returning one ambiguous 42501 message.
    if actor_id is distinct from p_caller_id then
      raise exception using errcode='42501', message='Call offer rejected: authenticated account does not match caller.';
    end if;
    if p_status is distinct from 'pending' then
      raise exception using errcode='42501', message='Call offer rejected: initial offer must have pending status.';
    end if;
    if payload->>'type' is distinct from 'offer' then
      raise exception using errcode='42501', message='Call offer rejected: SDP type must be offer.';
    end if;
    if nullif(btrim(payload->>'sdp'),'') is null then
      raise exception using errcode='42501', message='Call offer rejected: SDP is empty or missing.';
    end if;
    if coalesce(payload->>'renegotiate','false')='true' then
      raise exception using errcode='42501', message='Call offer rejected: renegotiation cannot create an initial offer.';
    end if;
  elsif p_signal_type='answer' then
    if actor_id<>p_callee_id or p_status<>'active' or payload->>'type'<>'answer' or coalesce(payload->>'sdp','')='' then
      raise exception using errcode='42501', message='Call answer rejected: callee, SDP, or active state is invalid.';
    end if;
  elsif p_signal_type='reject' then
    if actor_id<>p_callee_id or p_status<>'ended' then
      raise exception using errcode='42501', message='Call rejection is only allowed for the callee.';
    end if;
  elsif p_signal_type='ice-candidate' then
    if actor_id not in (p_caller_id,p_callee_id) or p_status not in ('pending','active') or not (payload ? 'candidate') then
      raise exception using errcode='42501', message='ICE candidate rejected: participant or candidate is invalid.';
    end if;
  elsif p_signal_type='hangup' then
    if actor_id not in (p_caller_id,p_callee_id) or p_status<>'ended' then
      raise exception using errcode='42501', message='Call end rejected: only a participant can end this call.';
    end if;
  end if;
  if p_signal_type<>'offer' and not exists(
    select 1 from public.call_signals cs where cs.signal_type='offer'
      and cs.caller_id=p_caller_id and cs.callee_id=p_callee_id
      and cs.conversation_id=p_conversation_id and cs.signal_data->>'callId'=signal_call_id
  ) then
    raise exception using errcode='42501', message='Call signal rejected: matching initial offer was not found.';
  end if;
  insert into public.call_signals(caller_id,callee_id,conversation_id,call_type,signal_type,signal_data,status)
  values(p_caller_id,p_callee_id,p_conversation_id,p_call_type,p_signal_type,payload,p_status)
  returning id into inserted_id;
  return inserted_id;
end;
$$;
revoke all on function public.create_call_signal(uuid,uuid,uuid,text,text,jsonb,text) from public,anon;
grant execute on function public.create_call_signal(uuid,uuid,uuid,text,text,jsonb,text) to authenticated;
