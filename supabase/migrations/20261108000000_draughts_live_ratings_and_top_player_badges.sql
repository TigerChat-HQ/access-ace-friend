-- Seasonal live Draughts rating, match ledger, divisions and Top Player awards.
ALTER TABLE public.draft_matches
  ADD COLUMN IF NOT EXISTS revision integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS join_code text,
  ADD COLUMN IF NOT EXISTS draw_offer_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;
UPDATE public.draft_matches SET join_code=upper(substr(replace(id::text,'-',''),1,8))
WHERE join_code IS NULL OR btrim(join_code)='';
ALTER TABLE public.draft_matches
  ALTER COLUMN join_code SET DEFAULT upper(substr(replace(gen_random_uuid()::text,'-',''),1,8)),
  ALTER COLUMN join_code SET NOT NULL,
  ALTER COLUMN current_turn SET DEFAULT 'w';
CREATE UNIQUE INDEX IF NOT EXISTS draft_matches_join_code_key ON public.draft_matches(upper(join_code));

CREATE TABLE IF NOT EXISTS public.draughts_seasons (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL,
 starts_at timestamptz NOT NULL DEFAULT now(), ends_at timestamptz,
 is_active boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now(),
 CHECK (ends_at IS NULL OR ends_at>=starts_at)
);
CREATE UNIQUE INDEX IF NOT EXISTS draughts_one_active_season ON public.draughts_seasons(is_active) WHERE is_active;
INSERT INTO public.draughts_seasons(name) SELECT 'Season 1'
WHERE NOT EXISTS(SELECT 1 FROM public.draughts_seasons WHERE is_active);

CREATE TABLE IF NOT EXISTS public.draughts_player_stats (
 season_id uuid NOT NULL REFERENCES public.draughts_seasons(id) ON DELETE CASCADE,
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 rating_points integer NOT NULL DEFAULT 300 CHECK(rating_points>=0),
 wins integer NOT NULL DEFAULT 0 CHECK(wins>=0),
 losses integer NOT NULL DEFAULT 0 CHECK(losses>=0),
 draws integer NOT NULL DEFAULT 0 CHECK(draws>=0),
 updated_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(season_id,user_id)
);
CREATE INDEX IF NOT EXISTS draughts_player_stats_leaderboard
 ON public.draughts_player_stats(season_id,rating_points DESC,wins DESC,losses ASC);

