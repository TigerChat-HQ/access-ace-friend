ALTER TABLE public.draft_matches ADD COLUMN IF NOT EXISTS draw_offer_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;
CREATE OR REPLACE FUNCTION public.offer_draft_draw(p_id uuid)
RETURNS public.draft_matches LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $fn$
DECLARE v_match public.draft_matches%ROWTYPE;
BEGIN
 SELECT * INTO v_match FROM public.draft_matches WHERE id=p_id FOR UPDATE;
 IF NOT FOUND OR v_match.status<>'active' OR v_match.vs_ai OR v_match.player_black IS NULL THEN RAISE EXCEPTION 'Draw offers are available only in active player matches'; END IF;
 IF (select auth.uid()) NOT IN(v_match.player_white,v_match.player_black) THEN RAISE EXCEPTION 'Not a match participant'; END IF;
 IF v_match.draw_offer_by IS NOT NULL AND v_match.draw_offer_by<>(select auth.uid()) THEN RAISE EXCEPTION 'Opponent has offered a draw; accept it'; END IF;
 UPDATE public.draft_matches SET draw_offer_by=(select auth.uid()),revision=revision+1,updated_at=now() WHERE id=p_id RETURNING * INTO v_match;
 RETURN v_match;
END;
$fn$;
CREATE OR REPLACE FUNCTION public.accept_draft_draw(p_id uuid)
RETURNS public.draft_matches LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $fn$
DECLARE v_match public.draft_matches%ROWTYPE;
BEGIN
 SELECT * INTO v_match FROM public.draft_matches WHERE id=p_id FOR UPDATE;
 IF NOT FOUND OR v_match.status<>'active' OR v_match.draw_offer_by IS NULL OR v_match.draw_offer_by=(select auth.uid()) THEN RAISE EXCEPTION 'There is no opponent draw offer to accept'; END IF;
 IF (select auth.uid()) NOT IN(v_match.player_white,v_match.player_black) THEN RAISE EXCEPTION 'Not a match participant'; END IF;
 UPDATE public.draft_matches SET status='finished',winner='draw',draw_offer_by=NULL,revision=revision+1,updated_at=now() WHERE id=p_id RETURNING * INTO v_match;
 RETURN v_match;
END;
$fn$;
REVOKE ALL ON FUNCTION public.offer_draft_draw(uuid) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.accept_draft_draw(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.offer_draft_draw(uuid),public.accept_draft_draw(uuid) TO authenticated;
