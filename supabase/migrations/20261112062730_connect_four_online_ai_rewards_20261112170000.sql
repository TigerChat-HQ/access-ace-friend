-- Connect Four secure online matches, match history, ratings and rewards.
CREATE TABLE IF NOT EXISTS public.connect_four_matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_code text NOT NULL UNIQUE,
  player_one uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  player_two uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  board jsonb NOT NULL DEFAULT '[[0,0,0,0,0,0,0],[0,0,0,0,0,0,0],[0,0,0,0,0,0,0],[0,0,0,0,0,0,0],[0,0,0,0,0,0,0],[0,0,0,0,0,0,0]]'::jsonb,
  current_turn smallint NOT NULL DEFAULT 1 CHECK (current_turn IN (1,2)),
  status text NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting','active','finished','cancelled')),
  winner_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  move_count integer NOT NULL DEFAULT 0 CHECK (move_count BETWEEN 0 AND 42),
  revision integer NOT NULL DEFAULT 0 CHECK (revision >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  CHECK (player_two IS NULL OR player_two <> player_one),
  CHECK (winner_id IS NULL OR winner_id IN (player_one,player_two))
);
CREATE INDEX IF NOT EXISTS connect_four_waiting_idx ON public.connect_four_matches(created_at) WHERE status='waiting';
CREATE INDEX IF NOT EXISTS connect_four_history_idx ON public.connect_four_matches(finished_at DESC) WHERE status='finished';

CREATE TABLE IF NOT EXISTS public.connect_four_player_stats (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  wins integer NOT NULL DEFAULT 0 CHECK (wins >= 0),
  losses integer NOT NULL DEFAULT 0 CHECK (losses >= 0),
  draws integer NOT NULL DEFAULT 0 CHECK (draws >= 0),
  xp integer NOT NULL DEFAULT 0 CHECK (xp >= 0),
  coins integer NOT NULL DEFAULT 0 CHECK (coins >= 0),
  rating integer NOT NULL DEFAULT 1000 CHECK (rating BETWEEN 0 AND 5000),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.connect_four_reward_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  match_id uuid NOT NULL REFERENCES public.connect_four_matches(id) ON DELETE CASCADE,
  xp integer NOT NULL DEFAULT 0,
  coins integer NOT NULL DEFAULT 0,
  reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id,match_id)
);
ALTER TABLE public.connect_four_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.connect_four_player_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.connect_four_reward_ledger ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Connect Four participants read matches" ON public.connect_four_matches;
CREATE POLICY "Connect Four participants read matches" ON public.connect_four_matches
 FOR SELECT TO authenticated USING (player_one=(select auth.uid()) OR player_two=(select auth.uid()));
DROP POLICY IF EXISTS "Connect Four leaderboard readable" ON public.connect_four_player_stats;
CREATE POLICY "Connect Four leaderboard readable" ON public.connect_four_player_stats
 FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Connect Four own rewards readable" ON public.connect_four_reward_ledger;
CREATE POLICY "Connect Four own rewards readable" ON public.connect_four_reward_ledger
 FOR SELECT TO authenticated USING (user_id=(select auth.uid()));
REVOKE INSERT, UPDATE, DELETE ON public.connect_four_matches, public.connect_four_player_stats, public.connect_four_reward_ledger FROM anon, authenticated;
GRANT SELECT ON public.connect_four_matches, public.connect_four_player_stats, public.connect_four_reward_ledger TO authenticated;

CREATE OR REPLACE FUNCTION public.connect_four_has_won(p_board jsonb, p_row integer, p_col integer, p_player integer)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE SET search_path=pg_catalog AS $$
DECLARE d integer; signum integer; r integer; c integer; count_cells integer; dirs integer[][] := ARRAY[ARRAY[0,1],ARRAY[1,0],ARRAY[1,1],ARRAY[1,-1]];
BEGIN
 FOR d IN 1..4 LOOP
  count_cells := 1;
  FOR signum IN -1..1 LOOP
   IF signum=0 THEN CONTINUE; END IF;
   r:=p_row+dirs[d][1]*signum; c:=p_col+dirs[d][2]*signum;
   WHILE r BETWEEN 0 AND 5 AND c BETWEEN 0 AND 6 LOOP
    IF (p_board->r->>c)::integer <> p_player THEN EXIT; END IF;
    count_cells:=count_cells+1; r:=r+dirs[d][1]*signum; c:=c+dirs[d][2]*signum;
   END LOOP;
  END LOOP;
  IF count_cells>=4 THEN RETURN true; END IF;
 END LOOP;
 RETURN false;
END $$;

