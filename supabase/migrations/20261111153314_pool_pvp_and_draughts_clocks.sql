-- Pool online rooms/matchmaking and server-enforced Draughts clocks.
-- Depends on 20261111170000_games_arena_expansion_foundation.sql.

ALTER TABLE public.pool_matches
  ADD COLUMN IF NOT EXISTS room_code text UNIQUE,
  ADD COLUMN IF NOT EXISTS rules_version integer NOT NULL DEFAULT 1 CHECK (rules_version BETWEEN 1 AND 10),
  ADD COLUMN IF NOT EXISTS game_rules jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS started_at timestamptz,
  ADD COLUMN IF NOT EXISTS finished_at timestamptz;

CREATE TABLE IF NOT EXISTS public.pool_match_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mode text NOT NULL CHECK (mode IN ('eight_ball','nine_ball')),
  rating integer NOT NULL DEFAULT 1000 CHECK (rating BETWEEN 0 AND 5000),
  clock_seconds integer NOT NULL DEFAULT 600 CHECK (clock_seconds BETWEEN 30 AND 7200),
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','matched','cancelled','expired')),
  match_id uuid REFERENCES public.pool_matches(id) ON DELETE SET NULL,
  queued_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '2 minutes')
);
CREATE UNIQUE INDEX IF NOT EXISTS pool_queue_one_active_per_user
  ON public.pool_match_queue(user_id) WHERE status='queued';
CREATE INDEX IF NOT EXISTS pool_queue_pairing_idx
  ON public.pool_match_queue(mode,rating,queued_at) WHERE status='queued';
ALTER TABLE public.pool_match_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Pool queue owner reads own ticket" ON public.pool_match_queue
  FOR SELECT TO authenticated USING ((select auth.uid())=user_id);
REVOKE INSERT, UPDATE, DELETE ON public.pool_match_queue FROM anon, authenticated;
GRANT SELECT ON public.pool_match_queue TO authenticated;

CREATE OR REPLACE FUNCTION public.create_pool_room(
  p_mode text DEFAULT 'eight_ball',p_visibility text DEFAULT 'private',p_clock_seconds integer DEFAULT 600
) RETURNS public.pool_matches
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE v_user uuid := (select auth.uid()); v_match public.pool_matches%ROWTYPE;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
  IF p_mode NOT IN ('eight_ball','nine_ball') OR p_visibility NOT IN ('private','public')
     OR p_clock_seconds NOT BETWEEN 30 AND 7200 THEN RAISE EXCEPTION 'Invalid Pool room settings'; END IF;
  INSERT INTO public.pool_matches(player_one,mode,status,visibility,clock_seconds,player_one_clock_ms,player_two_clock_ms,room_code,game_rules)
  VALUES(v_user,p_mode,'waiting',p_visibility,p_clock_seconds,p_clock_seconds*1000::bigint,p_clock_seconds*1000::bigint,
    upper(substr(replace(gen_random_uuid()::text,'-',''),1,8)),
    jsonb_build_object('version',1,'mode',p_mode,'break_rule','winner_breaks','foul_ball_in_hand',true))
  RETURNING * INTO v_match;
  RETURN v_match;
END $$;

CREATE OR REPLACE FUNCTION public.join_pool_room(p_match_id uuid,p_room_code text DEFAULT NULL)
RETURNS public.pool_matches
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE v_user uuid := (select auth.uid()); v_match public.pool_matches%ROWTYPE;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
  SELECT * INTO v_match FROM public.pool_matches WHERE id=p_match_id FOR UPDATE;
  IF NOT FOUND OR v_match.status<>'waiting' OR v_match.player_one=v_user THEN RAISE EXCEPTION 'Pool room is unavailable'; END IF;
  IF v_match.visibility='private' AND upper(coalesce(trim(p_room_code),''))<>v_match.room_code THEN RAISE EXCEPTION 'Invalid room code'; END IF;
  UPDATE public.pool_matches SET player_two=v_user,status='active',current_turn=player_one,
    clock_started_at=now(),started_at=now(),updated_at=now()
    WHERE id=p_match_id RETURNING * INTO v_match;
  RETURN v_match;
