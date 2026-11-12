-- Harden the three intentionally service-managed tables flagged by Supabase's RLS linter.
-- No client roles receive policies or table grants. service_role is the only policy target.
-- This keeps cron/config secrets and private presence rows out of the public API.

DO $$
BEGIN
  IF to_regclass('private.chat_presence') IS NULL
     OR to_regclass('public.tiger_ai_daily_config') IS NULL
     OR to_regclass('public.tiger_books_ai_config') IS NULL THEN
    RAISE EXCEPTION 'Expected security tables are missing; refusing partial hardening';
  END IF;
END;
$$;

DROP POLICY IF EXISTS chat_presence_service_role_only ON private.chat_presence;
CREATE POLICY chat_presence_service_role_only
  ON private.chat_presence
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS tiger_ai_daily_config_service_role_only ON public.tiger_ai_daily_config;
CREATE POLICY tiger_ai_daily_config_service_role_only
  ON public.tiger_ai_daily_config
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS tiger_books_ai_config_service_role_only ON public.tiger_books_ai_config;
CREATE POLICY tiger_books_ai_config_service_role_only
  ON public.tiger_books_ai_config
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Explicitly ensure client roles have no table privileges, including future accidental grants.
REVOKE ALL ON TABLE private.chat_presence FROM anon, authenticated;
REVOKE ALL ON TABLE public.tiger_ai_daily_config FROM anon, authenticated;
REVOKE ALL ON TABLE public.tiger_books_ai_config FROM anon, authenticated;
