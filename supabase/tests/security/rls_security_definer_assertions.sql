-- Security regression assertions for the RLS/SECURITY DEFINER hardening.
DO $$
DECLARE
  t record;
  bad_count integer;
BEGIN
  FOR t IN
    SELECT * FROM (VALUES
      ('private'::text, 'chat_presence'::text, 'chat_presence_service_role_only'::text),
      ('public'::text, 'tiger_ai_daily_config'::text, 'tiger_ai_daily_config_service_role_only'::text),
      ('public'::text, 'tiger_books_ai_config'::text, 'tiger_books_ai_config_service_role_only'::text)
    ) AS expected(schema_name, table_name, policy_name)
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname=t.schema_name AND tablename=t.table_name
        AND policyname=t.policy_name AND roles @> ARRAY['service_role']::name[]
    ) THEN
      RAISE EXCEPTION 'Missing service-role-only policy: %.%', t.schema_name, t.table_name;
    END IF;
    IF EXISTS (
      SELECT 1 FROM information_schema.role_table_grants
      WHERE table_schema=t.schema_name AND table_name=t.table_name
        AND grantee IN ('anon','authenticated')
    ) THEN
      RAISE EXCEPTION 'Client table grant found on %.%', t.schema_name, t.table_name;
    END IF;
  END LOOP;

  SELECT count(*) INTO bad_count
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE p.prosecdef AND n.nspname='public'
    AND NOT EXISTS (
      SELECT 1 FROM unnest(coalesce(p.proconfig, ARRAY[]::text[])) cfg
      WHERE cfg LIKE 'search_path=%'
    );
  IF bad_count > 0 THEN
    RAISE EXCEPTION '% public SECURITY DEFINER functions lack a pinned search_path', bad_count;
  END IF;

  SELECT count(*) INTO bad_count
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE p.prosecdef AND n.nspname='public'
    AND has_function_privilege('anon', p.oid, 'EXECUTE');
  IF bad_count > 0 THEN
    RAISE EXCEPTION '% public SECURITY DEFINER functions are executable by anon', bad_count;
  END IF;

  -- These helper RPCs may only answer questions about the authenticated caller.
  IF position('_user_id = auth.uid()' IN pg_get_functiondef('public.has_role(uuid, public.app_role)'::regprocedure)) = 0
     OR position('_user_id = auth.uid()' IN pg_get_functiondef('public.is_conversation_member(uuid, uuid)'::regprocedure)) = 0
     OR position('p_member_id = auth.uid()' IN pg_get_functiondef('public.is_story_audience_member(uuid, uuid, text)'::regprocedure)) = 0 THEN
    RAISE EXCEPTION 'Caller-scope guard missing from a SECURITY DEFINER helper';
  END IF;
END
$$;

-- Behavioral regression: a caller cannot probe another user''s role, conversation
-- membership, or selected-story audience membership.
DO $$
DECLARE
  v_admin uuid := '00000000-0000-0000-0000-000000000001';
  v_member uuid := '00000000-0000-0000-0000-000000000002';
  v_conversation uuid := '00000000-0000-0000-0000-000000000101';
  v_story uuid := '00000000-0000-0000-0000-000000000201';
