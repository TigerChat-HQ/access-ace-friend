-- Enforce Pool turn clocks and increment on the server, including tournament timeouts.
ALTER TABLE public.pool_matches
  ADD COLUMN IF NOT EXISTS clock_increment_seconds integer NOT NULL DEFAULT 0
    CHECK (clock_increment_seconds BETWEEN 0 AND 60);

CREATE OR REPLACE FUNCTION public.pool_commit_server_shot(
  p_match_id uuid,p_actor_id uuid,p_expected_revision integer,p_state jsonb,
  p_next_turn uuid,p_status text,p_winner_id uuid,p_event_type text,p_event jsonb
) RETURNS public.pool_matches
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE
  v_match public.pool_matches%ROWTYPE;
  v_duplicate public.pool_match_events%ROWTYPE;
  v_elapsed bigint:=0;
  v_one bigint;
  v_two bigint;
  v_actor_clock bigint;
  v_opponent uuid;
BEGIN
  SELECT * INTO v_match FROM public.pool_matches WHERE id=p_match_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pool match not found'; END IF;
  IF p_event ? 'request_id' THEN
    SELECT * INTO v_duplicate FROM public.pool_match_events
      WHERE match_id=p_match_id AND payload->>'request_id'=p_event->>'request_id' LIMIT 1;
    IF FOUND THEN RETURN v_match; END IF;
  END IF;
  IF v_match.status<>'active' OR v_match.player_two IS NULL THEN RAISE EXCEPTION 'Pool match is not active'; END IF;
  IF p_actor_id IS NULL OR p_actor_id NOT IN (v_match.player_one,v_match.player_two)
     OR v_match.current_turn IS DISTINCT FROM p_actor_id THEN RAISE EXCEPTION 'Actor is not the current player'; END IF;
  IF v_match.revision<>p_expected_revision THEN RAISE EXCEPTION 'Pool revision conflict'; END IF;
  IF p_status NOT IN ('active','finished') OR p_event_type NOT IN ('shot','foul')
     OR jsonb_typeof(p_state->'balls')<>'array'
     OR jsonb_array_length(p_state->'balls') NOT BETWEEN 2 AND 16
     OR p_state->>'mode'<>v_match.mode THEN RAISE EXCEPTION 'Invalid server-computed Pool state'; END IF;
  IF p_next_turn IS NULL OR p_next_turn NOT IN (v_match.player_one,v_match.player_two) THEN RAISE EXCEPTION 'Invalid next turn'; END IF;
  IF (p_status='finished' AND (p_winner_id IS NULL OR p_winner_id NOT IN (v_match.player_one,v_match.player_two)))
     OR (p_status='active' AND p_winner_id IS NOT NULL) THEN RAISE EXCEPTION 'Invalid Pool result'; END IF;

  v_one:=coalesce(v_match.player_one_clock_ms,v_match.clock_seconds::bigint*1000);
  v_two:=coalesce(v_match.player_two_clock_ms,v_match.clock_seconds::bigint*1000);
  v_opponent:=CASE WHEN p_actor_id=v_match.player_one THEN v_match.player_two ELSE v_match.player_one END;
  IF v_match.clock_seconds IS NOT NULL AND v_match.clock_started_at IS NOT NULL THEN
    v_elapsed:=greatest(0,(extract(epoch FROM (now()-v_match.clock_started_at))*1000)::bigint);
    IF p_actor_id=v_match.player_one THEN v_one:=greatest(0,v_one-v_elapsed);v_actor_clock:=v_one;
    ELSE v_two:=greatest(0,v_two-v_elapsed);v_actor_clock:=v_two; END IF;
    IF v_actor_clock<=0 THEN
      UPDATE public.pool_matches SET state=v_match.state,revision=revision+1,current_turn=v_opponent,
        status='finished',winner_id=v_opponent,finished_at=now(),clock_started_at=NULL,
        player_one_clock_ms=v_one,player_two_clock_ms=v_two,updated_at=now()
        WHERE id=p_match_id RETURNING * INTO v_match;
      INSERT INTO public.pool_match_events(match_id,revision,actor_id,event_type,payload)
        VALUES(v_match.id,v_match.revision,p_actor_id,'timeout',
          (p_event-'trajectory')||jsonb_build_object('reason','clock_expired','winner_id',v_opponent));
      RETURN v_match;
    END IF;
    IF p_status='active' THEN
      IF p_actor_id=v_match.player_one THEN v_one:=v_one+v_match.clock_increment_seconds*1000;
      ELSE v_two:=v_two+v_match.clock_increment_seconds*1000; END IF;
    END IF;
  END IF;

  UPDATE public.pool_matches SET state=p_state,revision=revision+1,current_turn=p_next_turn,status=p_status,
    winner_id=p_winner_id,finished_at=CASE WHEN p_status='finished' THEN now() ELSE NULL END,
    clock_started_at=CASE WHEN p_status='active' THEN now() ELSE NULL END,
    player_one_clock_ms=v_one,player_two_clock_ms=v_two,updated_at=now()
    WHERE id=p_match_id RETURNING * INTO v_match;
  INSERT INTO public.pool_match_events(match_id,revision,actor_id,event_type,payload)
    VALUES(v_match.id,v_match.revision,p_actor_id,p_event_type,p_event);
  RETURN v_match;
