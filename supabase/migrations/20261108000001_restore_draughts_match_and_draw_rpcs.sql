-- Secure online Draughts match lifecycle RPCs and agreed draw flow.
CREATE OR REPLACE FUNCTION public.create_draft_match(p_vs_ai boolean DEFAULT false)
RETURNS public.draft_matches LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $fn$
DECLARE v_board jsonb; v_match public.draft_matches%ROWTYPE;
BEGIN
 IF (select auth.uid()) IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
 SELECT jsonb_agg(CASE
  WHEN ((n/8+n%8)%2=1) AND n/8<3 THEN jsonb_build_object('c','b','k',false)
  WHEN ((n/8+n%8)%2=1) AND n/8>4 THEN jsonb_build_object('c','w','k',false)
  ELSE 'null'::jsonb END ORDER BY n) INTO v_board FROM generate_series(0,63) AS g(n);
 INSERT INTO public.draft_matches(player_white,player_black,vs_ai,board,current_turn,status)
 VALUES((select auth.uid()),NULL,coalesce(p_vs_ai,false),v_board,'w',CASE WHEN coalesce(p_vs_ai,false) THEN 'active' ELSE 'waiting' END)
 RETURNING * INTO v_match;
 RETURN v_match;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.join_draft_match(p_match_id uuid DEFAULT NULL,p_code text DEFAULT NULL)
RETURNS public.draft_matches LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $fn$
DECLARE v_match public.draft_matches%ROWTYPE;
BEGIN
 IF (select auth.uid()) IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
 UPDATE public.draft_matches SET player_black=(select auth.uid()),status='active',current_turn='w',
  revision=revision+1,updated_at=now()
 WHERE status='waiting' AND vs_ai=false AND player_black IS NULL AND player_white<>(select auth.uid())
  AND ((p_match_id IS NOT NULL AND id=p_match_id) OR (p_code IS NOT NULL AND upper(join_code)=upper(p_code)))
 RETURNING * INTO v_match;
 IF NOT FOUND THEN RAISE EXCEPTION 'Match is unavailable or already joined'; END IF;
 RETURN v_match;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.commit_draft_move(p_id uuid,p_revision integer,p_board jsonb,p_turn text,p_move jsonb,p_status text,p_winner text)
RETURNS public.draft_matches LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $fn$
DECLARE v_match public.draft_matches%ROWTYPE; v_mover text; v_expected text;
BEGIN
 SELECT * INTO v_match FROM public.draft_matches WHERE id=p_id FOR UPDATE;
 IF NOT FOUND OR v_match.status<>'active' THEN RAISE EXCEPTION 'Match is not active'; END IF;
 IF v_match.revision<>p_revision THEN RAISE EXCEPTION 'Board revision conflict'; END IF;
 IF v_match.player_white=(select auth.uid()) AND v_match.current_turn='w' THEN v_mover:='w';
 ELSIF v_match.player_black=(select auth.uid()) AND v_match.current_turn='b' THEN v_mover:='b';
 ELSIF v_match.vs_ai AND v_match.player_white=(select auth.uid()) AND v_match.current_turn='b' THEN v_mover:='b';
 ELSE RAISE EXCEPTION 'Not your turn or not a match participant'; END IF;
 IF v_match.current_turn<>v_mover THEN RAISE EXCEPTION 'Not your turn'; END IF;
 IF p_turn NOT IN('w','b') OR p_turn=v_mover THEN RAISE EXCEPTION 'Invalid next turn'; END IF;
 IF p_status NOT IN('active','finished') THEN RAISE EXCEPTION 'Invalid match status'; END IF;
 v_expected:=CASE WHEN v_mover='w' THEN 'white' ELSE 'black' END;
 IF p_status='finished' AND p_winner IS DISTINCT FROM v_expected THEN RAISE EXCEPTION 'Invalid winner'; END IF;
 IF p_status='active' AND p_winner IS NOT NULL THEN RAISE EXCEPTION 'Unexpected winner'; END IF;
 UPDATE public.draft_matches SET board=p_board,current_turn=p_turn,last_move=p_move,status=p_status,winner=p_winner,
  draw_offer_by=NULL,revision=revision+1,updated_at=now()
 WHERE id=p_id RETURNING * INTO v_match;
 RETURN v_match;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.resign_draft_match(p_id uuid)
RETURNS public.draft_matches LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $fn$
DECLARE v_match public.draft_matches%ROWTYPE; v_winner text;
BEGIN
 SELECT * INTO v_match FROM public.draft_matches WHERE id=p_id FOR UPDATE;
 IF NOT FOUND OR v_match.status<>'active' THEN RAISE EXCEPTION 'Match is not active'; END IF;
 IF v_match.player_white=(select auth.uid()) THEN v_winner:='black';
 ELSIF v_match.player_black=(select auth.uid()) THEN v_winner:='white';
 ELSE RAISE EXCEPTION 'Not a match participant'; END IF;
 UPDATE public.draft_matches SET status='finished',winner=v_winner,revision=revision+1,updated_at=now()
 WHERE id=p_id RETURNING * INTO v_match;
 RETURN v_match;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.offer_draft_draw(p_id uuid)
RETURNS public.draft_matches LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $fn$
DECLARE v_match public.draft_matches%ROWTYPE;
BEGIN
 SELECT * INTO v_match FROM public.draft_matches WHERE id=p_id FOR UPDATE;
 IF NOT FOUND OR v_match.status<>'active' OR v_match.vs_ai OR v_match.player_black IS NULL THEN RAISE EXCEPTION 'Draw offers are available only in active player matches'; END IF;
 IF (select auth.uid()) NOT IN(v_match.player_white,v_match.player_black) THEN RAISE EXCEPTION 'Not a match participant'; END IF;
 IF v_match.draw_offer_by IS NOT NULL AND v_match.draw_offer_by<>(select auth.uid()) THEN RAISE EXCEPTION 'Opponent has offered a draw; accept it'; END IF;
 UPDATE public.draft_matches SET draw_offer_by=(select auth.uid()),revision=revision+1,updated_at=now()
 WHERE id=p_id RETURNING * INTO v_match;
 RETURN v_match;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.accept_draft_draw(p_id uuid)
RETURNS public.draft_matches LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $fn$
DECLARE v_match public.draft_matches%ROWTYPE;
BEGIN
 SELECT * INTO v_match FROM public.draft_matches WHERE id=p_id FOR UPDATE;
 IF NOT FOUND OR v_match.status<>'active' OR v_match.draw_offer_by IS NULL OR v_match.draw_offer_by=(select auth.uid()) THEN
  RAISE EXCEPTION 'There is no opponent draw offer to accept';
 END IF;
 IF (select auth.uid()) NOT IN(v_match.player_white,v_match.player_black) THEN RAISE EXCEPTION 'Not a match participant'; END IF;
 UPDATE public.draft_matches SET status='finished',winner='draw',draw_offer_by=NULL,revision=revision+1,updated_at=now()
 WHERE id=p_id RETURNING * INTO v_match;
 RETURN v_match;
END;
$fn$;

REVOKE ALL ON FUNCTION public.create_draft_match(boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.join_draft_match(uuid,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.commit_draft_move(uuid,integer,jsonb,text,jsonb,text,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.resign_draft_match(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.offer_draft_draw(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.accept_draft_draw(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_draft_match(boolean),public.join_draft_match(uuid,text),
 public.commit_draft_move(uuid,integer,jsonb,text,jsonb,text,text),public.resign_draft_match(uuid),
 public.offer_draft_draw(uuid),public.accept_draft_draw(uuid) TO authenticated;