BEGIN
  PERFORM set_config('request.jwt.claim.sub', v_member::text, true);
  IF public.has_role(v_admin, 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'A non-admin caller probed another user admin role';
  END IF;
  IF public.is_conversation_member(v_conversation, v_admin) THEN
    RAISE EXCEPTION 'A caller probed another user''s conversation membership';
  END IF;
  IF public.is_story_audience_member(v_story, v_admin, 'include') THEN
    RAISE EXCEPTION 'A caller probed another user''s story audience membership';
  END IF;

  PERFORM set_config('request.jwt.claim.sub', v_admin::text, true);
  IF NOT public.has_role(v_admin, 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'A user cannot read their own admin role';
  END IF;
  IF NOT public.is_conversation_member(v_conversation, v_admin) THEN
    RAISE EXCEPTION 'A member cannot read their own conversation membership';
  END IF;
  IF NOT public.is_story_audience_member(v_story, v_admin, 'include') THEN
    RAISE EXCEPTION 'A selected story member cannot verify their own audience membership';
  END IF;

  PERFORM set_config('request.jwt.claim.sub', '', true);
  IF public.has_role(v_admin, 'admin'::public.app_role)
     OR public.is_conversation_member(v_conversation, v_admin)
     OR public.is_story_audience_member(v_story, v_admin, 'include') THEN
    RAISE EXCEPTION 'An unauthenticated caller received a positive helper result';
  END IF;
END
$$;


-- Server-authoritative Draughts behavior: reject forged boards/results, illegal
-- movement, missed compulsory captures, no-move claims while moves exist, and
-- stale revisions; accept a legal move and a legal capture.
DO $$
DECLARE
  v_user uuid := '00000000-0000-0000-0000-000000000001';
  v_other uuid := '00000000-0000-0000-0000-000000000002';
  v_match_id uuid := '00000000-0000-0000-0000-000000000301';
  v_capture_id uuid := '00000000-0000-0000-0000-000000000302';
  v_board jsonb;
  v_next jsonb;
  v_capture_board jsonb;
  v_capture_next jsonb;
  v_result public.draft_matches;
BEGIN
  PERFORM set_config('request.jwt.claim.sub',v_user::text,true);

  SELECT jsonb_agg(
    CASE
      WHEN (i/8+i%8)%2=0 THEN 'null'::jsonb
      WHEN i/8<3 THEN jsonb_build_object('c','b','k',false)
      WHEN i/8>4 THEN jsonb_build_object('c','w','k',false)
      ELSE 'null'::jsonb
    END ORDER BY i
  ) INTO v_board FROM generate_series(0,63) i;
  v_next:=jsonb_set(jsonb_set(v_board,'{17}','null'::jsonb),'{24}', '{"c":"b","k":false}'::jsonb);

  INSERT INTO public.draft_matches(id,player_white,current_turn,revision,status,board,vs_ai)
  VALUES(v_match_id,v_user,'b',0,'active',v_board,true);

  -- Client cannot submit a made-up board even when its move coordinates look valid.
  BEGIN
    PERFORM public.commit_draft_move(v_match_id,0,'[]'::jsonb,'w',
      '{"from":17,"to":24,"captures":[],"promote":false}'::jsonb,'finished','black');
    RAISE EXCEPTION 'Forged board/result was accepted';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM='Forged board/result was accepted' THEN RAISE; END IF;
    IF SQLERRM NOT LIKE 'Client board does not match%' THEN RAISE; END IF;
  END;

  -- A genuine board cannot be marked as a win while the opponent still has moves.
  BEGIN
    PERFORM public.commit_draft_move(v_match_id,0,v_next,'w',
      '{"from":17,"to":24,"captures":[],"promote":false}'::jsonb,'finished','black');
    RAISE EXCEPTION 'Forged winner was accepted';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM='Forged winner was accepted' THEN RAISE; END IF;
    IF SQLERRM NOT LIKE 'Client-supplied match result%' THEN RAISE; END IF;
  END;

  -- Men cannot make two-square non-capturing moves.
  BEGIN
    PERFORM public.commit_draft_move(v_match_id,0,v_next,'w',
      '{"from":17,"to":35,"captures":[],"promote":false}'::jsonb,'active',NULL);
    RAISE EXCEPTION 'Illegal long man move was accepted';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM='Illegal long man move was accepted' THEN RAISE; END IF;
    IF SQLERRM NOT LIKE 'A man can move only one square%' THEN RAISE; END IF;
  END;

  -- A null move cannot be used to claim a loss when legal moves exist.
  BEGIN
    PERFORM public.commit_draft_move(v_match_id,0,v_board,'b',NULL,'finished','white');
    RAISE EXCEPTION 'False no-legal-move claim was accepted';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM='False no-legal-move claim was accepted' THEN RAISE; END IF;
    IF SQLERRM NOT LIKE 'Cannot claim no legal move%' THEN RAISE; END IF;
  END;

  -- Wrong participant cannot submit a move for the active side.
  PERFORM set_config('request.jwt.claim.sub',v_other::text,true);
  BEGIN
    PERFORM public.commit_draft_move(v_match_id,0,v_next,'w',
      '{"from":17,"to":24,"captures":[],"promote":false}'::jsonb,'active',NULL);
    RAISE EXCEPTION 'Non-participant move was accepted';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM='Non-participant move was accepted' THEN RAISE; END IF;
    IF SQLERRM NOT LIKE 'Not your turn or not a match participant%' THEN RAISE; END IF;
  END;
  PERFORM set_config('request.jwt.claim.sub',v_user::text,true);

  -- A legal opening move is accepted and persisted as server-derived board.
  SELECT * INTO v_result FROM public.commit_draft_move(v_match_id,0,v_next,'w',
    '{"from":17,"to":24,"captures":[],"promote":false}'::jsonb,'active',NULL);
  IF v_result.revision<>1 OR v_result.board<>v_next OR v_result.current_turn<>'w' THEN
    RAISE EXCEPTION 'Legal Draughts move was not persisted correctly';
  END IF;

  -- A stale revision cannot overwrite the accepted move.
  BEGIN
    PERFORM public.commit_draft_move(v_match_id,0,v_next,'w',
      '{"from":17,"to":24,"captures":[],"promote":false}'::jsonb,'active',NULL);
    RAISE EXCEPTION 'Stale revision was accepted';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM='Stale revision was accepted' THEN RAISE; END IF;
    IF SQLERRM NOT LIKE 'Board revision conflict%' THEN RAISE; END IF;
  END;

  -- A compulsory capture must be played; a non-capturing alternative is rejected.
  SELECT jsonb_agg(
    CASE
      WHEN i=17 THEN '{"c":"b","k":false}'::jsonb
      WHEN i=26 OR i=40 OR i=42 THEN '{"c":"w","k":false}'::jsonb
      ELSE 'null'::jsonb
    END ORDER BY i
  ) INTO v_capture_board FROM generate_series(0,63) i;
  v_capture_next:=jsonb_set(jsonb_set(jsonb_set(v_capture_board,'{17}','null'::jsonb),'{26}','null'::jsonb),'{35}','{"c":"b","k":false}'::jsonb);
  INSERT INTO public.draft_matches(id,player_white,current_turn,revision,status,board,vs_ai)
  VALUES(v_capture_id,v_user,'b',0,'active',v_capture_board,true);

  BEGIN
    PERFORM public.commit_draft_move(v_capture_id,0,v_capture_board,'w',
      '{"from":17,"to":8,"captures":[],"promote":false}'::jsonb,'active',NULL);
    RAISE EXCEPTION 'Non-capture move bypassed compulsory capture';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM='Non-capture move bypassed compulsory capture' THEN RAISE; END IF;
    IF SQLERRM NOT LIKE 'Illegal or incomplete capture sequence%' THEN RAISE; END IF;
  END;

  SELECT * INTO v_result FROM public.commit_draft_move(v_capture_id,0,v_capture_next,'w',
    '{"from":17,"to":35,"captures":[26],"promote":false}'::jsonb,'active',NULL);
  IF v_result.revision<>1 OR v_result.board<>v_capture_next OR v_result.board->26<>'null'::jsonb THEN
    RAISE EXCEPTION 'Legal Draughts capture was not applied correctly';
  END IF;
END
$$;
