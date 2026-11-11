-- Rollback-only integration coverage for active Pool turn clocks and timeout settlement.
BEGIN;
DO $$
DECLARE
  u1 uuid := '20000000-0000-4000-8000-000000000001';
  u2 uuid := '20000000-0000-4000-8000-000000000002';
  u3 uuid := '20000000-0000-4000-8000-000000000003';
  u4 uuid := '20000000-0000-4000-8000-000000000004';
  m1 uuid;
  m2 uuid;
  timed public.pool_matches%ROWTYPE;
BEGIN
  INSERT INTO auth.users(id,email,raw_app_meta_data,raw_user_meta_data)
  VALUES (u1,'pool-clock-1@example.invalid','{}','{}'),
         (u2,'pool-clock-2@example.invalid','{}','{}'),
         (u3,'pool-clock-3@example.invalid','{}','{}'),
         (u4,'pool-clock-4@example.invalid','{}','{}');

  INSERT INTO public.pool_matches(player_one,player_two,mode,status,visibility,current_turn,
    clock_seconds,player_one_clock_ms,player_two_clock_ms,clock_started_at)
  VALUES(u1,u2,'eight_ball','active','private',u1,30,1000,30000,now()-interval '5 seconds')
  RETURNING id INTO m1;
  SELECT * INTO timed FROM public.pool_check_timeout(m1);
  IF timed.status<>'finished' OR timed.winner_id<>u2 THEN
    RAISE EXCEPTION 'Idle turn timeout did not award the opponent';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM public.pool_match_events WHERE match_id=m1 AND event_type='timeout') THEN
    RAISE EXCEPTION 'Timeout event was not persisted';
  END IF;

  INSERT INTO public.pool_matches(player_one,player_two,mode,status,visibility,current_turn,
    clock_seconds,player_one_clock_ms,player_two_clock_ms,clock_started_at)
  VALUES(u3,u4,'nine_ball','active','private',u3,30,1000,30000,now()-interval '5 seconds')
  RETURNING id INTO m2;
  SELECT * INTO timed FROM public.pool_commit_server_shot(
    m2,u3,0,'{"mode":"nine_ball","balls":[{},{}]}'::jsonb,u4,'active',NULL,'shot',
    '{"request_id":"expired-shot","angle":0,"power":50}'::jsonb
  );
  IF timed.status<>'finished' OR timed.winner_id<>u4 THEN
    RAISE EXCEPTION 'Expired shot was not converted into a server timeout';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM public.pool_match_events WHERE match_id=m2 AND event_type='timeout'
    AND payload->>'request_id'='expired-shot') THEN
    RAISE EXCEPTION 'Expired shot timeout event missing';
  END IF;
  PERFORM public.pool_settle_match(m2);
  IF NOT EXISTS(SELECT 1 FROM public.pool_match_results WHERE match_id=m2 AND winner_id=u4) THEN
    RAISE EXCEPTION 'Timeout result did not update persistent ratings/rewards';
  END IF;
END $$;
ROLLBACK;
