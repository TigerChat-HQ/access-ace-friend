CREATE OR REPLACE FUNCTION public.commit_draft_move(p_id uuid, p_revision integer, p_board jsonb, p_turn text, p_move jsonb, p_status text, p_winner text)
 RETURNS draft_matches LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE m public.draft_matches;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in to play'; END IF;
 IF p_status NOT IN ('active','finished') OR p_turn NOT IN ('w','b') OR (p_winner IS NOT NULL AND p_winner NOT IN ('white','black')) THEN RAISE EXCEPTION 'Invalid move'; END IF;
 SELECT * INTO m FROM public.draft_matches WHERE id=p_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Match not found'; END IF;
 IF m.vs_ai THEN
   IF m.player_white <> auth.uid() THEN RAISE EXCEPTION 'Not your match'; END IF;
 ELSE
   IF (m.current_turn='w' AND m.player_white IS DISTINCT FROM auth.uid()) OR (m.current_turn='b' AND m.player_black IS DISTINCT FROM auth.uid()) THEN RAISE EXCEPTION 'Not your turn'; END IF;
 END IF;
 UPDATE public.draft_matches SET board=p_board,current_turn=p_turn,last_move=p_move,status=p_status,winner=p_winner,revision=revision+1,updated_at=now() WHERE id=p_id AND revision=p_revision AND status='active' RETURNING * INTO m;
 IF NOT FOUND THEN RAISE EXCEPTION 'Match changed; refresh before moving'; END IF;
 RETURN m;
END $function$;

ALTER TABLE public.stories ALTER COLUMN image_url DROP NOT NULL;
ALTER TABLE public.stories ADD COLUMN IF NOT EXISTS audience text NOT NULL DEFAULT 'everyone';
ALTER TABLE public.stories ADD COLUMN IF NOT EXISTS background_color text;