CREATE OR REPLACE FUNCTION public.create_connect_four_match()
RETURNS public.connect_four_matches LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE u uuid := auth.uid(); m public.connect_four_matches%ROWTYPE; code text;
BEGIN
 IF u IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
 LOOP
  code := upper(substr(replace(gen_random_uuid()::text,'-',''),1,6));
  EXIT WHEN NOT EXISTS(SELECT 1 FROM public.connect_four_matches WHERE room_code=code);
 END LOOP;
 INSERT INTO public.connect_four_matches(room_code,player_one) VALUES(code,u) RETURNING * INTO m;
 RETURN m;
END $$;

CREATE OR REPLACE FUNCTION public.join_connect_four_match(p_room_code text)
RETURNS public.connect_four_matches LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE u uuid := auth.uid(); m public.connect_four_matches%ROWTYPE;
BEGIN
 IF u IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
 SELECT * INTO m FROM public.connect_four_matches WHERE room_code=upper(trim(p_room_code)) FOR UPDATE;
 IF NOT FOUND OR m.status<>'waiting' OR m.player_one=u THEN RAISE EXCEPTION 'Room unavailable'; END IF;
 UPDATE public.connect_four_matches SET player_two=u,status='active',updated_at=now(),revision=revision+1 WHERE id=m.id RETURNING * INTO m;
 RETURN m;
END $$;

CREATE OR REPLACE FUNCTION public.connect_four_quick_match()
RETURNS public.connect_four_matches LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE u uuid := auth.uid(); m public.connect_four_matches%ROWTYPE;
BEGIN
 IF u IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
 SELECT * INTO m FROM public.connect_four_matches WHERE status='waiting' AND player_one<>u ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1;
 IF FOUND THEN
  UPDATE public.connect_four_matches SET player_two=u,status='active',updated_at=now(),revision=revision+1 WHERE id=m.id RETURNING * INTO m;
  RETURN m;
 END IF;
 RETURN public.create_connect_four_match();
END $$;

