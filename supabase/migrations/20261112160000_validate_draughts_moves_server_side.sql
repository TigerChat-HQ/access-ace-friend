-- Validate every Draughts move against the persisted board on the server.
-- The client-supplied board/status/winner are treated as assertions only; the
-- server derives the authoritative board and terminal result itself.

CREATE OR REPLACE FUNCTION private.draughts_capture_paths(
  p_board jsonb,
  p_from integer,
  p_piece jsonb,
  p_captures integer[] DEFAULT ARRAY[]::integer[]
)
RETURNS TABLE(to_index integer, captures integer[])
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'pg_catalog', 'public', 'private'
AS $$
DECLARE
  v_r integer := p_from / 8;
  v_c integer := p_from % 8;
  v_color text := p_piece->>'c';
  v_king boolean := coalesce((p_piece->>'k')::boolean, false);
  v_dirs integer[][];
  v_dir integer[];
  v_dr integer;
  v_dc integer;
  v_mr integer;
  v_mc integer;
  v_mid integer;
  v_tr integer;
  v_tc integer;
  v_to integer;
  v_mid_piece jsonb;
  v_next_piece jsonb;
  v_next_board jsonb;
  v_next_caps integer[];
  v_has_further boolean;
BEGIN
  IF v_king THEN
    v_dirs := ARRAY[ARRAY[-1,-1],ARRAY[-1,1],ARRAY[1,-1],ARRAY[1,1]];
  ELSIF v_color='w' THEN
    v_dirs := ARRAY[ARRAY[-1,-1],ARRAY[-1,1]];
  ELSE
    v_dirs := ARRAY[ARRAY[1,-1],ARRAY[1,1]];
  END IF;

  FOREACH v_dir SLICE 1 IN ARRAY v_dirs LOOP
    v_mr := v_r + v_dir[1];
    v_mc := v_c + v_dir[2];

    IF v_king THEN
      WHILE v_mr BETWEEN 0 AND 7 AND v_mc BETWEEN 0 AND 7
        AND p_board->(v_mr*8+v_mc) = 'null' LOOP
        v_mr := v_mr + v_dir[1];
        v_mc := v_mc + v_dir[2];
      END LOOP;
    END IF;

    IF v_mr NOT BETWEEN 0 AND 7 OR v_mc NOT BETWEEN 0 AND 7 THEN CONTINUE; END IF;
    v_mid := v_mr*8+v_mc;
    v_mid_piece := p_board->v_mid;
    IF v_mid_piece IS NULL OR v_mid_piece='null'::jsonb OR v_mid_piece->>'c'=v_color THEN CONTINUE; END IF;

    v_tr := v_mr + v_dir[1];
    v_tc := v_mc + v_dir[2];
    WHILE v_tr BETWEEN 0 AND 7 AND v_tc BETWEEN 0 AND 7
      AND p_board->(v_tr*8+v_tc) = 'null' LOOP
      v_to := v_tr*8+v_tc;
      v_next_board := jsonb_set(p_board, ARRAY[p_from::text], 'null'::jsonb);
      v_next_board := jsonb_set(v_next_board, ARRAY[v_mid::text], 'null'::jsonb);
      v_next_piece := jsonb_build_object(
        'c',v_color,
        'k',v_king OR (v_color='w' AND v_tr=0) OR (v_color='b' AND v_tr=7)
      );
      v_next_board := jsonb_set(v_next_board, ARRAY[v_to::text], v_next_piece);
      v_next_caps := array_append(p_captures,v_mid);

      SELECT EXISTS (
        SELECT 1 FROM private.draughts_capture_paths(v_next_board,v_to,v_next_piece,v_next_caps)
      ) INTO v_has_further;

      IF v_has_further THEN
        RETURN QUERY SELECT cp.to_index,cp.captures
          FROM private.draughts_capture_paths(v_next_board,v_to,v_next_piece,v_next_caps) cp;
      ELSE
        to_index := v_to;
        captures := v_next_caps;
        RETURN NEXT;
      END IF;

      IF NOT v_king THEN EXIT; END IF;
      v_tr := v_tr + v_dir[1];
      v_tc := v_tc + v_dir[2];
    END LOOP;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION private.draughts_has_legal_move(p_board jsonb,p_color text)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'pg_catalog','public','private'
AS $$
DECLARE
  v_i integer;
  v_r integer;
  v_c integer;
  v_dr integer;
  v_dc integer;
  v_dirs integer[][];
  v_dir integer[];
  v_piece jsonb;
  v_step integer;
