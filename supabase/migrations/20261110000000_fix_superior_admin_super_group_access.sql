-- Allow the protected Superior Admin account to open and administer
-- the dedicated Admin Super Group without changing or reassigning user roles.
CREATE OR REPLACE FUNCTION public.ensure_admin_super_group()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  me uuid := auth.uid();
  super_id uuid;
BEGIN
  IF me IS NULL OR NOT (
    public.has_role(me, 'admin'::public.app_role)
    OR public.has_role(me, 'moderator'::public.app_role)
    OR public.has_role(me, 'adviser'::public.app_role)
    OR public.has_role(me, 'superior_admin'::public.app_role)
  ) THEN
    RAISE EXCEPTION 'Elevated role required';
  END IF;

  SELECT c.id
    INTO super_id
    FROM public.conversations AS c
   WHERE c.type = 'group'
     AND c.name = '🛡️ Admin Super Group'
   LIMIT 1;

  IF super_id IS NULL THEN
    INSERT INTO public.conversations (type, name)
    VALUES ('group', '🛡️ Admin Super Group')
    RETURNING id INTO super_id;
  END IF;

  INSERT INTO public.conversation_members (conversation_id, user_id)
  VALUES (super_id, me)
  ON CONFLICT DO NOTHING;

  -- The Superior Admin must be recognized as a group admin by downstream
  -- group-management checks, just like a regular admin.
  IF public.has_role(me, 'admin'::public.app_role)
     OR public.has_role(me, 'superior_admin'::public.app_role) THEN
    INSERT INTO public.group_admins (conversation_id, user_id)
    VALUES (super_id, me)
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN super_id;
END;
$$;

-- Keep the RPC callable only by signed-in users; authorization is checked
-- inside the function against the protected user_roles table.
REVOKE ALL ON FUNCTION public.ensure_admin_super_group() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ensure_admin_super_group() TO authenticated;