END $$;

CREATE OR REPLACE FUNCTION public.enqueue_pool_match(p_mode text DEFAULT 'eight_ball',p_rating integer DEFAULT 1000,p_clock_seconds integer DEFAULT 600)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE v_user uuid := (select auth.uid()); v_ticket uuid; v_candidate public.pool_match_queue%ROWTYPE; v_match public.pool_matches%ROWTYPE;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
  IF p_mode NOT IN ('eight_ball','nine_ball') OR p_rating NOT BETWEEN 0 AND 5000
     OR p_clock_seconds NOT BETWEEN 30 AND 7200 THEN RAISE EXCEPTION 'Invalid matchmaking settings'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('pool-matchmaking:'||p_mode));
  UPDATE public.pool_match_queue SET status='expired' WHERE status='queued' AND expires_at<now();
  UPDATE public.pool_match_queue SET status='cancelled' WHERE user_id=v_user AND status='queued';
  INSERT INTO public.pool_match_queue(user_id,mode,rating,clock_seconds) VALUES(v_user,p_mode,p_rating,p_clock_seconds) RETURNING id INTO v_ticket;
  SELECT * INTO v_candidate FROM public.pool_match_queue q WHERE q.status='queued' AND q.user_id<>v_user
    AND q.mode=p_mode AND q.clock_seconds=p_clock_seconds AND abs(q.rating-p_rating)<=200
    ORDER BY q.queued_at FOR UPDATE SKIP LOCKED LIMIT 1;
  IF NOT FOUND THEN RETURN jsonb_build_object('status','queued','queue_id',v_ticket,'match_id',NULL); END IF;
  INSERT INTO public.pool_matches(player_one,player_two,mode,status,visibility,current_turn,clock_seconds,
    player_one_clock_ms,player_two_clock_ms,clock_started_at,started_at,game_rules)
  VALUES(v_candidate.user_id,v_user,p_mode,'active','private',v_candidate.user_id,p_clock_seconds,
    p_clock_seconds*1000::bigint,p_clock_seconds*1000::bigint,now(),now(),
    jsonb_build_object('version',1,'mode',p_mode,'break_rule','winner_breaks','foul_ball_in_hand',true))
  RETURNING * INTO v_match;
  UPDATE public.pool_match_queue SET status='matched',match_id=v_match.id WHERE id IN(v_candidate.id,v_ticket);
  RETURN jsonb_build_object('status','matched','queue_id',v_ticket,'match_id',v_match.id);
END $$;

CREATE OR REPLACE FUNCTION public.cancel_pool_match_queue()
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE v_user uuid := (select auth.uid()); v_count integer;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
  UPDATE public.pool_match_queue SET status='cancelled' WHERE user_id=v_user AND status='queued';
  GET DIAGNOSTICS v_count=ROW_COUNT;
  RETURN v_count>0;
END $$;

ALTER TABLE public.draughts_tournaments
  ADD COLUMN IF NOT EXISTS clock_seconds integer NOT NULL DEFAULT 600 CHECK (clock_seconds BETWEEN 30 AND 7200),
  ADD COLUMN IF NOT EXISTS increment_seconds integer NOT NULL DEFAULT 5 CHECK (increment_seconds BETWEEN 0 AND 60),
  ADD COLUMN IF NOT EXISTS win_points integer NOT NULL DEFAULT 3 CHECK (win_points BETWEEN 0 AND 10),
  ADD COLUMN IF NOT EXISTS draw_points integer NOT NULL DEFAULT 1 CHECK (draw_points BETWEEN 0 AND 10),
  ADD COLUMN IF NOT EXISTS loss_points integer NOT NULL DEFAULT 0 CHECK (loss_points BETWEEN 0 AND 10),
  ADD COLUMN IF NOT EXISTS bye_points integer NOT NULL DEFAULT 3 CHECK (bye_points BETWEEN 0 AND 10),
  ADD COLUMN IF NOT EXISTS tie_breakers text[] NOT NULL DEFAULT ARRAY['head_to_head','wins','buchholz']::text[]
    CHECK (cardinality(tie_breakers) BETWEEN 1 AND 5 AND tie_breakers <@ ARRAY['head_to_head','wins','buchholz','sonneborn_berger','rating']::text[]);

