-- Ensure every authenticated account starts the active Draughts season at Division 3 / 300 points.
CREATE OR REPLACE FUNCTION public.initialize_draughts_player_stats()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_season_id uuid;
BEGIN
  SELECT id INTO v_season_id
  FROM public.draughts_seasons
  WHERE is_active = true
  ORDER BY starts_at DESC
  LIMIT 1;

  IF v_season_id IS NOT NULL THEN
    INSERT INTO public.draughts_player_stats
      (season_id, user_id, rating_points, wins, losses, draws)
    VALUES (v_season_id, NEW.id, 300, 0, 0, 0)
    ON CONFLICT (season_id, user_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS on_auth_user_created_initialize_draughts_stats ON auth.users;
CREATE TRIGGER on_auth_user_created_initialize_draughts_stats
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.initialize_draughts_player_stats();

-- Backfill existing accounts missing a row in the active season.
INSERT INTO public.draughts_player_stats
  (season_id, user_id, rating_points, wins, losses, draws)
SELECT s.id, u.id, 300, 0, 0, 0
FROM public.draughts_seasons s
CROSS JOIN auth.users u
WHERE s.is_active = true
ON CONFLICT (season_id, user_id) DO NOTHING;

REVOKE ALL ON FUNCTION public.initialize_draughts_player_stats() FROM PUBLIC, anon, authenticated;
