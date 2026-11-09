-- Prevent recursive RLS evaluation between stories and story_audience_members.
-- The helper is SECURITY DEFINER so its membership lookup bypasses the audience table's RLS.
CREATE OR REPLACE FUNCTION public.is_story_audience_member(
  p_story_id uuid,
  p_member_id uuid,
  p_audience_type text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.story_audience_members m
    WHERE m.story_id = p_story_id
      AND m.member_id = p_member_id
      AND m.audience_type = p_audience_type
  );
$function$;

REVOKE ALL ON FUNCTION public.is_story_audience_member(uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_story_audience_member(uuid, uuid, text) TO authenticated;

DROP POLICY IF EXISTS "Stories visible to selected audience" ON public.stories;
CREATE POLICY "Stories visible to selected audience"
ON public.stories
FOR SELECT TO authenticated
USING (
  expires_at > now()
  AND (
    user_id = (SELECT auth.uid())
    OR audience = 'everyone'
    OR (
      audience IN ('contacts', 'contacts_except')
      AND EXISTS (
        SELECT 1 FROM public.follows f
        WHERE f.follower_id = (SELECT auth.uid())
          AND f.following_id = stories.user_id
      )
      AND EXISTS (
        SELECT 1 FROM public.follows f
        WHERE f.follower_id = stories.user_id
          AND f.following_id = (SELECT auth.uid())
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.blocks b
        WHERE (b.blocker_id = (SELECT auth.uid()) AND b.blocked_id = stories.user_id)
           OR (b.blocker_id = stories.user_id AND b.blocked_id = (SELECT auth.uid()))
      )
      AND (
        audience = 'contacts'
        OR NOT public.is_story_audience_member(stories.id, (SELECT auth.uid()), 'exclude')
      )
    )
    OR (
      audience = 'selected'
      AND public.is_story_audience_member(stories.id, (SELECT auth.uid()), 'include')
      AND NOT EXISTS (
        SELECT 1 FROM public.blocks b
        WHERE (b.blocker_id = (SELECT auth.uid()) AND b.blocked_id = stories.user_id)
           OR (b.blocker_id = stories.user_id AND b.blocked_id = (SELECT auth.uid()))
      )
    )
  )
);
