-- Restrict SECURITY DEFINER helper RPCs to the caller's own identity.
-- These helpers are used by RLS policies with auth.uid(); callers must not probe
-- another user's role, conversation membership, or story-audience membership.

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $function$
  SELECT auth.uid() IS NOT NULL
     AND _user_id = auth.uid()
     AND EXISTS (
       SELECT 1 FROM public.user_roles
       WHERE user_id = auth.uid() AND role = _role
     );
$function$;

CREATE OR REPLACE FUNCTION public.is_conversation_member(_conversation_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $function$
  SELECT auth.uid() IS NOT NULL
     AND _user_id = auth.uid()
     AND EXISTS (
       SELECT 1 FROM public.conversation_members
       WHERE conversation_id = _conversation_id AND user_id = auth.uid()
     );
$function$;

CREATE OR REPLACE FUNCTION public.is_story_audience_member(
  p_story_id uuid,
  p_member_id uuid,
  p_audience_type text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $function$
  SELECT auth.uid() IS NOT NULL
     AND p_member_id = auth.uid()
     AND EXISTS (
       SELECT 1
       FROM public.story_audience_members
       WHERE story_id = p_story_id
         AND member_id = auth.uid()
         AND audience_type = p_audience_type
     );
$function$;

REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_conversation_member(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_story_audience_member(uuid, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_conversation_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_story_audience_member(uuid, uuid, text) TO authenticated;
