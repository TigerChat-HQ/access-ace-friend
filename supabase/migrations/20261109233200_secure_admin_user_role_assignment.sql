-- Keep role writes behind one authenticated, atomic RPC. The RPC checks the
-- caller's stored role, validates both the requested role and target, and protects
-- superior_admin rows. Direct authenticated table writes remain closed.
CREATE OR REPLACE FUNCTION public.set_admin_user_role(p_user_id uuid, p_role text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  actor_id uuid := auth.uid();
BEGIN
  IF actor_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required'
      USING ERRCODE = '42501';
  END IF;

  IF NOT (
    public.has_role(actor_id, 'admin'::public.app_role)
    OR public.has_role(actor_id, 'superior_admin'::public.app_role)
  ) THEN
    RAISE EXCEPTION 'Admin access required to manage user roles'
      USING ERRCODE = '42501';
  END IF;

  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'Target user is required'
      USING ERRCODE = '22023';
  END IF;

  IF p_role IS NULL OR p_role NOT IN ('none', 'admin', 'moderator', 'adviser') THEN
    RAISE EXCEPTION 'Unsupported role'
      USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = p_user_id
      AND role = 'superior_admin'::public.app_role
  ) THEN
    RAISE EXCEPTION 'Superior Admin roles are protected'
      USING ERRCODE = '42501';
  END IF;

  DELETE FROM public.user_roles
  WHERE user_id = p_user_id
    AND role::text IN ('admin', 'moderator', 'adviser');

  IF p_role <> 'none' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (p_user_id, p_role::public.app_role);
  END IF;
END;
$function$;

-- Remove authenticated table-write policies and grants so clients must use the
-- validated RPC. Keep SELECT policies/grants and any PUBLIC DML grants used by
-- SECURITY DEFINER owners; revoke TRUNCATE because RLS does not govern it.
DROP POLICY IF EXISTS "Only admins manage roles - insert" ON public.user_roles;
DROP POLICY IF EXISTS "Only admins manage roles - update" ON public.user_roles;
DROP POLICY IF EXISTS "Only admins manage roles - delete" ON public.user_roles;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.user_roles FROM anon, authenticated;
REVOKE TRUNCATE ON TABLE public.user_roles FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.set_admin_user_role(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_admin_user_role(uuid, text) TO authenticated;
