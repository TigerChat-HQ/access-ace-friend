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

-- Behavioral regression: a caller cannot probe another user's role, conversation
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
    RAISE EXCEPTION 'A caller probed another user's story audience membership';
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
