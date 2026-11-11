-- Give free-entry Pool tournaments a funded-by-game-system champion reward.
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
  INSERT INTO public.pool_tournaments(owner_id,title,mode,max_players,entry_fee,prize_pool)
  VALUES(v_user,trim(p_title),p_mode,p_max_players,p_entry_fee,CASE WHEN p_entry_fee=0 THEN 500 ELSE 0 END)
  RETURNING * INTO v_tournament;
  RETURN v_tournament;
END $$;
