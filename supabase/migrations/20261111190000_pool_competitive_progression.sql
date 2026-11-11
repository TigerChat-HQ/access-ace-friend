-- Persistent Pool progression, fair single-elimination tournaments, and replayable shot events.
-- This migration extends the deployed Pool PvP foundation.

CREATE TABLE IF NOT EXISTS public.pool_player_ratings (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  rating integer NOT NULL DEFAULT 1000 CHECK (rating BETWEEN 100 AND 5000),
  games_played integer NOT NULL DEFAULT 0 CHECK (games_played >= 0),
  wins integer NOT NULL DEFAULT 0 CHECK (wins >= 0),
  losses integer NOT NULL DEFAULT 0 CHECK (losses >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.pool_player_progression (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  xp bigint NOT NULL DEFAULT 0 CHECK (xp >= 0),
  level integer NOT NULL DEFAULT 1 CHECK (level >= 1),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.pool_match_results (
  match_id uuid PRIMARY KEY REFERENCES public.pool_matches(id) ON DELETE CASCADE,
  winner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  loser_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  winner_rating_before integer NOT NULL,
  winner_rating_after integer NOT NULL,
  loser_rating_before integer NOT NULL,
  loser_rating_after integer NOT NULL,
  winner_coins integer NOT NULL DEFAULT 100,
  loser_coins integer NOT NULL DEFAULT 25,
  settled_at timestamptz NOT NULL DEFAULT now(),
  CHECK (winner_id <> loser_id)
);

CREATE TABLE IF NOT EXISTS public.pool_tournaments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (length(trim(title)) BETWEEN 3 AND 64),
  mode text NOT NULL CHECK (mode IN ('eight_ball','nine_ball')),
  status text NOT NULL DEFAULT 'registration' CHECK (status IN ('registration','active','completed','cancelled')),
  max_players integer NOT NULL DEFAULT 8 CHECK (max_players IN (4,8,16,32,64)),
  entry_fee integer NOT NULL DEFAULT 0 CHECK (entry_fee BETWEEN 0 AND 50000),
  prize_pool bigint NOT NULL DEFAULT 0 CHECK (prize_pool >= 0),
  current_round integer NOT NULL DEFAULT 0 CHECK (current_round >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  finished_at timestamptz
);
CREATE TABLE IF NOT EXISTS public.pool_tournament_entries (
  tournament_id uuid NOT NULL REFERENCES public.pool_tournaments(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  seed_rating integer NOT NULL DEFAULT 1000 CHECK (seed_rating BETWEEN 0 AND 5000),
  status text NOT NULL DEFAULT 'registered' CHECK (status IN ('registered','active','eliminated','winner')),
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(tournament_id,user_id)
);
CREATE TABLE IF NOT EXISTS public.pool_tournament_matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id uuid NOT NULL REFERENCES public.pool_tournaments(id) ON DELETE CASCADE,
  round_no integer NOT NULL CHECK (round_no > 0),
  match_no integer NOT NULL CHECK (match_no > 0),
  player_one uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  player_two uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  match_id uuid NOT NULL UNIQUE REFERENCES public.pool_matches(id) ON DELETE CASCADE,
  winner_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','completed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tournament_id,round_no,match_no),
  CHECK (player_one <> player_two)
);
ALTER TABLE public.pool_matches
  ADD COLUMN IF NOT EXISTS tournament_id uuid REFERENCES public.pool_tournaments(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS pool_rating_leaderboard_idx ON public.pool_player_ratings(rating DESC,wins DESC);
CREATE INDEX IF NOT EXISTS pool_tournament_status_idx ON public.pool_tournaments(status,created_at DESC);
CREATE INDEX IF NOT EXISTS pool_tournament_entries_user_idx ON public.pool_tournament_entries(user_id,joined_at DESC);
CREATE INDEX IF NOT EXISTS pool_tournament_matches_round_idx ON public.pool_tournament_matches(tournament_id,round_no,match_no);
CREATE INDEX IF NOT EXISTS pool_events_actor_idx ON public.pool_match_events(actor_id);
CREATE INDEX IF NOT EXISTS pool_queue_match_idx ON public.pool_match_queue(match_id);
CREATE INDEX IF NOT EXISTS pool_matches_turn_idx ON public.pool_matches(current_turn);
CREATE INDEX IF NOT EXISTS pool_matches_player_one_idx ON public.pool_matches(player_one);
CREATE INDEX IF NOT EXISTS pool_matches_player_two_idx ON public.pool_matches(player_two);
CREATE INDEX IF NOT EXISTS pool_matches_winner_idx ON public.pool_matches(winner_id);

ALTER TABLE public.pool_player_ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pool_player_progression ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pool_match_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pool_tournaments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pool_tournament_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pool_tournament_matches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Pool ratings are publicly readable" ON public.pool_player_ratings;
CREATE POLICY "Pool ratings are publicly readable" ON public.pool_player_ratings
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Pool progression is publicly readable" ON public.pool_player_progression;
CREATE POLICY "Pool progression is publicly readable" ON public.pool_player_progression
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Pool match results are publicly readable" ON public.pool_match_results;
CREATE POLICY "Pool match results are publicly readable" ON public.pool_match_results
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.pool_matches m WHERE m.id=match_id
      AND (m.player_one=(select auth.uid()) OR m.player_two=(select auth.uid()) OR m.status='finished'))
  );
DROP POLICY IF EXISTS "Pool tournaments are readable" ON public.pool_tournaments;
CREATE POLICY "Pool tournaments are readable" ON public.pool_tournaments
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Pool tournament entries are readable" ON public.pool_tournament_entries;
CREATE POLICY "Pool tournament entries are readable" ON public.pool_tournament_entries
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Pool tournament brackets are readable" ON public.pool_tournament_matches;
CREATE POLICY "Pool tournament brackets are readable" ON public.pool_tournament_matches
  FOR SELECT TO authenticated USING (true);

REVOKE INSERT,UPDATE,DELETE ON public.pool_player_ratings,public.pool_player_progression,
  public.pool_match_results,public.pool_tournaments,public.pool_tournament_entries,
  public.pool_tournament_matches FROM anon,authenticated;
GRANT SELECT ON public.pool_player_ratings,public.pool_player_progression,public.pool_match_results,
  public.pool_tournaments,public.pool_tournament_entries,public.pool_tournament_matches TO authenticated;

CREATE OR REPLACE FUNCTION public.create_pool_tournament(
  p_title text,p_mode text DEFAULT 'eight_ball',p_max_players integer DEFAULT 8,p_entry_fee integer DEFAULT 0
) RETURNS public.pool_tournaments
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE v_user uuid := (select auth.uid()); v_tournament public.pool_tournaments%ROWTYPE;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
  IF p_mode NOT IN ('eight_ball','nine_ball') OR p_max_players NOT IN (4,8,16,32,64)
     OR p_entry_fee NOT BETWEEN 0 AND 50000 OR length(trim(coalesce(p_title,''))) NOT BETWEEN 3 AND 64
  THEN RAISE EXCEPTION 'Invalid tournament settings'; END IF;
  INSERT INTO public.pool_tournaments(owner_id,title,mode,max_players,entry_fee)
  VALUES(v_user,trim(p_title),p_mode,p_max_players,p_entry_fee) RETURNING * INTO v_tournament;
  RETURN v_tournament;
END $$;

CREATE OR REPLACE FUNCTION public.join_pool_tournament(p_tournament_id uuid)
RETURNS public.pool_tournament_entries
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE
  v_user uuid := (select auth.uid()); v_t public.pool_tournaments%ROWTYPE;
  v_rating integer := 1000; v_wallet public.pool_wallets%ROWTYPE; v_entry public.pool_tournament_entries%ROWTYPE;
  v_ledger_id uuid;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
  SELECT * INTO v_t FROM public.pool_tournaments WHERE id=p_tournament_id FOR UPDATE;
  IF NOT FOUND OR v_t.status<>'registration' THEN RAISE EXCEPTION 'Tournament registration is closed'; END IF;
  IF (SELECT count(*) FROM public.pool_tournament_entries WHERE tournament_id=p_tournament_id)>=v_t.max_players
    THEN RAISE EXCEPTION 'Tournament is full'; END IF;
  IF EXISTS(SELECT 1 FROM public.pool_tournament_entries WHERE tournament_id=p_tournament_id AND user_id=v_user)
    THEN RAISE EXCEPTION 'Already registered'; END IF;
  SELECT rating INTO v_rating FROM public.pool_player_ratings WHERE user_id=v_user;
  IF v_t.entry_fee>0 THEN
    SELECT * INTO v_wallet FROM public.pool_wallets WHERE user_id=v_user FOR UPDATE;
    IF NOT FOUND OR v_wallet.balance<v_t.entry_fee THEN RAISE EXCEPTION 'Not enough Pool coins'; END IF;
    UPDATE public.pool_wallets SET balance=balance-v_t.entry_fee,updated_at=now()
      WHERE user_id=v_user RETURNING * INTO v_wallet;
    INSERT INTO public.pool_coin_ledger(user_id,amount,balance_after,reason,source_type,source_id)
      VALUES(v_user,-v_t.entry_fee,v_wallet.balance,'tournament_entry','tournament',p_tournament_id)
      RETURNING id INTO v_ledger_id;
  END IF;
  INSERT INTO public.pool_tournament_entries(tournament_id,user_id,seed_rating)
    VALUES(p_tournament_id,v_user,coalesce(v_rating,1000)) RETURNING * INTO v_entry;
  UPDATE public.pool_tournaments SET prize_pool=prize_pool+v_t.entry_fee WHERE id=p_tournament_id;
  RETURN v_entry;
END $$;

CREATE OR REPLACE FUNCTION public.pool_advance_tournament(p_tournament_id uuid,p_round integer)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE
  v_t public.pool_tournaments%ROWTYPE; v_winners uuid[]; v_count integer; i integer;
  v_match public.pool_matches%ROWTYPE; v_match_id uuid; v_round integer;
  v_winner uuid; v_wallet public.pool_wallets%ROWTYPE; v_ledger uuid;
BEGIN
  SELECT * INTO v_t FROM public.pool_tournaments WHERE id=p_tournament_id FOR UPDATE;
  IF NOT FOUND OR v_t.status<>'active' THEN RETURN; END IF;
  IF EXISTS(SELECT 1 FROM public.pool_tournament_matches WHERE tournament_id=p_tournament_id
    AND round_no=p_round AND status<>'completed') THEN RETURN; END IF;
  SELECT array_agg(winner_id ORDER BY match_no) INTO v_winners
    FROM public.pool_tournament_matches WHERE tournament_id=p_tournament_id AND round_no=p_round;
  v_count:=coalesce(cardinality(v_winners),0);
  IF v_count=0 OR array_position(v_winners,NULL) IS NOT NULL THEN RETURN; END IF;
  IF v_count=1 THEN
    v_winner:=v_winners[1];
    UPDATE public.pool_tournaments SET status='completed',finished_at=now(),current_round=p_round WHERE id=p_tournament_id;
    UPDATE public.pool_tournament_entries SET status=CASE WHEN user_id=v_winner THEN 'winner' ELSE 'eliminated' END
      WHERE tournament_id=p_tournament_id;
    IF v_t.prize_pool>0 THEN
      INSERT INTO public.pool_wallets(user_id,balance,lifetime_earned) VALUES(v_winner,v_t.prize_pool,v_t.prize_pool)
      ON CONFLICT(user_id) DO UPDATE SET balance=pool_wallets.balance+EXCLUDED.balance,
        lifetime_earned=pool_wallets.lifetime_earned+EXCLUDED.lifetime_earned,updated_at=now()
      RETURNING * INTO v_wallet;
      INSERT INTO public.pool_coin_ledger(user_id,amount,balance_after,reason,source_type,source_id)
        VALUES(v_winner,v_t.prize_pool,v_wallet.balance,'tournament_champion','tournament',p_tournament_id)
        ON CONFLICT DO NOTHING;
    END IF;
    RETURN;
  END IF;
  v_round:=p_round+1;
  UPDATE public.pool_tournaments SET current_round=v_round WHERE id=p_tournament_id;
  FOR i IN 1..(v_count/2) LOOP
    INSERT INTO public.pool_matches(player_one,player_two,mode,status,visibility,current_turn,clock_seconds,
      player_one_clock_ms,player_two_clock_ms,clock_started_at,started_at,game_rules,tournament_id)
    VALUES(v_winners[(i*2)-1],v_winners[i*2],v_t.mode,'active','private',v_winners[(i*2)-1],600,
      600000,600000,now(),now(),jsonb_build_object('version',1,'mode',v_t.mode,'tournament',true,'foul_ball_in_hand',true),p_tournament_id)
    RETURNING * INTO v_match;
    INSERT INTO public.pool_tournament_matches(tournament_id,round_no,match_no,player_one,player_two,match_id)
      VALUES(p_tournament_id,v_round,i,v_winners[(i*2)-1],v_winners[i*2],v_match.id);
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.start_pool_tournament(p_tournament_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE
  v_user uuid := (select auth.uid()); v_t public.pool_tournaments%ROWTYPE;
  v_players uuid[]; v_count integer; i integer; v_match public.pool_matches%ROWTYPE;
BEGIN
  SELECT * INTO v_t FROM public.pool_tournaments WHERE id=p_tournament_id FOR UPDATE;
  IF NOT FOUND OR v_t.owner_id<>v_user OR v_t.status<>'registration' THEN
    RAISE EXCEPTION 'Only tournament owner can start an open tournament'; END IF;
  SELECT array_agg(user_id ORDER BY seed_rating DESC,joined_at) INTO v_players
    FROM public.pool_tournament_entries WHERE tournament_id=p_tournament_id;
  v_count:=coalesce(cardinality(v_players),0);
  IF v_count<4 OR v_count<>v_t.max_players OR (v_count & (v_count-1))<>0
    THEN RAISE EXCEPTION 'Tournament requires exactly max_players registered (4, 8, 16, 32 or 64)'; END IF;
  UPDATE public.pool_tournaments SET status='active',started_at=now(),current_round=1 WHERE id=p_tournament_id;
  FOR i IN 1..(v_count/2) LOOP
    INSERT INTO public.pool_matches(player_one,player_two,mode,status,visibility,current_turn,clock_seconds,
      player_one_clock_ms,player_two_clock_ms,clock_started_at,started_at,game_rules,tournament_id)
    VALUES(v_players[i],v_players[v_count-i+1],v_t.mode,'active','private',v_players[i],600,
      600000,600000,now(),now(),jsonb_build_object('version',1,'mode',v_t.mode,'tournament',true,'foul_ball_in_hand',true),p_tournament_id)
    RETURNING * INTO v_match;
    INSERT INTO public.pool_tournament_matches(tournament_id,round_no,match_no,player_one,player_two,match_id)
      VALUES(p_tournament_id,1,i,v_players[i],v_players[v_count-i+1],v_match.id);
  END LOOP;
  UPDATE public.pool_tournament_entries SET status='active' WHERE tournament_id=p_tournament_id;
  RETURN jsonb_build_object('status','active','round',1,'matches',v_count/2);
END $$;

CREATE OR REPLACE FUNCTION public.pool_settle_match(p_match_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE
  v_m public.pool_matches%ROWTYPE; v_w public.pool_player_ratings%ROWTYPE; v_l public.pool_player_ratings%ROWTYPE;
  v_we double precision; v_le double precision; v_wr integer; v_lr integer;
  v_wcoins integer:=100; v_lcoins integer:=25; v_xp integer:=50; v_wallet public.pool_wallets%ROWTYPE;
  v_bracket public.pool_tournament_matches%ROWTYPE; v_existing boolean;
BEGIN
  SELECT * INTO v_m FROM public.pool_matches WHERE id=p_match_id FOR UPDATE;
  IF NOT FOUND OR v_m.status<>'finished' OR v_m.winner_id IS NULL OR v_m.player_two IS NULL THEN
    RAISE EXCEPTION 'Finished Pool match with a winner required'; END IF;
  IF EXISTS(SELECT 1 FROM public.pool_match_results WHERE match_id=p_match_id) THEN
    RETURN jsonb_build_object('settled',true,'duplicate',true);
  END IF;
  INSERT INTO public.pool_player_ratings(user_id) VALUES(v_m.player_one),(v_m.player_two) ON CONFLICT DO NOTHING;
  SELECT * INTO v_w FROM public.pool_player_ratings WHERE user_id=v_m.winner_id FOR UPDATE;
  SELECT * INTO v_l FROM public.pool_player_ratings WHERE user_id=CASE WHEN v_m.winner_id=v_m.player_one THEN v_m.player_two ELSE v_m.player_one END FOR UPDATE;
  v_we:=1.0/(1.0+power(10.0,(v_l.rating-v_w.rating)/400.0));
  v_le:=1.0/(1.0+power(10.0,(v_w.rating-v_l.rating)/400.0));
  v_wr:=greatest(100,least(5000,round(v_w.rating+32*(1-v_we))::integer));
  v_lr:=greatest(100,least(5000,round(v_l.rating-32*(1-v_le))::integer));
  UPDATE public.pool_player_ratings SET rating=v_wr,games_played=games_played+1,wins=wins+1,updated_at=now() WHERE user_id=v_w.user_id;
  UPDATE public.pool_player_ratings SET rating=v_lr,games_played=games_played+1,losses=losses+1,updated_at=now() WHERE user_id=v_l.user_id;
  INSERT INTO public.pool_match_results(match_id,winner_id,loser_id,winner_rating_before,winner_rating_after,loser_rating_before,loser_rating_after)
    VALUES(p_match_id,v_w.user_id,v_l.user_id,v_w.rating,v_wr,v_l.rating,v_lr);
  INSERT INTO public.pool_player_progression(user_id,xp,level) VALUES(v_w.user_id,v_xp,1)
    ON CONFLICT(user_id) DO UPDATE SET xp=pool_player_progression.xp+v_xp,
      level=1+floor((pool_player_progression.xp+v_xp)/500)::integer,updated_at=now();
  INSERT INTO public.pool_player_progression(user_id,xp,level) VALUES(v_l.user_id,10,1)
    ON CONFLICT(user_id) DO UPDATE SET xp=pool_player_progression.xp+10,
      level=1+floor((pool_player_progression.xp+10)/500)::integer,updated_at=now();
  INSERT INTO public.pool_wallets(user_id,balance,lifetime_earned) VALUES(v_w.user_id,v_wcoins,v_wcoins)
    ON CONFLICT(user_id) DO UPDATE SET balance=pool_wallets.balance+v_wcoins,
      lifetime_earned=pool_wallets.lifetime_earned+v_wcoins,updated_at=now() RETURNING * INTO v_wallet;
  INSERT INTO public.pool_coin_ledger(user_id,amount,balance_after,reason,source_type,source_id)
    VALUES(v_w.user_id,v_wcoins,v_wallet.balance,'match_win','match',p_match_id);
  INSERT INTO public.pool_wallets(user_id,balance,lifetime_earned) VALUES(v_l.user_id,v_lcoins,v_lcoins)
    ON CONFLICT(user_id) DO UPDATE SET balance=pool_wallets.balance+v_lcoins,
      lifetime_earned=pool_wallets.lifetime_earned+v_lcoins,updated_at=now() RETURNING * INTO v_wallet;
  INSERT INTO public.pool_coin_ledger(user_id,amount,balance_after,reason,source_type,source_id)
    VALUES(v_l.user_id,v_lcoins,v_wallet.balance,'match_participation','match',p_match_id);
  SELECT * INTO v_bracket FROM public.pool_tournament_matches WHERE match_id=p_match_id FOR UPDATE;
  IF FOUND THEN
    UPDATE public.pool_tournament_matches SET winner_id=v_m.winner_id,status='completed' WHERE id=v_bracket.id;
    UPDATE public.pool_tournament_entries SET status='eliminated'
      WHERE tournament_id=v_bracket.tournament_id AND user_id=v_l.user_id;
    PERFORM public.pool_advance_tournament(v_bracket.tournament_id,v_bracket.round_no);
  END IF;
  RETURN jsonb_build_object('settled',true,'winner_id',v_w.user_id,'winner_rating',v_wr,'loser_rating',v_lr,'winner_coins',v_wcoins,'loser_coins',v_lcoins);
END $$;

REVOKE ALL ON FUNCTION public.pool_settle_match(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.pool_settle_match(uuid) TO service_role;
REVOKE ALL ON FUNCTION public.pool_advance_tournament(uuid,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.pool_advance_tournament(uuid,integer) TO service_role;
REVOKE ALL ON FUNCTION public.create_pool_tournament(text,text,integer,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.create_pool_tournament(text,text,integer,integer) TO authenticated;
REVOKE ALL ON FUNCTION public.join_pool_tournament(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.join_pool_tournament(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.start_pool_tournament(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.start_pool_tournament(uuid) TO authenticated;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname='supabase_realtime') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='pool_match_events') THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.pool_match_events;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='pool_tournament_matches') THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.pool_tournament_matches;
    END IF;
  END IF;
END $$;