CREATE OR REPLACE FUNCTION public.commit_draft_move(
  p_id uuid,p_revision integer,p_board jsonb,p_turn text,p_move jsonb,p_status text,p_winner text
) RETURNS public.draft_matches
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE
  v_match public.draft_matches%ROWTYPE; v_user uuid := (select auth.uid()); v_mover text;
  v_elapsed bigint; v_white bigint; v_black bigint; v_flag_winner text; v_expected text;
BEGIN
  SELECT * INTO v_match FROM public.draft_matches WHERE id=p_id FOR UPDATE;
  IF NOT FOUND OR v_match.status<>'active' THEN RAISE EXCEPTION 'Match is not active'; END IF;
  IF v_match.revision<>p_revision THEN RAISE EXCEPTION 'Board revision conflict'; END IF;
  IF v_match.player_white=v_user AND v_match.current_turn='w' THEN v_mover:='w';
  ELSIF v_match.player_black=v_user AND v_match.current_turn='b' THEN v_mover:='b';
  ELSIF v_match.vs_ai AND v_match.player_white=v_user AND v_match.current_turn='b' THEN v_mover:='b';
  ELSE RAISE EXCEPTION 'Not your turn or not a match participant'; END IF;
  IF p_turn NOT IN ('w','b') OR p_turn=v_mover OR p_status NOT IN ('active','finished')
     OR (p_winner IS NOT NULL AND p_winner NOT IN ('white','black','draw')) THEN RAISE EXCEPTION 'Invalid move payload'; END IF;
  v_expected:=CASE WHEN v_mover='w' THEN 'white' ELSE 'black' END;
  IF p_status='finished' AND p_winner IS DISTINCT FROM v_expected THEN RAISE EXCEPTION 'Invalid winner'; END IF;
  IF p_status='active' AND p_winner IS NOT NULL THEN RAISE EXCEPTION 'Unexpected winner'; END IF;
  v_white:=v_match.white_clock_ms; v_black:=v_match.black_clock_ms;
  IF v_match.initial_clock_seconds IS NOT NULL THEN
    v_elapsed:=greatest(0,(extract(epoch FROM (now()-coalesce(v_match.clock_started_at,now())))*1000)::bigint);
    IF v_mover='w' THEN v_white:=greatest(0,v_white-v_elapsed); ELSE v_black:=greatest(0,v_black-v_elapsed); END IF;
    IF (v_mover='w' AND v_white=0) OR (v_mover='b' AND v_black=0) THEN
      v_flag_winner:=CASE WHEN v_mover='w' THEN 'black' ELSE 'white' END;
      UPDATE public.draft_matches SET status='finished',winner=v_flag_winner,white_clock_ms=v_white,
        black_clock_ms=v_black,clock_started_at=NULL,revision=revision+1,updated_at=now()
        WHERE id=p_id RETURNING * INTO v_match;
      RETURN v_match;
    END IF;
    IF v_mover='w' THEN v_white:=v_white+v_match.increment_seconds*1000; ELSE v_black:=v_black+v_match.increment_seconds*1000; END IF;
  END IF;
  UPDATE public.draft_matches SET board=p_board,current_turn=p_turn,last_move=p_move,status=p_status,winner=p_winner,
    draw_offer_by=NULL,revision=revision+1,updated_at=now(),white_clock_ms=v_white,black_clock_ms=v_black,
    clock_started_at=CASE WHEN p_status='active' THEN now() ELSE NULL END
    WHERE id=p_id RETURNING * INTO v_match;
  RETURN v_match;
