REVOKE ALL ON FUNCTION public.ensure_admin_super_group() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_conversation_member(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ensure_admin_super_group(), public.has_role(uuid, public.app_role),
 public.is_conversation_member(uuid, uuid) TO authenticated;