BEGIN
  -- Captures are compulsory for every piece if any capture exists.
  FOR v_i IN 0..63 LOOP
    v_piece := p_board->v_i;
    IF v_piece IS NULL OR v_piece='null'::jsonb OR v_piece->>'c'<>p_color THEN CONTINUE; END IF;
    IF EXISTS (SELECT 1 FROM private.draughts_capture_paths(p_board,v_i,v_piece)) THEN RETURN true; END IF;
  END LOOP;

  FOR v_i IN 0..63 LOOP
    v_piece := p_board->v_i;
    IF v_piece IS NULL OR v_piece='null'::jsonb OR v_piece->>'c'<>p_color THEN CONTINUE; END IF;
    v_r := v_i/8; v_c := v_i%8;
    IF coalesce((v_piece->>'k')::boolean,false) THEN
      v_dirs := ARRAY[ARRAY[-1,-1],ARRAY[-1,1],ARRAY[1,-1],ARRAY[1,1]];
    ELSIF p_color='w' THEN
      v_dirs := ARRAY[ARRAY[-1,-1],ARRAY[-1,1]];
    ELSE
      v_dirs := ARRAY[ARRAY[1,-1],ARRAY[1,1]];
    END IF;
    FOREACH v_dir SLICE 1 IN ARRAY v_dirs LOOP
      v_step := 1;
      LOOP
        EXIT WHEN v_r+v_dir[1]*v_step NOT BETWEEN 0 AND 7 OR v_c+v_dir[2]*v_step NOT BETWEEN 0 AND 7;
        IF p_board->((v_r+v_dir[1]*v_step)*8+(v_c+v_dir[2]*v_step)) <> 'null'::jsonb THEN EXIT; END IF;
        RETURN true;
        EXIT WHEN NOT coalesce((v_piece->>'k')::boolean,false);
        v_step := v_step+1;
      END LOOP;
    END LOOP;
  END LOOP;
  RETURN false;
END;
$$;

CREATE OR REPLACE FUNCTION public.commit_draft_move(
  p_id uuid,p_revision integer,p_board jsonb,p_turn text,p_move jsonb,p_status text,p_winner text
)
RETURNS public.draft_matches
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog','public','private','auth'
AS $function$
DECLARE
  v_match public.draft_matches%ROWTYPE;
  v_user uuid := auth.uid();
  v_mover text;
  v_piece jsonb;
  v_new_piece jsonb;
  v_new_board jsonb;
  v_from integer;
  v_to integer;
  v_caps integer[];
  v_expected_caps integer[];
  v_move record;
  v_r integer;
  v_c integer;
  v_tr integer;
  v_tc integer;
  v_dr integer;
  v_dc integer;
  v_steps integer;
  v_step integer;
  v_promote boolean;
  v_expected_status text;
  v_expected_winner text;
  v_elapsed bigint;
  v_white bigint;
  v_black bigint;
  v_flag_winner text;
