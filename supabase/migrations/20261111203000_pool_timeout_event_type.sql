-- Permit server-authored timeout events in the Pool match replay log.
ALTER TABLE public.pool_match_events
  DROP CONSTRAINT IF EXISTS pool_match_events_event_type_check;
ALTER TABLE public.pool_match_events
  ADD CONSTRAINT pool_match_events_event_type_check
  CHECK (event_type IN ('shot','foul','turn','pause','resume','result','chat_emote','timeout'));