END $$;


CREATE OR REPLACE FUNCTION public.join_pool_room_by_code(p_room_code text)
RETURNS public.pool_matches
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE v_user uuid := (select auth.uid()); v_match public.pool_matches%ROWTYPE;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
  SELECT * INTO v_match FROM public.pool_matches
    WHERE room_code=upper(trim(coalesce(p_room_code,''))) AND status='waiting' FOR UPDATE;
  IF NOT FOUND OR v_match.player_one=v_user THEN RAISE EXCEPTION 'Pool room is unavailable'; END IF;
  UPDATE public.pool_matches SET player_two=v_user,status='active',current_turn=player_one,
    clock_started_at=now(),started_at=now(),updated_at=now()
    WHERE id=v_match.id RETURNING * INTO v_match;
  RETURN v_match;
END $$;

CREATE OR REPLACE FUNCTION public.list_pool_public_rooms()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
BEGIN
  IF (select auth.uid()) IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
  RETURN coalesce((SELECT jsonb_agg(jsonb_build_object(
    'id',id,'mode',mode,'player_one',player_one,'created_at',created_at,'clock_seconds',clock_seconds
  ) ORDER BY created_at DESC) FROM (
    SELECT id,mode,player_one,created_at,clock_seconds FROM public.pool_matches
    WHERE status='waiting' AND visibility='public' ORDER BY created_at DESC LIMIT 25
  ) rooms),'[]'::jsonb);
END $$;

DROP POLICY IF EXISTS "Pool participants read matches" ON public.pool_matches;
CREATE POLICY "Pool participants read matches" ON public.pool_matches
  FOR SELECT TO authenticated USING (
    player_one=(select auth.uid()) OR player_two=(select auth.uid())
    OR (visibility='public' AND status IN ('waiting','active','finished'))
  );


CREATE OR REPLACE FUNCTION public.claim_draughts_timeout(p_id uuid)
RETURNS public.draft_matches
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE
  v_match public.draft_matches%ROWTYPE;
  v_user uuid := (select auth.uid());
  v_remaining bigint;
  v_winner text;
BEGIN
  SELECT * INTO v_match FROM public.draft_matches WHERE id=p_id FOR UPDATE;
  IF NOT FOUND OR v_match.status<>'active' OR v_match.initial_clock_seconds IS NULL THEN
    RAISE EXCEPTION 'Timed match is unavailable';
  END IF;
  IF v_user IS NULL OR v_user NOT IN (v_match.player_white,v_match.player_black) THEN RAISE EXCEPTION 'Match participant required'; END IF;
  v_remaining:=CASE WHEN v_match.current_turn='w' THEN v_match.white_clock_ms ELSE v_match.black_clock_ms END;
  v_remaining:=v_remaining-greatest(0,(extract(epoch FROM (now()-coalesce(v_match.clock_started_at,now())))*1000)::bigint);
  IF v_remaining>0 THEN RAISE EXCEPTION 'Clock has not expired'; END IF;
  v_winner:=CASE WHEN v_match.current_turn='w' THEN 'black' ELSE 'white' END;
  UPDATE public.draft_matches SET status='finished',winner=v_winner,
    white_clock_ms=CASE WHEN current_turn='w' THEN 0 ELSE white_clock_ms END,
    black_clock_ms=CASE WHEN current_turn='b' THEN 0 ELSE black_clock_ms END,
    clock_started_at=NULL,revision=revision+1,updated_at=now()
    WHERE id=p_id RETURNING * INTO v_match;
  RETURN v_match;
END $$;