BEGIN
  SELECT * INTO v_match FROM public.draft_matches WHERE id=p_id FOR UPDATE;
  IF NOT FOUND OR v_match.status<>'active' THEN RAISE EXCEPTION 'Match is not active'; END IF;
  IF v_match.revision<>p_revision THEN RAISE EXCEPTION 'Board revision conflict'; END IF;

  IF v_match.player_white=v_user AND v_match.current_turn='w' THEN v_mover:='w';
  ELSIF v_match.player_black=v_user AND v_match.current_turn='b' THEN v_mover:='b';
  ELSIF v_match.vs_ai AND v_match.player_white=v_user AND v_match.current_turn='b' THEN v_mover:='b';
  ELSE RAISE EXCEPTION 'Not your turn or not a match participant'; END IF;

  IF jsonb_typeof(v_match.board)<>'array' OR jsonb_array_length(v_match.board)<>64 THEN
    RAISE EXCEPTION 'Stored Draughts board is invalid';
  END IF;
  v_new_board:=v_match.board;

  IF p_move IS NULL OR p_move='null'::jsonb THEN
    IF private.draughts_has_legal_move(v_match.board,v_mover) THEN
      RAISE EXCEPTION 'Cannot claim no legal move while a move exists';
    END IF;
    v_expected_status:='finished';
    v_expected_winner:=CASE WHEN v_mover='w' THEN 'black' ELSE 'white' END;
    IF p_turn<>v_mover THEN RAISE EXCEPTION 'Invalid no-move turn'; END IF;
  ELSE
    IF jsonb_typeof(p_move)<>'object'
       OR jsonb_typeof(p_move->'from')<>'number'
       OR jsonb_typeof(p_move->'to')<>'number'
       OR jsonb_typeof(p_move->'captures')<>'array'
       OR jsonb_typeof(p_move->'promote')<>'boolean' THEN
      RAISE EXCEPTION 'Malformed Draughts move';
    END IF;
    v_from:=(p_move->>'from')::integer; v_to:=(p_move->>'to')::integer;
    IF v_from NOT BETWEEN 0 AND 63 OR v_to NOT BETWEEN 0 AND 63 OR v_from=v_to THEN
      RAISE EXCEPTION 'Move square is out of range';
    END IF;
    v_piece:=v_match.board->v_from;
    IF v_piece IS NULL OR v_piece='null'::jsonb OR v_piece->>'c'<>v_mover THEN
      RAISE EXCEPTION 'Move does not start with the current player piece';
    END IF;
    IF v_match.board->v_to <> 'null'::jsonb THEN RAISE EXCEPTION 'Destination square is occupied'; END IF;

    SELECT coalesce(array_agg(value::integer ORDER BY ordinality),ARRAY[]::integer[])
      INTO v_caps
      FROM jsonb_array_elements_text(p_move->'captures') WITH ORDINALITY AS c(value,ordinality);
    IF cardinality(v_caps)<> (SELECT count(DISTINCT x) FROM unnest(v_caps) x)
       OR EXISTS (SELECT 1 FROM unnest(v_caps) x WHERE x NOT BETWEEN 0 AND 63) THEN
      RAISE EXCEPTION 'Invalid captured-square list';
    END IF;

    IF EXISTS (
      SELECT 1 FROM generate_series(0,63) i
      CROSS JOIN LATERAL (SELECT v_match.board->i AS piece) q
      WHERE q.piece IS NOT NULL AND q.piece<>'null'::jsonb AND q.piece->>'c'=v_mover
        AND EXISTS (SELECT 1 FROM private.draughts_capture_paths(v_match.board,i,q.piece))
    ) THEN
      SELECT cp.captures INTO v_expected_caps
      FROM private.draughts_capture_paths(v_match.board,v_from,v_piece) cp
      WHERE cp.to_index=v_to AND cp.captures=v_caps
      LIMIT 1;
      IF v_expected_caps IS NULL THEN RAISE EXCEPTION 'Illegal or incomplete capture sequence'; END IF;
    ELSE
      IF cardinality(v_caps)<>0 THEN RAISE EXCEPTION 'Capture is not available for this move'; END IF;
      v_r:=v_from/8; v_c:=v_from%8; v_tr:=v_to/8; v_tc:=v_to%8;
      v_dr:=CASE WHEN v_tr>v_r THEN 1 ELSE -1 END;
      v_dc:=CASE WHEN v_tc>v_c THEN 1 ELSE -1 END;
      IF abs(v_tr-v_r)<>abs(v_tc-v_c) THEN RAISE EXCEPTION 'Move must be diagonal'; END IF;
      v_steps:=abs(v_tr-v_r);
      IF NOT coalesce((v_piece->>'k')::boolean,false) AND v_steps<>1 THEN
        RAISE EXCEPTION 'A man can move only one square';
      END IF;
      IF NOT coalesce((v_piece->>'k')::boolean,false) AND
         ((v_mover='w' AND v_dr<>-1) OR (v_mover='b' AND v_dr<>1)) THEN
        RAISE EXCEPTION 'Man cannot move backwards';
      END IF;
      FOR v_step IN 1..v_steps-1 LOOP
        IF v_match.board->((v_r+v_dr*v_step)*8+(v_c+v_dc*v_step)) <> 'null'::jsonb THEN
          RAISE EXCEPTION 'Move path is blocked';
        END IF;
      END LOOP;
    END IF;

    v_promote:=(v_mover='w' AND v_to/8=0) OR (v_mover='b' AND v_to/8=7);
    IF (p_move->>'promote')::boolean IS DISTINCT FROM (coalesce((v_piece->>'k')::boolean,false) OR v_promote) THEN
      RAISE EXCEPTION 'Invalid promotion flag';
    END IF;

    v_new_board:=jsonb_set(v_new_board,ARRAY[v_from::text],'null'::jsonb);
    FOREACH v_step IN ARRAY v_caps LOOP
      v_new_board:=jsonb_set(v_new_board,ARRAY[v_step::text],'null'::jsonb);
    END LOOP;
    v_new_piece:=jsonb_build_object('c',v_mover,'k',coalesce((v_piece->>'k')::boolean,false) OR v_promote);
    v_new_board:=jsonb_set(v_new_board,ARRAY[v_to::text],v_new_piece);

    IF p_turn<>(CASE WHEN v_mover='w' THEN 'b' ELSE 'w' END) THEN
      RAISE EXCEPTION 'Invalid next turn';
    END IF;
    IF private.draughts_has_legal_move(v_new_board,CASE WHEN v_mover='w' THEN 'b' ELSE 'w' END) THEN
      v_expected_status:='active'; v_expected_winner:=NULL;
    ELSE
      v_expected_status:='finished'; v_expected_winner:=CASE WHEN v_mover='w' THEN 'white' ELSE 'black' END;
    END IF;
  END IF;

  IF p_board IS DISTINCT FROM v_new_board THEN RAISE EXCEPTION 'Client board does not match the legal server-applied move'; END IF;
  IF p_status IS DISTINCT FROM v_expected_status OR p_winner IS DISTINCT FROM v_expected_winner THEN
    RAISE EXCEPTION 'Client-supplied match result does not match the server-calculated result';
  END IF;

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

  UPDATE public.draft_matches SET board=v_new_board,current_turn=p_turn,last_move=p_move,status=v_expected_status,
    winner=v_expected_winner,draw_offer_by=NULL,revision=revision+1,updated_at=now(),
    white_clock_ms=v_white,black_clock_ms=v_black,
    clock_started_at=CASE WHEN v_expected_status='active' THEN now() ELSE NULL END
  WHERE id=p_id RETURNING * INTO v_match;
  RETURN v_match;
END
$function$;

REVOKE ALL ON FUNCTION public.commit_draft_move(uuid,integer,jsonb,text,jsonb,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.commit_draft_move(uuid,integer,jsonb,text,jsonb,text,text) TO authenticated,service_role;
