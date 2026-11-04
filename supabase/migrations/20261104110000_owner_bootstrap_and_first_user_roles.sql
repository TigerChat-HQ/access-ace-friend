-- Bootstrap the first registered user as the durable application owner.
-- This migration is intentionally in supabase/migrations because the deployment
-- workflow applies this directory, not drizzle/migrations.
CREATE TABLE IF NOT EXISTS public.owner_bootstrap (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  owner_user_id uuid REFERENCES auth.users(id)
);

GRANT ALL ON TABLE public.owner_bootstrap TO service_role;
ALTER TABLE public.owner_bootstrap ENABLE ROW LEVEL SECURITY;

-- Recover the owner for projects where the first user already exists.
INSERT INTO public.owner_bootstrap (singleton, owner_user_id)
SELECT true, p.user_id
FROM public.profiles AS p
ORDER BY p.created_at ASC, p.user_id ASC
LIMIT 1
ON CONFLICT (singleton) DO NOTHING;

-- Ensure the recovered owner has both the admin panel role and the
-- superior-admin role used by developer/command-center operations.
INSERT INTO public.user_roles (user_id, role)
SELECT owner_user_id, role
FROM public.owner_bootstrap
CROSS JOIN (VALUES ('admin'::public.app_role), ('superior_admin'::public.app_role)) AS roles(role)
WHERE owner_user_id IS NOT NULL
ON CONFLICT (user_id, role) DO NOTHING;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  base_username text;
  candidate text;
  suffix integer := 0;
  claimed_owner uuid;
BEGIN
  PERFORM pg_advisory_xact_lock(730194, 1);

  base_username := lower(regexp_replace(
    coalesce(
      NEW.raw_user_meta_data->>'username',
      NEW.raw_user_meta_data->>'display_name',
      split_part(NEW.email, '@', 1)
    ),
    '[^a-zA-Z0-9_]', '', 'g'
  ));
  IF base_username = '' OR base_username IS NULL THEN
    base_username := 'user' || substr(NEW.id::text, 1, 8);
  END IF;

  candidate := base_username;
  WHILE EXISTS (SELECT 1 FROM public.profiles WHERE username = candidate) LOOP
    suffix := suffix + 1;
    candidate := base_username || suffix::text;
  END LOOP;

  INSERT INTO public.profiles (user_id, display_name, username)
  VALUES (
    NEW.id,
    coalesce(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
    candidate
  );

  INSERT INTO public.owner_bootstrap (singleton, owner_user_id)
  VALUES (true, NEW.id)
  ON CONFLICT (singleton) DO NOTHING
  RETURNING owner_user_id INTO claimed_owner;

  IF claimed_owner = NEW.id THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin'), (NEW.id, 'superior_admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$function$;
