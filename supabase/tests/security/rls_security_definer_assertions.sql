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

  -- All exposed SECURITY DEFINER routines must pin search_path to avoid object-shadowing.
  SELECT count(*) INTO bad_count
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE p.prosecdef
    AND n.nspname='public'
    AND NOT EXISTS (
      SELECT 1 FROM unnest(coalesce(p.proconfig, ARRAY[]::text[])) cfg
      WHERE cfg LIKE 'search_path=%'
    );
  IF bad_count > 0 THEN
    RAISE EXCEPTION '% public SECURITY DEFINER functions lack a pinned search_path', bad_count;
  END IF;

  -- SECURITY DEFINER entry points must never be executable by anon.
  SELECT count(*) INTO bad_count
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE p.prosecdef AND n.nspname='public'
    AND has_function_privilege('anon', p.oid, 'EXECUTE');
  IF bad_count > 0 THEN
    RAISE EXCEPTION '% public SECURITY DEFINER functions are executable by anon', bad_count;
  END IF;
END
$$;
