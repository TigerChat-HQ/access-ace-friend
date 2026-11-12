-- TigerChat Draughts Arena: secure coins, daily missions, XP and achievements.
ALTER TABLE public.draughts_player_stats
  ADD COLUMN IF NOT EXISTS xp integer NOT NULL DEFAULT 0 CHECK (xp >= 0),
  ADD COLUMN IF NOT EXISTS current_streak integer NOT NULL DEFAULT 0 CHECK (current_streak >= 0),
  ADD COLUMN IF NOT EXISTS best_streak integer NOT NULL DEFAULT 0 CHECK (best_streak >= 0);

CREATE TABLE IF NOT EXISTS public.draughts_wallets (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  balance bigint NOT NULL DEFAULT 0 CHECK (balance >= 0),
  lifetime_earned bigint NOT NULL DEFAULT 0 CHECK (lifetime_earned >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.draughts_coin_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount bigint NOT NULL,
  balance_after bigint NOT NULL CHECK (balance_after >= 0),
  reason text NOT NULL,
  source_type text NOT NULL CHECK (source_type IN ('match','mission','achievement','tournament','streak','admin')),
  source_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, source_type, source_id, reason)
);
CREATE INDEX IF NOT EXISTS draughts_coin_ledger_user_created
  ON public.draughts_coin_ledger(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.draughts_mission_catalog (
  mission_key text PRIMARY KEY,
  title text NOT NULL,
  description text NOT NULL,
  cadence text NOT NULL CHECK (cadence IN ('daily','weekly')),
  target integer NOT NULL CHECK (target > 0),
  reward_coins integer NOT NULL CHECK (reward_coins >= 0),
  reward_xp integer NOT NULL CHECK (reward_xp >= 0),
  is_enabled boolean NOT NULL DEFAULT true
);
CREATE TABLE IF NOT EXISTS public.draughts_mission_progress (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mission_key text NOT NULL REFERENCES public.draughts_mission_catalog(mission_key) ON DELETE CASCADE,
  period_start date NOT NULL,
  progress integer NOT NULL DEFAULT 0 CHECK (progress >= 0),
  claimed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(user_id, mission_key, period_start)
);
CREATE TABLE IF NOT EXISTS public.draughts_achievement_catalog (
  achievement_key text PRIMARY KEY,
  title text NOT NULL,
  description text NOT NULL,
  emoji text NOT NULL DEFAULT '🏅',
  reward_coins integer NOT NULL DEFAULT 0 CHECK (reward_coins >= 0),
  is_enabled boolean NOT NULL DEFAULT true
);
CREATE TABLE IF NOT EXISTS public.draughts_user_achievements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  achievement_key text NOT NULL REFERENCES public.draughts_achievement_catalog(achievement_key),
  awarded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, achievement_key)
);

INSERT INTO public.draughts_mission_catalog(mission_key,title,description,cadence,target,reward_coins,reward_xp) VALUES
 ('daily_play_one','First Match','Complete one rated or AI match today','daily',1,20,25),
 ('daily_play_three','Daily Grinder','Complete three matches today','daily',3,45,60),
 ('daily_win_one','Daily Winner','Win one online PvP match today','daily',1,50,75),
 ('weekly_play_ten','Weekly Regular','Complete ten matches this week','weekly',10,150,250),
 ('weekly_win_five','Weekly Champion','Win five online PvP matches this week','weekly',5,250,400)
ON CONFLICT(mission_key) DO UPDATE SET title=excluded.title,description=excluded.description,
 cadence=excluded.cadence,target=excluded.target,reward_coins=excluded.reward_coins,reward_xp=excluded.reward_xp;
INSERT INTO public.draughts_achievement_catalog(achievement_key,title,description,emoji,reward_coins) VALUES
 ('first_win','First Victory','Win your first online PvP match','🥇',100),
 ('wins_10','Rising Star','Win 10 online PvP matches','⭐',250),
 ('wins_50','Draughts Master','Win 50 online PvP matches','👑',1000),
 ('streak_5','On Fire','Win five online PvP matches in a row','🔥',500)