END $$;

REVOKE ALL ON FUNCTION public.pool_commit_server_shot(uuid,uuid,integer,jsonb,uuid,text,uuid,text,jsonb)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.pool_commit_server_shot(uuid,uuid,integer,jsonb,uuid,text,uuid,text,jsonb)
  TO service_role;

CREATE OR REPLACE FUNCTION public.pool_check_timeout(p_match_id uuid)
RETURNS public.pool_matches
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$1
  v_match public.pool_matches%ROWTYPE;
  v_elapsed bigint;
  v_one bigint;
  v_two bigint;
  v_actor_clock bigint;
  v_opponent uuid;
BEGIN
  SELECT * INTO v_match FROM public.pool_matches WHERE id=p_match_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pool match not found'; END IF;
  IF v_match.status<>'active' OR v_match.clock_seconds IS NULL OR v_match.clock_started_at IS NULL
    THEN RETURN v_match; END IF;
  v_elapsed:=greatest(0,(extract(epoch FROM (now()-v_match.clock_started_at))*1000)::bigint);
  v_one:=greatest(0,coalesce(v_match.player_one_clock_ms,v_match.clock_seconds::bigint*1000));
  v_two:=greatest(0,coalesce(v_match.player_two_clock_ms,v_match.clock_seconds::bigint*1000));
  IF v_match.current_turn=v_match.player_one THEN v_one:=greatest(0,v_one-v_elapsed);v_actor_clock:=v_one;
  ELSIF v_match.current_turn=v_match.player_two THEN v_two:=greatest(0,v_two-v_elapsed);v_actor_clock:=v_two;
  ELSE RETURN v_match; END IF;
  IF v_actor_clock>0 THEN RETURN v_match; END IF;
  v_opponent:=CASE WHEN v_match.current_turn=v_match.player_one THEN v_match.player_two ELSE v_match.player_one END;
  UPDATE public.pool_matches SET status='finished',winner_id=v_opponent,current_turn=v_opponent,
    finished_at=now(),clock_started_at=NULL,player_one_clock_ms=v_one,player_two_clock_ms=v_two,
    revision=revision+1,updated_at=now()
    WHERE id=p_match_id RETURNING * INTO v_match;
  INSERT INTO public.pool_match_events(match_id,revision,actor_id,event_type,payload)
    VALUES(v_match.id,v_match.revision,CASE WHEN v_opponent=v_match.player_one THEN v_match.player_two ELSE v_match.player_one END,
      'timeout',jsonb_build_object('reason','clock_expired','winner_id',v_opponent));
  RETURN v_match;
END $;

REVOKE ALL ON FUNCTION public.pool_check_timeout(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.pool_check_timeout(uuid) TO service_role;
