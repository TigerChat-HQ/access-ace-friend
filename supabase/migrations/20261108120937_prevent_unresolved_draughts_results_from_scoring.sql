-- Never interpret a finished match without a declared winner as a draw.
CREATE OR REPLACE FUNCTION public.record_draughts_match_result()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $fn$
DECLARE v_season uuid; v_wp integer; v_bp integer; v_saved uuid;
BEGIN
 IF OLD.status='finished' OR NEW.status<>'finished' OR NEW.vs_ai OR NEW.player_black IS NULL
   OR NEW.winner IS NULL OR NEW.winner NOT IN('white','black','draw') THEN RETURN NEW; END IF;
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
REVOKE ALL ON FUNCTION public.record_draughts_match_result() FROM PUBLIC,anon,authenticated;