ON CONFLICT(achievement_key) DO UPDATE SET title=excluded.title,description=excluded.description,
 emoji=excluded.emoji,reward_coins=excluded.reward_coins;

ALTER TABLE public.draughts_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.draughts_coin_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.draughts_mission_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.draughts_mission_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.draughts_achievement_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.draughts_user_achievements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Players read their Draughts wallet" ON public.draughts_wallets;
CREATE POLICY "Players read their Draughts wallet" ON public.draughts_wallets
 FOR SELECT TO authenticated USING ((select auth.uid())=user_id);
DROP POLICY IF EXISTS "Players read their Draughts ledger" ON public.draughts_coin_ledger;
CREATE POLICY "Players read their Draughts ledger" ON public.draughts_coin_ledger
 FOR SELECT TO authenticated USING ((select auth.uid())=user_id);
DROP POLICY IF EXISTS "Mission catalog is visible to players" ON public.draughts_mission_catalog;
CREATE POLICY "Mission catalog is visible to players" ON public.draughts_mission_catalog
 FOR SELECT TO authenticated USING (is_enabled);
DROP POLICY IF EXISTS "Players read their Draughts mission progress" ON public.draughts_mission_progress;
CREATE POLICY "Players read their Draughts mission progress" ON public.draughts_mission_progress
 FOR SELECT TO authenticated USING ((select auth.uid())=user_id);
DROP POLICY IF EXISTS "Achievement catalog is visible to players" ON public.draughts_achievement_catalog;
CREATE POLICY "Achievement catalog is visible to players" ON public.draughts_achievement_catalog
 FOR SELECT TO authenticated USING (is_enabled);
DROP POLICY IF EXISTS "Players read their Draughts achievements" ON public.draughts_user_achievements;
CREATE POLICY "Players read their Draughts achievements" ON public.draughts_user_achievements
 FOR SELECT TO authenticated USING ((select auth.uid())=user_id);

