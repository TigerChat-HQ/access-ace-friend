-- Run with Supabase SQL test runner; all fixture rows are rolled back.
BEGIN;
DO $$
DECLARE
  u1 uuid := '10000000-0000-4000-8000-000000000001';
  u2 uuid := '10000000-0000-4000-8000-000000000002';
  u3 uuid := '10000000-0000-4000-8000-000000000003';
  u4 uuid := '10000000-0000-4000-8000-000000000004';
  v_tournament_id uuid;
  final_match_id uuid;
  final_player uuid;
  item record;
  result jsonb;
  first_round_count integer;
BEGIN
  INSERT INTO auth.users(id,email,raw_app_meta_data,raw_user_meta_data)
  VALUES (u1,'pool-smoke-1@example.invalid','{}','{}'),
         (u2,'pool-smoke-2@example.invalid','{}','{}'),
         (u3,'pool-smoke-3@example.invalid','{}','{}'),
         (u4,'pool-smoke-4@example.invalid','{}','{}');

  PERFORM set_config('request.jwt.claim.sub',u1::text,true);
  SELECT id INTO v_tournament_id FROM public.create_pool_tournament('Smoke test bracket','eight_ball',4,0);
  IF (SELECT prize_pool FROM public.pool_tournaments WHERE id=v_tournament_id)<>500
    THEN RAISE EXCEPTION 'Free-entry tournament must have a 500 coin champion prize'; END IF;
  INSERT INTO public.pool_tournament_entries(tournament_id,user_id,seed_rating)
  VALUES(v_tournament_id,u1,1200),(v_tournament_id,u2,1100),(v_tournament_id,u3,1000),(v_tournament_id,u4,900);
  result := public.start_pool_tournament(v_tournament_id);
  IF result->>'status'<>'active' THEN RAISE EXCEPTION 'Tournament did not start'; END IF;
  SELECT count(*) INTO first_round_count FROM public.pool_tournament_matches
    WHERE tournament_id=v_tournament_id AND round_no=1;
  IF first_round_count<>2 THEN RAISE EXCEPTION 'Expected 2 first-round matches'; END IF;

  FOR item IN SELECT match_id,player_one FROM public.pool_tournament_matches
    WHERE tournament_id=v_tournament_id AND round_no=1 ORDER BY match_no
  LOOP
    UPDATE public.pool_matches SET status='finished',winner_id=item.player_one,finished_at=now()
      WHERE id=item.match_id;
    result := public.pool_settle_match(item.match_id);
    IF result->>'settled'<>'true' THEN RAISE EXCEPTION 'First-round match did not settle'; END IF;
  END LOOP;

  SELECT match_id,player_one INTO final_match_id,final_player FROM public.pool_tournament_matches
    WHERE tournament_id=v_tournament_id AND round_no=2;
  IF final_match_id IS NULL THEN RAISE EXCEPTION 'Final match was not generated'; END IF;
  UPDATE public.pool_matches SET status='finished',winner_id=final_player,finished_at=now()
    WHERE id=final_match_id;
  result := public.pool_settle_match(final_match_id);
  IF result->>'settled'<>'true' THEN RAISE EXCEPTION 'Final match did not settle'; END IF;
  IF (SELECT status FROM public.pool_tournaments WHERE id=v_tournament_id)<>'completed'
    THEN RAISE EXCEPTION 'Tournament did not complete'; END IF;
  IF (SELECT count(*) FROM public.pool_match_results r JOIN public.pool_tournament_matches tm
      ON tm.match_id=r.match_id WHERE tm.tournament_id=v_tournament_id)<>3
    THEN RAISE EXCEPTION 'Expected three persisted match results'; END IF;
  IF (SELECT count(*) FROM public.pool_coin_ledger l JOIN public.pool_matches m
      ON l.source_id=m.id WHERE m.tournament_id=v_tournament_id AND l.source_type='match')<>6
    THEN RAISE EXCEPTION 'Expected winner and participation coin rewards for all three matches'; END IF;
  IF (SELECT coalesce(sum(r.games_played),0) FROM public.pool_player_ratings r
      WHERE r.user_id IN (u1,u2,u3,u4))<>6
    THEN RAISE EXCEPTION 'Elo games played totals do not match three completed matches'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.pool_coin_ledger WHERE user_id=final_player
      AND source_type='tournament' AND reason='tournament_champion' AND amount=500)
    THEN RAISE EXCEPTION 'Champion prize was not paid'; END IF;
  result := public.pool_settle_match(final_match_id);
  IF result->>'duplicate'<>'true' THEN RAISE EXCEPTION 'Settlement must be idempotent'; END IF;
END $$;
ROLLBACK;