REVOKE ALL ON FUNCTION public.claim_draughts_timeout(uuid) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.create_pool_room(text,text,integer) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.join_pool_room_by_code(text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.list_pool_public_rooms() FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.join_pool_room(uuid,text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.enqueue_pool_match(text,integer,integer) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.cancel_pool_match_queue() FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.commit_draft_move(uuid,integer,jsonb,text,jsonb,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.claim_draughts_timeout(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_pool_room(text,text,integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.join_pool_room_by_code(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_pool_public_rooms() TO authenticated;
GRANT EXECUTE ON FUNCTION public.join_pool_room(uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.enqueue_pool_match(text,integer,integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_pool_match_queue() TO authenticated;
GRANT EXECUTE ON FUNCTION public.commit_draft_move(uuid,integer,jsonb,text,jsonb,text,text) TO authenticated;


-- Server-authoritative Pool gameplay. Only the Edge Function service role can
-- initialize state or commit a simulated shot; authenticated clients remain read-only.
CREATE UNIQUE INDEX IF NOT EXISTS pool_events_request_id_idx
  ON public.pool_match_events(match_id, ((payload->>'request_id')))
  WHERE payload ? 'request_id';

CREATE OR REPLACE FUNCTION public.pool_initialize_match(p_match_id uuid,p_actor_id uuid,p_state jsonb)
RETURNS public.pool_matches
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE v_match public.pool_matches%ROWTYPE;
BEGIN
  SELECT * INTO v_match FROM public.pool_matches WHERE id=p_match_id FOR UPDATE;
  IF NOT FOUND OR v_match.status<>'active' OR p_actor_id IS NULL
     OR p_actor_id NOT IN (v_match.player_one,v_match.player_two) THEN
    RAISE EXCEPTION 'Active Pool match participant required';
  END IF;
  IF v_match.state IS NOT NULL AND v_match.state<>'{}'::jsonb THEN RETURN v_match; END IF;
  IF jsonb_typeof(p_state->'balls')<>'array' OR p_state->>'mode'<>v_match.mode
     OR jsonb_array_length(p_state->'balls') NOT BETWEEN 2 AND 16 THEN
    RAISE EXCEPTION 'Invalid initial Pool state';
  END IF;
  UPDATE public.pool_matches SET state=p_state,revision=revision+1,updated_at=now()
    WHERE id=p_match_id RETURNING * INTO v_match;
  INSERT INTO public.pool_match_events(match_id,revision,actor_id,event_type,payload)
    VALUES(v_match.id,v_match.revision,p_actor_id,'turn',jsonb_build_object('event','rack_initialized','engine_version',1));
  RETURN v_match;
END $$;

CREATE OR REPLACE FUNCTION public.pool_commit_server_shot(
  p_match_id uuid,p_actor_id uuid,p_expected_revision integer,p_state jsonb,
  p_next_turn uuid,p_status text,p_winner_id uuid,p_event_type text,p_event jsonb
) RETURNS public.pool_matches
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE v_match public.pool_matches%ROWTYPE; v_duplicate public.pool_match_events%ROWTYPE;
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
  UPDATE public.pool_matches SET state=p_state,revision=revision+1,current_turn=p_next_turn,status=p_status,
    winner_id=p_winner_id,finished_at=CASE WHEN p_status='finished' THEN now() ELSE NULL END,updated_at=now()
    WHERE id=p_match_id RETURNING * INTO v_match;
  INSERT INTO public.pool_match_events(match_id,revision,actor_id,event_type,payload)
    VALUES(v_match.id,v_match.revision,p_actor_id,p_event_type,p_event);
  RETURN v_match;
END $$;

REVOKE ALL ON FUNCTION public.pool_initialize_match(uuid,uuid,jsonb) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.pool_commit_server_shot(uuid,uuid,integer,jsonb,uuid,text,uuid,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.pool_initialize_match(uuid,uuid,jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.pool_commit_server_shot(uuid,uuid,integer,jsonb,uuid,text,uuid,text,jsonb) TO service_role;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname='supabase_realtime')
     AND NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='pool_matches') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.pool_matches;
  END IF;
END $$;

