-- Repair collaborator RLS recursion and complete profile archive/pin API.
-- The INSERT policy must not query posts directly: posts SELECT policies read
-- post_collaborators, which otherwise creates an RLS recursion cycle.
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA private TO authenticated;

CREATE OR REPLACE FUNCTION private.is_post_owner(_post_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, auth
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.posts p
    WHERE p.id = _post_id AND p.user_id = auth.uid()
  );
$function$;
REVOKE ALL ON FUNCTION private.is_post_owner(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.is_post_owner(uuid) TO authenticated;

DROP POLICY IF EXISTS "Post owners invite collaborators" ON public.post_collaborators;
CREATE POLICY "Post owners invite collaborators"
  ON public.post_collaborators FOR INSERT TO authenticated
  WITH CHECK (
    inviter_id = (SELECT auth.uid())
    AND private.is_post_owner(post_id)
  );

ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS pinned_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_posts_owner_pinned
  ON public.posts (user_id, pinned_at DESC NULLS LAST, created_at DESC)
  WHERE archived_at IS NULL AND is_draft = false;

CREATE OR REPLACE FUNCTION public.get_profile_collaboration_post_ids(_profile_id uuid)
RETURNS TABLE(post_id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, auth
AS $function$
  SELECT p.id
  FROM public.post_collaborators pc
  JOIN public.posts p ON p.id = pc.post_id
  WHERE auth.uid() IS NOT NULL
    AND pc.invitee_id = _profile_id
    AND pc.status = 'accepted'
    AND p.is_draft = false
    AND p.archived_at IS NULL
    AND (p.scheduled_at IS NULL OR p.scheduled_at <= now())
    AND (
      p.user_id = auth.uid()
      OR _profile_id = auth.uid()
      OR p.audience = 'public'
      OR (
        p.audience = 'followers'
        AND EXISTS (
          SELECT 1 FROM public.follows f
          WHERE f.follower_id = auth.uid()
            AND f.following_id = p.user_id
        )
      )
    );
$function$;
REVOKE ALL ON FUNCTION public.get_profile_collaboration_post_ids(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_profile_collaboration_post_ids(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
