-- Harden Draughts RPC permissions, support AI turns, and publish season changes.
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
 IF p_turn NOT IN('w','b') OR p_turn=v_mover THEN RAISE EXCEPTION 'Invalid next turn'; END IF;
 IF p_status NOT IN('active','finished') THEN RAISE EXCEPTION 'Invalid match status'; END IF;
 v_expected:=CASE WHEN v_mover='w' THEN 'white' ELSE 'black' END;
 IF p_status='finished' AND p_winner IS DISTINCT FROM v_expected THEN RAISE EXCEPTION 'Invalid winner'; END IF;
 IF p_status='active' AND p_winner IS NOT NULL THEN RAISE EXCEPTION 'Unexpected winner'; END IF;
 UPDATE public.draft_matches SET board=p_board,current_turn=p_turn,last_move=p_move,status=p_status,winner=p_winner,
  draw_offer_by=NULL,revision=revision+1,updated_at=now() WHERE id=p_id RETURNING * INTO v_match;
 RETURN v_match;
END;
$fn$;
ALTER FUNCTION public.draughts_division(integer) SET search_path=pg_catalog;
REVOKE ALL ON FUNCTION public.record_draughts_match_result() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.create_draft_match(boolean) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.join_draft_match(uuid,text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.commit_draft_move(uuid,integer,jsonb,text,jsonb,text,text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.resign_draft_match(uuid) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.offer_draft_draw(uuid) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.accept_draft_draw(uuid) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.close_draughts_season(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.create_draft_match(boolean),public.join_draft_match(uuid,text),
 public.commit_draft_move(uuid,integer,jsonb,text,jsonb,text,text),public.resign_draft_match(uuid),
 public.offer_draft_draw(uuid),public.accept_draft_draw(uuid),public.close_draughts_season(uuid) TO authenticated;
DO $fn$
BEGIN
 IF EXISTS(SELECT 1 FROM pg_publication WHERE pubname='supabase_realtime')
 AND NOT EXISTS(SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='draughts_seasons') THEN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.draughts_seasons;
 END IF;
END;
$fn$;