CREATE TABLE IF NOT EXISTS public.draughts_match_results (
 match_id uuid PRIMARY KEY REFERENCES public.draft_matches(id) ON DELETE CASCADE,
 season_id uuid NOT NULL REFERENCES public.draughts_seasons(id),
 player_white uuid NOT NULL REFERENCES auth.users(id),
 player_black uuid NOT NULL REFERENCES auth.users(id),
 winner text NOT NULL CHECK(winner IN ('white','black','draw')),
 white_points integer NOT NULL, black_points integer NOT NULL, completed_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.draughts_player_badges (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 season_id uuid NOT NULL REFERENCES public.draughts_seasons(id) ON DELETE CASCADE,
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 rank integer NOT NULL CHECK(rank BETWEEN 1 AND 100),
 badge_name text NOT NULL DEFAULT 'Top Player',
 show_on_profile boolean NOT NULL DEFAULT false,
 awarded_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(season_id,user_id), UNIQUE(season_id,rank)
);

ALTER TABLE public.draughts_seasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.draughts_player_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.draughts_match_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.draughts_player_badges ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Draughts seasons are public" ON public.draughts_seasons;
CREATE POLICY "Draughts seasons are public" ON public.draughts_seasons FOR SELECT TO authenticated USING(true);
DROP POLICY IF EXISTS "Draughts player stats are public" ON public.draughts_player_stats;
CREATE POLICY "Draughts player stats are public" ON public.draughts_player_stats FOR SELECT TO authenticated USING(true);
DROP POLICY IF EXISTS "Draughts results are public" ON public.draughts_match_results;
CREATE POLICY "Draughts results are public" ON public.draughts_match_results FOR SELECT TO authenticated USING(true);
DROP POLICY IF EXISTS "Draughts badges are public" ON public.draughts_player_badges;
CREATE POLICY "Draughts badges are public" ON public.draughts_player_badges FOR SELECT TO authenticated USING(true);
DROP POLICY IF EXISTS "Players choose to show their own Draughts badge" ON public.draughts_player_badges;
CREATE POLICY "Players choose to show their own Draughts badge" ON public.draughts_player_badges
 FOR UPDATE TO authenticated USING((select auth.uid())=user_id) WITH CHECK((select auth.uid())=user_id);
GRANT SELECT ON public.draughts_seasons,public.draughts_player_stats,public.draughts_match_results,public.draughts_player_badges TO authenticated;
GRANT UPDATE(show_on_profile) ON public.draughts_player_badges TO authenticated;

CREATE OR REPLACE FUNCTION public.record_draughts_match_result()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $fn$
DECLARE v_season uuid; v_wp integer; v_bp integer; v_saved uuid;
BEGIN
 IF OLD.status='finished' OR NEW.status<>'finished' OR NEW.vs_ai OR NEW.player_black IS NULL
   OR NEW.winner NOT IN('white','black','draw') THEN RETURN NEW; END IF;
 SELECT id INTO v_season FROM public.draughts_seasons WHERE is_active ORDER BY starts_at DESC LIMIT 1;
 IF v_season IS NULL THEN RETURN NEW; END IF;
 IF NEW.winner='white' THEN v_wp:=30;v_bp:=-25;
 ELSIF NEW.winner='black' THEN v_wp:=-25;v_bp:=30;
 ELSE v_wp:=10;v_bp:=10; END IF;
 INSERT INTO public.draughts_match_results(match_id,season_id,player_white,player_black,winner,white_points,black_points)
 VALUES(NEW.id,v_season,NEW.player_white,NEW.player_black,NEW.winner,v_wp,v_bp)
 ON CONFLICT(match_id) DO NOTHING RETURNING match_id INTO v_saved;
 IF v_saved IS NULL THEN RETURN NEW; END IF;
 INSERT INTO public.draughts_player_stats(season_id,user_id,rating_points,wins,losses,draws)
 VALUES(v_season,NEW.player_white,greatest(0,300+v_wp),(NEW.winner='white')::integer,(NEW.winner='black')::integer,(NEW.winner='draw')::integer)
 ON CONFLICT(season_id,user_id) DO UPDATE SET rating_points=greatest(0,draughts_player_stats.rating_points+v_wp),
 wins=draughts_player_stats.wins+(NEW.winner='white')::integer,
 losses=draughts_player_stats.losses+(NEW.winner='black')::integer,
 draws=draughts_player_stats.draws+(NEW.winner='draw')::integer,updated_at=now();
 INSERT INTO public.draughts_player_stats(season_id,user_id,rating_points,wins,losses,draws)
 VALUES(v_season,NEW.player_black,greatest(0,300+v_bp),(NEW.winner='black')::integer,(NEW.winner='white')::integer,(NEW.winner='draw')::integer)
 ON CONFLICT(season_id,user_id) DO UPDATE SET rating_points=greatest(0,draughts_player_stats.rating_points+v_bp),
 wins=draughts_player_stats.wins+(NEW.winner='black')::integer,
 losses=draughts_player_stats.losses+(NEW.winner='white')::integer,
 draws=draughts_player_stats.draws+(NEW.winner='draw')::integer,updated_at=now();
 RETURN NEW;
END;
$fn$;
DROP TRIGGER IF EXISTS draft_match_record_result ON public.draft_matches;
CREATE TRIGGER draft_match_record_result AFTER UPDATE OF status,winner ON public.draft_matches
 FOR EACH ROW EXECUTE FUNCTION public.record_draughts_match_result();

CREATE OR REPLACE FUNCTION public.draughts_division(p_points integer)
RETURNS text LANGUAGE sql IMMUTABLE AS $fn$
 SELECT CASE WHEN p_points>=600 THEN 'Division 1' WHEN p_points>=401 THEN 'Division 2'
 WHEN p_points>=300 THEN 'Division 3' ELSE 'Unranked' END;
$fn$;

CREATE OR REPLACE FUNCTION public.close_draughts_season(p_season_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $fn$
DECLARE v_season public.draughts_seasons%ROWTYPE; v_count integer; v_next integer;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=(select auth.uid())
   AND role::text IN('admin','superior_admin')) THEN RAISE EXCEPTION 'Only administrators can close a Draughts season'; END IF;
 SELECT * INTO v_season FROM public.draughts_seasons
 WHERE is_active AND (p_season_id IS NULL OR id=p_season_id) FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'No active Draughts season found'; END IF;
 WITH ranked AS(SELECT user_id,row_number() OVER(ORDER BY rating_points DESC,wins DESC,losses ASC,updated_at ASC) AS pos
   FROM public.draughts_player_stats WHERE season_id=v_season.id)
 INSERT INTO public.draughts_player_badges(season_id,user_id,rank,badge_name)
 SELECT v_season.id,user_id,pos,'Top Player' FROM ranked WHERE pos<=100
 ON CONFLICT(season_id,user_id) DO NOTHING;
 GET DIAGNOSTICS v_count=ROW_COUNT;
 UPDATE public.draughts_seasons SET is_active=false,ends_at=now() WHERE id=v_season.id;
 SELECT coalesce(max(substring(name from '[0-9]+')::integer),1)+1 INTO v_next FROM public.draughts_seasons;
 INSERT INTO public.draughts_seasons(name,starts_at) VALUES('Season '||v_next,now());
 RETURN jsonb_build_object('closed_season',v_season.id,'badges_awarded',v_count);
END;
$fn$;
REVOKE ALL ON FUNCTION public.close_draughts_season(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.close_draughts_season(uuid) TO authenticated;