CREATE OR REPLACE FUNCTION public.connect_four_play_move(p_match_id uuid,p_revision integer,p_column integer)
RETURNS public.connect_four_matches LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE u uuid:=auth.uid(); m public.connect_four_matches%ROWTYPE; b jsonb; player integer; row_idx integer; cell integer; won boolean; xp_gain integer:=0; coin_gain integer:=0; v_p1_rating integer:=1000; v_p2_rating integer:=1000; v_p1_delta integer:=0; v_p2_delta integer:=0; v_expected_p1 numeric:=0.5; v_score_p1 numeric:=0.5;
BEGIN
 IF u IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
 IF p_column NOT BETWEEN 0 AND 6 THEN RAISE EXCEPTION 'Invalid column'; END IF;
 SELECT * INTO m FROM public.connect_four_matches WHERE id=p_match_id FOR UPDATE;
 IF NOT FOUND OR m.status<>'active' OR m.revision<>p_revision THEN RAISE EXCEPTION 'Match changed; refresh and try again'; END IF;
 IF m.player_one=u THEN player:=1; ELSIF m.player_two=u THEN player:=2; ELSE RAISE EXCEPTION 'Not a match participant'; END IF;
 IF m.current_turn<>player THEN RAISE EXCEPTION 'Not your turn'; END IF;
 b:=m.board; row_idx:=5;
 WHILE row_idx>=0 LOOP
  IF (b->row_idx->>p_column)::integer=0 THEN EXIT; END IF;
  row_idx:=row_idx-1;
 END LOOP;
 IF row_idx<0 THEN RAISE EXCEPTION 'Column is full'; END IF;
 b:=jsonb_set(b,ARRAY[row_idx::text,p_column::text],to_jsonb(player),false);
 won:=public.connect_four_has_won(b,row_idx,p_column,player);
 UPDATE public.connect_four_matches SET board=b,move_count=move_count+1,
  current_turn=CASE WHEN won OR move_count=41 THEN current_turn ELSE 3-current_turn END,
  status=CASE WHEN won OR move_count=41 THEN 'finished' ELSE 'active' END,
  winner_id=CASE WHEN won THEN u ELSE NULL END,
  finished_at=CASE WHEN won OR move_count=41 THEN now() ELSE NULL END,
  revision=revision+1,updated_at=now()
 WHERE id=p_match_id RETURNING * INTO m;
 IF m.status='finished' THEN
  -- Calculate a zero-sum Elo update from both players' current persistent ratings.
  SELECT COALESCE((SELECT rating FROM public.connect_four_player_stats WHERE user_id=m.player_one),1000) INTO v_p1_rating;
  SELECT COALESCE((SELECT rating FROM public.connect_four_player_stats WHERE user_id=m.player_two),1000) INTO v_p2_rating;
  v_score_p1 := CASE WHEN NOT won THEN 0.5 WHEN m.winner_id=m.player_one THEN 1.0 ELSE 0.0 END;
  v_expected_p1 := 1.0/(1.0+power(10.0,(v_p2_rating-v_p1_rating)::numeric/400.0));
  v_p1_delta := round(32.0*(v_score_p1-v_expected_p1))::integer;
  v_p2_delta := -v_p1_delta;
  -- Winner earns 30 XP / 10 coins; loser earns 5 XP / 1 coin; a draw earns 10 XP / 3 coins.
  IF NOT won THEN xp_gain:=10; coin_gain:=3;
  ELSIF m.winner_id=m.player_one THEN xp_gain:=30; coin_gain:=10;
  ELSE xp_gain:=5; coin_gain:=1; END IF;
  INSERT INTO public.connect_four_player_stats(user_id,wins,losses,draws,xp,coins,rating)
   VALUES(m.player_one,CASE WHEN won AND m.winner_id=m.player_one THEN 1 ELSE 0 END,CASE WHEN won AND m.winner_id=m.player_two THEN 1 ELSE 0 END,CASE WHEN NOT won THEN 1 ELSE 0 END,xp_gain,coin_gain,greatest(0,least(5000,1000+v_p1_delta)))
   ON CONFLICT(user_id) DO UPDATE SET wins=connect_four_player_stats.wins+CASE WHEN won AND m.winner_id=m.player_one THEN 1 ELSE 0 END,
    losses=connect_four_player_stats.losses+CASE WHEN won AND m.winner_id=m.player_two THEN 1 ELSE 0 END,
    draws=connect_four_player_stats.draws+CASE WHEN NOT won THEN 1 ELSE 0 END,
    xp=connect_four_player_stats.xp+xp_gain,coins=connect_four_player_stats.coins+coin_gain,
    rating=greatest(0,least(5000,connect_four_player_stats.rating+v_p1_delta)),updated_at=now();
  INSERT INTO public.connect_four_reward_ledger(user_id,match_id,xp,coins,reason)
   VALUES(m.player_one,p_match_id,xp_gain,coin_gain,CASE WHEN NOT won THEN 'Connect Four draw' WHEN m.winner_id=m.player_one THEN 'Connect Four win' ELSE 'Connect Four loss' END)
   ON CONFLICT(user_id,match_id) DO NOTHING;
  IF m.player_two IS NOT NULL THEN
   IF NOT won THEN xp_gain:=10; coin_gain:=3;
   ELSIF m.winner_id=m.player_two THEN xp_gain:=30; coin_gain:=10;
   ELSE xp_gain:=5; coin_gain:=1; END IF;
   INSERT INTO public.connect_four_player_stats(user_id,wins,losses,draws,xp,coins,rating)
    VALUES(m.player_two,CASE WHEN won AND m.winner_id=m.player_two THEN 1 ELSE 0 END,CASE WHEN won AND m.winner_id=m.player_one THEN 1 ELSE 0 END,CASE WHEN NOT won THEN 1 ELSE 0 END,xp_gain,coin_gain,greatest(0,least(5000,1000+v_p2_delta)))
    ON CONFLICT(user_id) DO UPDATE SET wins=connect_four_player_stats.wins+CASE WHEN won AND m.winner_id=m.player_two THEN 1 ELSE 0 END,
     losses=connect_four_player_stats.losses+CASE WHEN won AND m.winner_id=m.player_one THEN 1 ELSE 0 END,
     draws=connect_four_player_stats.draws+CASE WHEN NOT won THEN 1 ELSE 0 END,
     xp=connect_four_player_stats.xp+xp_gain,coins=connect_four_player_stats.coins+coin_gain,
     rating=greatest(0,least(5000,connect_four_player_stats.rating+v_p2_delta)),updated_at=now();
   INSERT INTO public.connect_four_reward_ledger(user_id,match_id,xp,coins,reason)
    VALUES(m.player_two,p_match_id,xp_gain,coin_gain,CASE WHEN NOT won THEN 'Connect Four draw' WHEN m.winner_id=m.player_two THEN 'Connect Four win' ELSE 'Connect Four loss' END)
    ON CONFLICT(user_id,match_id) DO NOTHING;
  END IF;
 END IF;
 RETURN m;
END $$;

REVOKE ALL ON FUNCTION public.connect_four_has_won(jsonb,integer,integer,integer) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.create_connect_four_match() FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.join_connect_four_match(text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.connect_four_quick_match() FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.connect_four_play_move(uuid,integer,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.create_connect_four_match(),public.join_connect_four_match(text),public.connect_four_quick_match(),public.connect_four_play_move(uuid,integer,integer) TO authenticated;

DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='connect_four_matches') THEN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.connect_four_matches;
 END IF;
END $$;

