-- Run with Supabase SQL test runner; all fixture rows are rolled back.
BEGIN;
DO $$
DECLARE
  u1 uuid := '10000000-0000-4000-8000-000000000001';
  u2 uuid := '10000000-0000-4000-8000-000000000002';
  u3 uuid := '10000000-0000-4000-8000-000000000003';
  u4 uuid := '10000000-0000-4000-8000-000000000004';
  tournament_id uuid;
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

  INSERT INTO public.pool_tournaments(owner_id,title,mode,max_players,entry_fee)
  VALUES(u1,'Smoke test bracket','eight_ball',4,0) RETURNING id INTO tournament_id;
  INSERT INTO public.pool_tournament_entries(tournament_id,user_id,seed_rating)
  VALUES(tournament_id,u1,1200),(tournament_id,u2,1100),(tournament_id,u3,1000),(tournament_id,u4,900);

  PERFORM set_config('request.jwt.claim.sub',u1::text,true);
  result := public.start_pool_tournament(tournament_id);
  IF result->>'status'<>'active' THEN RAISE EXCEPTION 'Tournament did not start'; END IF;
  SELECT count(*) INTO first_round_count FROM public.pool_tournament_matches
    WHERE tournament_id=tournament_id AND round_no=1;
  IF first_round_count<>2 THEN RAISE EXCEPTION 'Expected 2 first-round matches'; END IF;

  FOR item IN SELECT match_id,player_one FROM public.pool_tournament_matches
    WHERE tournament_id=tournament_id AND round_no=1 ORDER BY match_no
  LOOP
    UPDATE public.pool_matches SET status='finished',winner_id=item.player_one,finished_at=now()
      WHERE id=item.match_id;
    result := public.pool_settle_match(item.match_id);
    IF result->>'settled'<>'true' THEN RAISE EXCEPTION 'First-round match did not settle'; END IF;
  END LOOP;

  SELECT match_id,player_one INTO final_match_id,final_player FROM public.pool_tournament_matches
    WHERE tournament_id=tournament_id AND round_no=2;
  IF final_match_id IS NULL THEN RAISE EXCEPTION 'Final match was not generated'; END IF;
  UPDATE public.pool_matches SET status='finished',winner_id=final_player,finished_at=now()
    WHERE id=final_match_id;
  result := public.pool_settle_match(final_match_id);
  IF result->>'settled'<>'true' THEN RAISE EXCEPTION 'Final match did not settle'; END IF;
  IF (SELECT status FROM public.pool_tournaments WHERE id=tournament_id)<>'completed'
    THEN RAISE EXCEPTION 'Tournament did not complete'; END IF;
  IF (SELECT count(*) FROM public.pool_match_results r JOIN public.pool_tournament_matches tm
      ON tm.match_id=r.match_id WHERE tm.tournament_id=tournament_id)<>3
    THEN RAISE EXCEPTION 'Expected three persisted match results'; END IF;
  result := public.pool_settle_match(final_match_id);
  IF result->>'duplicate'<>'true' THEN RAISE EXCEPTION 'Settlement must be idempotent'; END IF;
END $$;
ROLLBACK;
