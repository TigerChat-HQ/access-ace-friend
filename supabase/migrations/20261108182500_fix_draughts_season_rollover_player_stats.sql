-- Ensure closing a Draughts season initializes every existing account in the new season.
CREATE OR REPLACE FUNCTION public.close_draughts_season(p_season_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_season public.draughts_seasons%ROWTYPE;
  v_awards integer := 0;
  v_next integer;
  v_new_season_id uuid;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = (SELECT auth.uid())
      AND role::text IN ('admin', 'superior_admin')
  ) THEN
    RAISE EXCEPTION 'Only administrators can close a Draughts season';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.draughts_admin_settings
    WHERE id = true AND seasons_enabled = true
  ) THEN
    RAISE EXCEPTION 'Draughts season management is disabled by an administrator';
  END IF;

  SELECT * INTO v_season
  FROM public.draughts_seasons
  WHERE is_active AND (p_season_id IS NULL OR id = p_season_id)
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No active Draughts season found';
  END IF;

  INSERT INTO public.draughts_player_badges
    (season_id, user_id, rank, badge_name, badge_type_id)
  SELECT v_season.id, eligible.user_id, least(eligible.pos, 100), bt.badge_name, bt.id
  FROM public.draughts_badge_types bt
  CROSS JOIN LATERAL (
    SELECT s.user_id,
      row_number() OVER (
        ORDER BY s.rating_points DESC, s.wins DESC, s.losses ASC, s.updated_at ASC
      ) AS pos,
      s.rating_points,
      s.wins,
      coalesce((
        SELECT count(*)
        FROM public.draughts_match_results mr
        WHERE mr.season_id = v_season.id
          AND (mr.player_white = s.user_id OR mr.player_black = s.user_id)
      ), 0) AS played
    FROM public.draughts_player_stats s
    WHERE s.season_id = v_season.id
  ) eligible
  WHERE bt.is_enabled
    AND (
      (bt.award_rule = 'top_n' AND eligible.pos <= bt.threshold)
      OR (bt.award_rule = 'wins' AND eligible.wins >= bt.threshold)
      OR (bt.award_rule = 'rating' AND eligible.rating_points >= bt.threshold)
      OR (bt.award_rule = 'participation' AND eligible.played >= bt.threshold)
    )
  ON CONFLICT DO NOTHING;

  GET DIAGNOSTICS v_awards = ROW_COUNT;

  UPDATE public.draughts_seasons
  SET is_active = false, ends_at = now()
  WHERE id = v_season.id;

  SELECT coalesce(max(substring(name FROM '[0-9]+')::integer), 1) + 1
  INTO v_next
  FROM public.draughts_seasons;

  INSERT INTO public.draughts_seasons(name, starts_at)
  VALUES ('Season ' || v_next, now())
  RETURNING id INTO v_new_season_id;

  -- Every account starts each new season in Division 3 at 300 points.
  INSERT INTO public.draughts_player_stats
    (season_id, user_id, rating_points, wins, losses, draws)
  SELECT v_new_season_id, u.id, 300, 0, 0, 0
  FROM auth.users u
  ON CONFLICT (season_id, user_id) DO NOTHING;

  RETURN jsonb_build_object(
    'closed_season', v_season.id,
    'new_season', v_new_season_id,
    'badges_awarded', v_awards
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.close_draughts_season(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.close_draughts_season(uuid) TO authenticated;