GRANT SELECT ON public.draughts_wallets, public.draughts_coin_ledger,
 public.draughts_mission_catalog, public.draughts_mission_progress,
 public.draughts_achievement_catalog, public.draughts_user_achievements TO authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.draughts_wallets, public.draughts_coin_ledger,
 public.draughts_mission_progress, public.draughts_user_achievements FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.claim_draughts_mission(p_mission_key text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_user uuid := (select auth.uid()); v_m public.draughts_mission_catalog%ROWTYPE;
 v_period date; v_progress public.draughts_mission_progress%ROWTYPE; v_balance bigint;
BEGIN
 IF v_user IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
 SELECT * INTO v_m FROM public.draughts_mission_catalog WHERE mission_key=p_mission_key AND is_enabled;
 IF NOT FOUND THEN RAISE EXCEPTION 'Mission not found'; END IF;
 v_period := CASE WHEN v_m.cadence='daily' THEN (now() AT TIME ZONE 'Africa/Dar_es_Salaam')::date
   ELSE date_trunc('week', now() AT TIME ZONE 'Africa/Dar_es_Salaam')::date END;
 SELECT * INTO v_progress FROM public.draughts_mission_progress
  WHERE user_id=v_user AND mission_key=p_mission_key AND period_start=v_period FOR UPDATE;
 IF NOT FOUND OR v_progress.progress < v_m.target THEN RAISE EXCEPTION 'Mission is not complete yet'; END IF;
 IF v_progress.claimed_at IS NOT NULL THEN RAISE EXCEPTION 'Mission reward already claimed'; END IF;
 UPDATE public.draughts_mission_progress SET claimed_at=now(),updated_at=now()
  WHERE user_id=v_user AND mission_key=p_mission_key AND period_start=v_period;
 INSERT INTO public.draughts_wallets(user_id,balance,lifetime_earned) VALUES(v_user,0,0)
  ON CONFLICT(user_id) DO NOTHING;
 UPDATE public.draughts_wallets SET balance=balance+v_m.reward_coins,
  lifetime_earned=lifetime_earned+v_m.reward_coins,updated_at=now()
  WHERE user_id=v_user RETURNING balance INTO v_balance;
 INSERT INTO public.draughts_coin_ledger(user_id,amount,balance_after,reason,source_type,source_id)
 VALUES(v_user,v_m.reward_coins,v_balance,'Mission: '||v_m.title,'mission',
  (select gen_random_uuid()))
 ON CONFLICT DO NOTHING;
 UPDATE public.draughts_player_stats SET xp=xp+v_m.reward_xp,updated_at=now()
  WHERE user_id=v_user AND season_id IN (SELECT id FROM public.draughts_seasons WHERE is_active);
 RETURN jsonb_build_object('mission_key',p_mission_key,'coins',v_m.reward_coins,'xp',v_m.reward_xp,'balance',v_balance);
END $$;
REVOKE ALL ON FUNCTION public.claim_draughts_mission(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_draughts_mission(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.award_draughts_match_rewards()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_user uuid; v_result text; v_coins integer; v_balance bigint; v_stats public.draughts_player_stats%ROWTYPE;
 v_season uuid; v_wins integer; v_streak integer; v_achievement record; v_achievement_id uuid;
 v_period date; v_mission record; v_is_pvp boolean;
BEGIN
 IF OLD.status='finished' OR NEW.status<>'finished' OR NEW.winner IS NULL OR NEW.winner NOT IN ('white','black','draw') THEN RETURN NEW; END IF;
 IF NEW.player_white IS NULL THEN RETURN NEW; END IF;
 v_is_pvp := NOT NEW.vs_ai AND NEW.player_black IS NOT NULL;
 SELECT id INTO v_season FROM public.draughts_seasons WHERE is_active ORDER BY starts_at DESC LIMIT 1;
 IF v_season IS NULL THEN RETURN NEW; END IF;

 FOR v_user,v_result IN
   SELECT NEW.player_white, CASE WHEN NEW.winner='white' THEN 'win' WHEN NEW.winner='draw' THEN 'draw' ELSE 'loss' END
   UNION ALL
   SELECT NEW.player_black, CASE WHEN NEW.winner='black' THEN 'win' WHEN NEW.winner='draw' THEN 'draw' ELSE 'loss' END
    WHERE v_is_pvp
 LOOP
   v_coins := CASE WHEN v_is_pvp THEN CASE v_result WHEN 'win' THEN 30 WHEN 'draw' THEN 15 ELSE 5 END
     ELSE CASE v_result WHEN 'win' THEN 5 WHEN 'draw' THEN 2 ELSE 0 END END;
   IF v_coins>0 THEN
     INSERT INTO public.draughts_wallets(user_id,balance,lifetime_earned) VALUES(v_user,0,0)
       ON CONFLICT(user_id) DO NOTHING;
     UPDATE public.draughts_wallets SET balance=balance+v_coins,lifetime_earned=lifetime_earned+v_coins,updated_at=now()
       WHERE user_id=v_user RETURNING balance INTO v_balance;
     INSERT INTO public.draughts_coin_ledger(user_id,amount,balance_after,reason,source_type,source_id)
       VALUES(v_user,v_coins,v_balance,CASE WHEN v_result='win' THEN 'Match victory' WHEN v_result='draw' THEN 'Match draw' ELSE 'Match participation' END,'match',NEW.id)
       ON CONFLICT DO NOTHING;
   END IF;
   INSERT INTO public.draughts_player_stats(season_id,user_id,xp,current_streak,best_streak)
    VALUES(v_season,v_user,10,CASE WHEN v_result='win' AND v_is_pvp THEN 1 ELSE 0 END,
      CASE WHEN v_result='win' AND v_is_pvp THEN 1 ELSE 0 END)
   ON CONFLICT(season_id,user_id) DO UPDATE SET
    xp=draughts_player_stats.xp+10,
    current_streak=CASE WHEN NOT v_is_pvp THEN draughts_player_stats.current_streak
      WHEN v_result='win' THEN draughts_player_stats.current_streak+1
      WHEN v_result='loss' THEN 0 ELSE draughts_player_stats.current_streak END,
    best_streak=greatest(draughts_player_stats.best_streak,
      CASE WHEN v_is_pvp AND v_result='win' THEN draughts_player_stats.current_streak+1 ELSE draughts_player_stats.current_streak END),
    updated_at=now()
   RETURNING * INTO v_stats;

   -- One-time bonuses when a player reaches a 3- or 5-win streak.
   IF v_is_pvp AND v_result='win' AND v_stats.current_streak IN (3,5) THEN
     v_coins := CASE v_stats.current_streak WHEN 3 THEN 20 ELSE 50 END;
     INSERT INTO public.draughts_wallets(user_id,balance,lifetime_earned) VALUES(v_user,0,0)
       ON CONFLICT(user_id) DO NOTHING;
     UPDATE public.draughts_wallets SET balance=balance+v_coins,lifetime_earned=lifetime_earned+v_coins,updated_at=now()
       WHERE user_id=v_user RETURNING balance INTO v_balance;
     INSERT INTO public.draughts_coin_ledger(user_id,amount,balance_after,reason,source_type,source_id)
       VALUES(v_user,v_coins,v_balance,'Win streak bonus: '||v_stats.current_streak,'streak',NEW.id)
       ON CONFLICT DO NOTHING;
   END IF;

   v_period := (now() AT TIME ZONE 'Africa/Dar_es_Salaam')::date;
   FOR v_mission IN SELECT * FROM public.draughts_mission_catalog WHERE is_enabled LOOP
     IF v_mission.cadence='daily' THEN
       IF v_mission.mission_key='daily_win_one' AND NOT (v_is_pvp AND v_result='win') THEN CONTINUE; END IF;
       INSERT INTO public.draughts_mission_progress(user_id,mission_key,period_start,progress)
       VALUES(v_user,v_mission.mission_key,v_period,1)
       ON CONFLICT(user_id,mission_key,period_start) DO UPDATE SET
        progress=least(v_mission.target,draughts_mission_progress.progress+1),updated_at=now();
     ELSE
       v_period := date_trunc('week', now() AT TIME ZONE 'Africa/Dar_es_Salaam')::date;
       IF v_mission.mission_key='weekly_win_five' AND NOT (v_is_pvp AND v_result='win') THEN CONTINUE; END IF;
       INSERT INTO public.draughts_mission_progress(user_id,mission_key,period_start,progress)
       VALUES(v_user,v_mission.mission_key,v_period,1)
       ON CONFLICT(user_id,mission_key,period_start) DO UPDATE SET
        progress=least(v_mission.target,draughts_mission_progress.progress+1),updated_at=now();
     END IF;
   END LOOP;
   v_period := (now() AT TIME ZONE 'Africa/Dar_es_Salaam')::date;

   IF v_is_pvp THEN
     FOR v_achievement IN
       SELECT * FROM public.draughts_achievement_catalog WHERE is_enabled AND
        ((achievement_key='first_win' AND v_result='win' AND v_stats.wins=0) OR
         (achievement_key='wins_10' AND v_result='win' AND v_stats.wins=9) OR
         (achievement_key='wins_50' AND v_result='win' AND v_stats.wins=49) OR
         (achievement_key='streak_5' AND v_stats.current_streak=5))
     LOOP
       INSERT INTO public.draughts_user_achievements(user_id,achievement_key)
        VALUES(v_user,v_achievement.achievement_key) ON CONFLICT DO NOTHING RETURNING id INTO v_achievement_id;
       IF v_achievement_id IS NOT NULL THEN
         INSERT INTO public.draughts_wallets(user_id,balance,lifetime_earned) VALUES(v_user,0,0)
          ON CONFLICT(user_id) DO NOTHING;
         UPDATE public.draughts_wallets SET balance=balance+v_achievement.reward_coins,
          lifetime_earned=lifetime_earned+v_achievement.reward_coins,updated_at=now()
          WHERE user_id=v_user RETURNING balance INTO v_balance;
         INSERT INTO public.draughts_coin_ledger(user_id,amount,balance_after,reason,source_type,source_id)
          VALUES(v_user,v_achievement.reward_coins,v_balance,'Achievement: '||v_achievement.title,'achievement',v_achievement_id)
          ON CONFLICT DO NOTHING;
       END IF;
       v_achievement_id := NULL;
     END LOOP;
   END IF;
 END LOOP;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS draft_match_award_arena_rewards ON public.draft_matches;
CREATE TRIGGER draft_match_award_arena_rewards AFTER UPDATE OF status,winner ON public.draft_matches
 FOR EACH ROW EXECUTE FUNCTION public.award_draughts_match_rewards();
REVOKE ALL ON FUNCTION public.award_draughts_match_rewards() FROM PUBLIC, anon, authenticated;


-- Seasonal Top 100 coin awards are issued once when a badge is first created.
ALTER TABLE public.draughts_coin_ledger DROP CONSTRAINT IF EXISTS draughts_coin_ledger_source_type_check;
ALTER TABLE public.draughts_coin_ledger ADD CONSTRAINT draughts_coin_ledger_source_type_check
 CHECK (source_type IN ('match','mission','achievement','tournament','streak','admin','season'));

CREATE OR REPLACE FUNCTION public.award_draughts_season_badge_coins()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_coins integer; v_balance bigint;
BEGIN
 v_coins := CASE WHEN NEW.rank=1 THEN 5000 WHEN NEW.rank BETWEEN 2 AND 3 THEN 3000
   WHEN NEW.rank BETWEEN 4 AND 10 THEN 1500 WHEN NEW.rank BETWEEN 11 AND 25 THEN 800
   WHEN NEW.rank BETWEEN 26 AND 100 THEN 400 ELSE 0 END;
 IF v_coins<=0 THEN RETURN NEW; END IF;
 INSERT INTO public.draughts_wallets(user_id,balance,lifetime_earned) VALUES(NEW.user_id,0,0)
  ON CONFLICT(user_id) DO NOTHING;
 UPDATE public.draughts_wallets SET balance=balance+v_coins,lifetime_earned=lifetime_earned+v_coins,updated_at=now()
  WHERE user_id=NEW.user_id RETURNING balance INTO v_balance;
 INSERT INTO public.draughts_coin_ledger(user_id,amount,balance_after,reason,source_type,source_id)
 VALUES(NEW.user_id,v_coins,v_balance,'Season Top '||NEW.rank||' reward','season',NEW.season_id)
 ON CONFLICT DO NOTHING;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS draughts_season_badge_coin_award ON public.draughts_player_badges;
CREATE TRIGGER draughts_season_badge_coin_award AFTER INSERT ON public.draughts_player_badges
 FOR EACH ROW EXECUTE FUNCTION public.award_draughts_season_badge_coins();
REVOKE ALL ON FUNCTION public.award_draughts_season_badge_coins() FROM PUBLIC,anon,authenticated;

-- Tournament placements are paid only after the tournament is formally completed.
CREATE OR REPLACE FUNCTION public.award_draughts_tournament_coins()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_final_round integer; v_runner_up uuid; v_row record; v_balance bigint;
BEGIN
 IF OLD.status='completed' OR NEW.status<>'completed' OR NEW.winner_id IS NULL THEN RETURN NEW; END IF;
 SELECT max(round_number) INTO v_final_round FROM public.draughts_tournament_matches
  WHERE tournament_id=NEW.id AND status='completed';
 IF v_final_round IS NULL THEN RETURN NEW; END IF;
 FOR v_row IN
   SELECT NEW.winner_id AS user_id,1 AS place,2000 AS coins
   UNION ALL
   SELECT CASE WHEN player_one=NEW.winner_id THEN player_two ELSE player_one END,2,1200
    FROM public.draughts_tournament_matches
    WHERE tournament_id=NEW.id AND round_number=v_final_round AND status='completed'
      AND winner_id=NEW.winner_id
   UNION ALL
   SELECT CASE WHEN player_one=winner_id THEN player_two ELSE player_one END,3,700
    FROM public.draughts_tournament_matches
    WHERE tournament_id=NEW.id AND round_number=v_final_round-1 AND status='completed'
      AND player_one IS NOT NULL AND player_two IS NOT NULL
   UNION ALL
   SELECT CASE WHEN player_one=winner_id THEN player_two ELSE player_one END,4,400
    FROM public.draughts_tournament_matches
    WHERE tournament_id=NEW.id AND round_number=v_final_round-2 AND status='completed'
      AND player_one IS NOT NULL AND player_two IS NOT NULL
 LOOP
   IF v_row.user_id IS NULL OR v_row.user_id=NEW.winner_id AND v_row.place<>1 THEN CONTINUE; END IF;
   INSERT INTO public.draughts_wallets(user_id,balance,lifetime_earned) VALUES(v_row.user_id,0,0)
    ON CONFLICT(user_id) DO NOTHING;
   UPDATE public.draughts_wallets SET balance=balance+v_row.coins,lifetime_earned=lifetime_earned+v_row.coins,updated_at=now()
    WHERE user_id=v_row.user_id RETURNING balance INTO v_balance;
   INSERT INTO public.draughts_coin_ledger(user_id,amount,balance_after,reason,source_type,source_id)
    VALUES(v_row.user_id,v_row.coins,v_balance,'Tournament placement #'||v_row.place,'tournament',NEW.id)
    ON CONFLICT DO NOTHING;
 END LOOP;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS draughts_tournament_coin_award ON public.draughts_tournaments;
CREATE TRIGGER draughts_tournament_coin_award AFTER UPDATE OF status ON public.draughts_tournaments
 FOR EACH ROW EXECUTE FUNCTION public.award_draughts_tournament_coins();
REVOKE ALL ON FUNCTION public.award_draughts_tournament_coins() FROM PUBLIC,anon,authenticated;


-- Immutable per-move snapshots enable match replay for the two participants.
CREATE TABLE IF NOT EXISTS public.draughts_match_moves (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 match_id uuid NOT NULL REFERENCES public.draft_matches(id) ON DELETE CASCADE,
 revision integer NOT NULL CHECK (revision > 0),
 player_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
 move jsonb NOT NULL,
 board jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(match_id,revision)
);
CREATE INDEX IF NOT EXISTS draughts_match_moves_match_revision
 ON public.draughts_match_moves(match_id,revision);
ALTER TABLE public.draughts_match_moves ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Match participants can read their Draughts replays" ON public.draughts_match_moves;
CREATE POLICY "Match participants can read their Draughts replays" ON public.draughts_match_moves
 FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.draft_matches m WHERE m.id=match_id
   AND ((select auth.uid())=m.player_white OR (select auth.uid())=m.player_black))
 );
GRANT SELECT ON public.draughts_match_moves TO authenticated;
REVOKE INSERT,UPDATE,DELETE ON public.draughts_match_moves FROM anon,authenticated;

CREATE OR REPLACE FUNCTION public.capture_draughts_match_move()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_player uuid;
BEGIN
 IF NEW.revision<=OLD.revision OR NEW.last_move IS NULL THEN RETURN NEW; END IF;
 v_player := CASE WHEN OLD.current_turn='w' THEN OLD.player_white ELSE OLD.player_black END;
 INSERT INTO public.draughts_match_moves(match_id,revision,player_id,move,board)
 VALUES(NEW.id,NEW.revision,v_player,NEW.last_move,NEW.board)
 ON CONFLICT(match_id,revision) DO NOTHING;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS draft_match_capture_replay_move ON public.draft_matches;
CREATE TRIGGER draft_match_capture_replay_move AFTER UPDATE OF revision,last_move,board ON public.draft_matches
 FOR EACH ROW EXECUTE FUNCTION public.capture_draughts_match_move();
REVOKE ALL ON FUNCTION public.capture_draughts_match_move() FROM PUBLIC,anon,authenticated;


-- Ten-tier seasonal progression pass. XP is earned from matches and missions.
CREATE TABLE IF NOT EXISTS public.draughts_pass_claims (
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 season_id uuid NOT NULL REFERENCES public.draughts_seasons(id) ON DELETE CASCADE,
 level integer NOT NULL CHECK(level BETWEEN 1 AND 10),
 coins_awarded integer NOT NULL CHECK(coins_awarded>=0),
 claimed_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(user_id,season_id,level)
);
ALTER TABLE public.draughts_pass_claims ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Players read their season pass claims" ON public.draughts_pass_claims;
CREATE POLICY "Players read their season pass claims" ON public.draughts_pass_claims
 FOR SELECT TO authenticated USING ((select auth.uid())=user_id);
GRANT SELECT ON public.draughts_pass_claims TO authenticated;
REVOKE INSERT,UPDATE,DELETE ON public.draughts_pass_claims FROM anon,authenticated;

CREATE OR REPLACE FUNCTION public.claim_draughts_pass_reward(p_level integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_user uuid := (select auth.uid()); v_season uuid; v_xp integer; v_required integer;
 v_coins integer; v_balance bigint;
BEGIN
 IF v_user IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
 IF p_level<1 OR p_level>10 THEN RAISE EXCEPTION 'Invalid season pass level'; END IF;
 SELECT id INTO v_season FROM public.draughts_seasons WHERE is_active ORDER BY starts_at DESC LIMIT 1;
 IF v_season IS NULL THEN RAISE EXCEPTION 'No active season'; END IF;
 SELECT coalesce(xp,0) INTO v_xp FROM public.draughts_player_stats WHERE season_id=v_season AND user_id=v_user;
 IF v_xp IS NULL THEN v_xp:=0; END IF;
 v_required := CASE p_level WHEN 1 THEN 100 WHEN 2 THEN 250 WHEN 3 THEN 450 WHEN 4 THEN 700
  WHEN 5 THEN 1000 WHEN 6 THEN 1400 WHEN 7 THEN 1850 WHEN 8 THEN 2350 WHEN 9 THEN 2900 ELSE 3500 END;
 v_coins := CASE p_level WHEN 1 THEN 50 WHEN 2 THEN 100 WHEN 3 THEN 150 WHEN 4 THEN 200
  WHEN 5 THEN 250 WHEN 6 THEN 300 WHEN 7 THEN 400 WHEN 8 THEN 500 WHEN 9 THEN 700 ELSE 1000 END;
 IF v_xp<v_required THEN RAISE EXCEPTION 'More XP is required for this level'; END IF;
 INSERT INTO public.draughts_pass_claims(user_id,season_id,level,coins_awarded)
 VALUES(v_user,v_season,p_level,v_coins) ON CONFLICT DO NOTHING;
 IF NOT FOUND THEN RAISE EXCEPTION 'Season pass reward already claimed'; END IF;
 INSERT INTO public.draughts_wallets(user_id,balance,lifetime_earned) VALUES(v_user,0,0)
  ON CONFLICT(user_id) DO NOTHING;
 UPDATE public.draughts_wallets SET balance=balance+v_coins,lifetime_earned=lifetime_earned+v_coins,updated_at=now()
  WHERE user_id=v_user RETURNING balance INTO v_balance;
 INSERT INTO public.draughts_coin_ledger(user_id,amount,balance_after,reason,source_type,source_id)
 VALUES(v_user,v_coins,'0'::bigint+v_balance,'Season Pass Level '||p_level,'season',v_season)
 ON CONFLICT DO NOTHING;
 RETURN jsonb_build_object('level',p_level,'coins',v_coins,'balance',v_balance,'xp',v_xp);
END $$;
REVOKE ALL ON FUNCTION public.claim_draughts_pass_reward(integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.claim_draughts_pass_reward(integer) TO authenticated;

